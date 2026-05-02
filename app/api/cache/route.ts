import { NextResponse } from "next/server";
import { getLiveQuotes } from "@/lib/yahooFinance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
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

  const liveQuotes = await getLiveQuotes(tickers);
  const quotes: Record<string, { price: number; change_percent: number; as_of: string }> = {};

  for (const q of liveQuotes) {
    quotes[q.ticker] = {
      price: Math.round(q.price * 100) / 100,
      change_percent: Math.round(q.changePercent * 100) / 100,
      as_of: q.asOf,
    };
  }

  return NextResponse.json({
    quotes,
    source: "yahoo-finance",
    cached_count: Object.keys(quotes).length,
  });
}
