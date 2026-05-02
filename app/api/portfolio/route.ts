import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getLiveQuotes } from "@/lib/yahooFinance";
import type { Holding, Quote } from "@/lib/types";

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

  const { data: dbHoldings, error } = await supabase
    .from("holdings")
    .select("*")
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!dbHoldings || dbHoldings.length === 0) {
    return NextResponse.json({
      holdings: [],
      quotes: [],
      totalValue: 0,
      dailyChangePct: 0,
      asOf: new Date().toISOString().slice(0, 10),
      warnings: [],
    });
  }

  const totalCost = dbHoldings.reduce(
    (s: number, h: { cost_basis: number }) => s + Number(h.cost_basis),
    0,
  );

  const holdings: Holding[] = dbHoldings.map(
    (h: {
      id: string;
      ticker: string;
      name: string;
      category: string;
      shares: number;
      cost_basis: number;
    }) => ({
      id: h.id,
      ticker: h.ticker,
      name: h.name,
      category: h.category as Holding["category"],
      amount: Number(h.cost_basis),
      weight: totalCost > 0 ? Number(h.cost_basis) / totalCost : 0,
      shares: Number(h.shares),
      costBasis: Number(h.cost_basis),
    }),
  );

  // Live quotes from Yahoo Finance (free, no API key, with 1-min server cache)
  const tickers = holdings
    .filter((h) => h.category !== "Cash")
    .map((h) => h.ticker);

  const liveQuotes = await getLiveQuotes(tickers);
  const quotes: Quote[] = liveQuotes.map((q) => ({
    ticker: q.ticker,
    price: Math.round(q.price * 100) / 100,
    changePercent: Math.round(q.changePercent * 100) / 100,
    asOf: q.asOf,
  }));

  const warnings: string[] = [];
  for (const ticker of tickers) {
    if (!quotes.find((q) => q.ticker === ticker)) {
      warnings.push(`Could not fetch live price for ${ticker}`);
    }
  }

  let totalValue = 0;
  for (const h of holdings) {
    const q = quotes.find((q) => q.ticker === h.ticker);
    if (q && h.shares) {
      totalValue += q.price * h.shares;
    } else {
      totalValue += h.amount;
    }
  }

  const dailyChangePct =
    quotes.length > 0
      ? quotes.reduce((acc, q) => {
          const h = holdings.find((h) => h.ticker === q.ticker);
          return acc + q.changePercent * (h?.weight ?? 0);
        }, 0)
      : 0;

  return NextResponse.json({
    holdings,
    quotes,
    totalValue,
    dailyChangePct,
    asOf: quotes[0]?.asOf ?? new Date().toISOString().slice(0, 10),
    warnings,
  });
}
