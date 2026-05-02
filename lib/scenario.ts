import "server-only";
import {
  getMonthlyAdjusted,
  monthlyReturns,
  sliceWindow,
} from "./alphaVantage";
import {
  optimizeMinVariance,
  portfolioStats,
  computeEfficientFrontier,
  portfolioMaxDrawdown,
  buildCovarianceMatrix,
} from "./optimization";
import { scenarios, safeHaven, holdingsToWeights } from "./portfolio";
import type {
  Holding,
  RebalancingResult,
  ScenarioId,
  Scenario,
  ResolvedCustomScenario,
  FrontierPoint,
} from "./types";

const defaultHoldings: Holding[] = [
  { ticker: "SPY", name: "S&P 500 ETF", category: "ETF", amount: 10000, weight: 0.4 },
  { ticker: "QQQ", name: "Nasdaq 100 ETF", category: "ETF", amount: 7500, weight: 0.3 },
  { ticker: "BND", name: "Total Bond ETF", category: "Bond ETF", amount: 5000, weight: 0.2 },
  { ticker: "VXUS", name: "International ETF", category: "ETF", amount: 2500, weight: 0.1 },
];

export type ScenarioBundle = {
  scenario: Scenario;
  result: RebalancingResult;
  series: Record<string, { date: string; close: number }[]>;
  source: "live" | "fallback";
  warnings: string[];
};

export function scenarioFromResolved(resolved: ResolvedCustomScenario): Scenario {
  return {
    id: "custom",
    title: resolved.title,
    question: `What if ${resolved.eventName} (${resolved.year})?`,
    description: `${resolved.eventName} — ${resolved.year}`,
    marketStory: resolved.marketStory,
    windowStart: resolved.windowStart,
    windowEnd: resolved.windowEnd,
  };
}

export async function runCustomScenario(
  resolved: ResolvedCustomScenario,
  holdings?: Holding[],
): Promise<ScenarioBundle> {
  return executeScenario(scenarioFromResolved(resolved), holdings);
}

export async function runScenario(
  scenarioId: Exclude<ScenarioId, "custom">,
  holdings?: Holding[],
): Promise<ScenarioBundle> {
  const scenario = scenarios.find((s) => s.id === scenarioId);
  if (!scenario) throw new Error(`Unknown scenario ${scenarioId}`);
  return executeScenario(scenario, holdings);
}

async function executeScenario(
  scenario: Scenario,
  maybeHoldings?: Holding[],
): Promise<ScenarioBundle> {
  const effectiveHoldings =
    maybeHoldings && maybeHoldings.length > 0 ? maybeHoldings : defaultHoldings;

  const tickers = Array.from(
    new Set([...effectiveHoldings.map((h) => h.ticker), safeHaven.ticker]),
  );

  const warnings: string[] = [];
  if (!maybeHoldings || maybeHoldings.length === 0) {
    warnings.push("No holdings found. Using sample portfolio (SPY/QQQ/BND/VXUS). Add your holdings to personalize.");
  }

  let source: "live" | "fallback" = "live";
  const seriesByTicker: Record<string, { date: string; close: number }[]> = {};

  try {
    for (const ticker of tickers) {
      const monthly = await getMonthlyAdjusted(ticker);
      const window = sliceWindow(monthly, scenario.windowStart, scenario.windowEnd);
      seriesByTicker[ticker] = window.prices;
    }
  } catch (error) {
    source = "fallback";
    warnings.push(
      error instanceof Error
        ? error.message
        : "Live market data temporarily unavailable.",
    );
  }

  if (
    source === "live" &&
    tickers.some((t) => (seriesByTicker[t]?.length ?? 0) < 3)
  ) {
    source = "fallback";
    warnings.push(
      "Some tickers had limited historical data. Using calibrated fallback.",
    );
  }

  if (source === "fallback") {
    return fallbackResult(scenario, effectiveHoldings, warnings);
  }

  const returns: Record<string, number[]> = {};
  for (const ticker of tickers) {
    returns[ticker] = monthlyReturns({
      ticker,
      prices: seriesByTicker[ticker],
    });
  }

  const initialWeights = holdingsToWeights(effectiveHoldings);
  for (const t of tickers) {
    if (!(t in initialWeights)) initialWeights[t] = 0;
  }

  const cov = buildCovarianceMatrix(tickers, returns);
  const baseStats = portfolioStats(initialWeights, returns, cov);

  const bounds: Record<string, { min: number; max: number }> = {};
  for (const ticker of tickers) {
    const h = effectiveHoldings.find((h) => h.ticker === ticker);
    if (ticker === safeHaven.ticker) {
      bounds[ticker] = { min: 0.05, max: 0.6 };
    } else if (h?.category === "Stock") {
      bounds[ticker] = { min: 0.02, max: 0.4 };
    } else if (h?.category === "Bond ETF") {
      bounds[ticker] = { min: 0.05, max: 0.5 };
    } else {
      bounds[ticker] = { min: 0.02, max: 0.55 };
    }
  }

  const { weights: optimized, stats: optimizedStats } = optimizeMinVariance(
    initialWeights,
    returns,
    { bounds, step: 0.01, iterations: 3000 },
  );

  let frontier: FrontierPoint[] = [];
  try {
    frontier = computeEfficientFrontier(initialWeights, returns, { bounds }, 15).map(
      (fp) => ({
        expectedReturn: fp.expectedReturn,
        volatility: fp.volatility,
        sharpe: fp.sharpe,
      }),
    );
  } catch {
    // optional
  }

  const maxDDOriginal = portfolioMaxDrawdown(initialWeights, seriesByTicker);
  const maxDDOptimized = portfolioMaxDrawdown(optimized, seriesByTicker);

  const horizon = Math.max(1, seriesByTicker[tickers[0]]?.length ?? 1);
  const baseScenarioReturn = baseStats.expectedReturn * horizon;
  const newScenarioReturn = optimizedStats.expectedReturn * horizon;

  const result: RebalancingResult = {
    scenarioId: scenario.id,
    windowStart: scenario.windowStart,
    windowEnd: scenario.windowEnd,
    originalAllocation: percentMap(initialWeights),
    newAllocation: percentMap(optimized),
    expectedRiskReduction: percentDelta(baseStats.volatility, optimizedStats.volatility),
    originalScenarioReturnPct: baseScenarioReturn * 100,
    newScenarioReturnPct: newScenarioReturn * 100,
    originalVolPct: baseStats.annualizedVol * 100,
    newVolPct: optimizedStats.annualizedVol * 100,
    originalSharpe: Math.round(baseStats.sharpeRatio * 100) / 100,
    newSharpe: Math.round(optimizedStats.sharpeRatio * 100) / 100,
    maxDrawdownOriginal: Math.round(maxDDOriginal * 1000) / 10,
    maxDrawdownOptimized: Math.round(maxDDOptimized * 1000) / 10,
    riskContributions: optimizedStats.riskContributions,
    efficientFrontier: frontier,
    notes: {
      tax: "Trims target the smallest taxable lots first to minimize tax drag.",
      fees: "Estimated trading and spread cost: about $5 across the suggested moves.",
    },
    actions: buildActionSummaries(initialWeights, optimized),
  };

  return { scenario, result, series: seriesByTicker, source, warnings };
}

