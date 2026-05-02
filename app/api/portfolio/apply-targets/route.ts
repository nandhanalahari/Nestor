import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getLiveQuotes } from "@/lib/yahooFinance";

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

function normalizeTargets(raw: Record<string, number>): Record<string, number> {
  const entries = Object.entries(raw).filter(
    ([, p]) => typeof p === "number" && p > 0.25 && Number.isFinite(p),
  );
  const sum = entries.reduce((s, [, p]) => s + p, 0);
  if (sum <= 0) return {};
  const scale = Math.abs(sum - 100) < 2 ? 1 : 100 / sum;
  const out: Record<string, number> = {};
  for (const [t, p] of entries) {
    out[t.toUpperCase()] = p * scale;
  }
  return out;
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

  let body: { targets?: Record<string, number> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const targets = normalizeTargets(body.targets ?? {});
  if (Object.keys(targets).length === 0) {
    return NextResponse.json(
      { error: "targets must include positive percentage weights." },
      { status: 400 },
    );
  }

  const { data: rows, error: loadErr } = await supabase
    .from("holdings")
    .select("id,ticker,name,category,shares,cost_basis")
    .eq("user_id", user.id);

  if (loadErr) {
    return NextResponse.json({ error: loadErr.message }, { status: 500 });
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json(
      { error: "Add holdings first so we can value your portfolio." },
      { status: 400 },
    );
  }

  const tickers = [
    ...new Set([...rows.map((r: { ticker: string }) => r.ticker), ...Object.keys(targets)]),
  ];
  const quotes = await getLiveQuotes(tickers);
  const priceBy = new Map(quotes.map((q) => [q.ticker, q.price]));

  let totalValue = 0;
  for (const h of rows as { ticker: string; shares: number | null; cost_basis: number }[]) {
    const px = priceBy.get(h.ticker);
    const sh = Number(h.shares);
    const cb = Number(h.cost_basis);
    if (px && sh > 0) totalValue += px * sh;
    else totalValue += cb;
  }

  if (totalValue <= 0) {
    return NextResponse.json(
      { error: "Could not value portfolio (missing quotes or shares)." },
      { status: 400 },
    );
  }

  const metaByTicker = new Map(
    (rows as { ticker: string; name: string; category: string }[]).map((r) => [
      r.ticker,
      { name: r.name, category: r.category },
    ]),
  );

  const updates: {
    id: string;
    ticker: string;
    name: string;
    category: string;
    shares: number;
    cost_basis: number;
  }[] = [];

  for (const ticker of Object.keys(targets)) {
    const pct = targets[ticker];
    const px = priceBy.get(ticker);
    if (!px || px <= 0) {
      return NextResponse.json(
        { error: `No live price for ${ticker}; refresh and try again.` },
        { status: 400 },
      );
    }
    const targetValue = (pct / 100) * totalValue;
    const shares = Math.round((targetValue / px) * 10000) / 10000;
    const cost_basis = Math.round(shares * px * 100) / 100;
    const existing = (rows as { id: string; ticker: string }[]).find(
      (r) => r.ticker === ticker,
    );
    const meta = metaByTicker.get(ticker);
    const qmeta = quotes.find((q) => q.ticker === ticker);
    updates.push({
      id: existing?.id ?? "",
      ticker,
      name: meta?.name ?? qmeta?.longName ?? ticker,
      category: meta?.category ?? "Stock",
      shares,
      cost_basis,
    });
  }

  const keep = new Set(updates.map((u) => u.ticker));
  const toDelete = (rows as { id: string; ticker: string }[])
    .filter((r) => !keep.has(r.ticker))
    .map((r) => r.id);

  for (const id of toDelete) {
    const { error } = await supabase
      .from("holdings")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  for (const u of updates) {
    if (u.id) {
      const { error } = await supabase
        .from("holdings")
        .update({
          shares: u.shares,
          cost_basis: u.cost_basis,
          name: u.name,
          category: u.category,
        })
        .eq("id", u.id)
        .eq("user_id", user.id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      const { error } = await supabase.from("holdings").insert({
        user_id: user.id,
        ticker: u.ticker,
        name: u.name,
        category: u.category,
        shares: u.shares,
        cost_basis: u.cost_basis,
      });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({
    applied: true,
    totalValueApprox: Math.round(totalValue * 100) / 100,
    tickers: Object.keys(targets),
  });
}
