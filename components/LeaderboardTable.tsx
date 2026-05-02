"use client";

import { useMemo } from "react";
import useSWR from "swr";

import { useAuth } from "@/components/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { authFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

export type LeaderboardMode = "alltime" | "weekly";

export type LeaderboardRow = {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string;
  totalXp: number;
  level: number;
  levelLabel: string;
  badgeCount: number;
  topBadge: string | null;
  xpThisWeek: number;
  rankYesterday: number | null;
  /** Sparse-board demo rows only */
  lessonStreak?: number;
};

type LeaderboardApiResponse = {
  totalPlayers: number;
  rows: LeaderboardRow[];
  currentUserRank: LeaderboardRow | null;
  leaderboardDemoFill?: boolean;
};

/** Matches XP / DB level breakpoints */
const XP_BREAKPOINTS = [0, 100, 300, 600, 1000, 1500, 2100] as const;

function segmentProgress(totalXp: number, level: number): number {
  const lvl = Math.min(7, Math.max(1, Math.floor(level)));
  if (lvl >= 7) return 100;
  const low = XP_BREAKPOINTS[lvl - 1];
  const high = XP_BREAKPOINTS[lvl];
  const span = high - low;
  if (span <= 0) return 100;
  return Math.min(100, Math.max(0, ((totalXp - low) / span) * 100));
}

function humanizeBadgeId(id: string): string {
  return id
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

const KNOWN_BADGES: Record<string, { emoji: string; label: string }> = {
  gold_explorer: { emoji: "🏆", label: "Gold Explorer" },
  silver_explorer: { emoji: "🔭", label: "Silver Explorer" },
  bronze_explorer: { emoji: "🎯", label: "Bronze Explorer" },
  first_lesson: { emoji: "📘", label: "First Lesson" },
  streak_3: { emoji: "🔥", label: "3-Day Streak" },
  streak_7: { emoji: "🌟", label: "7-Day Streak" },
};

function badgePresentation(badgeId: string | null): {
  emoji: string;
  label: string;
} {
  if (!badgeId) return { emoji: "—", label: "No badge yet" };
  const key = badgeId.trim().toLowerCase();
  return (
    KNOWN_BADGES[key] ?? {
      emoji: "⭐",
      label: humanizeBadgeId(key),
    }
  );
}

function levelTierClasses(level: number): {
  avatarRing: string;
  badgeClass: string;
} {
  const lv = Math.min(7, Math.max(1, Math.floor(level)));
  if (lv >= 7) {
    return {
      avatarRing:
        "leaderboard-gold-ring-shimmer bg-gradient-to-br from-amber-300 via-yellow-200 to-amber-500 p-[2px]",
      badgeClass:
        "border-amber-500/50 bg-amber-500/15 text-amber-900 dark:text-amber-100",
    };
  }
  if (lv >= 5) {
    return {
      avatarRing: "ring-2 ring-purple-500/90 ring-offset-2 ring-offset-background",
      badgeClass:
        "border-purple-500/45 bg-purple-500/12 text-purple-900 dark:text-purple-100",
    };
  }
  if (lv >= 3) {
    return {
      avatarRing: "ring-2 ring-blue-500/90 ring-offset-2 ring-offset-background",
      badgeClass:
        "border-blue-500/45 bg-blue-500/12 text-blue-900 dark:text-blue-100",
    };
  }
  return {
    avatarRing:
      "ring-2 ring-zinc-300 ring-offset-2 ring-offset-background dark:ring-zinc-600",
    badgeClass:
      "border-zinc-400/40 bg-zinc-500/10 text-zinc-800 dark:text-zinc-200",
  };
}

function RankDelta({
  currentRank,
  rankYesterday,
}: {
  currentRank: number;
  rankYesterday: number | null;
}) {
  if (rankYesterday == null) return null;
  const delta = rankYesterday - currentRank;
  if (delta === 0) return null;
  if (delta > 0) {
    return (
      <span
        className="text-[11px] font-semibold tabular-nums text-emerald-600 dark:text-emerald-400"
        title={`Up ${delta} vs yesterday`}
      >
        ↑{delta}
      </span>
    );
  }
  return (
    <span
      className="text-[11px] font-semibold tabular-nums text-red-600 dark:text-red-400"
      title={`Down ${-delta} vs yesterday`}
    >
      ↓{-delta}
    </span>
  );
}

function RankDisplay({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex items-center gap-1 font-bold tabular-nums text-amber-600 dark:text-amber-400">
        <span aria-hidden>🥇</span>
        {rank}
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex items-center gap-1 font-bold tabular-nums text-slate-500 dark:text-slate-300">
        <span aria-hidden>🥈</span>
        {rank}
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex items-center gap-1 font-bold tabular-nums text-amber-800 dark:text-amber-600">
        <span aria-hidden>🥉</span>
        {rank}
      </span>
    );
  }
  return (
    <span className="tabular-nums text-muted-foreground">{rank}</span>
  );
}

