/**
 * Portfolio health score (0–100), aligned with PRD F3: three weighted factors.
 */

export type HealthFactor = {
  key: string;
  score: number;
  plainText: string;
};

export type HealthProfileInput = {
  profile_label: string;
  liquidity_window_months: number;
};

function targetVolatilityPct(profileLabel: string): number {
  if (profileLabel === "Steady Builder") return 10;
  if (profileLabel === "Balanced Climber") return 15;
  if (profileLabel === "Bold Grower") return 23;
  return 15;
}

/** Rough annualized vol proxy from weighted one-day move (%). */
function realizedVolProxy(dailyChangePct: number): number {
  return Math.min(45, Math.abs(dailyChangePct) * Math.sqrt(252));
}

function diversificationFromWeights(weights: number[]): {
  score: number;
  plainText: string;
} {
  const hhi = weights.reduce((s, w) => s + w * w, 0);
  const score = Math.round(Math.max(0, Math.min(100, 100 * (1 - hhi))));
  const plainText =
    weights.length <= 1
      ? "Everything is in one bucket — adding more holdings spreads risk."
      : hhi > 0.35
        ? "A few positions dominate — consider spreading across more names."
        : "Your positions are reasonably spread out.";
  return { score, plainText };
}

function riskMatchScore(
  dailyChangePct: number,
  profile: HealthProfileInput | null,
): { score: number; plainText: string } {
  const target = profile
    ? targetVolatilityPct(profile.profile_label)
    : 15;
  const realized = realizedVolProxy(dailyChangePct);
  const k = 3;
  const raw = 100 - Math.abs(realized - target) * k;
  const score = Math.round(Math.max(0, Math.min(100, raw)));
  const plainText =
    realized <= target + 5
      ? "Today's market move lines up fairly well with your risk comfort."
      : "Recent swings look a bit sharper than your profile suggests — worth a second look.";
  return { score, plainText };
}

/** Without ML drawdown: liquidity runway vs a conservative stress horizon (months). */
function drawdownBufferScore(profile: HealthProfileInput | null): {
  score: number;
  plainText: string;
} {
  const liquidity = profile?.liquidity_window_months ?? 6;
  const maxDrawdownMonths = 18;
  const ratio = Math.min(1, Math.max(0, liquidity / maxDrawdownMonths));
  const score = Math.round(100 * ratio);
  const plainText =
    ratio >= 0.67
      ? "Your liquidity cushion gives you room if markets stay rough for a while."
      : "Building more cash or liquid holdings would soften a long drawdown.";
  return { score, plainText };
}

export function computeHealthScore(input: {
  marketValueWeights: number[];
  dailyChangePct: number;
  warnings: string[];
  profile: HealthProfileInput | null;
}): { healthScore: number; factors: HealthFactor[] } {
  const div = diversificationFromWeights(input.marketValueWeights);
  const risk = riskMatchScore(input.dailyChangePct, input.profile);
  const buf = drawdownBufferScore(input.profile);

  let combined = Math.round((div.score + risk.score + buf.score) / 3);
  const warnPenalty = Math.min(25, input.warnings.length * 5);
  combined = Math.max(0, Math.round(combined - warnPenalty));

  return {
    healthScore: combined,
    factors: [
      {
        key: "diversification",
        score: div.score,
        plainText: div.plainText,
      },
      {
        key: "risk_match",
        score: risk.score,
        plainText: risk.plainText,
      },
      {
        key: "drawdown_buffer",
        score: buf.score,
        plainText: buf.plainText,
      },
    ],
  };
}
