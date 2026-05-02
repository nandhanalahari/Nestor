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

export type ScenarioId = "market-drop" | "inflation-spike" | "recession" | "tech-boom";

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

export type XGBPrediction = {
  ticker: string;
  predicted_return: number;
  predicted_vol: number;
  feature_importances: Record<string, number>;
  cv_rmse: number;
  data_points: number;
  error?: string;
};

export type LSTMPrediction = {
  ticker: string;
  current_price?: number;
  predicted_return: number;
  predicted_vol: number;
  forecast: { date: string; price: number }[];
  history_days?: number;
  model?: string;
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
  lstmPredictions?: Record<string, LSTMPrediction>;
  xgbImportanceText?: string;
  pipeline?: string;
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
