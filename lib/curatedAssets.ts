import type { AssetCategory } from "./types";

export type CuratedAsset = {
  ticker: string;
  name: string;
  category: AssetCategory;
  role: string;
};

export const CURATED_ASSETS: CuratedAsset[] = [
  {
    ticker: "AAPL",
    name: "Apple Inc.",
    category: "Stock",
    role: "Large U.S. technology company with established cash flows.",
  },
  {
    ticker: "MSFT",
    name: "Microsoft Corp.",
    category: "Stock",
    role: "Large U.S. technology company with broad software and cloud exposure.",
  },
  {
    ticker: "NVDA",
    name: "NVIDIA Corp.",
    category: "Stock",
    role: "Semiconductor growth exposure tied to AI and advanced computing.",
  },
  {
    ticker: "TSLA",
    name: "Tesla Inc.",
    category: "Stock",
    role: "Higher-volatility growth exposure in electric vehicles and energy.",
  },
  {
    ticker: "SPY",
    name: "SPDR S&P 500 ETF",
    category: "ETF",
    role: "Broad U.S. large-company stock market exposure.",
  },
  {
    ticker: "QQQ",
    name: "Invesco QQQ Trust",
    category: "ETF",
    role: "Growth-leaning exposure to large Nasdaq-listed companies.",
  },
  {
    ticker: "VEA",
    name: "Vanguard FTSE Developed Markets ETF",
    category: "ETF",
    role: "International developed-market stock diversification.",
  },
  {
    ticker: "IAU",
    name: "iShares Gold Trust",
    category: "ETF",
    role: "Gold exposure that can act differently from stocks and bonds.",
  },
  {
    ticker: "BND",
    name: "Vanguard Total Bond Market ETF",
    category: "Bond ETF",
    role: "Broad U.S. bond exposure for income and portfolio ballast.",
  },
  {
    ticker: "BIL",
    name: "SPDR Bloomberg 1-3 Month T-Bill ETF",
    category: "Bond ETF",
    role: "Cash-like Treasury bill exposure for short-term stability.",
  },
  {
    ticker: "VTSAX",
    name: "Vanguard Total Stock Market Index Fund Admiral Shares",
    category: "Mutual Fund",
    role: "Broad U.S. stock market core holding for long-term growth.",
  },
  {
    ticker: "VFIAX",
    name: "Vanguard 500 Index Fund Admiral Shares",
    category: "Mutual Fund",
    role: "Large U.S. company exposure through an S&P 500 index fund.",
  },
  {
    ticker: "VBTLX",
    name: "Vanguard Total Bond Market Index Fund Admiral Shares",
    category: "Mutual Fund",
    role: "Broad bond market cushion for steadier portfolio value.",
  },
  {
    ticker: "VTIAX",
    name: "Vanguard Total International Stock Index Fund Admiral Shares",
    category: "Mutual Fund",
    role: "International stock diversification outside the U.S.",
  },
  {
    ticker: "VMFXX",
    name: "Vanguard Federal Money Market Fund",
    category: "Mutual Fund",
    role: "Cash management sleeve for near-term needs and dry powder.",
  },
];

