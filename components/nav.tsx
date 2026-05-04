"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BarChart3, Flame, Menu, TrendingUp } from "lucide-react";
import { usePathname } from "next/navigation";

import { useAuth } from "@/components/auth-provider";
import { XPBar } from "@/components/XPBar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useXP } from "@/hooks/useXP";
import { authFetch } from "@/lib/api";
import { usd } from "@/lib/format";
import { cn } from "@/lib/utils";

export function Nav({
  className,
  onMenuClick,
}: {
  className?: string;
  /** Opens the mobile sidebar drawer (shown below `lg`). */
  onMenuClick?: () => void;
}) {
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

  const xpBlock = user ? (
    <XPBar
      levelLabel={xpState.levelLabel}
      level={xpState.level}
      totalXP={xpState.totalXP}
      xpToNextLevel={xpState.xpToNextLevel}
      recentGain={recentGain}
      isLoading={isLoading}
    />
  ) : null;

  return (
    <header
      className={cn(
        "fixed left-0 right-0 top-0 z-[60] flex h-12 max-h-12 flex-nowrap items-center justify-between gap-1.5 overflow-hidden border-b border-slate-200 bg-white/90 px-2 font-display text-sm backdrop-blur-md supports-[backdrop-filter]:bg-white/80 sm:h-14 sm:max-h-14 sm:gap-2 sm:px-3 lg:h-16 lg:max-h-16 lg:gap-2 lg:px-8 lg:left-64",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
        {onMenuClick ? (
          <button
            type="button"
            onClick={onMenuClick}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#002141] shadow-sm sm:h-9 sm:w-9 lg:hidden"
            aria-label="Open navigation menu"
          >
            <Menu className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2.25} aria-hidden />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          {showPortfolioSummary && portfolioSummary ? (
            <div className="flex min-w-0 items-center gap-1 sm:gap-2 md:gap-3">
              <span className="truncate font-display text-sm font-bold tabular-nums text-[#002141] sm:text-base md:text-lg">
                {usd.format(Math.round(portfolioSummary.totalValue))}
              </span>
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-0.5 rounded-full border px-1 py-0.5 text-[10px] font-bold sm:px-1.5 sm:text-[11px] md:gap-1 md:px-2.5 md:py-1 md:text-xs",
                  headerUp
                    ? "border-[#a9dfc3] bg-[#e7f7ef] text-[#146c43]"
                    : "border-[#f4b7b7] bg-[#fff1f1] text-[#9f1239]",
                )}
              >
                <TrendingUp
                  className={cn(
                    "h-2.5 w-2.5 md:h-3.5 md:w-3.5",
                    !headerUp && "rotate-180",
                  )}
                  aria-hidden
                />
                <span className="tabular-nums">
                  {headerUp ? "+" : ""}
                  {(portfolioSummary.dailyChangePct ?? 0).toFixed(2)}%
                </span>
                <span className="hidden font-medium sm:inline">today</span>
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2 md:gap-4">
        {user ? (
          <>
            <div className="hidden md:block">{xpBlock}</div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="h-8 w-8 shrink-0 border-slate-200 md:hidden"
                  aria-label="Level and XP details"
                >
                  <BarChart3 className="h-4 w-4 text-[#003666]" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 p-4" sideOffset={8}>
                {xpBlock}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : null}

        {user ? (
          <Link
            href="/lessons"
            title="Trading School streak - consecutive days with a lesson"
            className={cn(
              "flex h-8 shrink-0 items-center gap-0.5 rounded-full border border-[#f7e382] bg-[#f7e382]/35 px-2 text-[#524700] shadow-sm transition-opacity hover:opacity-95 sm:h-9 sm:gap-1 sm:px-2.5",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003666]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
            aria-label={`Lesson streak: ${xpState.streak} days`}
          >
            <Flame
              className="size-4 shrink-0 text-[#73640e] sm:size-[18px]"
              aria-hidden
              strokeWidth={2.25}
            />
            <span className="min-w-[1ch] text-center text-xs font-bold tabular-nums leading-none sm:text-sm">
              {isLoading ? "…" : xpState.streak}
            </span>
          </Link>
        ) : null}
      </div>
    </header>
  );
}
