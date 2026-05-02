"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { ProfileLabel } from "@/lib/profile";

/** Dashboard / portfolio context: delta vs ~7d baseline + rolling-week best score */
export type RiskMeterPortfolioData = {
  scoreDelta: number | null;
  weeklyHigh: number | null;
};

type RiskMeterProps = {
  score: number; // 0–100
  label?: ProfileLabel;
  size?: number; // diameter in px
  showLabel?: boolean;
  animate?: boolean;
  portfolioData?: RiskMeterPortfolioData | null;
};

/**
 * Animated circular risk/health dial.
 * - Green ≥ 67 (Bold Grower / healthy)
 * - Yellow 34–66 (Balanced Climber / moderate)
 * - Red ≤ 33 (Steady Builder / cautious)
 *
 * Reusable for both the onboarding reveal and F3 health score.
 */
export function RiskMeter({
  score,
  label,
  size = 200,
  showLabel = true,
  animate = true,
  portfolioData = null,
}: RiskMeterProps) {
  const [displayScore, setDisplayScore] = useState(animate ? 0 : score);

  // Animate the number counting up
  useEffect(() => {
    if (!animate) {
      setDisplayScore(score);
      return;
    }

    let frame: number;
    const duration = 1500; // ms
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(eased * score));

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [score, animate]);

  // SVG arc math
  const strokeWidth = size * 0.08;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Arc goes from 225° to -45° (270° sweep)
  const sweepAngle = 270;
  const sweepFraction = sweepAngle / 360;
  const totalArc = circumference * sweepFraction;
  const filledArc = totalArc * (displayScore / 100);
  const gapArc = totalArc - filledArc;

  // Color based on score
  const getColor = (s: number) => {
    if (s <= 33) return { main: "#7399c6", glow: "rgba(115, 153, 198, 0.3)" }; // Goldman Sachs blue for steady
    if (s <= 66) return { main: "#f59e0b", glow: "rgba(245, 158, 11, 0.3)" }; // Amber for balanced
    return { main: "#10b981", glow: "rgba(16, 185, 129, 0.3)" }; // Green for bold
  };

  const color = getColor(score);

  // Start angle offset: rotate so the arc starts at bottom-left
  const startAngle = 135; // degrees

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-[0deg]"
        >
          {/* Background arc (track) */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeDasharray={`${totalArc} ${circumference - totalArc}`}
            strokeDashoffset={0}
            strokeLinecap="round"
            className="text-muted/30"
            transform={`rotate(${startAngle} ${size / 2} ${size / 2})`}
          />

          {/* Filled arc */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color.main}
            strokeWidth={strokeWidth}
            strokeDasharray={`${filledArc} ${gapArc + (circumference - totalArc)}`}
            strokeDashoffset={0}
            strokeLinecap="round"
            transform={`rotate(${startAngle} ${size / 2} ${size / 2})`}
            initial={animate ? { opacity: 0 } : undefined}
            animate={animate ? { opacity: 1 } : undefined}
            transition={{ duration: 0.5 }}
            style={{
              filter: `drop-shadow(0 0 ${strokeWidth}px ${color.glow})`,
            }}
          />
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-bold text-foreground"
            style={{ fontSize: size * 0.22 }}
          >
            {displayScore}
          </span>
          <span
            className="text-muted-foreground font-medium"
            style={{ fontSize: size * 0.07 }}
          >
            / 100
          </span>
        </div>
      </div>

      {portfolioData ? (
        <div className="flex w-full max-w-[min(100%,280px)] flex-col items-center gap-1.5 px-1">
          {portfolioData.scoreDelta !== null ? (
            portfolioData.scoreDelta > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-0.5 text-xs font-semibold text-green-600 dark:text-green-400">
                ↑ {portfolioData.scoreDelta} this week
              </span>
            ) : portfolioData.scoreDelta < 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold text-red-600 dark:text-red-400">
                ↓ {Math.abs(portfolioData.scoreDelta)} this week
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                — No change
              </span>
            )
          ) : null}
          <p className="text-center text-[11px] text-muted-foreground">
            Weekly best:{" "}
            {portfolioData.weeklyHigh !== null &&
            portfolioData.weeklyHigh !== undefined
              ? portfolioData.weeklyHigh
              : "—"}
          </p>
        </div>
      ) : null}

      {showLabel && label && (
        <motion.div
          initial={animate ? { opacity: 0, y: 10 } : undefined}
          animate={animate ? { opacity: 1, y: 0 } : undefined}
          transition={{ delay: 1.2, duration: 0.5 }}
          className="text-center"
        >
          <p
            className="text-lg font-semibold text-foreground"
            style={{ color: color.main }}
          >
            {label}
          </p>
        </motion.div>
      )}
    </div>
  );
}
