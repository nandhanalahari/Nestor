import { NextResponse } from "next/server";
import { getLiveQuotes, getTrending } from "@/lib/yahooFinance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POPULAR = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "JPM",
  "V", "UNH", "JNJ", "WMT", "PG", "MA", "HD", "DIS", "NFLX",
  "ADBE", "CRM", "INTC", "AMD", "BA", "KO", "PEP", "QCOM",
];

export async function GET() {
  try {
    // Try Yahoo's trending list first, fall back to popular
    let symbols: string[] = [];
    try {
      const trending = await getTrending();
      symbols = trending.map((q) => q.ticker);
    } catch {
      // ignore
    }

    if (symbols.length === 0) {
      symbols = POPULAR;
    }

    const quotes = await getLiveQuotes(symbols);

    const rows = quotes
      .filter((q) => q.price > 0)
      .map((q) => ({
        ticker: q.ticker,
        name: q.longName || q.ticker,
        exchange: q.exchange || "US",
        price: Math.round(q.price * 100) / 100,
        change_percent: Math.round(q.changePercent * 100) / 100,
        volume: q.volume ?? 0,
      }));

    const gainers = [...rows]
      .filter((r) => r.change_percent > 0)
      .sort((a, b) => b.change_percent - a.change_percent)
      .slice(0, 10);
    const losers = [...rows]
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
      source: "yahoo-finance (live)",
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to fetch trending data",
        gainers: [],
        losers: [],
        mostActive: [],
      },
      { status: 500 },
    );
  }
}
