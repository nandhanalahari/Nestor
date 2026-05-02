"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight,
  RefreshCw,
  Calendar,
  Shield,
  Wallet,
  Target,
  Loader2,
  TrendingUp,
  Clock,
  PiggyBank,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/components/auth-provider";
import { supabase } from "@/lib/supabase/client";
import {
  QUIZ_QUESTIONS,
  PROFILE_DESCRIPTIONS,
  type UserProfile,
  type ProfileLabel,
} from "@/lib/profile";

const PROFILE_STORAGE_KEY = "nestor_user_profile";

// What this profile means for portfolio strategy
const PROFILE_STRATEGY: Record<
  ProfileLabel,
  {
    items: {
      icon: React.ComponentType<{
        className?: string;
        style?: React.CSSProperties;
      }>;
      label: string;
      value: string;
      color: string;
    }[];
  }
> = {
  "Steady Builder": {
    items: [
      { icon: PiggyBank, label: "Investment Mix", value: "Heavy bonds & stable ETFs, light on individual stocks", color: "#10b981" },
      { icon: TrendingUp, label: "Expected Return", value: "~5% per year", color: "var(--primary)" },
      { icon: Zap, label: "Rebalance Frequency", value: "Quarterly check-ins", color: "var(--foreground)" },
      { icon: AlertTriangle, label: "Drawdown Alerts", value: "We'll flag drops over 8%", color: "#f59e0b" },
    ],
  },
  "Balanced Climber": {
    items: [
      { icon: PiggyBank, label: "Investment Mix", value: "Mix of growth stocks, ETFs, and some bonds", color: "#10b981" },
      { icon: TrendingUp, label: "Expected Return", value: "~7% per year", color: "var(--primary)" },
      { icon: Zap, label: "Rebalance Frequency", value: "Quarterly check-ins", color: "var(--foreground)" },
      { icon: AlertTriangle, label: "Drawdown Alerts", value: "We'll flag drops over 15%", color: "#f59e0b" },
    ],
  },
  "Bold Grower": {
    items: [
      { icon: PiggyBank, label: "Investment Mix", value: "Growth-heavy stocks and aggressive ETFs", color: "#10b981" },
      { icon: TrendingUp, label: "Expected Return", value: "~9% per year", color: "var(--primary)" },
      { icon: Zap, label: "Rebalance Frequency", value: "Semi-annual check-ins", color: "var(--foreground)" },
      { icon: AlertTriangle, label: "Drawdown Alerts", value: "We'll only flag drops over 25%", color: "#f59e0b" },
    ],
  },
};

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "Goals & Time Horizon": Calendar,
  "Risk Tolerance": Shield,
  "Financial Capacity": Wallet,
};

function getGoalLabel(kind: string): string {
  const labels: Record<string, string> = {
    house: "House Deposit",
    education: "Education",
    retirement: "Retirement",
    growth: "General Growth",
    other: "Other",
  };
  return labels[kind] ?? kind;
}

