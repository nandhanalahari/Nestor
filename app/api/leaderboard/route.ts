import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import type { LeaderboardRowJson } from "@/lib/leaderboardTypes";

export type { LeaderboardRowJson } from "@/lib/leaderboardTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabase(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    "";
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

type LeaderboardRowDb = {
  rank: number | string;
  user_id: string;
  display_name: string;
  avatar_url: string;
  total_xp: number;
  level: number;
  level_label: string;
  badge_count: number | string;
  top_badge: string | null;
  xp_this_week: number;
  rank_yesterday?: number | string | null;
};

function mapRow(r: LeaderboardRowDb): LeaderboardRowJson {
  const ry = r.rank_yesterday;
  return {
    rank: Number(r.rank),
    userId: r.user_id,
    displayName: r.display_name,
    avatarUrl: r.avatar_url ?? "",
    totalXp: r.total_xp,
    level: r.level,
    levelLabel: r.level_label,
    badgeCount: Number(r.badge_count),
    topBadge: r.top_badge,
    xpThisWeek: r.xp_this_week,
    rankYesterday:
      ry != null && ry !== "" ? Number(ry) : null,
  };
}

/**
 * GET /api/leaderboard?mode=alltime|weekly&limit=50&offset=0
 * Paginated leaderboard plus the signed-in user's row (rank) even if outside the page.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabase = getSupabase(token);
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const url = new URL(req.url);
  const modeParam = (url.searchParams.get("mode") ?? "alltime").toLowerCase();
  const limitRaw = url.searchParams.get("limit");
  const offsetRaw = url.searchParams.get("offset");

  if (modeParam !== "alltime" && modeParam !== "weekly") {
    return NextResponse.json(
      { error: 'mode must be "alltime" or "weekly"' },
      { status: 400 },
    );
  }

  const limit = Math.min(
    50,
    Math.max(1, Number.parseInt(limitRaw ?? "50", 10) || 50),
  );
  const offset = Math.max(0, Number.parseInt(offsetRaw ?? "0", 10) || 0);

  const viewName =
    modeParam === "weekly"
      ? "leaderboard_weekly_view"
      : "leaderboard_view";

  const end = offset + limit - 1;

  const [selfRes, countRes, pageRes] = await Promise.all([
    supabase.from(viewName).select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("user_xp").select("*", { count: "exact", head: true }),
    supabase
      .from(viewName)
      .select("*")
      .order("rank", { ascending: true })
      .range(offset, end),
  ]);

  if (selfRes.error) {
    return NextResponse.json({ error: selfRes.error.message }, { status: 500 });
  }

  if (countRes.error) {
    return NextResponse.json({ error: countRes.error.message }, { status: 500 });
  }

  if (pageRes.error) {
    return NextResponse.json({ error: pageRes.error.message }, { status: 500 });
  }

  const totalReal = countRes.count ?? 0;
  const rows = (pageRes.data ?? []).map((r) =>
    mapRow(r as unknown as LeaderboardRowDb),
  );

  const currentUserRank: LeaderboardRowJson | null =
    selfRes.data == null
      ? null
      : mapRow(selfRes.data as unknown as LeaderboardRowDb);

  return NextResponse.json({
    mode: modeParam,
    limit,
    offset,
    totalPlayers: totalReal,
    rows,
    currentUserRank,
  });
}
