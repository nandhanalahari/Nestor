/** Leaderboard row returned by GET /api/leaderboard */
export type LeaderboardRowJson = {
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
  /** All-time rank from prior UTC calendar day snapshot; null if unknown */
  rankYesterday: number | null;
  /** Present on sparse-board demo rows only */
  lessonStreak?: number;
};
