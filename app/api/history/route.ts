import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function GET(req: Request) {
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

  return NextResponse.json({ snapshots: snapshots ?? [] });
}

export async function POST(req: Request) {
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

  // Fetch holdings
  const { data: dbHoldings } = await supabase
    .from("holdings")
    .select("*")
    .eq("user_id", user.id);

  if (!dbHoldings || dbHoldings.length === 0) {
    return NextResponse.json({ error: "No holdings to snapshot" }, { status: 400 });
  }

  // Fetch cached prices
  const tickers = dbHoldings.map((h: { ticker: string }) => h.ticker);
  const { data: cachedQuotes } = await supabase
    .from("stock_cache")
    .select("*")
    .in("ticker", tickers);

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay()); // Sunday
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6); // Saturday

  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  // Calculate total portfolio value
  let totalPortfolioValue = 0;
  const holdingValues: { ticker: string; marketValue: number }[] = [];

  for (const h of dbHoldings) {
    const cached = cachedQuotes?.find(
      (c: { ticker: string }) => c.ticker === h.ticker,
    );
    const price = cached ? Number(cached.price) : 0;
    const shares = Number(h.shares) || 0;
    const marketValue = price > 0 && shares > 0 ? price * shares : Number(h.cost_basis);
    totalPortfolioValue += marketValue;
    holdingValues.push({ ticker: h.ticker, marketValue });
  }

  const rows = dbHoldings.map((h: { ticker: string; name: string; shares: number; cost_basis: number }) => {
    const cached = cachedQuotes?.find(
      (c: { ticker: string }) => c.ticker === h.ticker,
    );
    const price = cached ? Number(cached.price) : 0;
    const shares = Number(h.shares) || 0;
    const costBasis = Number(h.cost_basis);
    const marketValue = price > 0 && shares > 0 ? price * shares : costBasis;
    const profit = marketValue - costBasis;
    const profitPct = costBasis > 0 ? (profit / costBasis) * 100 : 0;
    const portfolioWeight =
      totalPortfolioValue > 0 ? (marketValue / totalPortfolioValue) * 100 : 0;
    const portfolioContribution =
      totalPortfolioValue > 0 ? (profit / totalPortfolioValue) * 100 : 0;

    return {
      user_id: user.id,
      ticker: h.ticker,
      name: h.name,
      week_start: weekStartStr,
      week_end: weekEndStr,
      shares,
      cost_basis: costBasis,
      market_value: Math.round(marketValue * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      profit_pct: Math.round(profitPct * 100) / 100,
      portfolio_weight: Math.round(portfolioWeight * 100) / 100,
      portfolio_contribution: Math.round(portfolioContribution * 100) / 100,
    };
  });

  const { error } = await supabase
    .from("weekly_snapshots")
    .upsert(rows, { onConflict: "user_id,ticker,week_start" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ saved: rows.length, week: weekStartStr });
}
