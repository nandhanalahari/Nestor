"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Flame, TrendingUp } from "lucide-react";
import { usePathname } from "next/navigation";

import { useAuth } from "@/components/auth-provider";
import { XPBar } from "@/components/XPBar";
import { useXP } from "@/hooks/useXP";
import { authFetch } from "@/lib/api";
import { usd } from "@/lib/format";
import { cn } from "@/lib/utils";

export function Nav({ className }: { className?: string }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const { xpState, isLoading } = useXP();
  const [recentGain, setRecentGain] = useState(0);
  const [portfolioSummary, setPortfolioSummary] = useState<{
    totalValue: number;
    dailyChangePct: number;
  } | null>(null);
  const prevXP = useRef<number | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showPortfolioSummary = Boolean(user && pathname !== "/");

  useEffect(() => {
    prevXP.current = null;
    setRecentGain(0);
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, [user?.id]);

  useEffect(() => {
    if (!user || isLoading) return;

    const x = xpState.totalXP;
    if (prevXP.current === null) {
      prevXP.current = x;
      return;
    }

    const delta = x - prevXP.current;
    prevXP.current = x;

    if (delta <= 0) return;

    setRecentGain(delta);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setRecentGain(0), 2400);
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [user, isLoading, xpState.totalXP]);

  useEffect(() => {
    if (!showPortfolioSummary) {
      setPortfolioSummary(null);
      return;
    }

    let cancelled = false;
    async function loadSummary() {
      try {
        const res = await authFetch("/api/portfolio");
        if (!res.ok) return;
        const data = (await res.json()) as {
          totalValue?: number;
          dailyChangePct?: number;
        };
        if (!cancelled) {
          setPortfolioSummary({
            totalValue: Number(data.totalValue) || 0,
            dailyChangePct: Number(data.dailyChangePct) || 0,
          });
        }
      } catch {
        // Header summary is non-critical.
      }
    }

    void loadSummary();
    return () => {
      cancelled = true;
    };
  }, [showPortfolioSummary, pathname]);

  const headerUp = (portfolioSummary?.dailyChangePct ?? 0) >= 0;

  return (
    <header
      className={cn(
        "fixed left-64 right-0 top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 px-8 font-display text-sm backdrop-blur-md supports-[backdrop-filter]:bg-white/80",
        className,
      )}
    >
      <div>
        {showPortfolioSummary && portfolioSummary ? (
          <div className="flex items-center gap-3">
            <span className="font-display text-lg font-bold text-[#002141]">
              {usd.format(Math.round(portfolioSummary.totalValue))}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold",
                headerUp
                  ? "border-[#a9dfc3] bg-[#e7f7ef] text-[#146c43]"
                  : "border-[#f4b7b7] bg-[#fff1f1] text-[#9f1239]",
              )}
            >
              <TrendingUp className={cn("h-3.5 w-3.5", !headerUp && "rotate-180")} />
              {headerUp ? "+" : ""}
              {(portfolioSummary.dailyChangePct ?? 0).toFixed(2)}% today
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-4">
        {user ? (
          <XPBar
            levelLabel={xpState.levelLabel}
            level={xpState.level}
            totalXP={xpState.totalXP}
            xpToNextLevel={xpState.xpToNextLevel}
            recentGain={recentGain}
            isLoading={isLoading}
          />
        ) : null}

        {user ? (
          <Link
            href="/lessons"
            title="Trading School streak - consecutive days with a lesson"
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-full border border-[#f7e382] bg-[#f7e382]/35 px-2.5 py-1 text-[#524700] shadow-sm transition-opacity hover:opacity-95",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003666]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
            aria-label={`Lesson streak: ${xpState.streak} days`}
          >
            <Flame
              className="size-[18px] shrink-0 text-[#73640e]"
              aria-hidden
              strokeWidth={2.25}
            />
            <span className="min-w-[1ch] text-center text-sm font-bold tabular-nums leading-none">
              {isLoading ? "..." : xpState.streak}
            </span>
          </Link>
        ) : null}
      </div>
    </header>
  );
}
