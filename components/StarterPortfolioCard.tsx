"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  PieChart as RechartsPie,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { Sparkles, Loader2, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/api";
import {
  getStarterPortfolio,
  DEFAULT_SEED_AMOUNT,
  type StarterPortfolio,
} from "@/lib/starterPortfolio";
import type { ProfileLabel } from "@/lib/profile";

const COLORS = [
  "hsl(221, 83%, 53%)",
  "hsl(142, 71%, 45%)",
  "hsl(262, 83%, 58%)",
  "hsl(24, 95%, 53%)",
  "hsl(355, 78%, 56%)",
  "hsl(199, 89%, 48%)",
  "hsl(45, 93%, 47%)",
];

type Props = {
  onSeeded: () => void | Promise<void>;
  onPickMyself: () => void;
};

type ProfileResponse = { profile: { profile_label: ProfileLabel } | null };

const VALID_LABELS: ProfileLabel[] = [
  "Steady Builder",
  "Balanced Climber",
  "Bold Grower",
];

function readLocalProfileLabel(): ProfileLabel | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("nestor_user_profile");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { profile_label?: string };
    const label = parsed?.profile_label;
    if (label && VALID_LABELS.includes(label as ProfileLabel)) {
      return label as ProfileLabel;
    }
    return null;
  } catch {
    return null;
  }
}

const MUTED_COLOR = "hsl(220, 10%, 75%)";

export function StarterPortfolioCard({ onSeeded, onPickMyself }: Props) {
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileLabel, setProfileLabel] = useState<ProfileLabel | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let resolved: ProfileLabel | null = null;
      try {
        const res = await authFetch("/api/profile");
        if (res.ok) {
          const data: ProfileResponse = await res.json();
          resolved = data.profile?.profile_label ?? null;
        }
      } catch {
        // Network or parse failure — fall through to localStorage.
      }
      // Fallback: onboarding writes the profile to localStorage when the
      // Supabase write fails (e.g. user_profiles migration not applied yet).
      if (!resolved) {
        resolved = readLocalProfileLabel();
      }
      if (!cancelled) {
        setProfileLabel(resolved);
        setLoadingProfile(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loadingProfile) {
    return (
      <Card>
        <CardContent className="p-12 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // No profile → nudge to take the quiz
  if (!profileLabel) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border-primary/30">
          <CardContent className="p-10 text-center space-y-3">
            <Sparkles className="w-10 h-10 text-primary mx-auto" />
            <h3 className="text-lg font-semibold text-foreground">
              Take the risk quiz to get a personalized starter portfolio
            </h3>
            <p className="text-sm text-muted-foreground">
              Five quick questions, then we'll match you to a starter portfolio
              you can build with one click.
            </p>
            <Link href="/onboarding">
              <Button className="gap-2 mt-2">
                Start the quiz <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  const template: StarterPortfolio = getStarterPortfolio(profileLabel);
  const pieData = template.tickers.map((t) => ({
    name: t.ticker,
    value: Math.round(t.weight * 100),
  }));

  const handleBuild = async () => {
    setSeeding(true);
    setError(null);
    try {
      const res = await authFetch("/api/holdings/seed", {
        method: "POST",
        body: JSON.stringify({
          seed_amount: DEFAULT_SEED_AMOUNT,
          profile_label: profileLabel,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not build starter portfolio.");
        return;
      }
      await onSeeded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not build starter portfolio.");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="border-primary/30">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">
              Recommended for <span className="text-primary">The {profileLabel}</span>
            </CardTitle>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{template.rationale}</p>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Pie chart */}
            <div className="h-64 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie
                  onClick={(_, e) => {
                    // Click anywhere on the chart background clears selection
                    if (e && (e.target as HTMLElement)?.tagName === "svg") {
                      setActiveIndex(null);
                    }
                  }}
                >
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={50}
                    isAnimationActive={false}
                    label={(entry: { name: string; value: number; index: number }) => {
                      const dim = activeIndex !== null && activeIndex !== entry.index;
                      return dim ? "" : `${entry.name} ${entry.value}%`;
                    }}
                    onClick={(_data, index) =>
                      setActiveIndex((cur) => (cur === index ? null : index))
                    }
                  >
                    {pieData.map((_, i) => {
                      const isActive = activeIndex === null || activeIndex === i;
                      return (
                        <Cell
                          key={i}
                          fill={isActive ? COLORS[i % COLORS.length] : MUTED_COLOR}
                          opacity={isActive ? 1 : 0.4}
                          stroke="none"
                          style={{ cursor: "pointer", outline: "none" }}
                        />
                      );
                    })}
                  </Pie>
                </RechartsPie>
              </ResponsiveContainer>
            </div>

            {/* Ticker rows */}
            <div className="space-y-2">
              {template.tickers.map((t, i) => {
                const isActive = activeIndex === null || activeIndex === i;
                return (
                  <button
                    type="button"
                    key={t.ticker}
                    onClick={() =>
                      setActiveIndex((cur) => (cur === i ? null : i))
                    }
                    className={`w-full flex items-start gap-3 py-1 text-left transition-opacity rounded-md hover:bg-muted/40 px-2 -mx-2 ${
                      isActive ? "opacity-100" : "opacity-40"
                    }`}
                  >
                    <div
                      className="w-3 h-3 rounded-full mt-1.5 shrink-0"
                      style={{
                        background: isActive
                          ? COLORS[i % COLORS.length]
                          : MUTED_COLOR,
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-semibold text-foreground">{t.ticker}</span>
                        <span className="text-sm text-muted-foreground">
                          {Math.round(t.weight * 100)}%
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground/80 mt-0.5">{t.role}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <p className="mt-4 text-sm text-destructive">{error}</p>
          )}

          <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3">
            <Button
              onClick={handleBuild}
              disabled={seeding}
              size="lg"
              className="gap-2"
            >
              {seeding ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {seeding ? "Building..." : `Build my starter portfolio ($${DEFAULT_SEED_AMOUNT.toLocaleString()})`}
            </Button>
            <button
              type="button"
              onClick={onPickMyself}
              className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
            >
              I'd rather pick myself
            </button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
