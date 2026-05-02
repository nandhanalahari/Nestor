import "server-only";
import { GoogleGenAI } from "@google/genai";
import type { RebalancingResult } from "./types";

let cachedClient: GoogleGenAI | null = null;

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY env var.");
  if (!cachedClient) cachedClient = new GoogleGenAI({ apiKey });
  return cachedClient;
}

const MODEL = "gemini-2.5-flash";

export type ExplanationContext = {
  ownerName: string;
  scenarioTitle: string;
  scenarioStory: string;
  goalText?: string;
  result: RebalancingResult;
  xgbImportanceText?: string;
};

export async function explainRebalancing(
  context: ExplanationContext,
): Promise<string> {
  const ai = getClient();

  const riskContrib = Object.entries(context.result.riskContributions || {})
    .map(([t, pct]) => `${t}: ${pct}%`)
    .join(", ");

  const xgbSection = context.xgbImportanceText
    ? `
The XGBoost model analyzed historical price, volume, and momentum data for each stock. Here's what drove its predictions:
${context.xgbImportanceText}

Use this to explain WHY the model expects certain stocks to do better or worse. Translate the feature names into simple concepts (e.g., "12-month momentum" means "how much the stock has been trending up or down over the past year").`
    : "";

  const scenarioActualCurrent = context.result.scenarioActualReturnCurrent;
  const scenarioActualOpt = context.result.scenarioActualReturnOptimized;
  const actualPerfSection =
    scenarioActualCurrent !== undefined && scenarioActualOpt !== undefined
      ? `

ACTUAL HISTORICAL PERFORMANCE during the scenario period:
- User's current portfolio would have returned ${scenarioActualCurrent.toFixed(1)}%
- Optimized portfolio would have returned ${scenarioActualOpt.toFixed(1)}%
- Difference: ${(scenarioActualOpt - scenarioActualCurrent).toFixed(1)} percentage points`
      : "";

  const prompt = `You are Nestor, a wise and friendly financial guide for a beginner investor.

The pipeline works in three steps:
1. XGBoost (the "Eyes") predicted expected returns and risk for each stock based on historical patterns
2. Mean-Variance Optimization (the "Hands") used REAL historical data from the ${context.scenarioTitle} period to find the safest portfolio allocation that would have survived that crisis
3. You (the "Translator") explain it all in plain English
${xgbSection}

User: ${context.ownerName}
Goal: ${context.goalText ?? "Build a steady, calm investing habit."}
Scenario: ${context.scenarioTitle}
What happened historically: ${context.scenarioStory}

Original allocation: ${JSON.stringify(context.result.originalAllocation)}
Recommended allocation: ${JSON.stringify(context.result.newAllocation)}
Risk reduction: ${context.result.expectedRiskReduction}
Annualized volatility: was ${context.result.originalVolPct.toFixed(1)}%, now ${context.result.newVolPct.toFixed(1)}%
Sharpe ratio: was ${context.result.originalSharpe.toFixed(2)}, now ${context.result.newSharpe.toFixed(2)}
Max drawdown during scenario: was ${context.result.maxDrawdownOriginal.toFixed(1)}%, now ${context.result.maxDrawdownOptimized.toFixed(1)}%
Risk contributions by asset: ${riskContrib || "N/A"}${actualPerfSection}

Explain in 4-5 short sentences:
1. Specifically reference what would have happened to their actual portfolio during ${context.scenarioTitle} (use the actual % returns)
2. Which holdings were the biggest "weak link" during this exact crisis
3. Why the recommended changes would have helped (mention the drawdown improvement)
4. End with one reassuring sentence

No jargon, no bullet points, no emojis. Write as if talking to a friend who just started investing.`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
  });
  const text = response.text?.trim();
  if (!text) throw new Error("Gemini returned an empty response.");
  return text;
}

export type GoalContext = { rawText: string };

export async function structureGoal(input: GoalContext) {
  const ai = getClient();
  const prompt = `You are Nestor. Read this beginner investor's goal and respond with JSON only:
{
  "summary": "<one short sentence in plain English>",
  "horizonYears": <integer or null>,
  "targetAmount": <number or null>,
  "encouragement": "<one warm sentence>"
}

Goal: """${input.rawText}"""

Return only valid JSON.`;
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
  });
  const text = response.text?.trim() ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Gemini response was not JSON.");
  return JSON.parse(jsonMatch[0]) as {
    summary: string;
    horizonYears: number | null;
    targetAmount: number | null;
    encouragement: string;
  };
}
