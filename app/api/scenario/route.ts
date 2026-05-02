import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runScenario, runCustomScenario } from "@/lib/scenario";
import { explainRebalancing, resolveCustomScenarioFromPrompt } from "@/lib/gemini";
import type { Holding, ScenarioId, RebalancingResult, ResolvedCustomScenario } from "@/lib/types";
import { scenarios } from "@/lib/portfolio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ML_API = process.env.ML_API_URL || "http://127.0.0.1:8000";

type ScenarioBody = {
  scenarioId?: ScenarioId;
  customPrompt?: string;
};

const PRESET_IDS = new Set<Exclude<ScenarioId, "custom">>([
  "market-drop",
  "inflation-spike",
  "recession",
  "tech-boom",
]);

function isPresetId(id: unknown): id is Exclude<ScenarioId, "custom"> {
  return typeof id === "string" && PRESET_IDS.has(id as Exclude<ScenarioId, "custom">);
}

async function mlFetch(path: string, options: RequestInit, retries = 2): Promise<Response | null> {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(`${ML_API}${path}`, {
        ...options,
        signal: AbortSignal.timeout(90_000),
      });
      return res;
    } catch {
      if (i < retries) await new Promise((r) => setTimeout(r, 2000));
    }
  }
  return null;
}

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
  let body: ScenarioBody = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const trimmedPrompt =
    typeof body.customPrompt === "string" ? body.customPrompt.trim() : "";
  const hasCustom = trimmedPrompt.length > 0;
  const hasPreset = Boolean(body.scenarioId && body.scenarioId !== "custom");

  if (hasCustom && hasPreset) {
    return NextResponse.json(
      { error: "Send either scenarioId (preset) or customPrompt, not both." },
      { status: 400 },
    );
  }
  if (!hasCustom && !hasPreset) {
    return NextResponse.json(
      { error: "scenarioId or customPrompt is required." },
      { status: 400 },
    );
  }
  if (body.scenarioId === "custom") {
    return NextResponse.json(
      {
        error:
          'For a custom historical scenario, send customPrompt instead of scenarioId "custom".',
      },
      { status: 400 },
    );
  }

  let resolvedCustom: ResolvedCustomScenario | undefined;
  let activePresetId: Exclude<ScenarioId, "custom"> | undefined;
  let userPromptForResponse: string | undefined;

  if (hasCustom) {
    try {
      resolvedCustom = await resolveCustomScenarioFromPrompt(trimmedPrompt);
      userPromptForResponse = trimmedPrompt;
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Could not resolve scenario." },
        { status: 400 },
      );
    }
  } else {
    if (!isPresetId(body.scenarioId)) {
      return NextResponse.json({ error: "Unknown scenarioId." }, { status: 400 });
    }
    activePresetId = body.scenarioId;
  }

  let holdings: Holding[] | undefined;
  let userId: string | undefined;
  let userGoalText: string | undefined;

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (token) {
    try {
      const supabase = getSupabase(token);
      const {
        data: { user },
      } = await supabase.auth.getUser(token);

      if (user) {
        userId = user.id;
        const { data: dbHoldings } = await supabase
          .from("holdings")
          .select("*")
          .eq("user_id", user.id);

        if (dbHoldings && dbHoldings.length > 0) {
          const totalCost = dbHoldings.reduce(
            (s: number, h: { cost_basis: number }) => s + Number(h.cost_basis),
            0,
          );
          holdings = dbHoldings.map(
            (h: {
              ticker: string;
              name: string;
              category: string;
              cost_basis: number;
            }) => ({
              ticker: h.ticker,
              name: h.name,
              category: h.category as Holding["category"],
              amount: Number(h.cost_basis),
              weight: totalCost > 0 ? Number(h.cost_basis) / totalCost : 0,
            }),
          );
        }

        try {
          const { data: goals } = await supabase
            .from("goals")
            .select("text")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1);
          if (goals && goals.length > 0) {
            userGoalText = goals[0].text;
          }
        } catch {
          // optional
        }
      }
    } catch {
      // Fall through
    }
  }

  const scenarioIdForMl: ScenarioId = resolvedCustom ? "custom" : activePresetId!;

  if (holdings && holdings.length > 0) {
    try {
      const mlPayload: Record<string, unknown> = {
        holdings: holdings.map((h) => ({
          ticker: h.ticker,
          name: h.name,
          category: h.category,
          weight: h.weight,
        })),
        scenario_id: scenarioIdForMl,
      };
      if (resolvedCustom) {
        mlPayload.window_start = resolvedCustom.windowStart;
        mlPayload.window_end = resolvedCustom.windowEnd;
      }

      const mlRes = await mlFetch("/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mlPayload),
      });

      if (mlRes?.ok) {
        const mlData = await mlRes.json();
        const opt = mlData.optimization;

        const result: RebalancingResult = {
          scenarioId: scenarioIdForMl,
          windowStart: mlData.window?.start || "",
          windowEnd: mlData.window?.end || "",
          originalAllocation: opt.current.weights,
          newAllocation: opt.min_volatility.weights,
          expectedRiskReduction: `${Math.max(0, opt.current.volatility - opt.min_volatility.volatility).toFixed(1)} pts`,
          originalScenarioReturnPct: opt.current.expected_return,
          newScenarioReturnPct: opt.min_volatility.expected_return,
          originalVolPct: opt.current.volatility,
          newVolPct: opt.min_volatility.volatility,
          originalSharpe: opt.current.sharpe,
          newSharpe: opt.min_volatility.sharpe,
          maxDrawdownOriginal: opt.max_drawdown_current,
          maxDrawdownOptimized: opt.max_drawdown_optimized,
          riskContributions: opt.risk_contributions,
          efficientFrontier: (opt.efficient_frontier || []).map(
            (p: { expectedReturn: number; volatility: number; sharpe: number }) => ({
              expectedReturn: p.expectedReturn,
              volatility: p.volatility,
              sharpe: p.sharpe,
            }),
          ),
          notes: {
            tax: "Rebalancing may trigger taxable events. Consider tax-loss harvesting.",
            fees: "Check your broker for trading fees before executing.",
          },
          actions: opt.actions || [],
          predictions: mlData.predictions,
          xgbImportanceText: mlData.xgb_importance_text,
          pipeline: mlData.pipeline,
          maxSharpe: opt.max_sharpe,
          scenarioActualReturnCurrent: opt.scenario_actual_return_current,
          scenarioActualReturnOptimized: opt.scenario_actual_return_optimized,
          method: opt.method,
          riskScores: mlData.risk_scores as RebalancingResult["riskScores"],
        };

        const presetScenario =
          activePresetId != null ? scenarios.find((s) => s.id === activePresetId) : undefined;
        const scenarioTitle =
          resolvedCustom?.title ?? presetScenario?.title ?? String(scenarioIdForMl);
        const scenarioStory =
          resolvedCustom?.marketStory ??
          presetScenario?.marketStory ??
          `Scenario window: ${result.windowStart} to ${result.windowEnd}`;

        let explanation = "";
        try {
          explanation = await explainRebalancing({
            ownerName: "Investor",
            scenarioTitle,
            scenarioStory,
            goalText: userGoalText,
            result,
            xgbImportanceText: mlData.xgb_importance_text,
            macroContext: mlData.macro_snapshot,
          });
        } catch {
          explanation =
            "The XGBoost model predicted expected returns for each asset, and the optimizer found a lower-risk allocation on the Efficient Frontier.";
        }

        if (userId && token) {
          try {
            const supabase = getSupabase(token);
            await supabase.from("rebalance_proposals").insert({
              user_id: userId,
              scenario_id: result.scenarioId,
              scenario_title: scenarioTitle,
              original_allocation: result.originalAllocation,
              recommended_allocation: result.newAllocation,
              risk_reduction: result.expectedRiskReduction,
              original_vol: result.originalVolPct,
              new_vol: result.newVolPct,
              original_sharpe: result.originalSharpe,
              new_sharpe: result.newSharpe,
              max_drawdown_original: result.maxDrawdownOriginal,
              max_drawdown_optimized: result.maxDrawdownOptimized,
              risk_contributions: result.riskContributions,
              efficient_frontier: result.efficientFrontier,
              explanation,
              source: "xgboost-mvo",
            });
          } catch {
            // Non-critical
          }
        }

        return NextResponse.json({
          scenario: { title: scenarioTitle, marketStory: scenarioStory },
          ...(resolvedCustom && userPromptForResponse
            ? {
                resolvedCustom: {
                  ...resolvedCustom,
                  userPrompt: userPromptForResponse,
                },
              }
            : {}),
          result,
          explanation,
          source: "xgboost-mvo",
          warnings: [],
        });
      }
    } catch {
      // Python backend not available
    }
  }

  try {
    const bundle = resolvedCustom
      ? await runCustomScenario(resolvedCustom, holdings)
      : await runScenario(activePresetId!, holdings);

    let macroSnapshot: Record<string, { name: string; value: number; change_1m?: number | null }> | undefined;
    try {
      const macroRes = await fetch(`${ML_API}/macro`, { signal: AbortSignal.timeout(10_000) });
      if (macroRes.ok) {
        const macroData = await macroRes.json();
        macroSnapshot = macroData.indicators;
      }
    } catch {
      // optional
    }

    let explanation = "";
    try {
      explanation = await explainRebalancing({
        ownerName: "Investor",
        scenarioTitle: bundle.scenario.title,
        scenarioStory: bundle.scenario.marketStory,
        goalText: userGoalText,
        result: bundle.result,
        macroContext: macroSnapshot,
      });
    } catch {
      explanation =
        "The optimizer analyzed your portfolio using historical data and the covariance matrix to find a lower-risk allocation.";
    }

    if (userId && token) {
      try {
        const supabase = getSupabase(token);
        await supabase.from("rebalance_proposals").insert({
          user_id: userId,
          scenario_id: bundle.result.scenarioId,
          scenario_title: bundle.scenario.title,
          original_allocation: bundle.result.originalAllocation,
          recommended_allocation: bundle.result.newAllocation,
          risk_reduction: bundle.result.expectedRiskReduction,
          original_vol: bundle.result.originalVolPct,
          new_vol: bundle.result.newVolPct,
          original_sharpe: bundle.result.originalSharpe,
          new_sharpe: bundle.result.newSharpe,
          max_drawdown_original: bundle.result.maxDrawdownOriginal,
          max_drawdown_optimized: bundle.result.maxDrawdownOptimized,
          risk_contributions: bundle.result.riskContributions,
          efficient_frontier: bundle.result.efficientFrontier,
          explanation,
          source: bundle.source,
        });
      } catch {
        // Non-critical
      }
    }

    return NextResponse.json({
      scenario: { title: bundle.scenario.title, marketStory: bundle.scenario.marketStory },
      ...(resolvedCustom && userPromptForResponse
        ? {
            resolvedCustom: {
              ...resolvedCustom,
              userPrompt: userPromptForResponse,
            },
          }
        : {}),
      result: bundle.result,
      series: bundle.series,
      source: bundle.source,
      warnings: bundle.warnings,
      explanation,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Scenario engine failed to respond.",
      },
      { status: 500 },
    );
  }
}
