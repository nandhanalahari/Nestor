"use client";

import { useCallback, useMemo } from "react";
import useSWR from "swr";

import { authFetch } from "@/lib/api";

/** Matches SQL migration breakpoints; index `level` (1-based) = XP needed for next level */
const XP_BREAKPOINTS = [0, 100, 300, 600, 1000, 1500, 2100] as const;

const LEVEL_LABELS = [
  "Saver",
  "Planner",
  "Investor",
  "Builder",
  "Allocator",
  "Strategist",
  "Master",
] as const;

export type XpApiPayload = {
  totalXP: number;
  level: number;
  xpThisWeek: number;
};

export type XpState = {
  totalXP: number;
  level: number;
  xpThisWeek: number;
  xpToNextLevel: number;
  levelLabel: (typeof LEVEL_LABELS)[number];
};

function labelForLevel(level: number): (typeof LEVEL_LABELS)[number] {
  if (level >= 1 && level <= LEVEL_LABELS.length) {
    return LEVEL_LABELS[level - 1];
  }
  return LEVEL_LABELS[0];
}

function deriveXpState(payload: XpApiPayload | undefined): XpState {
  const totalXP = payload?.totalXP ?? 0;
  const rawLevel = payload?.level ?? 1;
  const level = Math.min(7, Math.max(1, Math.floor(rawLevel)));
  const xpThisWeek = payload?.xpThisWeek ?? 0;

  const xpToNextLevel =
    level >= 7 ? 0 : Math.max(0, XP_BREAKPOINTS[level] - totalXP);

  return {
    totalXP,
    level,
    xpThisWeek,
    xpToNextLevel,
    levelLabel: labelForLevel(level),
  };
}

async function xpFetcher(url: string): Promise<XpApiPayload> {
  const res = await authFetch(url);
  if (res.status === 401) {
    throw new Error("Not authenticated");
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Failed to load XP");
  }
  return res.json() as Promise<XpApiPayload>;
}

export function useXP() {
  const { data, isLoading, mutate } = useSWR("/api/xp", xpFetcher, {
    revalidateOnFocus: true,
    shouldRetryOnError: false,
  });

  const xpState = useMemo(() => deriveXpState(data), [data]);

  const awardXP = useCallback(
    async (amount: number, reason: string): Promise<void> => {
      const res = await authFetch("/api/xp/award", {
        method: "POST",
        body: JSON.stringify({ amount, reason }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? res.statusText);
      }

      await mutate();
    },
    [mutate],
  );

  return {
    awardXP,
    xpState,
    isLoading,
  };
}
