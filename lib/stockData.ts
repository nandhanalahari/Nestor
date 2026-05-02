import "server-only";
import fs from "fs";
import path from "path";

const DATASET_BASE = path.join(
  process.env.HOME || "/Users/nandhanalahari",
  ".cache/kagglehub/datasets/jacksoncrow/stock-market-dataset/versions/2",
);

const STOCKS_DIR = path.join(DATASET_BASE, "stocks");
const ETFS_DIR = path.join(DATASET_BASE, "etfs");
const META_FILE = path.join(DATASET_BASE, "symbols_valid_meta.csv");

export type StockDay = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjClose: number;
  volume: number;
};

export type StockMeta = {
  symbol: string;
  name: string;
  exchange: string;
  isETF: boolean;
};

// In-memory caches so we only read disk once per server lifecycle
const priceCache = new Map<string, StockDay[]>();
let metaCache: StockMeta[] | null = null;

function findCSV(ticker: string): string | null {
  const stockPath = path.join(STOCKS_DIR, `${ticker}.csv`);
  if (fs.existsSync(stockPath)) return stockPath;
  const etfPath = path.join(ETFS_DIR, `${ticker}.csv`);
  if (fs.existsSync(etfPath)) return etfPath;
  return null;
}

function parseCSV(filePath: string): StockDay[] {
  const raw = fs.readFileSync(filePath, "utf-8");
  const lines = raw.trim().split("\n");
  const rows: StockDay[] = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    if (parts.length < 7) continue;
    const close = parseFloat(parts[4]);
    if (!Number.isFinite(close) || close <= 0) continue;
    rows.push({
      date: parts[0],
      open: parseFloat(parts[1]),
      high: parseFloat(parts[2]),
      low: parseFloat(parts[3]),
      close,
      adjClose: parseFloat(parts[5]),
      volume: parseInt(parts[6], 10) || 0,
    });
  }

  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export function getStockHistory(ticker: string): StockDay[] {
  const upper = ticker.toUpperCase();
  if (priceCache.has(upper)) return priceCache.get(upper)!;

  const csvPath = findCSV(upper);
  if (!csvPath) return [];

  const data = parseCSV(csvPath);
  priceCache.set(upper, data);
  return data;
}

export function getLatestPrice(ticker: string): StockDay | null {
  const history = getStockHistory(ticker);
  return history.length > 0 ? history[history.length - 1] : null;
}

export function getLatestPrices(tickers: string[]): Map<string, StockDay> {
  const result = new Map<string, StockDay>();
  for (const ticker of tickers) {
    const latest = getLatestPrice(ticker);
    if (latest) result.set(ticker.toUpperCase(), latest);
  }
  return result;
}

export function getWeeklyReturns(
  ticker: string,
  weeks: number = 52,
): { weekStart: string; weekEnd: string; returnPct: number; close: number }[] {
  const history = getStockHistory(ticker);
  if (history.length < 10) return [];

  const results: { weekStart: string; weekEnd: string; returnPct: number; close: number }[] = [];
  const endIdx = history.length - 1;

  for (let w = 0; w < weeks && (endIdx - (w + 1) * 5) >= 0; w++) {
    const end = endIdx - w * 5;
    const start = Math.max(0, end - 5);
    const startPrice = history[start].close;
    const endPrice = history[end].close;
    const ret = startPrice > 0 ? ((endPrice - startPrice) / startPrice) * 100 : 0;
    results.push({
      weekStart: history[start].date,
      weekEnd: history[end].date,
      returnPct: Math.round(ret * 100) / 100,
      close: endPrice,
    });
  }

  return results.reverse();
}

export function hasStock(ticker: string): boolean {
  return findCSV(ticker.toUpperCase()) !== null;
}

export function loadMeta(): StockMeta[] {
  if (metaCache) return metaCache;
  if (!fs.existsSync(META_FILE)) return [];

  const raw = fs.readFileSync(META_FILE, "utf-8");
  const lines = raw.trim().split("\n");
  const result: StockMeta[] = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    if (parts.length < 6) continue;
    result.push({
      symbol: parts[1]?.trim() || "",
      name: parts[2]?.trim().replace(/"/g, "") || "",
      exchange: parts[3]?.trim() || "",
      isETF: parts[5]?.trim() === "Y",
    });
  }

  metaCache = result.filter((m) => m.symbol.length > 0);
  return metaCache;
}

export function getTopMovers(count: number = 10): {
  gainers: (StockMeta & { price: number; changePct: number; volume: number })[];
  losers: (StockMeta & { price: number; changePct: number; volume: number })[];
  mostActive: (StockMeta & { price: number; changePct: number; volume: number })[];
} {
  const popularSymbols = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "JPM",
    "V", "UNH", "JNJ", "WMT", "PG", "MA", "HD", "DIS", "NFLX",
    "ADBE", "CRM", "PYPL", "INTC", "AMD", "BA", "KO", "PEP",
    "CSCO", "VZ", "T", "ORCL", "MRK", "ABT", "CVX", "XOM",
    "IBM", "GS", "MS", "C", "BAC", "WFC", "QCOM", "TXN",
    "AVGO", "COST", "NKE", "SBUX", "MCD", "LOW", "UPS", "FDX",
  ];

  const meta = loadMeta();
  type StockInfo = StockMeta & { price: number; changePct: number; volume: number };
  const stocks: StockInfo[] = [];

  for (const sym of popularSymbols) {
    const history = getStockHistory(sym);
    if (history.length < 2) continue;

    const latest = history[history.length - 1];
    const prev = history[history.length - 2];
    const changePct =
      prev.close > 0
        ? ((latest.close - prev.close) / prev.close) * 100
        : 0;

    const m = meta.find((m) => m.symbol === sym);
    stocks.push({
      symbol: sym,
      name: m?.name || sym,
      exchange: m?.exchange || "US",
      isETF: m?.isETF || false,
      price: Math.round(latest.close * 100) / 100,
      changePct: Math.round(changePct * 100) / 100,
      volume: latest.volume,
    });
  }

  const sorted = [...stocks].sort((a, b) => b.changePct - a.changePct);
  const gainers = sorted.filter((s) => s.changePct > 0).slice(0, count);
  const losers = sorted.filter((s) => s.changePct < 0).reverse().slice(0, count);
  const mostActive = [...stocks].sort((a, b) => b.volume - a.volume).slice(0, count);

  return { gainers, losers, mostActive };
}