function XpProgressCell({ row }: { row: LeaderboardRow }) {
  const pct = segmentProgress(row.totalXp, row.level);
  return (
    <div className="flex max-w-[220px] items-center gap-2">
      <Progress
        value={pct}
        className={cn(
          "h-1.5 flex-1",
          "[&_[data-slot=progress-indicator]]:transition-transform",
          "[&_[data-slot=progress-indicator]]:duration-[600ms]",
          "[&_[data-slot=progress-indicator]]:ease-in-out",
        )}
      />
      <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">
        {row.totalXp.toLocaleString()}
      </span>
    </div>
  );
}

async function leaderboardFetcher(url: string): Promise<LeaderboardApiResponse> {
  const res = await authFetch(url);
  if (res.status === 401) {
    throw new Error("Not authenticated");
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Failed to load leaderboard");
  }
  return res.json() as Promise<LeaderboardApiResponse>;
}

function SkeletonGrid() {
  return (
    <>
      {Array.from({ length: 10 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <Skeleton className="mx-auto h-5 w-10" />
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-2">
              <Skeleton className="size-9 shrink-0 rounded-full" />
              <Skeleton className="h-5 flex-1 max-w-[140px]" />
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="h-6 w-20 rounded-full" />
          </TableCell>
          <TableCell className="hidden md:table-cell">
            <Skeleton className="mx-auto h-8 w-8 rounded-md" />
          </TableCell>
          <TableCell className="hidden md:table-cell">
            <Skeleton className="h-4 w-full max-w-[180px]" />
          </TableCell>
          <TableCell className="hidden md:table-cell">
            <Skeleton className="ml-auto h-4 w-12" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export type LeaderboardTableProps = {
  mode: LeaderboardMode;
  /** Debounced filter on display name (client-side) */
  searchQuery?: string;
};

export function LeaderboardTable({
  mode,
  searchQuery = "",
}: LeaderboardTableProps) {
  const { user } = useAuth();
  const apiMode = mode === "weekly" ? "weekly" : "alltime";
  const swrKey = `/api/leaderboard?mode=${apiMode}&limit=50&offset=0`;

  const { data, error, isLoading } = useSWR(swrKey, leaderboardFetcher, {
    revalidateOnFocus: true,
    refreshInterval: 60_000,
    shouldRetryOnError: false,
  });

  const totalPlayers = data?.totalPlayers ?? 0;
  const rows = data?.rows ?? [];
  const you = data?.currentUserRank ?? null;
  const demoFill = Boolean(data?.leaderboardDemoFill);

  const q = searchQuery.trim().toLowerCase();
  const filteredRows = useMemo(() => {
    if (!q) return rows;
    return rows.filter((r) => r.displayName.toLowerCase().includes(q));
  }, [rows, q]);

  const showSparseEmpty =
    !isLoading && !error && totalPlayers < 3;

  return (
    <div className="relative space-y-4 pb-28">
      {demoFill ? (
        <p className="rounded-md border border-dashed border-primary/25 bg-primary/[0.06] px-3 py-2 text-xs text-muted-foreground dark:bg-primary/[0.09]">
          Sample investors are shown until at least three real players have XP.
          Rankings and streaks are illustrative.
        </p>
      ) : null}
      {showSparseEmpty ? (
        <div className="rounded-lg border border-border bg-muted/20 px-6 py-12 text-center">
          <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
            Be the first on the board — complete a Trading School lesson to earn
            XP.
          </p>
        </div>
      ) : (
      <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="border-b hover:bg-transparent">
                <TableHead className="w-11 md:w-14">#</TableHead>
                <TableHead>Player</TableHead>
                <TableHead className="w-[120px] md:w-[132px]">Tier</TableHead>
                <TableHead className="hidden w-14 text-center md:table-cell">
                  Honor
                </TableHead>
                <TableHead className="hidden md:table-cell md:min-w-[200px]">
                  Level progress
                </TableHead>
                <TableHead className="hidden text-right md:table-cell md:w-24">
                  This week
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <SkeletonGrid />
              ) : error ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-destructive"
                  >
                    {error.message}
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No players yet. Be the first on the board.
                  </TableCell>
                </TableRow>
              ) : filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No players match your search.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map((row, i) => {
                  const isYou = Boolean(user?.id && row.userId === user.id);
                  const tier = levelTierClasses(row.level);
                  const badge = badgePresentation(row.topBadge);
                  return (
                    <TableRow
                      key={row.userId}
                      className={cn(
                        "leaderboard-row-enter border-b",
                        isYou && "bg-primary/[0.06] dark:bg-primary/[0.12]",
                      )}
                      style={{ animationDelay: `${Math.min(i, 24) * 48}ms` }}
                    >
                      <TableCell className="align-middle">
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                          <RankDisplay rank={row.rank} />
                          <RankDelta
                            currentRank={row.rank}
                            rankYesterday={row.rankYesterday}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="align-middle">
                        <div className="flex items-center gap-2 md:gap-3">
                          <div
                            className={cn(
                              "shrink-0 rounded-full",
                              tier.avatarRing,
                            )}
                          >
                            <Avatar className="size-9 border-2 border-background md:size-10">
                              {row.avatarUrl ? (
                                <AvatarImage src={row.avatarUrl} alt="" />
                              ) : null}
                              <AvatarFallback className="text-[10px] font-semibold">
                                {row.displayName.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate font-medium text-foreground">
                                {row.displayName}
                              </span>
                              {row.lessonStreak != null && row.lessonStreak > 0 ? (
                                <span
                                  className="shrink-0 text-[10px] font-semibold tabular-nums text-orange-600 dark:text-orange-400"
                                  title="Lesson streak (sample data)"
                                >
                                  🔥 {row.lessonStreak}d
                                </span>
                              ) : null}
                              {isYou ? (
                                <Badge
                                  variant="outline"
                                  className="h-5 rounded-full border-primary/40 bg-primary/10 px-2 text-[10px] font-bold uppercase tracking-wide text-primary"
                                >
                                  You
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-middle">
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                            tier.badgeClass,
                          )}
                        >
                          {row.levelLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden align-middle md:table-cell">
                        <div className="flex justify-center">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="flex size-9 cursor-default items-center justify-center rounded-md border border-border/80 bg-muted/40 text-lg leading-none transition-colors hover:bg-muted"
                                aria-label={badge.label}
                              >
                                <span aria-hidden>{badge.emoji}</span>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top">{badge.label}</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                      <TableCell className="hidden align-middle md:table-cell">
                        <XpProgressCell row={row} />
                      </TableCell>
                      <TableCell className="hidden align-middle text-right md:table-cell">
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {row.xpThisWeek.toLocaleString()}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Sticky “You” summary */}
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-40 border-t-2 border-primary bg-background/95 backdrop-blur-md shadow-[0_-12px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_-12px_40px_rgba(0,0,0,0.35)]",
          "md:left-64",
          "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        )}
        role="region"
        aria-label="Your leaderboard rank"
      >
        <div className="mx-auto max-w-5xl px-4 py-3 md:px-8">
          {!isLoading && error ? (
            <p className="text-sm text-muted-foreground">
              Could not load your rank.
            </p>
          ) : you ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="rounded-md bg-primary/15 px-2 py-1 text-xs font-bold uppercase tracking-wide text-primary">
                  You
                </span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0 text-sm text-muted-foreground">
                  <span>
                    Rank{" "}
                    <span className="font-semibold tabular-nums text-foreground">
                      #{you.rank.toLocaleString()}
                    </span>
                  </span>
                  {mode === "alltime" ? (
                    <RankDelta
                      currentRank={you.rank}
                      rankYesterday={you.rankYesterday}
                    />
                  ) : null}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                <span>
                  <span className="text-muted-foreground">
                    {mode === "weekly" ? "Weekly XP" : "Total XP"}
                    {": "}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {mode === "weekly"
                      ? you.xpThisWeek.toLocaleString()
                      : you.totalXp.toLocaleString()}
                  </span>
                </span>
                <span>
                  <span className="text-muted-foreground">Level: </span>
                  <span className="font-semibold tabular-nums">{you.level}</span>
                  <span className="text-muted-foreground"> · </span>
                  <span className="font-medium text-primary">
                    {you.levelLabel}
                  </span>
                </span>
                {you.lessonStreak != null && you.lessonStreak > 0 ? (
                  <span className="text-orange-600 dark:text-orange-400">
                    <span className="text-muted-foreground">Streak: </span>
                    <span className="font-semibold tabular-nums">
                      🔥 {you.lessonStreak}d
                    </span>
                  </span>
                ) : null}
              </div>
            </div>
          ) : !isLoading ? (
            <p className="text-sm text-muted-foreground">
              You&apos;re not on the leaderboard yet — earn XP to get ranked.
            </p>
          ) : (
            <div className="flex items-center gap-3">
              <Skeleton className="h-7 w-14 rounded-md" />
              <Skeleton className="h-5 w-48" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
