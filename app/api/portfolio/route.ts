import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { computeHealthScore } from "@/lib/healthScore";
import { getLiveQuotes } from "@/lib/yahooFinance";
import { isMockDataEnabled, mockHoldings, mockProfile, mockQuotes } from "@/lib/mockData";
import type { Holding, Quote } from "@/lib/types";

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
    const holdings = mockHoldings.map((holding) => ({
      ...holding,
      costBasis: holding.costBasis ?? holding.amount,
    }));
    const totalValue = holdings.reduce((sum, holding) => {
      const quote = mockQuotes.find((q) => q.ticker === holding.ticker);
      return sum + (quote && holding.shares ? quote.price * holding.shares : holding.amount);
    }, 0);
    const marketValueWeights = holdings.map((holding) => {
      const quote = mockQuotes.find((q) => q.ticker === holding.ticker);
      const value = quote && holding.shares ? quote.price * holding.shares : holding.amount;
      return totalValue > 0 ? value / totalValue : 0;
    });
    const dailyChangePct = mockQuotes.reduce((acc, quote) => {
      const holding = holdings.find((h) => h.ticker === quote.ticker);
      const quoteValue = holding?.shares ? quote.price * holding.shares : 0;
      const weight = totalValue > 0 ? quoteValue / totalValue : 0;
      return acc + quote.changePercent * weight;
    }, 0);
    const { healthScore, factors } = computeHealthScore({
      marketValueWeights,
      dailyChangePct,
      warnings: ["Mock data mode is enabled. Values are local test data."],
      profile: mockProfile,
    });

    return NextResponse.json({
      holdings,
      quotes: mockQuotes,
      totalValue,
      dailyChangePct: Math.round(dailyChangePct * 100) / 100,
      asOf: "2026-05-02",
      warnings: ["Mock data mode is enabled. Values are local test data."],
      healthScore,
      factors,
      scoreDelta: null,
      weeklyHigh: healthScore,
    });
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

  const { data: dbHoldings, error } = await supabase
    .from("holdings")
    .select("*")
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!dbHoldings || dbHoldings.length === 0) {
    return NextResponse.json({
      holdings: [],
      quotes: [],
      totalValue: 0,
      dailyChangePct: 0,
      asOf: new Date().toISOString().slice(0, 10),
      warnings: [],
      healthScore: null,
      factors: [],
      scoreDelta: null,
      weeklyHigh: null,
    });
  }

  const totalCost = dbHoldings.reduce(
    (s: number, h: { cost_basis: number }) => s + Number(h.cost_basis),
    0,
  );

  const holdings: Holding[] = dbHoldings.map(
    (h: {
      id: string;
      ticker: string;
      name: string;
      category: string;
      shares: number;
      cost_basis: number;
    }) => ({
      id: h.id,
      ticker: h.ticker,
      name: h.name,
      category: h.category as Holding["category"],
      amount: Number(h.cost_basis),
      weight: totalCost > 0 ? Number(h.cost_basis) / totalCost : 0,
      shares: Number(h.shares),
      costBasis: Number(h.cost_basis),
    }),
  );

  // Live quotes from Yahoo Finance (free, no API key, with 1-min server cache)
  const tickers = holdings
    .filter((h) => h.category !== "Cash")
    .map((h) => h.ticker);

  const liveQuotes = await getLiveQuotes(tickers);
  const quotes: Quote[] = liveQuotes.map((q) => ({
    ticker: q.ticker,
    price: Math.round(q.price * 100) / 100,
    changePercent: Math.round(q.changePercent * 100) / 100,
    asOf: q.asOf,
  }));

  const warnings: string[] = [];
  for (const ticker of tickers) {
    if (!quotes.find((q) => q.ticker === ticker)) {
      warnings.push(`Could not fetch live price for ${ticker}`);
    }
  }

  const marketValues: number[] = [];
  let totalValue = 0;
  for (const h of holdings) {
    const q = quotes.find((x) => x.ticker === h.ticker);
    const mv = q && h.shares ? q.price * h.shares : h.amount;
    marketValues.push(mv);
    totalValue += mv;
  }

  const marketValueWeights =
    totalValue > 0 ? marketValues.map((mv) => mv / totalValue) : [];

  const dailyChangePct =
    quotes.length > 0
      ? quotes.reduce((acc, q) => {
          const h = holdings.find((hh) => hh.ticker === q.ticker);
          return acc + q.changePercent * (h?.weight ?? 0);
        }, 0)
      : 0;

  const { data: profileRow } = await supabase
    .from("user_profiles")
    .select("profile_label, liquidity_window_months")
    .eq("user_id", user.id)
    .maybeSingle();

  const healthProfile =
    profileRow &&
    typeof profileRow.profile_label === "string" &&
    typeof profileRow.liquidity_window_months === "number"
      ? {
          profile_label: profileRow.profile_label,
          liquidity_window_months: profileRow.liquidity_window_months,
        }
      : null;

  const { healthScore, factors } = computeHealthScore({
    marketValueWeights,
    dailyChangePct,
    warnings,
    profile: healthProfile,
  });

  const sevenDaysAgoIso = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const fourHoursAgoIso = new Date(
    Date.now() - 4 * 60 * 60 * 1000,
  ).toISOString();

  const [baselineRes, lastRecordedRes, weekScoresRes] = await Promise.all([
    supabase
      .from("health_score_history")
      .select("score")
      .eq("user_id", user.id)
      .lte("recorded_at", sevenDaysAgoIso)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("health_score_history")
      .select("recorded_at")
      .eq("user_id", user.id)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("health_score_history")
      .select("score")
      .eq("user_id", user.id)
      .gte("recorded_at", sevenDaysAgoIso),
  ]);

  const baselineScore = baselineRes.data?.score;
  const scoreDelta =
    baselineScore === undefined || baselineScore === null
      ? null
      : healthScore - Number(baselineScore);

  const weekRows = weekScoresRes.data ?? [];
  const weeklyHigh =
    weekRows.length === 0
      ? healthScore
      : Math.max(
          healthScore,
          ...weekRows.map((r) => Number(r.score)),
        );

  const lastRecordedAt = lastRecordedRes.data?.recorded_at;
  const lastMs = lastRecordedAt ? new Date(lastRecordedAt).getTime() : 0;
  const fourHourCutoff = new Date(fourHoursAgoIso).getTime();
  const shouldInsertHistory =
    lastMs === 0 || lastMs < fourHourCutoff;

  if (shouldInsertHistory) {
    const { error: insertErr } = await supabase
      .from("health_score_history")
      .insert({ user_id: user.id, score: healthScore });

    if (insertErr) {
      console.error(
        "[GET /api/portfolio] health_score_history insert:",
        insertErr.message,
      );
    }
  }

  return NextResponse.json({
    holdings,
    quotes,
    totalValue,
    dailyChangePct,
    asOf: quotes[0]?.asOf ?? new Date().toISOString().slice(0, 10),
    warnings,
    healthScore,
    factors,
    scoreDelta,
    weeklyHigh,
  });
}
