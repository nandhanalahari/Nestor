"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  ShieldAlert,
  Wallet,
  Target,
  ArrowRight,
  ArrowLeft,
  Loader2,
  TrendingUp,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { RiskMeter } from "@/components/RiskMeter";
import { authFetch } from "@/lib/api";
import {
  QUIZ_QUESTIONS,
  PROFILE_DESCRIPTIONS,
  computeRiskScore,
  deriveProfileLabel,
  deriveHorizonYears,
  deriveLiquidityMonths,
  type QuizAnswers,
  type GoalKind,
  type ProfileLabel,
  type UserProfile,
} from "@/lib/profile";

// localStorage key for profile persistence
const PROFILE_STORAGE_KEY = "nestor_user_profile";

// Map icon names from question definitions to actual components
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Calendar,
  ShieldAlert,
  Wallet,
  Target,
};

// ─── Animation variants ──────────────────────────────────────────────────────

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
    scale: 0.95,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -300 : 300,
    opacity: 0,
    scale: 0.95,
  }),
};

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

// ─── Main component ──────────────────────────────────────────────────────────

type Step = "welcome" | "quiz" | "result";

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [step, setStep] = useState<Step>("welcome");
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = back
  const [selectedOptions, setSelectedOptions] = useState<(number | null)[]>(
    new Array(QUIZ_QUESTIONS.length).fill(null),
  );
  // Track which option index was selected (not the value, since some share values)
  const [selectedOptionIndices, setSelectedOptionIndices] = useState<(number | null)[]>(
    new Array(QUIZ_QUESTIONS.length).fill(null),
  );
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    label: ProfileLabel;
  } | null>(null);

  // ─── Handlers ────────────────────────────────────────────────────────────

  const selectOption = useCallback(
    (questionIdx: number, optionIdx: number, value: number) => {
      setSelectedOptions((prev) => {
        const next = [...prev];
        next[questionIdx] = value;
        return next;
      });
      setSelectedOptionIndices((prev) => {
        const next = [...prev];
        next[questionIdx] = optionIdx;
        return next;
      });
    },
    [],
  );

  const goNext = useCallback(() => {
    if (currentQuestion < QUIZ_QUESTIONS.length - 1) {
      setDirection(1);
      setCurrentQuestion((q) => q + 1);
    } else {
      // Submit
      handleSubmit();
    }
  }, [currentQuestion, selectedOptions, selectedOptionIndices]);

  const goBack = useCallback(() => {
    if (currentQuestion > 0) {
      setDirection(-1);
      setCurrentQuestion((q) => q - 1);
    } else {
      setStep("welcome");
    }
  }, [currentQuestion]);

  const handleSubmit = async () => {
    if (!user) {
      router.push("/auth");
      return;
    }

    setSubmitting(true);

    const answers: QuizAnswers = {
      q1_horizon: selectedOptions[0] ?? 2,
      q2_risk: selectedOptions[1] ?? 2,
      q3_liquidity: selectedOptions[2] ?? 2,
      q4_goal: selectedOptions[3] ?? 3,
    };

    // Determine goal kind from the selected option index
    const q4OptionIdx = selectedOptionIndices[3] ?? 3;
    const q4Option = QUIZ_QUESTIONS[3].options[q4OptionIdx];
    const primary_goal_kind: GoalKind = q4Option?.goalKind ?? "growth";

    // Compute result client-side for the reveal
    const score = computeRiskScore(answers);
    const label = deriveProfileLabel(score);

    // Build full profile and save to localStorage (always works, even without DB)
    const fullProfile: UserProfile = {
      user_id: user.id,
      risk_score: score,
      profile_label: label,
      horizon_years: deriveHorizonYears(answers.q1_horizon),
      liquidity_window_months: deriveLiquidityMonths(answers.q3_liquidity),
      primary_goal_kind,
      answers,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(fullProfile));
    } catch {
      // localStorage might be full or disabled — non-fatal
    }

    // Also attempt to persist to Supabase (may fail if migration hasn't been run)
    try {
      const res = await authFetch("/api/profile", {
        method: "POST",
        body: JSON.stringify({ answers, primary_goal_kind }),
      });

      if (!res.ok) {
        const text = await res.text();
        let details: Record<string, unknown> = { status: res.status };
        if (text) {
          try {
            details = { ...details, ...JSON.parse(text) };
          } catch {
            details.body = text;
          }
        }
        console.error("Profile save to DB failed (localStorage backup used):", details);
      }
    } catch (e) {
      console.error("Profile API error (localStorage backup used):", e);
    }

    setResult({ score, label });
    setStep("result");
    setSubmitting(false);
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="-m-8 flex min-h-screen items-center justify-center overflow-hidden bg-[#f9f9fe] px-4 py-10 font-[Inter] text-[#002141]">
      <div className="w-full max-w-2xl">
        <AnimatePresence mode="wait" custom={direction}>
          {step === "welcome" && <WelcomeScreen onStart={() => setStep("quiz")} />}

          {step === "quiz" && (
            <QuizStep
              key={`q-${currentQuestion}`}
              question={QUIZ_QUESTIONS[currentQuestion]}
              questionIdx={currentQuestion}
              total={QUIZ_QUESTIONS.length}
              selectedOptionIdx={selectedOptionIndices[currentQuestion]}
              direction={direction}
              onSelect={(optIdx, value) =>
                selectOption(currentQuestion, optIdx, value)
              }
              onNext={goNext}
              onBack={goBack}
              isLast={currentQuestion === QUIZ_QUESTIONS.length - 1}
              submitting={submitting}
            />
          )}

          {step === "result" && result && (
            <ResultScreen
              score={result.score}
              label={result.label}
              onContinue={() => router.push("/")}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Welcome screen ──────────────────────────────────────────────────────────

function WelcomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <motion.div
      key="welcome"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
      className="space-y-8 rounded-lg border border-[#e0e0e0] bg-white p-8 text-center shadow-[0_20px_20px_rgba(0,0,0,0.04)]"
    >
      {/* Logo */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
        className="mx-auto flex h-20 w-20 items-center justify-center rounded-lg bg-[#002141] shadow-[0_20px_20px_rgba(0,0,0,0.04)]"
      >
        <TrendingUp className="h-10 w-10 text-white" />
      </motion.div>

      <motion.div {...fadeUp} transition={{ delay: 0.2 }} className="space-y-3">
        <h1 className="font-[Manrope] text-4xl font-bold tracking-tight text-[#002141]">
          Let&apos;s build your
          <br />
          <span className="text-[#003666]">investor profile</span>
        </h1>
        <p className="mx-auto max-w-md text-lg leading-relaxed text-[#3f5165]">
          Answer 4 quick questions so Nestor can tailor everything to you.
          No jargon, no wrong answers.
        </p>
      </motion.div>

      {/* Feature highlights */}
      <motion.div
        {...fadeUp}
        transition={{ delay: 0.4 }}
        className="flex flex-col gap-3 max-w-sm mx-auto"
      >
        {[
          { icon: ShieldAlert, text: "Understand your risk comfort" },
          { icon: Target, text: "Align with your goals" },
          { icon: Sparkles, text: "Get personalized recommendations" },
        ].map(({ icon: Icon, text }, i) => (
          <motion.div
            key={text}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + i * 0.1 }}
            className="flex items-center gap-3 rounded-lg border border-[#e0e0e0] bg-[#f9f9fe] p-3 text-left"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#eef4fb]">
              <Icon className="h-5 w-5 text-[#003666]" />
            </div>
            <span className="font-medium text-[#002141]">{text}</span>
          </motion.div>
        ))}
      </motion.div>

      <motion.div {...fadeUp} transition={{ delay: 0.7 }}>
        <Button
          size="lg"
          onClick={onStart}
          className="gap-2 rounded-lg bg-[#002141] px-8 py-6 text-lg text-white shadow-[0_20px_20px_rgba(0,0,0,0.04)] transition-colors hover:bg-[#003666]"
        >
          Get Started
          <ArrowRight className="w-5 h-5" />
        </Button>
        <p className="mt-3 text-xs text-[#3f5165]">
          Takes about 1 minute
        </p>
      </motion.div>
    </motion.div>
  );
}

