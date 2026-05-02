// lib/profile.ts — Risk quiz scoring logic, question definitions, and types
// Pure functions — no side effects, easy to test

// ─── Types ───────────────────────────────────────────────────────────────────

export type ProfileLabel = "Steady Builder" | "Balanced Climber" | "Bold Grower";

export type GoalKind = "house" | "education" | "retirement" | "growth" | "other";

export type QuizOption = {
  label: string;
  value: number;
  description?: string;
  goalKind?: GoalKind; // only used for Q4
  horizonYears?: number; // only used for Q1
  liquidityMonths?: number; // only used for Q3
};

export type QuizQuestion = {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  options: QuizOption[];
  weight: number;
  icon: string; // lucide icon name
};

export type QuizAnswers = {
  q1_horizon: number;
  q2_risk: number;
  q3_liquidity: number;
  q4_goal: number;
};

export type UserProfile = {
  user_id: string;
  risk_score: number;
  profile_label: ProfileLabel;
  horizon_years: number;
  liquidity_window_months: number;
  primary_goal_kind: GoalKind;
  answers: QuizAnswers;
  created_at?: string;
  updated_at?: string;
};

// ─── Question definitions ────────────────────────────────────────────────────

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "q1_horizon",
    category: "Goals & Time Horizon",
    title: "When do you think you'll need most of this money?",
    subtitle: "This helps us understand how long your investments can grow.",
    icon: "Calendar",
    weight: 0.35,
    options: [
      {
        label: "Less than 2 years",
        value: 1,
        description: "Short-term — you'll need it soon",
        horizonYears: 1,
      },
      {
        label: "2 – 5 years",
        value: 2,
        description: "Medium-term — a few years to grow",
        horizonYears: 3,
      },
      {
        label: "5 – 10 years",
        value: 3,
        description: "Long-term — plenty of time",
        horizonYears: 7,
      },
      {
        label: "10+ years",
        value: 4,
        description: "Very long-term — thinking ahead",
        horizonYears: 15,
      },
    ],
  },
  {
    id: "q2_risk",
    category: "Risk Tolerance",
    title: "Your investments drop 25% in a month. You…",
    subtitle: "There's no wrong answer — we just want to know how you'd feel.",
    icon: "ShieldAlert",
    weight: 0.35,
    options: [
      {
        label: "Sell most of it",
        value: 1,
        description: "Cut your losses and protect what's left",
      },
      {
        label: "Sell some of it",
        value: 2,
        description: "Reduce exposure but stay partially invested",
      },
      {
        label: "Hold steady",
        value: 3,
        description: "Wait it out — markets recover",
      },
      {
        label: "Buy more",
        value: 4,
        description: "Stocks are on sale — great opportunity",
      },
    ],
  },
  {
    id: "q3_liquidity",
    category: "Financial Capacity",
    title:
      "If something unexpected came up, how much should you be able to pull out within a week?",
    subtitle: "This helps us keep enough accessible for emergencies.",
    icon: "Wallet",
    weight: 0.15,
    options: [
      {
        label: "$1,000",
        value: 1,
        description: "A small safety net",
        liquidityMonths: 1,
      },
      {
        label: "$5,000",
        value: 2,
        description: "A comfortable cushion",
        liquidityMonths: 3,
      },
      {
        label: "$20,000",
        value: 3,
        description: "A large emergency fund",
        liquidityMonths: 6,
      },
      {
        label: "I'm not sure",
        value: 2,
        description: "That's okay — we'll use a sensible default",
        liquidityMonths: 3,
      },
    ],
  },
  {
    id: "q4_goal",
    category: "Goals & Time Horizon",
    title: "What's the main reason you're investing?",
    subtitle: "This shapes the kind of portfolio we'll suggest.",
    icon: "Target",
    weight: 0.15,
    options: [
      {
        label: "House deposit",
        value: 1,
        description: "Saving for a down payment",
        goalKind: "house",
      },
      {
        label: "Education",
        value: 2,
        description: "Funding school or learning",
        goalKind: "education",
      },
      {
        label: "Retirement",
        value: 3,
        description: "Building long-term wealth",
        goalKind: "retirement",
      },
      {
        label: "General growth",
        value: 4,
        description: "Growing your money over time",
        goalKind: "growth",
      },
      {
        label: "Something else",
        value: 3,
        description: "We'll tailor it to you either way",
        goalKind: "other",
      },
    ],
  },
];

