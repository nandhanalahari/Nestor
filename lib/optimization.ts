/**
 * Mean-Variance Optimization (MVO) engine.
 *
 * Computes the Efficient Frontier by building a covariance matrix from
 * historical returns, then optimizes portfolio weights for:
 *   - Minimum volatility
 *   - Maximum Sharpe ratio
 *   - Target return
 *
 * Also computes per-asset risk contribution and max drawdown from the
 * historical window.
 */

type Returns = Record<string, number[]>;

// ───────── Basic statistics ─────────

function mean(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function covariance(a: number[], b: number[]) {
  if (a.length !== b.length || a.length < 2) return 0;
  const ma = mean(a);
  const mb = mean(b);
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - ma) * (b[i] - mb);
  }
  return sum / (a.length - 1);
}

// ───────── Covariance matrix ─────────

export type CovarianceMatrix = {
  tickers: string[];
  matrix: number[][];
  means: number[];
};

export function buildCovarianceMatrix(
  tickers: string[],
  returns: Returns,
): CovarianceMatrix {
  const n = tickers.length;
  const matrix: number[][] = Array.from({ length: n }, () =>
    Array(n).fill(0),
  );
  const means: number[] = tickers.map((t) => mean(returns[t] ?? []));

  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const cov = covariance(returns[tickers[i]] ?? [], returns[tickers[j]] ?? []);
      matrix[i][j] = cov;
      matrix[j][i] = cov;
    }
  }

  return { tickers, matrix, means };
}

// ───────── Portfolio statistics ─────────

export type PortfolioStats = {
  expectedReturn: number;
  variance: number;
  volatility: number;
  sharpeRatio: number;
  annualizedReturn: number;
  annualizedVol: number;
  riskContributions: Record<string, number>;
};

const RISK_FREE_RATE = 0.045 / 12; // ~4.5% annual risk-free rate (monthly)

export function portfolioStats(
  weights: Record<string, number>,
  returns: Returns,
  cov?: CovarianceMatrix,
): PortfolioStats {
  const tickers = Object.keys(weights);

  if (!cov) {
    cov = buildCovarianceMatrix(tickers, returns);
  }

  const w = tickers.map((t) => weights[t] ?? 0);
  const n = tickers.length;

  let expectedReturn = 0;
  for (let i = 0; i < n; i++) {
    expectedReturn += w[i] * cov.means[cov.tickers.indexOf(tickers[i])];
  }

  let variance = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const ci = cov.tickers.indexOf(tickers[i]);
      const cj = cov.tickers.indexOf(tickers[j]);
      variance += w[i] * w[j] * cov.matrix[ci][cj];
    }
  }

  const volatility = Math.sqrt(Math.max(variance, 0));
  const annualizedReturn = expectedReturn * 12;
  const annualizedVol = volatility * Math.sqrt(12);
  const sharpeRatio =
    annualizedVol > 0
      ? (annualizedReturn - RISK_FREE_RATE * 12) / annualizedVol
      : 0;

  // Per-asset marginal risk contribution: w_i * (Sigma * w)_i / sigma_p
  const riskContributions: Record<string, number> = {};
  if (volatility > 0) {
    for (let i = 0; i < n; i++) {
      let marginal = 0;
      for (let j = 0; j < n; j++) {
        const ci = cov.tickers.indexOf(tickers[i]);
        const cj = cov.tickers.indexOf(tickers[j]);
        marginal += w[j] * cov.matrix[ci][cj];
      }
      riskContributions[tickers[i]] =
        Math.round(((w[i] * marginal) / variance) * 1000) / 10;
    }
  }

  return {
    expectedReturn,
    variance,
    volatility,
    sharpeRatio,
    annualizedReturn,
    annualizedVol,
    riskContributions,
  };
}

// ───────── Normalization ─────────

function normalize(weights: Record<string, number>) {
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  if (sum === 0) return weights;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(weights)) {
    out[k] = v / sum;
  }
  return out;
}

// ───────── Max drawdown ─────────

