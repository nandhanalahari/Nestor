import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getEODLatest } from "@/lib/marketstack";

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

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { tickers?: string[] } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const tickers = body.tickers ?? [];
  if (tickers.length === 0) {
    return NextResponse.json({ error: "No tickers provided" }, { status: 400 });
  }

  const supabase = getSupabase(token);

  // Check what's already cached and fresh
  const { data: cached } = await supabase
    .from("stock_cache")
    .select("*")
    .in("ticker", tickers);

  const now = Date.now();
  const fresh: Record<string, { price: number; change_percent: number; as_of: string }> = {};
  const stale: string[] = [];

  for (const ticker of tickers) {
    const entry = cached?.find((c: { ticker: string }) => c.ticker === ticker);
    if (entry) {
      const age = now - new Date(entry.fetched_at).getTime();
      if (age < CACHE_TTL_MS) {
        fresh[ticker] = {
          price: Number(entry.price),
          change_percent: Number(entry.change_percent),
          as_of: entry.as_of,
        };
        continue;
      }
    }
    stale.push(ticker);
  }

  // Fetch fresh data from Marketstack for stale tickers
  if (stale.length > 0) {
    try {
      const eodData = await getEODLatest(stale);
      for (const entry of eodData) {
        const changePct =
          entry.open > 0
            ? ((entry.close - entry.open) / entry.open) * 100
            : 0;

        const row = {
          ticker: entry.symbol,
          price: entry.close,
          change_percent: Math.round(changePct * 100) / 100,
          as_of: entry.date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
          volume: entry.volume,
          high: entry.high,
          low: entry.low,
          open: entry.open,
          source: "marketstack",
          fetched_at: new Date().toISOString(),
        };

        await supabase
          .from("stock_cache")
          .upsert(row, { onConflict: "ticker" });

        fresh[entry.symbol] = {
          price: entry.close,
          change_percent: row.change_percent,
          as_of: row.as_of,
        };
      }
    } catch (err) {
      // If Marketstack fails, return whatever we have from cache
      for (const ticker of stale) {
        const entry = cached?.find((c: { ticker: string }) => c.ticker === ticker);
        if (entry) {
          fresh[ticker] = {
            price: Number(entry.price),
            change_percent: Number(entry.change_percent),
            as_of: entry.as_of,
          };
        }
      }
    }
  }

  return NextResponse.json({
    quotes: fresh,
    cached_count: tickers.length - stale.length,
    refreshed_count: stale.length,
  });
}
