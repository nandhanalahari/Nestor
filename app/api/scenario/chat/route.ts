import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { mapScenarioChatPrompt } from "@/lib/scenarioChat";
import { getLiveQuotes } from "@/lib/yahooFinance";
import {
  isMockDataEnabled,
  mockGoals,
  mockHoldings,
  mockProfile,
  mockQuotes,
} from "@/lib/mockData";
import type { Holding } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ML_API = process.env.ML_API_URL || "http://127.0.0.1:8000";

type ScenarioChatBody = {
  prompt?: string;
  message?: string;
  text?: string;
};

type DbHolding = {
  id?: string;
  ticker: string;
  name: string;
  category: string;
  shares?: number | null;
  cost_basis?: number | null;
};

type UserProfile = {
  profile_label?: string | null;
  liquidity_window_months?: number | null;
};

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

export async function POST(req: Request) {
  let body: ScenarioChatBody = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const prompt = body.prompt ?? body.message ?? body.text ?? "";
  if (!prompt.trim()) {
    return NextResponse.json(
      { error: "prompt is required." },
      { status: 400 },
    );
  }

  const { holdings, goalText, profile } = await loadUserContext(req);
  const latestQuotes = await loadLatestQuotes(holdings);
  const macroSnapshot = await loadMacroSnapshot();

  return NextResponse.json(
    mapScenarioChatPrompt(prompt, {
      holdings,
      goalText,
      profile,
      latestQuotes,
      macroSnapshot,
    }),
  );
}

async function loadUserContext(req: Request): Promise<{
  holdings?: Holding[];
  goalText?: string;
  profile?: UserProfile | null;
}> {
  if (isMockDataEnabled()) {
    return {
      holdings: normalizeHoldings(
        mockHoldings.map((holding) => ({
          id: holding.id,
          ticker: holding.ticker,
          name: holding.name,
          category: holding.category,
          shares: holding.shares,
          cost_basis: holding.costBasis ?? holding.amount,
        })),
      ),
      goalText: mockGoals[0]?.text_goal,
      profile: mockProfile,
    };
  }

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) return {};

  try {
    const supabase = getSupabase(token);
    const {
      data: { user },
    } = await supabase.auth.getUser(token);
    if (!user) return {};

    const [holdingsRes, goalsRes, profileRes] = await Promise.all([
      supabase.from("holdings").select("*").eq("user_id", user.id),
      supabase
        .from("goals")
        .select("text_goal, title")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("user_profiles")
        .select("profile_label, liquidity_window_months")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    const goalRow = goalsRes.data?.[0];
    return {
      holdings: normalizeHoldings((holdingsRes.data ?? []) as DbHolding[]),
      goalText: goalRow?.text_goal || goalRow?.title,
      profile: (profileRes.data as UserProfile | null) ?? null,
    };
  } catch {
    return {};
  }
}

function normalizeHoldings(dbHoldings: DbHolding[]): Holding[] | undefined {
  if (dbHoldings.length === 0) return undefined;

  const totalCost = dbHoldings.reduce(
    (sum, holding) => sum + Math.max(0, Number(holding.cost_basis) || 0),
    0,
  );

  return dbHoldings.map((holding) => {
    const amount = Math.max(0, Number(holding.cost_basis) || 0);
    return {
      id: holding.id,
      ticker: holding.ticker,
      name: holding.name,
      category: holding.category as Holding["category"],
      amount,
      weight: totalCost > 0 ? amount / totalCost : 0,
      shares: Number(holding.shares) || undefined,
      costBasis: amount,
    };
  });
}

async function loadMacroSnapshot() {
  try {
    const res = await fetch(`${ML_API}/macro`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return undefined;

    const data = await res.json();
    return data.indicators as
      | Record<string, { name: string; value: number; change_1m?: number | null }>
      | undefined;
  } catch {
    return undefined;
  }
}

async function loadLatestQuotes(holdings?: Holding[]) {
  if (!holdings || holdings.length === 0) return undefined;

  const tickers = holdings
    .filter((holding) => holding.category !== "Cash")
    .map((holding) => holding.ticker.toUpperCase());
  if (tickers.length === 0) return undefined;

  try {
    const quotes = isMockDataEnabled()
      ? mockQuotes.filter((quote) => tickers.includes(quote.ticker.toUpperCase()))
      : await getLiveQuotes(tickers.slice(0, 8));

    return Object.fromEntries(
      quotes
        .filter((quote) => Number.isFinite(quote.price) && quote.price > 0)
        .map((quote) => [quote.ticker.toUpperCase(), quote.price]),
    );
  } catch {
    return undefined;
  }
}
