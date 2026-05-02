import { NextResponse } from "next/server";
import { fetchCompanyNews, fetchMarketNews } from "@/lib/finnhub";
import { analyzeNewsItems } from "@/lib/gemini";
import type { NewsItem } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Simple in-memory cache keyed by sorted tickers hash
const cache = new Map<string, { data: NewsItem[]; expiresAt: number }>();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tickersParam = searchParams.get("tickers") || "";
  const tickers = tickersParam.split(",").map(t => t.trim().toUpperCase()).filter(Boolean);

  // Use "MARKET" if no tickers provided to cache general market news
  const cacheKey = tickers.length > 0 ? tickers.sort().join(",") : "MARKET";

  // Check cache (15 minutes)
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return NextResponse.json({ news: cached.data });
  }

  try {
    let allNews: NewsItem[] = [];

    // 1. Fetch news
    const marketNews = await fetchMarketNews();
    allNews.push(...marketNews);

    if (tickers.length > 0) {
      // Get news for top 3 holdings to avoid hitting rate limits immediately
      const topTickers = tickers.slice(0, 3);
      for (const ticker of topTickers) {
        const companyNews = await fetchCompanyNews(ticker);
        allNews.push(...companyNews);
      }
    }

    // 2. Deduplicate by headline
    const uniqueNews = Array.from(
      new Map(allNews.map((item) => [item.headline, item])).values()
    );

    // 3. Sort by date (newest first) and limit to 5-7 items
    uniqueNews.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    let finalNews = uniqueNews.slice(0, 6);

    // 4. Send batch to Gemini for cause-effect analysis
    if (finalNews.length > 0) {
      const geminiAnalysis = await analyzeNewsItems(
        finalNews.map((item) => ({ headline: item.headline, summary: item.summary })),
        tickers,
      );

      if (geminiAnalysis && geminiAnalysis.length === finalNews.length) {
        finalNews = finalNews.map((item, index) => ({
          ...item,
          geminiWhy: geminiAnalysis[index].why,
          geminiForYou: geminiAnalysis[index].forYou,
          geminiDeepDive: geminiAnalysis[index].deepDive,
          importance: geminiAnalysis[index].importance,
          impact: geminiAnalysis[index].impact,
          jargon: geminiAnalysis[index].jargon,
          takeaway: geminiAnalysis[index].takeaway,
        }));
      }
    }

    // 5. Update cache (15 minutes; skip caching empty to allow quick recovery after key setup)
    if (finalNews.length > 0) {
      cache.set(cacheKey, {
        data: finalNews,
        expiresAt: now + 15 * 60 * 1000,
      });
    }

    const hasFinnhub = Boolean(process.env.FINNHUB_API_KEY);
    return NextResponse.json({
      news: finalNews,
      tickersRequested: tickers,
      source: "finnhub+gemini",
      ...(finalNews.length === 0 && {
        hint: hasFinnhub
          ? "No headlines returned from Finnhub for this window. Try again later."
          : "Add FINNHUB_API_KEY to .env.local for Live Events (see Finnhub dashboard).",
      }),
    });
  } catch (error) {
    console.error("News API error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch news",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
