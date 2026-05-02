import type { NewsItem } from "./types";

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;

type FinnhubNews = {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
};

// Maps raw Finnhub item to our internal NewsItem (without Gemini enrichment yet)
function mapToNewsItem(item: FinnhubNews, newsType: "macro" | "company", ticker?: string): NewsItem {
  return {
    id: String(item.id),
    headline: item.headline,
    source: item.source,
    url: item.url,
    publishedAt: new Date(item.datetime * 1000).toISOString(),
    summary: item.summary,
    relatedTickers: ticker ? [ticker] : (item.related ? item.related.split(",") : []),
    geminiWhy: null,
    geminiForYou: null,
    geminiDeepDive: null,
    importance: "normal",
    newsType,
    impact: null,
    jargon: null,
    takeaway: null,
  };
}

export async function fetchMarketNews(): Promise<NewsItem[]> {
  if (!FINNHUB_API_KEY) {
    console.warn("FINNHUB_API_KEY is missing.");
    return [];
  }
  try {
    const url = `https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_API_KEY}`;
    const res = await fetch(url, { next: { revalidate: 900 } }); // 15 min edge cache
    if (!res.ok) throw new Error(`Finnhub error: ${res.status}`);
    const data: FinnhubNews[] = await res.json();
    return data.slice(0, 15).map(item => mapToNewsItem(item, "macro"));
  } catch (error) {
    console.error("fetchMarketNews error:", error);
    return [];
  }
}

export async function fetchCompanyNews(ticker: string): Promise<NewsItem[]> {
  if (!FINNHUB_API_KEY) {
    return [];
  }
  try {
    // Get last 3 days of news for the company
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 3);
    
    const toStr = to.toISOString().split("T")[0];
    const fromStr = from.toISOString().split("T")[0];

    const url = `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${fromStr}&to=${toStr}&token=${FINNHUB_API_KEY}`;
    const res = await fetch(url, { next: { revalidate: 900 } }); 
    if (!res.ok) throw new Error(`Finnhub error: ${res.status}`);
    const data: FinnhubNews[] = await res.json();
    return data.slice(0, 5).map(item => mapToNewsItem(item, "company", ticker));
  } catch (error) {
    console.error(`fetchCompanyNews error for ${ticker}:`, error);
    return [];
  }
}
