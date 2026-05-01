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
};

export async function explainRebalancing(
  context: ExplanationContext,
): Promise<string> {
  const ai = getClient();

  const riskContrib = Object.entries(context.result.riskContributions || {})
    .map(([t, pct]) => `${t}: ${pct}%`)
    .join(", ");

  const prompt = `You are Nestor, a wise and friendly financial guide for a beginner investor.

The ML model ran Mean-Variance Optimization using real historical data from Alpha Vantage. It computed the covariance matrix (how assets move together) and found the minimum-volatility portfolio on the Efficient Frontier.

User: ${context.ownerName}
Goal: ${context.goalText ?? "Build a steady, calm investing habit."}
Scenario: ${context.scenarioTitle}
What happened historically: ${context.scenarioStory}

Original allocation: ${JSON.stringify(context.result.originalAllocation)}
Recommended allocation: ${JSON.stringify(context.result.newAllocation)}
Risk reduction: ${context.result.expectedRiskReduction}
Annualized volatility: was ${context.result.originalVolPct.toFixed(1)}%, now ${context.result.newVolPct.toFixed(1)}%
Sharpe ratio: was ${context.result.originalSharpe.toFixed(2)}, now ${context.result.newSharpe.toFixed(2)}
Max drawdown: was ${context.result.maxDrawdownOriginal.toFixed(1)}%, now ${context.result.maxDrawdownOptimized.toFixed(1)}%
Risk contributions by asset: ${riskContrib || "N/A"}

Explain in 3-4 short sentences why the optimizer suggested these changes. Mention which asset was the biggest "weak link" during this historical period and why shifting weight helps. Reference the reduced drawdown if it's meaningful. End with one reassuring sentence. No jargon, no bullet points, no emojis. Write as if talking to a friend who just started investing.`;

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