export function maxDrawdown(prices: { date: string; close: number }[]): number {
  if (prices.length < 2) return 0;
  let peak = prices[0].close;
  let maxDD = 0;
  for (const p of prices) {
    if (p.close > peak) peak = p.close;
    const dd = (peak - p.close) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

export function portfolioMaxDrawdown(
  weights: Record<string, number>,
  series: Record<string, { date: string; close: number }[]>,
): number {
  const tickers = Object.keys(weights);
  const dates = new Set<string>();
  for (const t of tickers) {
    for (const p of series[t] ?? []) dates.add(p.date);
  }
  const sortedDates = [...dates].sort();
  if (sortedDates.length < 2) return 0;

  const priceMap: Record<string, Record<string, number>> = {};
  for (const t of tickers) {
    priceMap[t] = {};
    for (const p of series[t] ?? []) priceMap[t][p.date] = p.close;
  }

  const portfolioValues: number[] = [];
  for (const date of sortedDates) {
    let val = 0;
    for (const t of tickers) {
      val += (weights[t] ?? 0) * (priceMap[t][date] ?? 0);
    }
    portfolioValues.push(val);
  }

  let peak = portfolioValues[0];
  let maxDD = 0;
  for (const v of portfolioValues) {
    if (v > peak) peak = v;
    const dd = peak > 0 ? (peak - v) / peak : 0;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

// ───────── Optimization options ─────────

export type OptimizationTarget =
  | "min_volatility"
  | "max_sharpe"
  | "target_return";

export type OptimizationOptions = {
  bounds?: Record<string, { min?: number; max?: number }>;
  step?: number;
  iterations?: number;
  target?: OptimizationTarget;
  targetReturn?: number;
};

// ───────── Efficient Frontier ─────────

export type FrontierPoint = {
  expectedReturn: number;
  volatility: number;
  sharpe: number;
  weights: Record<string, number>;
};

export function computeEfficientFrontier(
  initialWeights: Record<string, number>,
  returns: Returns,
  options: OptimizationOptions = {},
  points = 20,
): FrontierPoint[] {
  const tickers = Object.keys(initialWeights);
  const cov = buildCovarianceMatrix(tickers, returns);
  const means = tickers.map((t) => mean(returns[t] ?? []));
  const minReturn = Math.min(...means);
  const maxReturn = Math.max(...means);
  const range = maxReturn - minReturn;

  const frontier: FrontierPoint[] = [];

  for (let i = 0; i <= points; i++) {
    const targetReturn = minReturn + (range * i) / points;
    const result = optimizeForTarget(
      initialWeights,
      returns,
      cov,
      {
        ...options,
        target: "target_return",
        targetReturn,
      },
    );
    const stats = portfolioStats(result.weights, returns, cov);
    frontier.push({
      expectedReturn: stats.annualizedReturn * 100,
      volatility: stats.annualizedVol * 100,
      sharpe: stats.sharpeRatio,
      weights: result.weights,
    });
  }

  return frontier;
}

// ───────── Core optimizer ─────────

function optimizeForTarget(
  initialWeights: Record<string, number>,
  returns: Returns,
  cov: CovarianceMatrix,
  options: OptimizationOptions,
) {
  const { step = 0.01, iterations = 3000, target = "min_volatility" } = options;
  const bounds = options.bounds ?? {};
  const tickers = Object.keys(initialWeights);
  let weights = normalize({ ...initialWeights });
  let bestStats = portfolioStats(weights, returns, cov);
  let bestScore = scorePortfolio(bestStats, target, options.targetReturn);

  for (let iter = 0; iter < iterations; iter++) {
    let improved = false;

    for (let i = 0; i < tickers.length; i++) {
      for (let j = 0; j < tickers.length; j++) {
        if (i === j) continue;
        const a = tickers[i];
        const b = tickers[j];
        const aBound = bounds[a] ?? {};
        const bBound = bounds[b] ?? {};
        const next = { ...weights };

        const currentStep = step * (1 - iter / iterations * 0.8);

        const moveable = Math.min(
          currentStep,
          (next[a] ?? 0) - (aBound.min ?? 0),
          (bBound.max ?? 1) - (next[b] ?? 0),
        );
        if (moveable <= 1e-6) continue;

        next[a] = (next[a] ?? 0) - moveable;
        next[b] = (next[b] ?? 0) + moveable;
        const candidate = portfolioStats(next, returns, cov);
        const candidateScore = scorePortfolio(candidate, target, options.targetReturn);

        if (candidateScore < bestScore - 1e-12) {
          weights = next;
          bestStats = candidate;
          bestScore = candidateScore;
          improved = true;
        }
      }
    }
    if (!improved) break;
  }

  const rounded: Record<string, number> = {};
  for (const t of tickers) {
    rounded[t] = Math.max(0, Math.round((weights[t] ?? 0) * 1000) / 1000);
  }
  return {
    weights: normalize(rounded),
    stats: portfolioStats(normalize(rounded), returns, cov),
  };
}

function scorePortfolio(
  stats: PortfolioStats,
  target: OptimizationTarget,
  targetReturn?: number,
): number {
  switch (target) {
    case "min_volatility":
      return stats.variance;
    case "max_sharpe":
      return -stats.sharpeRatio;
    case "target_return": {
      const returnPenalty = targetReturn != null
        ? Math.pow(stats.expectedReturn - targetReturn, 2) * 1000
        : 0;
      return stats.variance + returnPenalty;
    }
  }
}

// ───────── Public API ─────────

export function optimizeMinVariance(
  initialWeights: Record<string, number>,
  returns: Returns,
  options: OptimizationOptions = {},
) {
  const tickers = Object.keys(initialWeights);
  const cov = buildCovarianceMatrix(tickers, returns);
  return optimizeForTarget(initialWeights, returns, cov, {
    ...options,
    target: "min_volatility",
  });
}

export function optimizeMaxSharpe(
  initialWeights: Record<string, number>,
  returns: Returns,
  options: OptimizationOptions = {},
) {
  const tickers = Object.keys(initialWeights);
  const cov = buildCovarianceMatrix(tickers, returns);
  return optimizeForTarget(initialWeights, returns, cov, {
    ...options,
    target: "max_sharpe",
  });
}
