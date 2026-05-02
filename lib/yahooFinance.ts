import "server-only";
import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance();
yf._notices.suppress(["yahooSurvey", "ripHistorical"]);

export type LiveQuote = {
  ticker: string;
  price: number;
  changePercent: number;
  asOf: string;
  dayHigh?: number;
  dayLow?: number;
  marketCap?: number;
  volume?: number;
  currency?: string;
  longName?: string;
  exchange?: string;
};

export type HistoricalDay = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjClose: number;
  volume: number;
};

const cache = new Map<string, { value: unknown; expires: number }>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expires < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value as T;
}

function setCached(key: string, value: unknown, ttlMs: number) {
  cache.set(key, { value, expires: Date.now() + ttlMs });
}

const QUOTE_TTL = 60 * 1000;
const HISTORY_TTL = 60 * 60 * 1000;

export async function getLiveQuote(ticker: string): Promise<LiveQuote | null> {
  const upper = ticker.toUpperCase();
  const cached = getCached<LiveQuote>(`quote:${upper}`);
  if (cached) return cached;

  try {
    const quote = await yf.quote(upper);
    if (!quote || typeof quote.regularMarketPrice !== "number") return null;

    const result: LiveQuote = {
      ticker: upper,
      price: quote.regularMarketPrice,
      changePercent: quote.regularMarketChangePercent ?? 0,
      asOf: quote.regularMarketTime
        ? new Date(
            (quote.regularMarketTime as unknown as number) * 1000,
          )
            .toISOString()
            .slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      dayHigh: quote.regularMarketDayHigh,
      dayLow: quote.regularMarketDayLow,
      marketCap: quote.marketCap,
      volume: quote.regularMarketVolume,
      currency: quote.currency,
      longName: quote.longName || quote.shortName,
      exchange: quote.fullExchangeName || quote.exchange,
    };

    setCached(`quote:${upper}`, result, QUOTE_TTL);
    return result;
  } catch {
    return null;
  }
}

export async function getLiveQuotes(tickers: string[]): Promise<LiveQuote[]> {
  if (tickers.length === 0) return [];
  const results = await Promise.all(tickers.map((t) => getLiveQuote(t)));
  return results.filter((q): q is LiveQuote => q !== null);
}

export async function getHistory(
  ticker: string,
  period: "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y" = "1y",
): Promise<HistoricalDay[]> {
  const upper = ticker.toUpperCase();
  const cacheKey = `hist:${upper}:${period}`;
  const cached = getCached<HistoricalDay[]>(cacheKey);
  if (cached) return cached;

  const periodMap: Record<string, number> = {
    "1mo": 30,
    "3mo": 90,
    "6mo": 180,
    "1y": 365,
    "2y": 730,
    "5y": 1825,
  };
  const days = periodMap[period] || 365;
  const period1 = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const result = await yf.chart(upper, { period1, interval: "1d" });
    const quotes = result.quotes ?? [];
    const data: HistoricalDay[] = quotes
      .filter((q) => q.close != null && Number.isFinite(q.close))
      .map((q) => ({
        date: (q.date instanceof Date ? q.date : new Date(q.date))
          .toISOString()
          .slice(0, 10),
        open: q.open ?? 0,
        high: q.high ?? 0,
        low: q.low ?? 0,
        close: q.close ?? 0,
        adjClose: q.adjclose ?? q.close ?? 0,
        volume: q.volume ?? 0,
      }));

    setCached(cacheKey, data, HISTORY_TTL);
    return data;
  } catch {
    return [];
  }
}

export async function getTrending(): Promise<LiveQuote[]> {
  const cacheKey = "trending:US";
  const cached = getCached<LiveQuote[]>(cacheKey);
  if (cached) return cached;

  try {
    const result = await yf.trendingSymbols("US", { count: 25 });
    const symbols =
      result.quotes
        ?.map((q: { symbol?: string }) => q.symbol)
        .filter((s): s is string => !!s) ?? [];

    if (symbols.length === 0) return [];

    const quotes = await getLiveQuotes(symbols);
    setCached(cacheKey, quotes, 5 * 60 * 1000);
    return quotes;
  } catch {
    return [];
  }
}
