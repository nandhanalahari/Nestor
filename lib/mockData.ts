import type { Holding, Quote } from "@/lib/types";
import type { ProfileLabel } from "@/lib/profile";

export function isMockDataEnabled() {
  return process.env.NEXT_PUBLIC_NESTOR_MOCK_DATA === "true";
}

/** Server routes: true when mock mode is on and the client sent the mock header (see authFetch). */
export function isMockApiRequest(req: Request) {
  if (process.env.NEXT_PUBLIC_NESTOR_MOCK_DATA !== "true") return false;
  return req.headers.get("x-nestor-mock-data")?.toLowerCase() === "true";
}

export const MOCK_USER_ID = "00000000-0000-4000-8000-000000000001";

export const mockProfile = {
  profile_label: "Balanced Climber" as ProfileLabel,
  liquidity_window_months: 3,
};

type MockHolding = Omit<Holding, "costBasisDate"> & {
  costBasisDate?: string | null;
};

type MockGoal = {
  id: string;
  title: string;
  text_goal: string;
  target_amount: number;
  current_amount: number;
  monthly_savings_target: number | null;
  deadline?: string;
  icon: string;
  ai_suggestion: string;
};

export const mockHoldings: MockHolding[] = [
  {
    id: "mock-holding-aapl",
    ticker: "AAPL",
    name: "Apple Inc.",
    category: "Stock",
    amount: 3300,
    weight: 0.33,
    shares: 18,
    costBasis: 3300,
    costBasisDate: "2024-02-15",
  },
  {
    id: "mock-holding-msft",
    ticker: "MSFT",
    name: "Microsoft Corp.",
    category: "Stock",
    amount: 2800,
    weight: 0.28,
    shares: 7,
    costBasis: 2800,
    costBasisDate: "2026-01-20",
  },
  {
    id: "mock-holding-spy",
    ticker: "SPY",
    name: "SPDR S&P 500 ETF",
    category: "ETF",
    amount: 2500,
    weight: 0.25,
    shares: 5,
    costBasis: 2500,
    costBasisDate: null,
  },
  {
    id: "mock-holding-bnd",
    ticker: "BND",
    name: "Vanguard Total Bond Market ETF",
    category: "Bond ETF",
    amount: 1400,
    weight: 0.14,
    shares: 20,
    costBasis: 1400,
    costBasisDate: "2023-05-01",
  },
];

export const mockQuotes: Quote[] = [
  { ticker: "AAPL", price: 214, changePercent: 1.2, asOf: "2026-05-02" },
  { ticker: "MSFT", price: 455, changePercent: -0.4, asOf: "2026-05-02" },
  { ticker: "SPY", price: 545, changePercent: 0.3, asOf: "2026-05-02" },
  { ticker: "BND", price: 73, changePercent: 0.1, asOf: "2026-05-02" },
];

export const mockGoals: MockGoal[] = [
  {
    id: "mock-goal-house",
    title: "House deposit",
    text_goal: "I want to save for a house deposit in about 6 years.",
    target_amount: 85000,
    current_amount: 12000,
    monthly_savings_target: 450,
    deadline: "2031",
    icon: "home",
    ai_suggestion:
      "Good target. The projection below checks whether your current portfolio and monthly savings pace are enough.",
  },
  {
    id: "mock-goal-emergency",
    title: "Emergency fund",
    text_goal: "I want to build a safer emergency fund.",
    target_amount: 20000,
    current_amount: 4000,
    monthly_savings_target: null,
    deadline: "2028",
    icon: "other",
    ai_suggestion:
      "Start with a monthly savings number so Nestor can estimate when you may reach this.",
  },
];

export function getMockPortfolioValue() {
  return mockHoldings.reduce((total, holding) => {
    const quote = mockQuotes.find((q) => q.ticker === holding.ticker);
    const shares = holding.shares ?? 0;
    return total + (quote && shares > 0 ? quote.price * shares : holding.amount);
  }, 0);
}
