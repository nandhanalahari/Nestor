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
  macroContext?: Record<string, { name: string; value: number; change_1m?: number | null }>;
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
The XGBoost model analyzed historical price, volume, momentum data AND macroeconomic indicators (Fed rate, inflation, unemployment, treasury yields, VIX) for each stock. Here's what drove its predictions:
${context.xgbImportanceText}

Translate the feature names into simple concepts. For macro features:
- "fed_funds_rate" = the interest rate the Fed sets (higher = harder for growth stocks, better for savings)
- "cpi_yoy" = how fast prices are rising (inflation rate)
- "unemployment" = how many people are out of work
- "yield_spread" = difference between long and short term rates (negative = recession warning)
- "vix" = how scared the market is (higher = more volatility expected)`
    : "";

  // Build FRED macro context section
  let macroSection = "";
  if (context.macroContext && Object.keys(context.macroContext).length > 0) {
    const macroLines: string[] = [];
    for (const [, info] of Object.entries(context.macroContext)) {
      if (info.value !== undefined) {
        const changeStr = info.change_1m != null ? ` (${info.change_1m > 0 ? "+" : ""}${info.change_1m}% vs last month)` : "";
        macroLines.push(`- ${info.name}: ${info.value}${changeStr}`);
      }
    }
    if (macroLines.length > 0) {
      macroSection = `

CURRENT MACROECONOMIC ENVIRONMENT (from FRED — Federal Reserve Economic Data):
${macroLines.join("\n")}

IMPORTANT: Use this macro data to ground your explanation in reality. For example:
- If the Fed rate is high (>4%), explain that borrowing costs are elevated which hurts growth stocks but benefits bond yields
- If inflation (CPI YoY) is >3%, note that cash loses purchasing power and TIPS/real assets may be better
- If VIX is >20, explain that the market expects turbulence
- If the yield curve is inverted (10Y < 2Y), warn that this historically signals recession within 12-18 months
- Connect the macro environment to WHY specific rebalancing moves make sense RIGHT NOW`;
    }
  }

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

  // Build action cost estimates
  const actions = context.result.actions || [];
  const numTrades = actions.length;
  const estimatedTradingCost = numTrades * 2; // ~$2 per trade average
  const taxSection = `
COST & TAX TRANSPARENCY:
- Number of trades needed: ${numTrades}
- Estimated trading costs: ~$${estimatedTradingCost} (varies by broker; many brokers offer $0 commission on stocks/ETFs)
- Tax considerations: Selling positions at a gain triggers capital gains tax. Short-term gains (<1 year held) are taxed as ordinary income. Long-term gains (>1 year) get a lower tax rate (0-20%). If any position is at a LOSS, selling it can offset other gains (tax-loss harvesting — this is actually helpful).
- Net tax impact: Rebalancing inside a tax-advantaged account (401k, IRA, Roth IRA) has ZERO tax impact. In a taxable account, focus on selling losers first.`;

  const goalSection = context.goalText
    ? `
USER'S INVESTMENT GOAL: "${context.goalText}"
Explain how this rebalancing aligns with their specific goal. Be concrete about how lower volatility, better Sharpe ratio, or reduced drawdown helps them reach their goal.`
    : `
