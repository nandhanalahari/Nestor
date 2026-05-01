import type { Holding, Scenario } from "./types";

export const safeHaven = { ticker: "BND", name: "Total Bond ETF" };

export const scenarios: Scenario[] = [
  {
    id: "market-drop",
    title: "Market drops sharply",
    question: "What if stocks fall 20% in a month?",
    description:
      "Stress test with the early 2020 selloff window. Stocks fall fast, bonds stay steady.",
    marketStory:
      "Investors are nervous, growth names are getting hit, and safer assets are catching the bid.",
    windowStart: "2020-01-01",
    windowEnd: "2020-06-01",
  },
  {
    id: "inflation-spike",
    title: "Inflation spikes",
    question: "What if prices heat up like 2022?",
    description:
      "Use the 2021-2022 inflation window. Rates rise, growth tech struggles, bonds need a shorter role.",
    marketStory:
      "Rates are rising, expensive growth stocks feel pressure, and bonds need a steadier role.",
    windowStart: "2021-06-01",
    windowEnd: "2022-12-31",
  },
  {
    id: "recession",
    title: "Recession warning",
    question: "What if the economy slides into recession?",
    description:
      "Use the 2008 financial crisis window. Cash flow matters more than hype.",
    marketStory:
      "Consumers spend less, companies cut forecasts, and cash flow matters more than headlines.",
    windowStart: "2008-01-01",
    windowEnd: "2009-06-01",
  },
];

export function holdingsToWeights(holdings: Holding[]): Record<string, number> {
  const total = holdings.reduce((s, h) => s + h.amount, 0);
  if (total === 0) return {};
  const w: Record<string, number> = {};
  for (const h of holdings) w[h.ticker] = h.amount / total;
  return w;
}
