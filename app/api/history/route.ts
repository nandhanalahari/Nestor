import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getLiveQuotes } from "@/lib/yahooFinance";
import {
  isMockApiRequest,
  mockHoldings,
  mockQuotes,
  MOCK_USER_ID,
} from "@/lib/mockData";
import { SNAPSHOT_ONCE_PER_WEEK_MESSAGE } from "@/lib/snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SnapshotRow = {
  id: string;
  user_id: string;
  ticker: string;
  name: string;
  week_start: string;
  week_end: string;
  shares: number;
  cost_basis: number;
  market_value: number;
  profit: number;
  profit_pct: number;
  portfolio_weight: number;
  portfolio_contribution: number;
};

let mockWeeklySnapshots: SnapshotRow[] = [];

function getUtcWeekRange(d = new Date()) {
  const day = d.getUTCDay();
  const start = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day),
  );
  const end = new Date(
    Date.UTC(
      start.getUTCFullYear(),
      start.getUTCMonth(),
      start.getUTCDate() + 6,
    ),
  );
  return {
    weekStartStr: start.toISOString().slice(0, 10),
    weekEndStr: end.toISOString().slice(0, 10),
  };
}

function getSupabase(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    "";
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

/** One row per ticker — duplicate tickers in `holdings` otherwise break Postgres upsert (ON CONFLICT … cannot affect row twice). */
function mergeDbHoldingsByTicker(
  dbHoldings: {
    ticker: string;
    name?: string | null;
    shares: number | string | null;
    cost_basis: number | string | null;
  }[],
): { ticker: string; name: string; shares: number; cost_basis: number }[] {
  const map = new Map<
    string,
    { ticker: string; name: string; shares: number; cost_basis: number }
  >();

  for (const h of dbHoldings) {
    const upper = String(h.ticker || "").toUpperCase();
    if (!upper) continue;

    const shares = Number(h.shares) || 0;
    const cost_basis = Number(h.cost_basis) || 0;
    const name = (h.name && String(h.name).trim()) || upper;

    const prev = map.get(upper);
    if (!prev) {
      map.set(upper, { ticker: upper, name, shares, cost_basis });
    } else {
      prev.shares += shares;
      prev.cost_basis += cost_basis;
      if (prev.name === prev.ticker && name !== upper) prev.name = name;
    }
  }

  return Array.from(map.values());
}

function buildMockSnapshotRows(weekStartStr: string, weekEndStr: string) {
  const merged = mergeDbHoldingsByTicker(
    mockHoldings.map((h) => ({
      ticker: h.ticker,
      name: h.name,
      shares: h.shares,
      cost_basis: Number(h.costBasis ?? h.amount) || 0,
    })),
  );

  let totalValue = 0;
  const withMv = merged.map((h) => {
    const quote = mockQuotes.find(
      (q) => q.ticker.toUpperCase() === h.ticker,
    );
    const marketValue =
      quote && h.shares > 0
        ? quote.price * h.shares
        : h.cost_basis;
    totalValue += marketValue;
    return { ...h, marketValue };
  });

  const rows: Omit<SnapshotRow, "id" | "user_id">[] = withMv.map((h) => {
    const costBasis = h.cost_basis;
    const profit = h.marketValue - costBasis;
    const profitPct = costBasis > 0 ? (profit / costBasis) * 100 : 0;
    const portfolioWeight =
      totalValue > 0 ? (h.marketValue / totalValue) * 100 : 0;
    const portfolioContribution =
      totalValue > 0 ? (profit / totalValue) * 100 : 0;

    return {
      ticker: h.ticker,
      name: h.name,
      week_start: weekStartStr,
      week_end: weekEndStr,
      shares: h.shares,
      cost_basis: costBasis,
      market_value: Math.round(h.marketValue * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      profit_pct: Math.round(profitPct * 100) / 100,
      portfolio_weight: Math.round(portfolioWeight * 100) / 100,
      portfolio_contribution:
        Math.round(portfolioContribution * 100) / 100,
    };
  });

  return rows.map((r) => ({
    ...r,
    id: crypto.randomUUID(),
    user_id: MOCK_USER_ID,
  }));
}

export async function GET(req: Request) {
  const { weekStartStr } = getUtcWeekRange();

  if (isMockApiRequest(req)) {
    const hasThisWeek = mockWeeklySnapshots.some(
      (s) =>
        s.user_id === MOCK_USER_ID &&
        String(s.week_start).slice(0, 10) === weekStartStr,
    );
    return NextResponse.json({
      snapshots: mockWeeklySnapshots,
      hasSnapshotForCurrentWeek: hasThisWeek,
      currentWeekStart: weekStartStr,
    });
  }

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabase = getSupabase(token);
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const { data: snapshots, error } = await supabase
    .from("weekly_snapshots")
    .select("*")
    .eq("user_id", user.id)
    .order("week_start", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const list = snapshots ?? [];
  const norm = (d: string | null | undefined) => String(d ?? "").slice(0, 10);
  const hasThisWeek = list.some((s) => norm(s.week_start) === weekStartStr);

  return NextResponse.json({
    snapshots: list,
    hasSnapshotForCurrentWeek: hasThisWeek,
    currentWeekStart: weekStartStr,
  });
}

export async function POST(req: Request) {
  if (isMockApiRequest(req)) {
    if (mockHoldings.length === 0) {
      return NextResponse.json(
        { error: "No holdings to snapshot" },
        { status: 400 },
      );
    }
    const { weekStartStr, weekEndStr } = getUtcWeekRange();
    const already = mockWeeklySnapshots.some(
      (s) =>
        s.user_id === MOCK_USER_ID &&
        String(s.week_start).slice(0, 10) === weekStartStr,
    );
    if (already) {
      return NextResponse.json(
        { error: SNAPSHOT_ONCE_PER_WEEK_MESSAGE },
        { status: 409 },
      );
    }
    const next = buildMockSnapshotRows(weekStartStr, weekEndStr);
    mockWeeklySnapshots = [...next, ...mockWeeklySnapshots];
    return NextResponse.json({
      saved: next.length,
      week: weekStartStr,
    });
  }

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabase = getSupabase(token);
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const { data: dbHoldings, error: holdingsError } = await supabase
    .from("holdings")
    .select("*")
    .eq("user_id", user.id);

  if (holdingsError) {
    return NextResponse.json(
      { error: holdingsError.message },
      { status: 500 },
    );
  }

  if (!dbHoldings || dbHoldings.length === 0) {
    return NextResponse.json(
      { error: "No holdings to snapshot" },
      { status: 400 },
    );
  }

  const { weekStartStr, weekEndStr } = getUtcWeekRange();

  const { data: existingThisWeek } = await supabase
    .from("weekly_snapshots")
    .select("ticker")
    .eq("user_id", user.id)
    .eq("week_start", weekStartStr)
    .limit(1);

  if (existingThisWeek && existingThisWeek.length > 0) {
    return NextResponse.json(
      { error: SNAPSHOT_ONCE_PER_WEEK_MESSAGE },
      { status: 409 },
    );
  }

  const mergedHoldings = mergeDbHoldingsByTicker(dbHoldings);

  if (mergedHoldings.length === 0) {
    return NextResponse.json(
      { error: "No holdings to snapshot" },
      { status: 400 },
    );
  }

  const tickers = mergedHoldings.map((h) => h.ticker);
  const liveQuotes = await getLiveQuotes(tickers);

  let totalPortfolioValue = 0;

  const holdingPrices = mergedHoldings.map((h) => {
    const live = liveQuotes.find(
      (q) => q.ticker.toUpperCase() === h.ticker,
    );
    const price = live ? live.price : 0;
    const shares = h.shares;
    const costBasis = h.cost_basis;
    const marketValue =
      price > 0 && shares > 0 ? price * shares : costBasis;
    totalPortfolioValue += marketValue;
    return {
      ticker: h.ticker,
      name: h.name,
      shares,
      cost_basis: costBasis,
      price,
      marketValue,
    };
  });

  const rows = holdingPrices.map((h) => {
    const costBasis = h.cost_basis;
    const profit = h.marketValue - costBasis;
    const profitPct = costBasis > 0 ? (profit / costBasis) * 100 : 0;
    const portfolioWeight =
      totalPortfolioValue > 0
        ? (h.marketValue / totalPortfolioValue) * 100
        : 0;
    const portfolioContribution =
      totalPortfolioValue > 0
        ? (profit / totalPortfolioValue) * 100
        : 0;

    return {
      user_id: user.id,
      ticker: h.ticker,
      name: h.name,
      week_start: weekStartStr,
      week_end: weekEndStr,
      shares: h.shares,
      cost_basis: costBasis,
      market_value: Math.round(h.marketValue * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      profit_pct: Math.round(profitPct * 100) / 100,
      portfolio_weight: Math.round(portfolioWeight * 100) / 100,
      portfolio_contribution:
        Math.round(portfolioContribution * 100) / 100,
    };
  });

  const { error } = await supabase.from("weekly_snapshots").insert(rows);

  if (error) {
    console.error("[history POST] insert error:", error.message);
    if (error.code === "23505") {
      return NextResponse.json(
        { error: SNAPSHOT_ONCE_PER_WEEK_MESSAGE },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ saved: rows.length, week: weekStartStr });
}
