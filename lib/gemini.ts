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
  const prompt = `You are Nestor, a wise and friendly financial guide for a beginner.

User: ${context.ownerName}
Goal: ${context.goalText ?? "Build a steady, calm investing habit."}
Scenario: ${context.scenarioTitle}
Story: ${context.scenarioStory}

Original allocation (% of portfolio): ${JSON.stringify(
    context.result.originalAllocation,
  )}
Recommended allocation: ${JSON.stringify(context.result.newAllocation)}
Expected risk reduction: ${context.result.expectedRiskReduction}
Estimated annualized volatility: was ${context.result.originalVolPct.toFixed(
    1,
  )}%, now ${context.result.newVolPct.toFixed(1)}%

Explain in 2 to 3 short sentences why this calm rebalance helps the user, mention any tax angle in plain English, and end with a single reassuring sentence. No jargon. No bullet points. No emojis.`;

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
