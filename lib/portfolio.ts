import type { Holding, Scenario } from "./types";

export const safeHaven = { ticker: "BND", name: "Total Bond ETF" };

export const scenarios: Scenario[] = [
  {
    id: "market-drop",
    title: "Market Crash",
    question: "What if stocks fall 20% in a month?",
    description:
      "Stress test with the early 2020 COVID selloff. Stocks fell fast, bonds held steady.",
    marketStory:
      "Investors panicked, growth names got hammered, and safer assets caught the bid. The S&P 500 dropped over 30% in weeks.",
    windowStart: "2020-01-01",
    windowEnd: "2020-06-01",
  },
  {
    id: "inflation-spike",
    title: "Inflation Spike",
    question: "What if prices heat up like 2022?",
    description:
      "Use the 2021-2022 inflation window. Rates rose, growth tech struggled, bonds needed a shorter role.",
    marketStory:
      "CPI hit 9.1%, the Fed raised rates aggressively, expensive growth stocks felt pressure, and bonds lost value too.",
    windowStart: "2021-06-01",
    windowEnd: "2022-12-31",
  },
  {
    id: "recession",
    title: "Recession",
    question: "What if the economy slides into recession?",
    description:
      "Use the 2008 financial crisis window. Credit froze, banks failed, cash flow mattered more than hype.",
    marketStory:
      "The financial system nearly collapsed. Consumers cut spending, companies slashed forecasts, and safe havens were the only shelter.",
    windowStart: "2008-01-01",
    windowEnd: "2009-06-01",
  },
  {
    id: "tech-boom",
    title: "Tech Boom",
    question: "What if tech stocks surge like 2023-2024?",
    description:
      "Use the AI-driven tech rally of 2023-2024. Growth and mega-cap tech led the market higher.",
    marketStory:
      "AI enthusiasm drove tech stocks to new highs. The Magnificent Seven dominated returns while other sectors lagged behind.",
    windowStart: "2023-01-01",
    windowEnd: "2024-06-01",
  },
];

export function holdingsToWeights(holdings: Holding[]): Record<string, number> {
  const total = holdings.reduce((s, h) => s + h.amount, 0);
  if (total === 0) return {};
  const w: Record<string, number> = {};
  for (const h of holdings) w[h.ticker] = h.amount / total;
  return w;
}
