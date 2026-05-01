type Returns = Record<string, number[]>;

function mean(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
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

export type PortfolioStats = {
  expectedReturn: number;
  variance: number;
  volatility: number;
};

export function portfolioStats(
  weights: Record<string, number>,
  returns: Returns,
): PortfolioStats {
  const tickers = Object.keys(weights);
  let expected = 0;
  for (const t of tickers) {
    expected += (weights[t] ?? 0) * mean(returns[t] ?? []);
  }
  let variance = 0;
  for (const i of tickers) {
    for (const j of tickers) {
      const wi = weights[i] ?? 0;
      const wj = weights[j] ?? 0;
      const cov = covariance(returns[i] ?? [], returns[j] ?? []);
      variance += wi * wj * cov;
    }
  }
  return {
    expectedReturn: expected,
    variance,
    volatility: Math.sqrt(Math.max(variance, 0)),
  };
}

function normalize(weights: Record<string, number>) {
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  if (sum === 0) return weights;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(weights)) {
    out[k] = v / sum;
  }
  return out;
}

export type OptimizationOptions = {
  bounds?: Record<string, { min?: number; max?: number }>;
  step?: number;
  iterations?: number;
};

export function optimizeMinVariance(
  initialWeights: Record<string, number>,
  returns: Returns,
  options: OptimizationOptions = {},
) {
  const { step = 0.02, iterations = 1500 } = options;
  const bounds = options.bounds ?? {};
  const tickers = Object.keys(initialWeights);
  let weights = normalize({ ...initialWeights });
  let bestStats = portfolioStats(weights, returns);

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
        const moveable = Math.min(
          step,
          (next[a] ?? 0) - (aBound.min ?? 0),
          (bBound.max ?? 1) - (next[b] ?? 0),
        );
        if (moveable <= 0) continue;
        next[a] = (next[a] ?? 0) - moveable;
        next[b] = (next[b] ?? 0) + moveable;
        const candidate = portfolioStats(next, returns);
        if (candidate.variance + 1e-9 < bestStats.variance) {
          weights = next;
          bestStats = candidate;
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
    stats: portfolioStats(rounded, returns),
  };
}
