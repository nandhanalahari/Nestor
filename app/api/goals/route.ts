import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { structureGoal } from "@/lib/gemini";
import { isMockDataEnabled, mockGoals } from "@/lib/mockData";

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

export async function GET(req: Request) {
  if (isMockDataEnabled()) {
    return NextResponse.json({ goals: mockGoals });
  }

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
    .from("goals")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ goals: data ?? [] });
}

export async function POST(req: Request) {
  if (isMockDataEnabled()) {
    let body: {
      title?: string;
      text?: string;
      target_amount?: number;
      monthly_savings_target?: number | null;
      deadline?: string;
      icon?: string;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!body.title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const goal = {
      id: `mock-goal-${Date.now()}`,
      title: body.title,
      text_goal:
        body.text ||
        `I want to ${body.title} with a target of $${body.target_amount ?? 0} by ${body.deadline ?? "someday"}.`,
      target_amount: body.target_amount ?? 0,
      current_amount: 0,
      monthly_savings_target: body.monthly_savings_target ?? null,
      deadline: body.deadline,
      icon: body.icon || "other",
      ai_suggestion:
        "Mock goal saved locally for this dev session. Real persistence will use Supabase later.",
    };
    mockGoals.unshift(goal);
    return NextResponse.json({ goal, aiSuggestion: goal.ai_suggestion });
  }

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

  let body: {
    title?: string;
    text?: string;
    target_amount?: number;
    monthly_savings_target?: number | null;
    deadline?: string;
    icon?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.title) {
    return NextResponse.json(
      { error: "title is required" },
      { status: 400 },
    );
  }

  const plainText = body.text || `I want to ${body.title} with a target of $${body.target_amount ?? 0} by ${body.deadline ?? "someday"}.`;

  let aiSuggestion = "";
  try {
    const structured = await structureGoal({ rawText: plainText });
    aiSuggestion = `${structured.encouragement} ${structured.summary}`;
  } catch {
    aiSuggestion = "Great goal! Keep contributing steadily and review your timeline as life changes.";
  }

  const { data, error } = await supabase
    .from("goals")
    .insert({
      user_id: user.id,
      title: body.title,
      text_goal: plainText,
      target_amount: body.target_amount ?? 0,
      current_amount: 0,
      monthly_savings_target: body.monthly_savings_target ?? null,
      deadline: body.deadline,
      icon: body.icon || "other",
      ai_suggestion: aiSuggestion,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ goal: data, aiSuggestion });
}

export async function PATCH(req: Request) {
  if (isMockDataEnabled()) {
    let body: { id?: string; monthly_savings_target?: number | null };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const goal = mockGoals.find((item) => item.id === body.id);
    if (!goal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    const monthlySavingsTarget =
      body.monthly_savings_target === null ||
      body.monthly_savings_target === undefined
        ? null
        : Number(body.monthly_savings_target);

    if (
      monthlySavingsTarget !== null &&
      (!Number.isFinite(monthlySavingsTarget) || monthlySavingsTarget <= 0)
    ) {
      return NextResponse.json(
        { error: "monthly_savings_target must be a positive number" },
        { status: 400 },
      );
    }

    goal.monthly_savings_target = monthlySavingsTarget;
    return NextResponse.json({ goal });
  }

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

  let body: { id?: string; monthly_savings_target?: number | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const monthlySavingsTarget =
    body.monthly_savings_target === null ||
    body.monthly_savings_target === undefined
      ? null
      : Number(body.monthly_savings_target);

  if (
    monthlySavingsTarget !== null &&
    (!Number.isFinite(monthlySavingsTarget) || monthlySavingsTarget <= 0)
  ) {
    return NextResponse.json(
      { error: "monthly_savings_target must be a positive number" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("goals")
    .update({ monthly_savings_target: monthlySavingsTarget })
    .eq("id", body.id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ goal: data });
}

export async function DELETE(req: Request) {
  if (isMockDataEnabled()) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const index = mockGoals.findIndex((goal) => goal.id === id);
    if (index >= 0) mockGoals.splice(index, 1);
    return NextResponse.json({ deleted: true });
  }

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

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("goals")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
