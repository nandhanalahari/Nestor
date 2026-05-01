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

export type ScenarioId = "market-drop" | "inflation-spike" | "recession";

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
  notes: {
    tax: string;
    fees: string;
  };
  actions: string[];
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
