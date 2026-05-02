"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Flame } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { XPBar } from "@/components/XPBar";
import { useXP } from "@/hooks/useXP";
import { cn } from "@/lib/utils";

export function Nav({ className }: { className?: string }) {
  const { user } = useAuth();
  const { xpState, isLoading } = useXP();
  const [recentGain, setRecentGain] = useState(0);
  const prevXP = useRef<number | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  if (!user) return null;

  const avatarUrl =
    typeof user.user_metadata?.avatar_url === "string"
      ? user.user_metadata.avatar_url
      : undefined;

  const initials =
    user.email?.slice(0, 2).toUpperCase() ||
    user.user_metadata?.display_name?.slice(0, 2).toUpperCase() ||
    "?";

  return (
    <header
      className={cn(
        "sticky top-0 z-30 mb-4 flex items-center justify-end gap-3 border-b border-border/60 bg-background/85 py-2 pb-3 backdrop-blur-md pr-12 supports-[backdrop-filter]:bg-background/70",
        className,
      )}
    >
      <XPBar
        levelLabel={xpState.levelLabel}
        level={xpState.level}
        totalXP={xpState.totalXP}
        xpToNextLevel={xpState.xpToNextLevel}
        recentGain={recentGain}
        isLoading={isLoading}
      />

      <Link
        href="/lessons"
        title="Trading School streak — consecutive days with a lesson"
        className={cn(
          "flex shrink-0 items-center gap-1 rounded-full border border-orange-500/35 bg-gradient-to-b from-orange-500/15 to-amber-600/10 px-2.5 py-1 shadow-sm transition-opacity hover:opacity-95",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
        aria-label={`Lesson streak: ${xpState.streak} days`}
      >
        <Flame
          className="size-[18px] shrink-0 text-orange-500 dark:text-orange-400"
          aria-hidden
          strokeWidth={2.25}
        />
        <span className="min-w-[1ch] text-center text-sm font-bold tabular-nums leading-none text-orange-700 dark:text-orange-300">
          {isLoading ? "…" : xpState.streak}
        </span>
      </Link>

      <Link
        href="/profile"
        className="shrink-0 rounded-full ring-offset-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label="My profile"
      >
        <Avatar className="size-8 border border-border shadow-sm">
          {avatarUrl ? (
            <AvatarImage src={avatarUrl} alt="" />
          ) : null}
          <AvatarFallback className="bg-primary/15 text-[10px] font-semibold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
      </Link>
    </header>
  );
}
