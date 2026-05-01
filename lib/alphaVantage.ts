import "server-only";

const BASE = "https://www.alphavantage.co/query";

const memoryCache = new Map<string, { value: unknown; expires: number }>();

function getCache<T>(key: string): T | undefined {
  const entry = memoryCache.get(key);
  if (!entry) return undefined;
  if (entry.expires < Date.now()) {
    memoryCache.delete(key);
    return undefined;
  }
  return entry.value as T;
}

function setCache(key: string, value: unknown, ttlMs: number) {
  memoryCache.set(key, { value, expires: Date.now() + ttlMs });
}

function getApiKey() {
  const key = process.env.ALPHA_VANTAGE_API_KEY;
  if (!key) throw new Error("Missing ALPHA_VANTAGE_API_KEY env var.");
  return key;
}

async function avFetch<T>(params: Record<string, string>, ttlMs: number) {
  const key = `av:${JSON.stringify(params)}`;
  const cached = getCache<T>(key);
  if (cached) return cached;

  const search = new URLSearchParams({ ...params, apikey: getApiKey() });
  const url = `${BASE}?${search.toString()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Alpha Vantage HTTP ${res.status}`);
  const json = (await res.json()) as Record<string, unknown> & T;

  if ((json as { Note?: string }).Note) {
    throw new Error("Alpha Vantage rate limit reached. Try again in a minute.");
  }
  if ((json as { Information?: string }).Information) {
    throw new Error(
      `Alpha Vantage info: ${(json as { Information?: string }).Information}`,
    );
  }
  if ((json as { "Error Message"?: string })["Error Message"]) {
    throw new Error(
      `Alpha Vantage error: ${
        (json as { "Error Message"?: string })["Error Message"]
      }`,
    );
  }

  setCache(key, json, ttlMs);
  return json;
}

export type GlobalQuote = {
  ticker: string;
  price: number;
  changePercent: number;
  asOf: string;
};

export async function getGlobalQuote(symbol: string): Promise<GlobalQuote> {
  const json = await avFetch<{ "Global Quote"?: Record<string, string> }>(
    { function: "GLOBAL_QUOTE", symbol },
    60_000,
  );
  const quote = json["Global Quote"];
  if (!quote || !quote["05. price"]) {
    throw new Error(`No quote returned for ${symbol}.`);
  }
  return {
    ticker: symbol,
    price: Number(quote["05. price"]),
    changePercent: Number(
      (quote["10. change percent"] || "0").replace("%", ""),
    ),
    asOf:
      quote["07. latest trading day"] ?? new Date().toISOString().slice(0, 10),
  };
}

export type MonthlySeries = {
  ticker: string;
  prices: { date: string; close: number }[];
};

export async function getMonthlyAdjusted(symbol: string): Promise<MonthlySeries> {
  const json = await avFetch<{
    "Monthly Adjusted Time Series"?: Record<string, Record<string, string>>;
  }>(
    { function: "TIME_SERIES_MONTHLY_ADJUSTED", symbol },
    24 * 60 * 60_000,
  );

  const series = json["Monthly Adjusted Time Series"];
  if (!series) throw new Error(`No monthly series for ${symbol}.`);

  const prices = Object.entries(series)
    .map(([date, fields]) => ({
      date,
      close: Number(fields["5. adjusted close"] ?? fields["4. close"]),
    }))
    .filter((row) => Number.isFinite(row.close))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  return { ticker: symbol, prices };
}

export function sliceWindow(series: MonthlySeries, start: string, end: string) {
  return {
    ticker: series.ticker,
    prices: series.prices.filter((row) => row.date >= start && row.date <= end),
  } satisfies MonthlySeries;
}

export function monthlyReturns(series: MonthlySeries): number[] {
  const out: number[] = [];
  for (let i = 1; i < series.prices.length; i++) {
    const prev = series.prices[i - 1].close;
    const curr = series.prices[i].close;
    if (prev > 0) out.push((curr - prev) / prev);
  }
  return out;
}