function getHorizonLabel(years: number): string {
  if (years <= 1) return "Less than 2 years";
  if (years <= 3) return "2–5 years";
  if (years <= 7) return "5–10 years";
  return "10+ years";
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/auth");
      return;
    }

    const fetchProfile = async () => {
      let fetched = false;

      // Try API first (Supabase DB)
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const res = await fetch("/api/profile", {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          if (data.profile) {
            setProfile(data.profile);
            fetched = true;
          }
        }
      } catch (e) {
        console.error("Failed to fetch profile from API:", e);
      }

      // Fallback to localStorage
      if (!fetched) {
        try {
          const stored = localStorage.getItem(PROFILE_STORAGE_KEY);
          if (stored) {
            const parsed = JSON.parse(stored) as UserProfile;
            setProfile(parsed);
          }
        } catch {
          // localStorage parse failed
        }
      }

      setLoading(false);
    };

    fetchProfile();
  }, [user, authLoading, router]);

  if (authLoading || loading) {
    return (
      <div className="-mx-4 -my-8 flex min-h-screen items-center justify-center bg-[#f9f9fe] md:-mx-8">
        <Loader2 className="h-8 w-8 animate-spin text-[#003666]" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="-mx-4 -my-8 min-h-screen bg-[#f9f9fe] px-4 py-16 font-[Inter] text-[#002141] md:-mx-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-lg space-y-4 rounded-lg border border-[#e0e0e0] bg-white p-8 text-center shadow-[0_20px_20px_rgba(0,0,0,0.04)]"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-[#f7e382]">
            <Target className="h-8 w-8 text-[#002141]" />
          </div>
          <h1 className="font-[Manrope] text-2xl font-bold text-[#002141]">
            No investor profile yet
          </h1>
          <p className="text-[#3f5165]">
            Take a quick quiz so Nestor can personalize your experience.
          </p>
          <Button
            size="lg"
            onClick={() => router.push("/onboarding")}
            className="gap-2 bg-[#002141] text-white hover:bg-[#003666]"
          >
            Take the Quiz
            <ArrowRight className="w-4 h-4" />
          </Button>
        </motion.div>
      </div>
    );
  }

  const profileInfo = PROFILE_DESCRIPTIONS[profile.profile_label];
  const strategy = PROFILE_STRATEGY[profile.profile_label];
  const answerKeys = ["q1_horizon", "q2_risk", "q3_liquidity", "q4_goal"] as const;

  return (
    <div className="-mx-4 -my-8 min-h-screen bg-[#f9f9fe] px-4 py-10 font-[Inter] text-[#002141] md:-mx-8 md:px-8">
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg border border-[#e0e0e0] bg-white p-6 shadow-[0_20px_20px_rgba(0,0,0,0.04)]"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7aa0d6]">
          Account Dashboard
        </p>
        <h1 className="mt-3 font-[Manrope] text-3xl font-bold tracking-tight text-[#002141]">My Investor Profile</h1>
        <p className="mt-1 text-[#3f5165]">
          Your personalized investment strategy based on your quiz results
        </p>
      </motion.div>

      {/* ── Two-column layout: Profile (left) | At a Glance + Strategy (right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* LEFT: Profile type card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="h-full overflow-hidden border-[#e0e0e0] bg-white shadow-[0_20px_20px_rgba(0,0,0,0.04)]">
            <div className="h-full bg-white p-6">
              <div className="flex flex-col items-center text-center gap-4">
                <div className="text-5xl">{profileInfo.emoji}</div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7aa0d6]">
                    Your Profile Type
                  </p>
                  <h2 className="font-[Manrope] text-2xl font-bold text-[#002141]">
                    {profile.profile_label}
                  </h2>
                  <p className="font-semibold text-[#003666]">
                    {profileInfo.tagline}
                  </p>
                </div>
                <p className="text-sm leading-relaxed text-[#3f5165]">
                  {profileInfo.description}
                </p>

                {/* Highlights */}
                <div className="mt-1 w-full space-y-3 border-t border-[#e0e0e0] pt-4">
                  {profileInfo.highlights.map((highlight, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.1 }}
                      className="flex items-start gap-3 text-left"
                    >
                      <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#f7e382]">
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#002141]" />
                      </div>
                      <p className="text-sm text-[#002141]">{highlight}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* RIGHT: At a Glance + Investment Strategy */}
        <div className="space-y-6">
          {/* At a Glance */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <h3 className="mb-3 font-[Manrope] text-lg font-semibold text-[#002141]">At a Glance</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  label: "Time Horizon",
                  value: getHorizonLabel(profile.horizon_years),
                  icon: Clock,
                },
                {
                  label: "Primary Goal",
                  value: getGoalLabel(profile.primary_goal_kind),
                  icon: Target,
                },
                {
                  label: "Liquidity Buffer",
                  value: profile.liquidity_window_months <= 1
                    ? "~$1,000"
                    : profile.liquidity_window_months <= 3
                      ? "~$5,000"
                      : "~$20,000",
                  icon: Wallet,
                },
              ].map(({ label, value, icon: Icon }, i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.05 }}
                >
                  <Card className="h-full border-[#e0e0e0] bg-white p-4 text-center shadow-[0_20px_20px_rgba(0,0,0,0.04)]">
                    <Icon className="mx-auto mb-2 h-5 w-5 text-[#003666]" />
                    <p className="text-xs font-medium text-[#3f5165]">{label}</p>
                    <p className="mt-1 text-sm font-bold text-[#002141]">{value}</p>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Investment Strategy */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Card className="border-[#e0e0e0] bg-white shadow-[0_20px_20px_rgba(0,0,0,0.04)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-[Manrope] text-lg text-[#002141]">
                  <Info className="h-5 w-5 text-[#003666]" />
                  What This Means for Your Portfolio
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {strategy.items.map(({ icon: Icon, label, value, color }, i) => (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.05 }}
                    className="flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-[#eef4fb]"
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${color}15` }}
                    >
                      <Icon className="w-4 h-4" style={{ color }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7a8797]">
                        {label}
                      </p>
                      <p className="mt-0.5 font-medium text-[#002141]">{value}</p>
                    </div>
                  </motion.div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* ── Your answers ──────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="border-[#e0e0e0] bg-white shadow-[0_20px_20px_rgba(0,0,0,0.04)]">
          <CardHeader>
            <CardTitle className="font-[Manrope] text-lg text-[#002141]">Your Answers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {QUIZ_QUESTIONS.map((question, idx) => {
              const key = answerKeys[idx];
              const answerValue = profile.answers[key];
              const matchedOption = question.options.find(
                (o) => o.value === answerValue,
              );
              const CategoryIcon =
                CATEGORY_ICONS[question.category] ?? Target;

              return (
                <div
                  key={question.id}
                  className="flex items-start gap-3 rounded-lg border border-[#e0e0e0] bg-[#f9f9fe] p-4"
                >
                  <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#eef4fb]">
                    <CategoryIcon className="h-5 w-5 text-[#003666]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug text-[#3f5165]">
                      {question.title}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-[#002141]">
                      {matchedOption?.label ?? "—"}
                    </p>
                    {matchedOption?.description && (
                      <p className="mt-0.5 text-xs text-[#3f5165]">
                        {matchedOption.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Actions ───────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="flex flex-col sm:flex-row items-center justify-center gap-3 pb-8"
      >
        <Button
          variant="outline"
          size="lg"
          onClick={() => router.push("/onboarding")}
          className="gap-2 border-[#d7dce5] bg-white text-[#002141] shadow-[0_20px_20px_rgba(0,0,0,0.04)] hover:bg-[#eef4fb] hover:text-[#003666]"
        >
          <RefreshCw className="w-4 h-4" />
          Retake Quiz
        </Button>
        <Button
          size="lg"
          onClick={() => router.push("/dashboard")}
          className="gap-2 bg-[#002141] text-white shadow-[0_20px_20px_rgba(0,0,0,0.04)] hover:bg-[#003666]"
        >
          Go to Dashboard
          <ArrowRight className="w-4 h-4" />
        </Button>
      </motion.div>
    </div>
    </div>
  );
}
