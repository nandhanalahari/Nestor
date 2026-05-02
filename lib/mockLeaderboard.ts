import type { LeaderboardRowJson } from "@/lib/leaderboardTypes";

/** Stable UUIDs — never collide with real auth users */
const DEMO_IDS = [
  "aaaaaaaa-aaaa-4aaa-8aaa-000000000001",
  "aaaaaaaa-aaaa-4aaa-8aaa-000000000002",
  "aaaaaaaa-aaaa-4aaa-8aaa-000000000003",
  "aaaaaaaa-aaaa-4aaa-8aaa-000000000004",
  "aaaaaaaa-aaaa-4aaa-8aaa-000000000005",
  "aaaaaaaa-aaaa-4aaa-8aaa-000000000006",
  "aaaaaaaa-aaaa-4aaa-8aaa-000000000007",
  "aaaaaaaa-aaaa-4aaa-8aaa-000000000008",
  "aaaaaaaa-aaaa-4aaa-8aaa-000000000009",
  "aaaaaaaa-aaaa-4aaa-8aaa-00000000000a",
] as const;

const LEVEL_LABELS = [
  "Saver",
  "Planner",
  "Investor",
  "Builder",
  "Allocator",
  "Strategist",
  "Master",
] as const;

const XP_BREAKPOINTS = [0, 100, 300, 600, 1000, 1500, 2100] as const;

function levelFromTotalXp(totalXp: number): number {
  for (let lv = 7; lv >= 1; lv--) {
    if (totalXp >= XP_BREAKPOINTS[lv - 1]) return lv;
  }
  return 1;
}

type DemoSeed = {
  displayName: string;
  avatarUrl: string;
  totalXp: number;
  xpThisWeek: number;
  badgeCount: number;
  topBadge: string | null;
  /** Prior-day rank for ↑/↓ demo */
  rankYesterday: number | null;
  /** Lesson streak days (mock only; not stored on leaderboard view) */
  lessonStreak: number;
};

const DEMO_SEEDS: DemoSeed[] = [
  {
    displayName: "Maya Chen",
    avatarUrl: "",
    totalXp: 2480,
    xpThisWeek: 175,
    badgeCount: 6,
    topBadge: "gold_explorer",
    rankYesterday: 3,
    lessonStreak: 12,
  },
  {
    displayName: "Jordan Wells",
    avatarUrl: "",
    totalXp: 1950,
    xpThisWeek: 240,
    badgeCount: 5,
    topBadge: "silver_explorer",
    rankYesterday: 2,
    lessonStreak: 7,
  },
  {
    displayName: "Sam Rivera",
    avatarUrl: "",
    totalXp: 1620,
    xpThisWeek: 88,
    badgeCount: 4,
    topBadge: "streak_7",
    rankYesterday: 1,
    lessonStreak: 7,
  },
  {
    displayName: "Priya Patel",
    avatarUrl: "",
    totalXp: 1280,
    xpThisWeek: 320,
    badgeCount: 4,
    topBadge: "bronze_explorer",
    rankYesterday: 5,
    lessonStreak: 4,
  },
  {
    displayName: "Chris Okonkwo",
    avatarUrl: "",
    totalXp: 950,
    xpThisWeek: 42,
    badgeCount: 3,
    topBadge: "first_lesson",
    rankYesterday: 4,
    lessonStreak: 2,
  },
  {
    displayName: "Taylor Brooks",
    avatarUrl: "",
    totalXp: 720,
    xpThisWeek: 110,
    badgeCount: 3,
    topBadge: "streak_3",
    rankYesterday: 8,
    lessonStreak: 3,
  },
  {
    displayName: "Jamie Liu",
    avatarUrl: "",
    totalXp: 480,
    xpThisWeek: 155,
    badgeCount: 2,
    topBadge: "streak_3",
    rankYesterday: 6,
    lessonStreak: 5,
  },
  {
    displayName: "Riley Santos",
    avatarUrl: "",
    totalXp: 285,
    xpThisWeek: 18,
    badgeCount: 2,
    topBadge: "first_lesson",
    rankYesterday: 7,
    lessonStreak: 0,
  },
  {
    displayName: "Morgan Bailey",
    avatarUrl: "",
    totalXp: 140,
    xpThisWeek: 62,
    badgeCount: 1,
    topBadge: "first_lesson",
    rankYesterday: 10,
    lessonStreak: 1,
  },
  {
    displayName: "Casey Nguyen",
    avatarUrl: "",
    totalXp: 65,
    xpThisWeek: 22,
    badgeCount: 1,
    topBadge: "first_lesson",
    rankYesterday: 9,
    lessonStreak: 2,
  },
];

function seedToRow(seed: DemoSeed, userId: string): LeaderboardRowJson {
  const level = levelFromTotalXp(seed.totalXp);
  return {
    rank: 0,
    userId,
    displayName: seed.displayName,
    avatarUrl: seed.avatarUrl,
    totalXp: seed.totalXp,
    level,
    levelLabel: LEVEL_LABELS[level - 1],
    badgeCount: seed.badgeCount,
    topBadge: seed.topBadge,
    xpThisWeek: seed.xpThisWeek,
    rankYesterday: seed.rankYesterday,
    lessonStreak: seed.lessonStreak,
  };
}

/** Ten placeholder investors for empty / sparse leaderboards */
export function getDemoLeaderboardRows(): LeaderboardRowJson[] {
  return DEMO_SEEDS.map((seed, i) => seedToRow(seed, DEMO_IDS[i]!));
}

export function mergeWithDemoLeaderboard(
  mode: "alltime" | "weekly",
  demoRows: LeaderboardRowJson[],
  realRows: LeaderboardRowJson[],
): LeaderboardRowJson[] {
  const byUser = new Map<string, LeaderboardRowJson>();
  for (const r of demoRows) {
    byUser.set(r.userId, { ...r });
  }
  for (const r of realRows) {
    byUser.set(r.userId, { ...r });
  }

  const list = Array.from(byUser.values());
  list.sort((a, b) => {
    if (mode === "weekly") {
      const w = b.xpThisWeek - a.xpThisWeek;
      if (w !== 0) return w;
    }
    const t = b.totalXp - a.totalXp;
    if (t !== 0) return t;
    return a.userId.localeCompare(b.userId);
  });

  return list.map((r, i) => ({
    ...r,
    rank: i + 1,
    rankYesterday: mode === "weekly" ? null : r.rankYesterday,
  }));
}