// ─── Quiz step ───────────────────────────────────────────────────────────────

function QuizStep({
  question,
  questionIdx,
  total,
  selectedOptionIdx,
  direction,
  onSelect,
  onNext,
  onBack,
  isLast,
  submitting,
}: {
  question: (typeof QUIZ_QUESTIONS)[number];
  questionIdx: number;
  total: number;
  selectedOptionIdx: number | null;
  direction: number;
  onSelect: (optionIdx: number, value: number) => void;
  onNext: () => void;
  onBack: () => void;
  isLast: boolean;
  submitting: boolean;
}) {
  const IconComponent = ICON_MAP[question.icon] ?? Target;
  const hasSelection = selectedOptionIdx !== null;

  return (
    <motion.div
      key={`q-${questionIdx}`}
      custom={direction}
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="space-y-6 rounded-lg border border-[#e0e0e0] bg-white p-6 shadow-[0_20px_20px_rgba(0,0,0,0.04)]"
    >
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-[#3f5165]">
          <span className="font-medium">{question.category}</span>
          <span>
            {questionIdx + 1} of {total}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[#eef4fb]">
          <motion.div
            className="h-full rounded-full bg-[#003666]"
            initial={{ width: `${(questionIdx / total) * 100}%` }}
            animate={{ width: `${((questionIdx + 1) / total) * 100}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="space-y-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#f7e382]">
          <IconComponent className="h-6 w-6 text-[#002141]" />
        </div>
        <h2 className="font-[Manrope] text-2xl font-bold leading-tight text-[#002141]">
          {question.title}
        </h2>
        <p className="text-[#3f5165]">{question.subtitle}</p>
      </div>

      {/* Options */}
      <div className="space-y-3">
        {question.options.map((option, optIdx) => {
          const isSelected = selectedOptionIdx === optIdx;
          return (
            <motion.button
              key={optIdx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: optIdx * 0.08 }}
              onClick={() => onSelect(optIdx, option.value)}
              className={`
                w-full rounded-lg border p-4 text-left transition-all duration-200
                hover:border-[#7aa0d6] hover:bg-[#eef4fb] active:scale-[0.98]
                ${
                  isSelected
                    ? "border-[#003666] bg-[#eef4fb] shadow-[0_20px_20px_rgba(0,0,0,0.04)]"
                    : "border-[#e0e0e0] bg-white"
                }
              `}
            >
              <div className="flex items-center gap-3">
                {/* Selection indicator */}
                <div
                  className={`
                    flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2
                    transition-all duration-200
                    ${
                      isSelected
                        ? "border-[#002141] bg-[#002141]"
                        : "border-[#d7dce5]"
                    }
                  `}
                >
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    >
                      <CheckCircle2 className="h-5 w-5 text-white" />
                    </motion.div>
                  )}
                </div>

                <div className="flex-1">
                  <p
                    className={`font-semibold ${
                      isSelected ? "text-[#003666]" : "text-[#002141]"
                    }`}
                  >
                    {option.label}
                  </p>
                  {option.description && (
                    <p className="mt-0.5 text-sm text-[#3f5165]">
                      {option.description}
                    </p>
                  )}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="ghost"
          onClick={onBack}
          className="gap-1 text-[#3f5165] hover:bg-[#eef4fb] hover:text-[#002141]"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        <Button
          onClick={onNext}
          disabled={!hasSelection || submitting}
          className="gap-2 bg-[#002141] px-6 text-white shadow-[0_20px_20px_rgba(0,0,0,0.04)] hover:bg-[#003666]"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isLast ? (
            <>
              See My Profile
              <Sparkles className="w-4 h-4" />
            </>
          ) : (
            <>
              Next
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );
}

// ─── Result screen ───────────────────────────────────────────────────────────

function ResultScreen({
  label,
  onContinue,
}: {
  score: number;
  label: ProfileLabel;
  onContinue: () => void;
}) {
  const profile = PROFILE_DESCRIPTIONS[label];

  return (
    <motion.div
      key="result"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6 }}
      className="space-y-8 rounded-lg border border-[#e0e0e0] bg-white p-8 text-center shadow-[0_20px_20px_rgba(0,0,0,0.04)]"
    >
      {/* Animated emoji */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5, rotate: -20 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
        className="text-6xl"
      >
        {profile.emoji}
      </motion.div>

      {/* Profile name + tagline */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="space-y-3"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#7aa0d6]">
          Your Investor Profile
        </p>
        <h1 className="font-[Manrope] text-4xl font-bold tracking-tight text-[#002141]">{label}</h1>
        <p className="text-lg font-semibold text-[#003666]">{profile.tagline}</p>
      </motion.div>

      {/* Profile card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="mx-auto max-w-md space-y-4 rounded-lg border border-[#e0e0e0] bg-[#f9f9fe] p-6 text-left"
      >
        <p className="leading-relaxed text-[#3f5165]">
          {profile.description}
        </p>

        <div className="space-y-3 border-t border-[#e0e0e0] pt-4">
          {profile.highlights.map((highlight, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.0 + i * 0.15 }}
              className="flex items-start gap-3"
            >
              <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#f7e382]">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#002141]" />
              </div>
              <p className="text-sm text-[#002141]">{highlight}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.6 }}
        className="space-y-3"
      >
        <Button
          size="lg"
          onClick={onContinue}
          className="gap-2 rounded-lg bg-[#002141] px-8 py-6 text-lg text-white shadow-[0_20px_20px_rgba(0,0,0,0.04)] hover:bg-[#003666]"
        >
          Go to Dashboard
          <ArrowRight className="w-5 h-5" />
        </Button>
        <p className="text-xs text-[#3f5165]">
          You can retake this quiz anytime from your profile settings
        </p>
      </motion.div>
    </motion.div>
  );
}
