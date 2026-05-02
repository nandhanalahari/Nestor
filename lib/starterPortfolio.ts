// lib/starterPortfolio.ts — F9 default starter portfolio templates
// Pure data + lookup. No side effects, easy to unit-test.

import type { ProfileLabel } from "./profile";
import type { AssetCategory } from "./types";

export type StarterTicker = {
  ticker: string;
  name: string;
  category: AssetCategory;
  weight: number; // 0..1
  role: string; // one-line plain-English explanation
};

export type StarterPortfolio = {
  profile: ProfileLabel;
  rationale: string;
  tickers: StarterTicker[];
};

export const DEFAULT_SEED_AMOUNT = 10_000;

const STEADY_BUILDER: StarterPortfolio = {
  profile: "Steady Builder",
  rationale:
    "Lower volatility and a strong bond cushion — built so a near-term goal isn't derailed by a market dip.",
  tickers: [
    {
      ticker: "BND",
      name: "Vanguard Total Bond Market ETF",
      category: "Bond ETF",
      weight: 0.6,
      role: "Bond cushion — steady income, low swings.",
    },
    {
      ticker: "SPY",
      name: "SPDR S&P 500 ETF",
      category: "ETF",
      weight: 0.2,
      role: "U.S. broad market — your equity engine.",
    },
    {
      ticker: "VEA",
      name: "Vanguard FTSE Developed Markets ETF",
      category: "ETF",
      weight: 0.1,
      role: "International stocks — diversification beyond the U.S.",
    },
    {
      ticker: "BIL",
      name: "SPDR Bloomberg 1–3 Month T-Bill ETF",
      category: "Bond ETF",
      weight: 0.1,
      role: "Cash-like reserve — instant liquidity if you need it.",
    },
  ],
};

const BALANCED_CLIMBER: StarterPortfolio = {
  profile: "Balanced Climber",
  rationale:
    "A balanced mix that participates in equity upside while keeping bonds and gold as ballast.",
  tickers: [
    {
      ticker: "SPY",
      name: "SPDR S&P 500 ETF",
      category: "ETF",
      weight: 0.4,
      role: "U.S. broad market — your equity engine.",
    },
    {
      ticker: "QQQ",
      name: "Invesco QQQ Trust",
      category: "ETF",
      weight: 0.15,
      role: "Tech-heavy growth — extra upside potential.",
    },
    {
      ticker: "BND",
      name: "Vanguard Total Bond Market ETF",
      category: "Bond ETF",
      weight: 0.25,
      role: "Bond cushion — steadies the ride.",
    },
    {
      ticker: "VEA",
      name: "Vanguard FTSE Developed Markets ETF",
      category: "ETF",
      weight: 0.15,
      role: "International stocks — diversification beyond the U.S.",
    },
    {
      ticker: "IAU",
      name: "iShares Gold Trust",
      category: "ETF",
      weight: 0.05,
      role: "Gold — ballast for unusual market shocks.",
    },
  ],
};

const BOLD_GROWER: StarterPortfolio = {
  profile: "Bold Grower",
  rationale:
    "Equity-heavy and tilted toward growth — accepts bigger swings in exchange for higher long-run returns.",
  tickers: [
    {
      ticker: "QQQ",
      name: "Invesco QQQ Trust",
      category: "ETF",
      weight: 0.35,
      role: "Tech-heavy growth — your primary engine.",
    },
    {
      ticker: "SPY",
      name: "SPDR S&P 500 ETF",
      category: "ETF",
      weight: 0.25,
      role: "U.S. broad market — diversified equity base.",
    },
    {
      ticker: "NVDA",
      name: "NVIDIA Corp.",
      category: "Stock",
      weight: 0.1,
      role: "AI / chips — concentrated growth bet.",
    },
    {
      ticker: "AAPL",
      name: "Apple Inc.",
      category: "Stock",
      weight: 0.1,
      role: "Mega-cap tech — defensible cash flows.",
    },
    {
      ticker: "VEA",
      name: "Vanguard FTSE Developed Markets ETF",
      category: "ETF",
      weight: 0.1,
      role: "International stocks — diversification beyond the U.S.",
    },
    {
      ticker: "IAU",
      name: "iShares Gold Trust",
      category: "ETF",
      weight: 0.05,
      role: "Gold — small ballast for shocks.",
    },
    {
      ticker: "BND",
      name: "Vanguard Total Bond Market ETF",
      category: "Bond ETF",
      weight: 0.05,
      role: "Light bond reserve.",
    },
  ],
};

export function getStarterPortfolio(profileLabel: ProfileLabel): StarterPortfolio {
  switch (profileLabel) {
    case "Steady Builder":
      return STEADY_BUILDER;
    case "Balanced Climber":
      return BALANCED_CLIMBER;
    case "Bold Grower":
      return BOLD_GROWER;
  }
}
