import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  computeRiskScore,
  deriveProfileLabel,
  deriveHorizonYears,
  deriveLiquidityMonths,
  type QuizAnswers,
  type GoalKind,
} from "@/lib/profile";

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

// ─── GET /api/profile ────────────────────────────────────────────────────────
// Returns the current user's profile, or 404 if none exists.

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

  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (error && error.code === "PGRST116") {
    // No rows found — user hasn't completed the quiz
    return NextResponse.json({ profile: null }, { status: 404 });
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}

// ─── POST /api/profile ───────────────────────────────────────────────────────
// Upserts the user's profile from quiz answers.
// Body: { answers: QuizAnswers, primary_goal_kind: GoalKind }

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

  let body: { answers: QuizAnswers; primary_goal_kind: GoalKind };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Validate answers
  const { answers, primary_goal_kind } = body;
  if (
    !answers ||
    typeof answers.q1_horizon !== "number" ||
    typeof answers.q2_risk !== "number" ||
    typeof answers.q3_liquidity !== "number" ||
    typeof answers.q4_goal !== "number"
  ) {
    return NextResponse.json(
      { error: "Invalid answers format. Expected q1_horizon, q2_risk, q3_liquidity, q4_goal as numbers." },
      { status: 400 },
    );
  }

  // Validate ranges (each answer is 1–4)
  const values = [answers.q1_horizon, answers.q2_risk, answers.q3_liquidity, answers.q4_goal];
  if (values.some((v) => v < 1 || v > 4)) {
    return NextResponse.json(
      { error: "Answer values must be between 1 and 4" },
      { status: 400 },
    );
  }

  const validGoals: GoalKind[] = ["house", "education", "retirement", "growth", "other"];
  if (!validGoals.includes(primary_goal_kind)) {
    return NextResponse.json(
      { error: `Invalid goal kind. Must be one of: ${validGoals.join(", ")}` },
      { status: 400 },
    );
  }

  // Compute derived fields
  const risk_score = computeRiskScore(answers);
  const profile_label = deriveProfileLabel(risk_score);
  const horizon_years = deriveHorizonYears(answers.q1_horizon);
  const liquidity_window_months = deriveLiquidityMonths(answers.q3_liquidity);

  const profileData = {
    user_id: user.id,
    risk_score,
    profile_label,
    horizon_years,
    liquidity_window_months,
    primary_goal_kind,
    answers,
    updated_at: new Date().toISOString(),
  };

  // Upsert — insert if new, update if exists
  const { data, error } = await supabase
    .from("user_profiles")
    .upsert(profileData, { onConflict: "user_id" })
    .select()
    .single();

  if (error) {
    console.error("[/api/profile POST] Supabase upsert error:", error);
    return NextResponse.json(
      {
        error: error.message || "Supabase error (no message)",
        code: error.code,
        details: error.details,
        hint: error.hint,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ profile: data });
}
