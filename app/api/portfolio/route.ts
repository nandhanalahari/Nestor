import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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

  // Read from stock_cache instead of calling Alpha Vantage
  const tickers = holdings.filter((h) => h.category !== "Cash").map((h) => h.ticker);
  const quotes: Quote[] = [];
  const warnings: string[] = [];

  if (tickers.length > 0) {
    const { data: cachedQuotes } = await supabase
      .from("stock_cache")
      .select("*")
      .in("ticker", tickers);

    const missingTickers: string[] = [];

    for (const h of holdings) {
      if (h.category === "Cash") continue;
      const cached = cachedQuotes?.find(
        (c: { ticker: string }) => c.ticker === h.ticker,
      );
      if (cached) {
        quotes.push({
          ticker: h.ticker,
          price: Number(cached.price),
          changePercent: Number(cached.change_percent),
          asOf: cached.as_of,
        });
      } else {
        missingTickers.push(h.ticker);
      }
    }

    // If cache is empty for some tickers, try to populate via the cache API internally
    if (missingTickers.length > 0) {
      try {
        const { getEODLatest } = await import("@/lib/marketstack");
        const eodData = await getEODLatest(missingTickers);
        for (const entry of eodData) {
          const changePct =
            entry.open > 0
              ? ((entry.close - entry.open) / entry.open) * 100
              : 0;
          const asOf = entry.date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);

          quotes.push({
            ticker: entry.symbol,
            price: entry.close,
            changePercent: Math.round(changePct * 100) / 100,
            asOf,
          });

          // Store in cache for next time
          await supabase.from("stock_cache").upsert(
            {
              ticker: entry.symbol,
              price: entry.close,
              change_percent: Math.round(changePct * 100) / 100,
              as_of: asOf,
              volume: entry.volume,
              high: entry.high,
              low: entry.low,
              open: entry.open,
              source: "marketstack",
              fetched_at: new Date().toISOString(),
            },
            { onConflict: "ticker" },
          );
        }

        // Any still missing after Marketstack
        for (const ticker of missingTickers) {
          if (!quotes.find((q) => q.ticker === ticker)) {
            warnings.push(`No price data available for ${ticker}`);
          }
        }
      } catch (err) {
        for (const ticker of missingTickers) {
          warnings.push(
            `No cached price for ${ticker}. Click "Refresh Prices" to fetch.`,
          );
        }
      }
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
