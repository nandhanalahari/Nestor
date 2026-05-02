import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { updateStreak } from "@/lib/lessonStreak";

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

/** POST /api/lesson/play — records `lesson_attempts`, then refreshes XP streak. */
export async function POST(req: Request) {
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

  let body: { lessonId?: unknown; choice?: unknown; score?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const lessonId =
    typeof body.lessonId === "string" ? body.lessonId.trim() : "";
  const choice =
    typeof body.choice === "string"
      ? body.choice.trim()
      : body.choice != null
        ? String(body.choice)
        : "";

  if (!lessonId) {
    return NextResponse.json(
      { error: "lessonId is required" },
      { status: 400 },
    );
  }
  if (!choice) {
    return NextResponse.json({ error: "choice is required" }, { status: 400 });
  }

  const score =
    typeof body.score === "number" &&
    Number.isFinite(body.score)
      ? Math.round(body.score)
      : 0;

  const { error: insertErr } = await supabase.from("lesson_attempts").insert({
    user_id: user.id,
    lesson_id: lessonId,
    choice,
    score,
  });

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  try {
    const streak = await updateStreak(user.id);
    return NextResponse.json({
      ok: true,
      currentStreak: streak.currentStreak,
      isNewRecord: streak.isNewRecord,
      bonusXP: streak.bonusXP,
    });
  } catch (e) {
    console.error("[POST /api/lesson/play] updateStreak:", e);
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Streak update failed (check SUPABASE_SERVICE_ROLE_KEY)",
      },
      { status: 500 },
    );
  }
}
