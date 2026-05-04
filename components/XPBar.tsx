"use client";

import { AnimatePresence, motion } from "framer-motion";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/** Matches `user_xp` / useXP breakpoints (min XP for level N is index N-1). */
const XP_BREAKPOINTS = [0, 100, 300, 600, 1000, 1500, 2100] as const;

function segmentProgress(totalXP: number, level: number): number {
  if (level >= 7) return 100;
  const low = XP_BREAKPOINTS[level - 1];
  const high = XP_BREAKPOINTS[level];
  const span = high - low;
  if (span <= 0) return 100;
  return Math.min(100, Math.max(0, ((totalXP - low) / span) * 100));
}

export type XPBarProps = {
  levelLabel: string;
  level: number;
  totalXP: number;
  xpToNextLevel: number;
  /** When &gt; 0, shows a small animated “+N XP” chip */
  recentGain: number;
  isLoading?: boolean;
  className?: string;
};

export function XPBar({
  levelLabel,
  level,
  totalXP,
  xpToNextLevel,
  recentGain,
  isLoading = false,
  className,
}: XPBarProps) {
  const pct = isLoading ? 0 : segmentProgress(totalXP, level);

  return (
    <div
      className={cn(
        "relative flex min-w-[5.75rem] max-w-[8rem] flex-col gap-0.5 font-[Inter] sm:min-w-[9.5rem] sm:max-w-[11rem] sm:gap-1",
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate text-[10px] font-semibold leading-none text-[#002141] sm:text-[11px]">
          <span className="text-[#003666]">{levelLabel}</span>
          <span className="font-normal text-[#3f5165]">
            {" "}
            · Lv {level}
          </span>
        </p>
      </div>

      <div className="relative">
        <Progress
          value={pct}
          className={cn(
            "h-1.5 bg-[#eef4fb] [&_[data-slot=progress-indicator]]:bg-[#003666]",
            isLoading && "animate-pulse opacity-60",
          )}
        />
        <AnimatePresence mode="wait">
          {recentGain > 0 ? (
            <motion.span
              key={`${totalXP}-${recentGain}`}
              initial={{ opacity: 0, y: 6, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.92 }}
              transition={{ type: "spring", stiffness: 420, damping: 26 }}
              className="pointer-events-none absolute -top-7 right-0 z-10 whitespace-nowrap rounded-md border border-[#f7e382] bg-[#fffbe8] px-2 py-0.5 text-[10px] font-bold tabular-nums text-[#002141] shadow-[0_20px_20px_rgba(0,0,0,0.04)]"
            >
              +{recentGain} XP
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>

      <p className="text-[9px] leading-none tabular-nums text-[#3f5165] sm:text-[10px]">
        {level >= 7
          ? "Max level"
          : isLoading
            ? "…"
            : `${xpToNextLevel} XP to next`}
      </p>
    </div>
  );
}
