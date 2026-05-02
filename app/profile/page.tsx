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
  { items: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; color: string }[] }
> = {
  "Steady Builder": {
    items: [
      { icon: PiggyBank, label: "Investment Mix", value: "Heavy bonds & stable ETFs, light on individual stocks", color: "#10b981" },
      { icon: TrendingUp, label: "Expected Return", value: "~5% per year", color: "#3b82f6" },
      { icon: Zap, label: "Rebalance Frequency", value: "Quarterly check-ins", color: "#8b5cf6" },
      { icon: AlertTriangle, label: "Drawdown Alerts", value: "We'll flag drops over 8%", color: "#f59e0b" },
    ],
  },
  "Balanced Climber": {
    items: [
      { icon: PiggyBank, label: "Investment Mix", value: "Mix of growth stocks, ETFs, and some bonds", color: "#10b981" },
      { icon: TrendingUp, label: "Expected Return", value: "~7% per year", color: "#3b82f6" },
      { icon: Zap, label: "Rebalance Frequency", value: "Quarterly check-ins", color: "#8b5cf6" },
      { icon: AlertTriangle, label: "Drawdown Alerts", value: "We'll flag drops over 15%", color: "#f59e0b" },
    ],
  },
  "Bold Grower": {
    items: [
      { icon: PiggyBank, label: "Investment Mix", value: "Growth-heavy stocks and aggressive ETFs", color: "#10b981" },
      { icon: TrendingUp, label: "Expected Return", value: "~9% per year", color: "#3b82f6" },
      { icon: Zap, label: "Rebalance Frequency", value: "Semi-annual check-ins", color: "#8b5cf6" },
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
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Target className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            No investor profile yet
          </h1>
          <p className="text-muted-foreground">
            Take a quick quiz so Nestor can personalize your experience.
          </p>
          <Button
            size="lg"
            onClick={() => router.push("/onboarding")}
            className="gap-2"
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
    <div className="max-w-5xl mx-auto py-8 space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-1"
      >
        <h1 className="text-3xl font-bold text-foreground">My Investor Profile</h1>
        <p className="text-muted-foreground">
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
          <Card className="border-2 overflow-hidden h-full">
            <div className="bg-gradient-to-br from-primary/5 via-primary/8 to-primary/15 p-6 h-full">
              <div className="flex flex-col items-center text-center gap-4">
                <div className="text-5xl">{profileInfo.emoji}</div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Your Profile Type
                  </p>
                  <h2 className="text-2xl font-bold text-foreground">
                    {profile.profile_label}
                  </h2>
                  <p className="text-primary font-semibold">
                    {profileInfo.tagline}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {profileInfo.description}
                </p>

                {/* Highlights */}
                <div className="border-t border-border/50 pt-4 mt-1 w-full space-y-3">
                  {profileInfo.highlights.map((highlight, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.1 }}
                      className="flex items-start gap-3 text-left"
                    >
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <p className="text-sm text-foreground">{highlight}</p>
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
            <h3 className="text-lg font-semibold text-foreground mb-3">At a Glance</h3>
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
                  <Card className="p-4 text-center h-full">
                    <Icon className="w-5 h-5 text-primary mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground font-medium">{label}</p>
                    <p className="text-sm font-bold text-foreground mt-1">{value}</p>
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
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="w-5 h-5 text-primary" />
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
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${color}15` }}
                    >
                      <Icon className="w-4 h-4" style={{ color }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {label}
                      </p>
                      <p className="font-medium text-foreground mt-0.5">{value}</p>
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
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Answers</CardTitle>
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
                  className="flex items-start gap-3 p-4 rounded-xl border border-border bg-card"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CategoryIcon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground leading-snug">
                      {question.title}
                    </p>
                    <p className="font-semibold text-foreground mt-1 text-lg">
                      {matchedOption?.label ?? "—"}
                    </p>
                    {matchedOption?.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">
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
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Retake Quiz
        </Button>
        <Button
          size="lg"
          onClick={() => router.push("/dashboard")}
          className="gap-2"
        >
          Go to Dashboard
          <ArrowRight className="w-4 h-4" />
        </Button>
      </motion.div>
    </div>
  );
}
