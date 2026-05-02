import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type StreakUpdateResult = {
  currentStreak: number;
  isNewRecord: boolean;
  bonusXP: number;
};

/** UTC calendar date `YYYY-MM-DD`. */
export function utcCalendarDay(isoTimestamp: string): string {
  return new Date(isoTimestamp).toISOString().slice(0, 10);
}

export function addCalendarDaysUtc(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

/**
 * Consecutive calendar days with ≥1 lesson attempt, counting back from the most
 * recent play. Streak is maintained if the latest play was today or yesterday (UTC).
 */
export function computeLessonCalendarStreak(
  playedAtIso: string[],
): number {
  if (playedAtIso.length === 0) return 0;

  const dayKeys = [
    ...new Set(playedAtIso.map((iso) => utcCalendarDay(iso))),
  ].sort((a, b) => b.localeCompare(a));

  const todayKey = new Date().toISOString().slice(0, 10);
  const yesterdayKey = addCalendarDaysUtc(todayKey, -1);

  const newest = dayKeys[0];
  if (newest !== todayKey && newest !== yesterdayKey) return 0;

  let streak = 1;
  let expectedPrev = addCalendarDaysUtc(newest, -1);

  for (let i = 1; i < dayKeys.length; i++) {
    const d = dayKeys[i];
    if (d === expectedPrev) {
      streak++;
      expectedPrev = addCalendarDaysUtc(d, -1);
    } else if (d < expectedPrev) {
      break;
    }
  }

  return streak;
}

function bonusForStreak(currentStreak: number): number {
  if (currentStreak >= 7) return 100;
  if (currentStreak >= 3) return 50;
  return 0;
}

function createServiceSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      "updateStreak requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)",
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Reads `lesson_attempts` for the user, derives consecutive calendar-day streak,
 * upserts `streak` on `user_xp`, and returns streak metadata + milestone bonus XP.
 *
 * Uses the service role so it can run after a user JWT insert without depending on
 * `user_xp` row-level policies.
 */
export async function updateStreak(userId: string): Promise<StreakUpdateResult> {
  const supabase = createServiceSupabase();

  const { data: xpRow, error: xpErr } = await supabase
    .from("user_xp")
    .select("streak")
    .eq("user_id", userId)
    .maybeSingle();

  if (xpErr) throw new Error(xpErr.message);

  const prevStreak = xpRow?.streak ?? 0;

  const { data: attempts, error: attemptsErr } = await supabase
    .from("lesson_attempts")
    .select("played_at")
    .eq("user_id", userId);

  if (attemptsErr) {
    throw new Error(attemptsErr.message);
  }

  const playedAtIso = (attempts ?? []).map((r) =>
    typeof r.played_at === "string"
      ? r.played_at
      : new Date(r.played_at as string).toISOString(),
  );

  const currentStreak = computeLessonCalendarStreak(playedAtIso);
  const isNewRecord = currentStreak > prevStreak;
  const bonusXP = bonusForStreak(currentStreak);

  if (xpRow) {
    const { error: updErr } = await supabase
      .from("user_xp")
      .update({
        streak: currentStreak,
        last_updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (updErr) throw new Error(updErr.message);
  } else {
    const { error: insErr } = await supabase.from("user_xp").insert({
      user_id: userId,
      streak: currentStreak,
      total_xp: 0,
      level: 1,
      xp_this_week: 0,
      last_updated_at: new Date().toISOString(),
    });

    if (insErr) throw new Error(insErr.message);
  }

  return { currentStreak, isNewRecord, bonusXP };
}