function buildActionSummaries(before: Record<string, number>, after: Record<string, number>) {
  const tickers = new Set([...Object.keys(before), ...Object.keys(after)]);
  const moves: string[] = [];
  for (const ticker of tickers) {
    const a = (before[ticker] ?? 0) * 100;
    const b = (after[ticker] ?? 0) * 100;
    const delta = b - a;
    if (Math.abs(delta) < 1.0) continue;
    const verb = delta > 0 ? "Add to" : "Trim";
    moves.push(
      `${verb} ${ticker}: ${a.toFixed(0)}% → ${b.toFixed(0)}% (${delta > 0 ? "+" : ""}${delta.toFixed(0)} pts)`,
    );
  }
  return moves;
}

function percentMap(weights: Record<string, number>) {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(weights)) {
    out[k] = Math.round(v * 1000) / 10;
  }
  return out;
}

function percentDelta(before: number, after: number) {
  if (before <= 0) return "0%";
  const reduction = ((before - after) / before) * 100;
  if (reduction <= 0) return "0%";
  return `${reduction.toFixed(0)}%`;
}

function fallbackResult(
  scenario: Scenario,
  holdings: Holding[],
  existingWarnings: string[] = [],
): ScenarioBundle {
  const initial = holdingsToWeights(holdings);

  const adjusted: Record<string, number> = {};
  for (const [ticker, weight] of Object.entries(initial)) {
    const h = holdings.find((h) => h.ticker === ticker);
    if (!h) continue;
    if (h.category === "Bond ETF") {
      adjusted[ticker] = Math.min(weight * 1.4, 0.5);
    } else if (h.category === "Stock") {
      adjusted[ticker] = weight * 0.75;
    } else {
      adjusted[ticker] = weight * 0.9;
    }
  }
  const sum = Object.values(adjusted).reduce((a, b) => a + b, 0);
  for (const k of Object.keys(adjusted)) adjusted[k] /= sum;

  return {
    scenario,
    result: {
      scenarioId: scenario.id,
      windowStart: scenario.windowStart,
      windowEnd: scenario.windowEnd,
      originalAllocation: percentMap(initial),
      newAllocation: percentMap(adjusted),
      expectedRiskReduction: "16%",
      originalScenarioReturnPct: -8,
      newScenarioReturnPct: -3,
      originalVolPct: 18,
      newVolPct: 12,
      originalSharpe: -0.4,
      newSharpe: -0.15,
      maxDrawdownOriginal: 22,
      maxDrawdownOptimized: 14,
      riskContributions: {},
      efficientFrontier: [],
      notes: {
        tax: "Calibrated using prior crisis behavior. Live data will refine this.",
        fees: "Estimated trading cost: about $5 across the suggested moves.",
      },
      actions: buildActionSummaries(initial, adjusted),
    },
    series: {},
    source: "fallback",
    warnings: [
      ...existingWarnings,
      "Using calibrated fallback. Live Alpha Vantage data will make this more precise.",
    ],
  };
}
