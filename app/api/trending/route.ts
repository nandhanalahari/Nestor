import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getEODLatest } from "@/lib/marketstack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabaseAnon() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    "";
  return createClient(url, key);
}

const TRENDING_SYMBOLS = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "JPM",
  "V", "UNH", "JNJ", "WMT", "PG", "MA", "HD",
  "DIS", "NFLX", "ADBE", "CRM", "PYPL", "INTC", "AMD", "BA",
  "KO", "PEP",
];

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export async function GET() {
  const supabase = getSupabaseAnon();

  // Check if we have fresh trending data
  const { data: existing } = await supabase
    .from("trending_stocks")
    .select("*")
    .order("fetched_at", { ascending: false })
    .limit(1);

  const lastFetch = existing?.[0]?.fetched_at;
  const isFresh = lastFetch && Date.now() - new Date(lastFetch).getTime() < CACHE_TTL_MS;

  if (isFresh) {
    const { data: allTrending } = await supabase
      .from("trending_stocks")
      .select("*")
      .gte("fetched_at", new Date(Date.now() - CACHE_TTL_MS).toISOString())
      .order("change_percent", { ascending: false });

    const gainers = (allTrending ?? []).filter(
      (s: { change_percent: number }) => Number(s.change_percent) > 0,
    );
    const losers = (allTrending ?? [])
      .filter((s: { change_percent: number }) => Number(s.change_percent) < 0)
      .sort(
        (a: { change_percent: number }, b: { change_percent: number }) =>
          Number(a.change_percent) - Number(b.change_percent),
      );
    const mostActive = [...(allTrending ?? [])]
      .sort(
        (a: { volume: number }, b: { volume: number }) =>
          Number(b.volume) - Number(a.volume),
      )
      .slice(0, 10);

    return NextResponse.json({
      gainers: gainers.slice(0, 10),
      losers: losers.slice(0, 10),
      mostActive,
      asOf: lastFetch,
      source: "cache",
    });
  }

  // Fetch fresh data from Marketstack
  try {
    const eodData = await getEODLatest(TRENDING_SYMBOLS);

    const rows = eodData.map((entry) => {
      const changePct =
        entry.open > 0 ? ((entry.close - entry.open) / entry.open) * 100 : 0;
      return {
        ticker: entry.symbol,
        name: entry.symbol,
        exchange: entry.exchange || "US",
        price: entry.close,
        change_percent: Math.round(changePct * 100) / 100,
        volume: entry.volume,
        category: changePct > 0 ? "gainer" : "loser",
        fetched_at: new Date().toISOString(),
      };
    });

    // Clear old and insert new
    await supabase
      .from("trending_stocks")
      .delete()
      .lt("fetched_at", new Date(Date.now() - CACHE_TTL_MS * 2).toISOString());

    if (rows.length > 0) {
      await supabase.from("trending_stocks").insert(rows);

      // Also update stock_cache
      for (const entry of eodData) {
        const changePct =
          entry.open > 0 ? ((entry.close - entry.open) / entry.open) * 100 : 0;
        await supabase.from("stock_cache").upsert(
          {
            ticker: entry.symbol,
            price: entry.close,
            change_percent: Math.round(changePct * 100) / 100,
            as_of:
              entry.date?.slice(0, 10) ??
              new Date().toISOString().slice(0, 10),
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
    }

    const gainers = rows
      .filter((r) => r.change_percent > 0)
      .sort((a, b) => b.change_percent - a.change_percent)
      .slice(0, 10);
    const losers = rows
      .filter((r) => r.change_percent < 0)
      .sort((a, b) => a.change_percent - b.change_percent)
      .slice(0, 10);
    const mostActive = [...rows]
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 10);

    return NextResponse.json({
      gainers,
      losers,
      mostActive,
      asOf: new Date().toISOString(),
      source: "marketstack",
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to fetch trending data",
        gainers: [],
        losers: [],
        mostActive: [],
      },
      { status: 500 },
    );
  }
}
