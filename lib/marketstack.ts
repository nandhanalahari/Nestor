import "server-only";

const BASE = "http://api.marketstack.com/v1";

function getApiKey() {
  const key = process.env.MARKETSTACK_API_KEY;
  if (!key) throw new Error("Missing MARKETSTACK_API_KEY env var.");
  return key;
}

async function msFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const search = new URLSearchParams({ access_key: getApiKey(), ...params });
  const url = `${BASE}${endpoint}?${search.toString()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 429) {
    throw new Error("RATE_LIMITED");
  }
  if (!res.ok) throw new Error(`Marketstack HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export type EODEntry = {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adj_close: number;
  date: string;
  symbol: string;
  exchange: string;
};

export type TickerInfo = {
  name: string;
  symbol: string;
  stock_exchange: { acronym: string; name: string };
};

export async function getEOD(symbol: string, limit = 30): Promise<EODEntry[]> {
  const data = await msFetch<{ data: EODEntry[] }>("/eod", {
    symbols: symbol,
    limit: String(limit),
  });
  return data.data ?? [];
}

export async function getEODLatest(symbols: string[]): Promise<EODEntry[]> {
  const data = await msFetch<{ data: EODEntry[] }>("/eod/latest", {
    symbols: symbols.join(","),
  });
  return data.data ?? [];
}

export async function searchTickers(query: string): Promise<TickerInfo[]> {
  const data = await msFetch<{ data: TickerInfo[] }>("/tickers", {
    search: query,
    limit: "10",
  });
  return data.data ?? [];
}

export async function getTickerInfo(symbol: string): Promise<TickerInfo | null> {
  try {
    const data = await msFetch<TickerInfo>(`/tickers/${symbol}`);
    return data;
  } catch {
    return null;
  }
}
