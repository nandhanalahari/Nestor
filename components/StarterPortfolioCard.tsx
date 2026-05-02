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
  "#002141",
  "#7aa0d6",
  "#f7e382",
  "#003666",
  "#8ca7c8",
  "#d9c95f",
  "#4c6582",
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

const MUTED_COLOR = "#d9dce5";

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
      <Card className="rounded-lg border-[#e0e0e0] bg-white shadow-[0_20px_20px_rgba(0,0,0,0.04)]">
        <CardContent className="p-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#003666]" />
        </CardContent>
      </Card>
    );
  }

  // No profile → nudge to take the quiz
  if (!profileLabel) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="rounded-lg border-[#e0e0e0] bg-white shadow-[0_20px_20px_rgba(0,0,0,0.04)]">
          <CardContent className="p-10 text-center space-y-3">
            <Sparkles className="mx-auto h-10 w-10 text-[#7aa0d6]" />
            <h3 className="font-display text-lg font-semibold text-[#002141]">
              Take the risk quiz to get a personalized starter portfolio
            </h3>
            <p className="text-sm leading-6 text-[#43474f]">
              Five quick questions, then we'll match you to a starter portfolio
              you can build with one click.
            </p>
            <Link href="/onboarding">
              <Button className="mt-2 gap-2 bg-[#002141] text-white hover:bg-[#003666]">
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
      <Card className="rounded-lg border-[#e0e0e0] bg-white shadow-[0_20px_20px_rgba(0,0,0,0.04)]">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#7aa0d6]" />
            <CardTitle className="font-display text-lg text-[#002141]">
              Recommended for <span className="text-[#003666]">The {profileLabel}</span>
            </CardTitle>
          </div>
          <p className="goldman-insight-accent mt-2 text-sm leading-6 text-[#524700]">{template.rationale}</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
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
                    className={`-mx-2 flex w-full items-start gap-3 rounded-md px-2 py-2 text-left transition-opacity hover:bg-[#eef3fa] ${
                      isActive ? "opacity-100" : "opacity-40"
                    }`}
                  >
                    <div
                      className="mt-1.5 h-3 w-3 shrink-0 rounded-full"
                      style={{
                        background: isActive
                          ? COLORS[i % COLORS.length]
                          : MUTED_COLOR,
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-display font-semibold text-[#002141]">{t.ticker}</span>
                        <span className="text-sm font-semibold text-[#003666]">
                          {Math.round(t.weight * 100)}%
                        </span>
                      </div>
                      <p className="truncate text-xs text-[#43474f]">{t.name}</p>
                      <p className="mt-0.5 text-xs text-[#6b7280]">{t.role}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <p className="mt-4 text-sm text-destructive">{error}</p>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              onClick={handleBuild}
              disabled={seeding}
              size="lg"
              className="gap-2 bg-[#002141] text-white hover:bg-[#003666]"
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
              className="text-sm font-medium text-[#43474f] underline-offset-4 hover:text-[#002141] hover:underline"
            >
              I'd rather pick myself
            </button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
