import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { estimateTradeFees } from "@/lib/fees";
import { getLiveQuotes, type LiveQuote } from "@/lib/yahooFinance";
import { isMockDataEnabled, mockHoldings, mockQuotes, MOCK_USER_ID } from "@/lib/mockData";
import type { AssetCategory } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExecuteBody = {
  recommendedAllocation?: Record<string, number>;
  originalAllocation?: Record<string, number>;
  sourceScenario?: string;
};

type DbHolding = {
  id: string;
  ticker: string;
  name: string;
  category: AssetCategory | string;
  shares?: number | null;
  cost_basis?: number | null;
};

type HoldingValue = DbHolding & {
  ticker: string;
  currentValue: number;
  price: number;
};

type TradeSummary = {
  ticker: string;
  action: "buy" | "sell" | "hold";
  dollarChange: number;
  sharesChange: number;
  price: number;
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

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function roundShares(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function normalizeTicker(ticker: string) {
  return ticker.trim().toUpperCase();
}

function normalizeAllocation(allocation: Record<string, number>) {
  const entries = Object.entries(allocation)
    .map(([ticker, value]) => [normalizeTicker(ticker), Number(value)] as const)
    .filter(([ticker, value]) => ticker.length > 0 && Number.isFinite(value) && value >= 0);

  const rawTotal = entries.reduce((sum, [, value]) => sum + value, 0);
  if (rawTotal <= 0) return null;

  const valuesLookLikePercent = rawTotal > 1.5 || entries.some(([, value]) => value > 1);
  const divisor = valuesLookLikePercent ? 100 : rawTotal;
  const normalized = new Map<string, number>();
  for (const [ticker, value] of entries) {
    normalized.set(ticker, (normalized.get(ticker) ?? 0) + value / divisor);
  }

  const normalizedTotal = Array.from(normalized.values()).reduce((sum, value) => sum + value, 0);
  if (normalizedTotal <= 0) return null;

  for (const [ticker, value] of normalized) {
    normalized.set(ticker, value / normalizedTotal);
  }
  return normalized;
}

function quoteMap(quotes: Array<LiveQuote | { ticker: string; price: number }>) {
  return new Map(
    quotes
      .filter((quote) => Number.isFinite(quote.price) && quote.price > 0)
      .map((quote) => [quote.ticker.toUpperCase(), quote]),
  );
}

function categoryForTicker(
  ticker: string,
  existing?: DbHolding,
): AssetCategory {
  if (existing?.category) return existing.category as AssetCategory;
  if (ticker === "CASH") return "Cash";
  if (/^[A-Z]{5}X$/.test(ticker)) return "Mutual Fund";
  return "ETF";
}

function nameForTicker(ticker: string, quote?: LiveQuote | { ticker: string; price: number }) {
  if (quote && "longName" in quote && quote.longName) return quote.longName;
  if (ticker === "CASH") return "Cash";
  return ticker;
}

function currentPrice(holding: DbHolding, quotePrice?: number) {
  const shares = Number(holding.shares) || 0;
  const costBasis = Math.max(0, Number(holding.cost_basis) || 0);
  if (holding.category === "Cash" || holding.ticker.toUpperCase() === "CASH") return 1;
  if (quotePrice && quotePrice > 0) return quotePrice;
  if (shares > 0 && costBasis > 0) return costBasis / shares;
  return 0;
}

async function buildPlan(
  holdings: DbHolding[],
  allocation: Map<string, number>,
  quoteSource: "mock" | "live",
) {
  const tickers = Array.from(
    new Set([
      ...holdings.map((holding) => normalizeTicker(holding.ticker)),
      ...allocation.keys(),
    ]),
  );
  const quotes =
    quoteSource === "mock"
      ? mockQuotes.filter((quote) => tickers.includes(quote.ticker.toUpperCase()))
      : await getLiveQuotes(tickers.filter((ticker) => ticker !== "CASH"));
  const prices = quoteMap(quotes);

  const holdingByTicker = new Map(
    holdings.map((holding) => [normalizeTicker(holding.ticker), holding]),
  );
  const valuedHoldings = new Map<string, HoldingValue>();
  let totalValue = 0;

  for (const holding of holdings) {
    const ticker = normalizeTicker(holding.ticker);
    const price = currentPrice(holding, prices.get(ticker)?.price);
    const shares = Number(holding.shares) || 0;
    const costBasis = Math.max(0, Number(holding.cost_basis) || 0);
    const currentValue = price > 0 && shares > 0 ? price * shares : costBasis;
    totalValue += currentValue;
    valuedHoldings.set(ticker, {
      ...holding,
      ticker,
      price: price > 0 ? price : currentValue,
      currentValue,
    });
  }

  const trades: TradeSummary[] = [];
  const updates: { id: string; ticker: string; shares: number; cost_basis: number }[] = [];
  const inserts: {
    ticker: string;
    name: string;
    category: AssetCategory;
    shares: number;
    cost_basis: number;
  }[] = [];
  const deletes: string[] = [];
  const warnings: string[] = [];

  for (const ticker of tickers) {
    const targetValue = totalValue * (allocation.get(ticker) ?? 0);
    const existing = valuedHoldings.get(ticker);
    const quote = prices.get(ticker);
    const price = existing?.price || quote?.price || (ticker === "CASH" ? 1 : 0);
    const currentValue = existing?.currentValue ?? 0;
    const dollarChange = targetValue - currentValue;
    const sharesChange = price > 0 ? dollarChange / price : 0;
    const action =
      Math.abs(dollarChange) < 0.01 ? "hold" : dollarChange > 0 ? "buy" : "sell";

    trades.push({
      ticker,
      action,
      dollarChange: roundMoney(dollarChange),
      sharesChange: roundShares(sharesChange),
      price: roundMoney(price),
    });

    if (existing) {
      if (targetValue < 1) {
        deletes.push(existing.id);
      } else if (price > 0) {
        updates.push({
          id: existing.id,
          ticker,
          shares: roundShares(targetValue / price),
          cost_basis: roundMoney(targetValue),
        });
      } else {
        warnings.push(`Could not price ${ticker}; holding was not updated.`);
      }
    } else if (targetValue >= 1) {
      if (price <= 0) {
        warnings.push(`Could not price ${ticker}; holding was not inserted.`);
        continue;
      }
      inserts.push({
        ticker,
        name: nameForTicker(ticker, quote),
        category: categoryForTicker(ticker, holdingByTicker.get(ticker)),
        shares: roundShares(targetValue / price),
        cost_basis: roundMoney(targetValue),
      });
    }
  }

  return {
    totalValue: roundMoney(totalValue),
    trades,
    updates,
    inserts,
    deletes,
    warnings,
    feeEstimate: estimateTradeFees(
      trades
        .filter((trade) => trade.action !== "hold")
        .map((trade) => ({
          ticker: trade.ticker,
          tradedValue: trade.dollarChange,
          category:
            valuedHoldings.get(trade.ticker)?.category ??
            inserts.find((insert) => insert.ticker === trade.ticker)?.category,
        })),
    ),
  };
}

export async function POST(req: Request) {
  let body: ExecuteBody = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.recommendedAllocation || typeof body.recommendedAllocation !== "object") {
    return NextResponse.json(
      { error: "recommendedAllocation is required." },
      { status: 400 },
    );
  }

  const allocation = normalizeAllocation(body.recommendedAllocation);
  if (!allocation) {
    return NextResponse.json(
      { error: "recommendedAllocation must contain positive numeric weights." },
      { status: 400 },
    );
  }

  if (isMockDataEnabled()) {
    const mockDbHoldings: DbHolding[] = mockHoldings.map((holding) => ({
      id: holding.id ?? `mock-${holding.ticker}`,
      ticker: holding.ticker,
      name: holding.name,
      category: holding.category,
      shares: holding.shares ?? 0,
      cost_basis: holding.costBasis ?? holding.amount,
    }));
    const plan = await buildPlan(mockDbHoldings, allocation, "mock");

    return NextResponse.json({
      executed: false,
      mock: true,
      userId: MOCK_USER_ID,
      sourceScenario: body.sourceScenario ?? null,
      originalAllocation: body.originalAllocation ?? null,
      totalValue: plan.totalValue,
      trades: plan.trades,
      feeEstimate: plan.feeEstimate,
      updated: plan.updates.length,
      inserted: plan.inserts.length,
      deleted: plan.deletes.length,
      warnings: ["Mock data mode is enabled. No holdings were persisted.", ...plan.warnings],
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

  const { data: dbHoldings, error: fetchError } = await supabase
    .from("holdings")
    .select("id, ticker, name, category, shares, cost_basis")
    .eq("user_id", user.id);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const plan = await buildPlan((dbHoldings ?? []) as DbHolding[], allocation, "live");

  let updated = 0;
  let inserted = 0;
  let deleted = 0;

  for (const update of plan.updates) {
    const { error } = await supabase
      .from("holdings")
      .update({
        shares: update.shares,
        cost_basis: update.cost_basis,
      })
      .eq("id", update.id)
      .eq("user_id", user.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    updated += 1;
  }

  if (plan.inserts.length > 0) {
    const { data, error } = await supabase
      .from("holdings")
      .insert(
        plan.inserts.map((insert) => ({
          user_id: user.id,
          ticker: insert.ticker,
          name: insert.name,
          category: insert.category,
          shares: insert.shares,
          cost_basis: insert.cost_basis,
        })),
      )
      .select("id");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    inserted = data?.length ?? plan.inserts.length;
  }

  if (plan.deletes.length > 0) {
    const { error } = await supabase
      .from("holdings")
      .delete()
      .in("id", plan.deletes)
      .eq("user_id", user.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    deleted = plan.deletes.length;
  }

  return NextResponse.json({
    executed: true,
    mock: false,
    sourceScenario: body.sourceScenario ?? null,
    originalAllocation: body.originalAllocation ?? null,
    totalValue: plan.totalValue,
    trades: plan.trades,
    feeEstimate: plan.feeEstimate,
    updated,
    inserted,
    deleted,
    warnings: plan.warnings,
  });
}
