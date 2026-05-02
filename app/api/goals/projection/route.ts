import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getLiveQuotes } from "@/lib/yahooFinance";
import type { ProfileLabel } from "@/lib/profile";
import {
  getMockPortfolioValue,
  isMockDataEnabled,
  mockGoals,
  mockProfile,
} from "@/lib/mockData";
import {
  addMonths,
  getAnnualReturn,
  getMonthlyContribution,
  monthlyNeededForTargetDate,
  monthsToTarget,
  monthsUntil,
  parseGoalDeadline,
} from "@/lib/projection";

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

async function getCurrentPortfolioValue(
  supabase: ReturnType<typeof getSupabase>,
  userId: string,
): Promise<number> {
  const { data: holdings, error } = await supabase
    .from("holdings")
    .select("ticker, category, shares, cost_basis")
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
  if (!holdings || holdings.length === 0) return 0;

  const tickers = holdings
    .filter((h) => h.category !== "Cash")
    .map((h) => String(h.ticker));
  const quotes = await getLiveQuotes(tickers);

  return holdings.reduce((total, holding) => {
    const costBasis = Number(holding.cost_basis) || 0;
    const shares = Number(holding.shares) || 0;
    const quote = quotes.find((q) => q.ticker === holding.ticker);
    const marketValue = quote && shares > 0 ? quote.price * shares : costBasis;
    return total + marketValue;
  }, 0);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const goalId = searchParams.get("goal_id");

  if (isMockDataEnabled()) {
    if (!goalId) {
      return NextResponse.json({ error: "goal_id is required" }, { status: 400 });
    }

    const goal = mockGoals.find((item) => item.id === goalId);
    if (!goal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    if (!goal.monthly_savings_target) {
      return NextResponse.json({
        goal_id: goal.id,
        needs_monthly_savings_target: true,
        projected_date: null,
        on_track: null,
        monthly_needed_to_be_on_time: null,
      });
    }

    const profileLabel = mockProfile.profile_label;
    const currentPortfolioValue = getMockPortfolioValue();
    const monthlyContribution = getMonthlyContribution(goal.monthly_savings_target);
    const targetAmount = Number(goal.target_amount) || 0;
    const months = monthsToTarget({
      principal: currentPortfolioValue,
      targetAmount,
      monthlyContribution,
      profileLabel,
    });
    const deadlineDate = parseGoalDeadline(goal.deadline);
    const monthsToDeadline = deadlineDate ? monthsUntil(deadlineDate) : null;
    const monthlyNeeded =
      monthsToDeadline === null
        ? null
        : monthlyNeededForTargetDate({
            principal: currentPortfolioValue,
            targetAmount,
            profileLabel,
            months: monthsToDeadline,
          });
    const projectedDate = months === null ? null : addMonths(new Date(), months);
    const onTrack =
      projectedDate && deadlineDate
        ? projectedDate.getTime() <= deadlineDate.getTime()
        : null;

    return NextResponse.json({
      goal_id: goal.id,
      projected_date: projectedDate?.toISOString().slice(0, 10) ?? null,
      on_track: onTrack,
      monthly_needed_to_be_on_time:
        monthlyNeeded === null ? null : Math.ceil(monthlyNeeded),
      current_portfolio_value: Math.round(currentPortfolioValue * 100) / 100,
      monthly_savings_target: monthlyContribution,
      annual_return_assumption: getAnnualReturn(profileLabel),
      profile_label: profileLabel,
      months_to_target: months,
      target_deadline: deadlineDate?.toISOString().slice(0, 10) ?? null,
      source: "mock",
    });
  }

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!goalId) {
    return NextResponse.json({ error: "goal_id is required" }, { status: 400 });
  }

  const supabase = getSupabase(token);
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const { data: goal, error: goalError } = await supabase
    .from("goals")
    .select("id, target_amount, deadline, monthly_savings_target")
    .eq("id", goalId)
    .eq("user_id", user.id)
    .single();

  if (goalError) {
    return NextResponse.json({ error: goalError.message }, { status: 500 });
  }

  if (!goal.monthly_savings_target) {
    return NextResponse.json({
      goal_id: goal.id,
      needs_monthly_savings_target: true,
      projected_date: null,
      on_track: null,
      monthly_needed_to_be_on_time: null,
    });
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("profile_label")
    .eq("user_id", user.id)
    .maybeSingle();

  const profileLabel =
    (profile?.profile_label as ProfileLabel | undefined) ?? "Balanced Climber";
  const currentPortfolioValue = await getCurrentPortfolioValue(supabase, user.id);
  const monthlyContribution = getMonthlyContribution(goal.monthly_savings_target);
  const targetAmount = Number(goal.target_amount) || 0;
  const months = monthsToTarget({
    principal: currentPortfolioValue,
    targetAmount,
    monthlyContribution,
    profileLabel,
  });
  const deadlineDate = parseGoalDeadline(goal.deadline);
  const monthsToDeadline = deadlineDate ? monthsUntil(deadlineDate) : null;
  const monthlyNeeded =
    monthsToDeadline === null
      ? null
      : monthlyNeededForTargetDate({
          principal: currentPortfolioValue,
          targetAmount,
          profileLabel,
          months: monthsToDeadline,
        });
  const projectedDate = months === null ? null : addMonths(new Date(), months);
  const onTrack =
    projectedDate && deadlineDate
      ? projectedDate.getTime() <= deadlineDate.getTime()
      : null;

  return NextResponse.json({
    goal_id: goal.id,
    projected_date: projectedDate?.toISOString().slice(0, 10) ?? null,
    on_track: onTrack,
    monthly_needed_to_be_on_time:
      monthlyNeeded === null ? null : Math.ceil(monthlyNeeded),
    current_portfolio_value: Math.round(currentPortfolioValue * 100) / 100,
    monthly_savings_target: monthlyContribution,
    annual_return_assumption: getAnnualReturn(profileLabel),
    profile_label: profileLabel,
    months_to_target: months,
    target_deadline: deadlineDate?.toISOString().slice(0, 10) ?? null,
  });
}
