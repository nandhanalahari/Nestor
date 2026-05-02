export type AssetCategory = "Stock" | "ETF" | "Bond ETF" | "Cash" | "Mutual Fund";

export type Holding = {
  id?: string;
  ticker: string;
  name: string;
  category: AssetCategory;
  amount: number;
  weight: number;
  shares?: number;
  costBasis?: number;
};

export type Quote = {
  ticker: string;
  price: number;
  changePercent: number;
  asOf: string;
};

export type ScenarioId =
  | "market-drop"
  | "inflation-spike"
  | "recession"
  | "tech-boom"
  | "custom";

/** Gemini maps a user question to a real historical stress window. */
export type ResolvedCustomScenario = {
  title: string;
  eventName: string;
  year: number;
  windowStart: string;
  windowEnd: string;
  marketStory: string;
};

export type Scenario = {
  id: ScenarioId;
  title: string;
  question: string;
  description: string;
  marketStory: string;
  windowStart: string;
  windowEnd: string;
};

export type Allocation = Record<string, number>;

export type FrontierPoint = {
  expectedReturn: number;
  volatility: number;
  sharpe: number;
};

export type StockRiskScore = {
  risk_score: number;
  label: string;
  summary: string;
  yahoo: {
    annualized_vol_pct: number;
    beta_vs_spy: number;
    observation_days: number;
  };
  macro: {
    regime_stress_0_100: number;
    factors: Record<string, unknown>;
  };
};

export type XGBPrediction = {
  ticker: string;
  predicted_return: number;
  predicted_vol: number;
  feature_importances: Record<string, number>;
  cv_rmse: number;
  data_points: number;
  error?: string;
};

export type RebalancingResult = {
  scenarioId: ScenarioId;
  windowStart: string;
  windowEnd: string;
  originalAllocation: Allocation;
  newAllocation: Allocation;
  expectedRiskReduction: string;
  originalScenarioReturnPct: number;
  newScenarioReturnPct: number;
  originalVolPct: number;
  newVolPct: number;
  originalSharpe: number;
  newSharpe: number;
  maxDrawdownOriginal: number;
  maxDrawdownOptimized: number;
  riskContributions: Record<string, number>;
  efficientFrontier: FrontierPoint[];
  notes: {
    tax: string;
    fees: string;
  };
  actions: string[];
  predictions?: Record<string, XGBPrediction>;
  xgbImportanceText?: string;
  pipeline?: string;
  scenarioActualReturnCurrent?: number;
  scenarioActualReturnOptimized?: number;
  method?: string;
  riskScores?: Record<string, StockRiskScore>;
  maxSharpe?: {
    weights: Record<string, number>;
    expected_return: number;
    volatility: number;
    sharpe: number;
  };
  macroSnapshot?: Record<string, { name: string; value: number; change_1m?: number | null }>;
};

export type Goal = {
  id?: string;
  title?: string;
  text: string;
  horizonYears?: number;
  targetAmount?: number;
  currentAmount?: number;
  deadline?: string;
  icon?: string;
  encouragement?: string;
  aiSuggestion?: string;
};

export type NewsItem = {
  id: string;
  headline: string;
  source: string;
  url: string;
  publishedAt: string;
  summary: string;
  relatedTickers: string[];
  geminiWhy: string | null;
  geminiForYou: string | null;
  geminiDeepDive: string | null;
  importance: "high" | "normal";
  newsType: "macro" | "company";
  impact?: "Positive" | "Negative" | "Neutral" | null;
  jargon?: { term: string; definition: string }[] | null;
  takeaway?: string | null;
};