USER'S INVESTMENT GOAL: Build a steady, calm investing habit.
The user hasn't set a specific goal yet. Frame the recommendation in terms of building long-term wealth safely.`;

  const prompt = `You are Nestor, a wise and friendly financial guide for a beginner investor.

The pipeline works in four steps:
1. XGBoost (the "Eyes") predicted expected returns and risk for each stock using both technical indicators AND macroeconomic data from the Federal Reserve (FRED)
2. Mean-Variance Optimization (the "Hands") used REAL historical data from the ${context.scenarioTitle} period to find the safest portfolio allocation that would have survived that crisis
3. FRED macro data provides context about the CURRENT economic environment (interest rates, inflation, unemployment, etc.)
4. You (the "Translator") explain it all in plain English — clearly, transparently, with costs and goal alignment
${xgbSection}${macroSection}

${goalSection}

${taxSection}

User: ${context.ownerName}
Scenario: ${context.scenarioTitle}
What happened historically: ${context.scenarioStory}

Original allocation: ${JSON.stringify(context.result.originalAllocation)}
Recommended allocation: ${JSON.stringify(context.result.newAllocation)}
Risk reduction: ${context.result.expectedRiskReduction}
Annualized volatility: was ${context.result.originalVolPct.toFixed(1)}%, now ${context.result.newVolPct.toFixed(1)}%
Sharpe ratio: was ${context.result.originalSharpe.toFixed(2)}, now ${context.result.newSharpe.toFixed(2)}
Max drawdown during scenario: was ${context.result.maxDrawdownOriginal.toFixed(1)}%, now ${context.result.maxDrawdownOptimized.toFixed(1)}%
Risk contributions by asset: ${riskContrib || "N/A"}
Notes on tax: ${context.result.notes?.tax || "N/A"}
Notes on fees: ${context.result.notes?.fees || "N/A"}${actualPerfSection}

Write your explanation in this exact structure (use these exact section headers):

**What happened:** One sentence about what would have happened to their portfolio during ${context.scenarioTitle} (use actual % numbers).

**Why this matters now:** One sentence connecting the CURRENT macro environment (use real FRED numbers like "with the Fed rate at X%" or "inflation running at Y%") to why this rebalancing is timely.

**What we recommend:** Two sentences explaining the specific moves and WHY each one helps. Mention which holdings were the weak link and which are the safe haven. Translate the XGBoost feature importances into plain language.

**Costs & taxes:** One sentence on estimated trading costs and tax implications. Be honest — if it's minimal, say so. If there are tax-loss harvesting opportunities, mention them.

**How this fits your goal:** One sentence connecting the changes to their investment goal.

Rules: No bullet points, no emojis. Use the section headers exactly as shown. Write warmly, as if talking to a friend who just started investing. Use SPECIFIC numbers from the data provided (don't make up numbers).`;

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

export async function analyzeNewsItems(
  items: { headline: string; summary: string }[],
  userTickers: string[]
) {
  const ai = getClient();
  const prompt = `You are Nestor, a financial guide. Review these ${items.length} news articles.
For each article, analyze it in the context of a beginner investor who holds the following stocks: ${userTickers.join(", ") || "None specified"}.

    Return a JSON array exactly matching the length and order of the input articles. For each article, provide:
    1. "why": A single, simple sentence explaining WHY this happened.
    2. "forYou": A single, simple sentence explaining what this means for their specific holdings (if related) OR the general market (if not).
    3. "deepDive": A 1-2 paragraph simple explanation with more context.
    4. "importance": "high" if this is a major market event (e.g., Fed rate change, major crash, huge earnings surprise for a held stock), otherwise "normal".
    5. "impact": "Positive", "Negative", or "Neutral" based on how this affects their portfolio.
    6. "jargon": An array of objects { "term": "...", "definition": "..." } identifying 0-2 complex financial terms in the summary and defining them simply. Return an empty array if none.
    7. "takeaway": A single, reassuring sentence offering a mental model or educational suggestion (e.g., "Since your goal is long-term, this daily drop is normal market noise—no action needed.").

    Articles to analyze:
    ${items.map((item, i) => `[${i}] Headline: ${item.headline}\nSummary: ${item.summary}`).join("\n\n")}

    Return ONLY a JSON array of objects. Example format:
    [
      {
        "why": "Apple reported record iPhone sales in Q4.",
        "forYou": "Since you hold AAPL, this is good news for your portfolio's growth.",
        "deepDive": "Apple's new iPhone was a huge hit, driving their revenue up 20% compared to last year. For investors, this shows the company is still growing fast.",
        "importance": "high",
        "impact": "Positive",
        "jargon": [{ "term": "Q4", "definition": "The fourth quarter of the financial year, usually October to December." }],
        "takeaway": "Strong earnings like this support a long-term hold strategy."
      }
    ]`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
    });
    const text = response.text?.trim() ?? "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("Gemini response was not a JSON array.");
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) throw new Error("Parsed JSON is not an array.");
    return parsed as {
      why: string;
      forYou: string;
      deepDive: string;
      importance: "high" | "normal";
      impact: "Positive" | "Negative" | "Neutral";
      jargon: { term: string; definition: string }[];
      takeaway: string;
    }[];
  } catch (error) {
    console.error("Gemini analyzeNewsItems error:", error);
    return null;
  }
}

export async function explainGlossaryTerm(
  term: string,
  context?: string,
): Promise<string> {
  const ai = getClient();
  const prompt = `Explain this investing term for a beginner in 1-2 short sentences.

Term: ${term}
${context ? `Context where it appeared: ${context}` : ""}

Rules:
- Use plain English.
- Do not give personalized financial advice.
- Do not mention that you are an AI.
- Return only the explanation text.`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
  });

  const text = response.text?.trim() ?? "";
  if (!text) throw new Error("Gemini returned an empty glossary explanation.");
  return text.replace(/^["']|["']$/g, "");
}