// ─── Scoring ─────────────────────────────────────────────────────────────────

/**
 * Compute a risk score from 0–100 based on quiz answers.
 *
 * Formula:
 *   raw = (Q1 * 0.35) + (Q2 * 0.35) + (Q3 * 0.15) + (Q4 * 0.15)
 *   risk_score = round((raw - 1) / 3 * 100)
 *
 * Each answer is 1–4. Min raw = 1.0 → score 0. Max raw = 4.0 → score 100.
 */
export function computeRiskScore(answers: QuizAnswers): number {
  const raw =
    answers.q1_horizon * 0.35 +
    answers.q2_risk * 0.35 +
    answers.q3_liquidity * 0.15 +
    answers.q4_goal * 0.15;

  const score = Math.round(((raw - 1) / 3) * 100);
  return Math.max(0, Math.min(100, score));
}

/**
 * Map a 0–100 risk score to one of three profile labels.
 */
export function deriveProfileLabel(score: number): ProfileLabel {
  if (score <= 33) return "Steady Builder";
  if (score <= 66) return "Balanced Climber";
  return "Bold Grower";
}

/**
 * Derive horizon years from Q1 answer index.
 */
export function deriveHorizonYears(q1Value: number): number {
  const q1 = QUIZ_QUESTIONS[0];
  const option = q1.options.find((o) => o.value === q1Value);
  return option?.horizonYears ?? 3;
}

/**
 * Derive liquidity window (months) from Q3 answer index.
 */
export function deriveLiquidityMonths(q3Value: number): number {
  const q3 = QUIZ_QUESTIONS[2];
  const option = q3.options.find((o) => o.value === q3Value);
  return option?.liquidityMonths ?? 3;
}

/**
 * Derive primary goal kind from Q4 answer index.
 */
export function deriveGoalKind(q4Value: number, q4OptionIndex: number): GoalKind {
  const q4 = QUIZ_QUESTIONS[3];
  const option = q4.options[q4OptionIndex];
  return option?.goalKind ?? "growth";
}

/**
 * Build a complete UserProfile from quiz answers + user id.
 */
export function buildProfile(
  userId: string,
  answers: QuizAnswers,
  q4OptionIndex: number,
): Omit<UserProfile, "created_at" | "updated_at"> {
  const risk_score = computeRiskScore(answers);
  return {
    user_id: userId,
    risk_score,
    profile_label: deriveProfileLabel(risk_score),
    horizon_years: deriveHorizonYears(answers.q1_horizon),
    liquidity_window_months: deriveLiquidityMonths(answers.q3_liquidity),
    primary_goal_kind: deriveGoalKind(answers.q4_goal, q4OptionIndex),
    answers,
  };
}

// ─── Profile descriptions ────────────────────────────────────────────────────

export const PROFILE_DESCRIPTIONS: Record<
  ProfileLabel,
  { tagline: string; description: string; emoji: string; highlights: string[] }
> = {
  "Steady Builder": {
    tagline: "Slow and steady wins the race",
    description:
      "You prefer stability over big swings. We'll focus on lower-risk investments that protect your capital while still growing it steadily over time.",
    emoji: "🛡️",
    highlights: [
      "We'll prioritize stable ETFs and bonds to protect your capital",
      "You'll get alerts if your portfolio risk exceeds your comfort zone",
      "Scenarios will focus on preserving what you've built",
    ],
  },
  "Balanced Climber": {
    tagline: "A mix of growth and safety",
    description:
      "You're comfortable with some ups and downs in exchange for better returns. We'll build a balanced portfolio that grows while managing risk.",
    emoji: "⚖️",
    highlights: [
      "We'll blend growth stocks with stabilizing bonds and ETFs",
      "Rebalancing suggestions will keep your mix on track",
      "You'll see opportunities to grow without overexposing yourself",
    ],
  },
  "Bold Grower": {
    tagline: "Aiming for maximum growth",
    description:
      "You're in it for the long haul and can handle market swings. We'll target higher-growth investments that may be volatile but offer the best long-term returns.",
    emoji: "🚀",
    highlights: [
      "We'll lean into high-growth stocks and aggressive ETFs",
      "Dips are buying opportunities — we'll highlight them for you",
      "Your long time horizon means you can ride out short-term volatility",
    ],
  },
};

