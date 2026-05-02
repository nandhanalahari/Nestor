import { scenarios } from "@/lib/portfolio";
import type { Holding, ScenarioId } from "@/lib/types";

export type ScenarioChatCitation = {
  label: string;
  value: string;
  detail: string;
};

export type ScenarioChatContext = {
  holdings?: Holding[];
  goalText?: string;
  profile?: {
    profile_label?: string | null;
    liquidity_window_months?: number | null;
  } | null;
  latestQuotes?: Record<string, number>;
  macroSnapshot?: Record<
    string,
    { name: string; value: number; change_1m?: number | null }
  >;
};

export type ScenarioChatResponse = {
  answer: string;
  scenarioId: ScenarioId | null;
  citations: ScenarioChatCitation[];
  suggestedPromptExamples: string[];
  unsupported: boolean;
};

type MatchKind =
  | "market-drop"
  | "inflation-spike"
  | "recession"
  | "tech-boom"
  | "liquidity";

const suggestedPromptExamples = [
  "What if stocks fall 20% next month?",
  "What if inflation spikes again?",
  "What if the economy enters a recession?",
  "What if AI and tech stocks keep booming?",
  "I need to withdraw 20% next year.",
];

const keywordMap: Record<Exclude<MatchKind, "liquidity">, RegExp[]> = {
  "market-drop": [
    /\bmarket\s+(drop|crash|selloff|sell-off|fall|falls|downturn)\b/,
    /\bstocks?\s+(drop|crash|fall|falls|sell off|sell-off|down)\b/,
    /\b(bear market|correction|drawdown|covid selloff|2020)\b/,
    /\b(20|twenty|30|thirty)%?\s+(drop|fall|crash|decline)\b/,
  ],
  "inflation-spike": [
    /\b(inflation|cpi|prices|price spike|cost of living)\b/,
    /\b(fed|federal reserve|rates?|interest rates?|yields?)\b/,
    /\b(stagflation|2022)\b/,
  ],
  recession: [
    /\b(recession|downturn|economic slowdown|slowdown)\b/,
    /\b(unemployment|layoffs?|job losses|credit crunch)\b/,
    /\b(financial crisis|2008|banks? fail|banking crisis)\b/,
  ],
  "tech-boom": [
    /\b(tech|technology|nasdaq|qqq|growth stocks?)\b/,
    /\b(ai|artificial intelligence|semiconductors?|chips?|nvda|nvidia)\b/,
    /\b(boom|surge|rally|melt up|2023|2024)\b/,
  ],
};

const liquidityPatterns = [
  /\b(withdraw|withdrawal|take out|cash out|pull out)\b/,
  /\b(need|raise|use)\s+(cash|money|liquidity|funds)\b/,
  /\b(i|we)\s+(need|want|plan|have)\s+to\s+sell\b/,
  /\bsell\s+\d+(?:\.\d+)?\s?%\b/,
  /\b(down payment|tuition|emergency fund|medical bill|big purchase)\b/,
  /\b(liquid|liquidity)\b/,
];

export function mapScenarioChatPrompt(
  prompt: string,
  context: ScenarioChatContext = {},
): ScenarioChatResponse {
  const cleaned = prompt.trim();
  if (!cleaned) return unsupportedResponse();

  const normalized = cleaned.toLowerCase();
  const liquidity = liquidityPatterns.some((pattern) => pattern.test(normalized));
  const scores = scoreScenarioKeywords(normalized);
  const matchedKind = liquidity ? "liquidity" : highestScenarioScore(scores);

  if (!matchedKind) return unsupportedResponse();

  const scenarioId: ScenarioId =
    matchedKind === "liquidity" ? "recession" : matchedKind;
  const scenario = scenarios.find((item) => item.id === scenarioId);

  if (!scenario) return unsupportedResponse();

  const citations = buildCitations(matchedKind, scenarioId, context);
  const answer = buildAnswer(cleaned, matchedKind, scenarioId, context);

  return {
    answer,
    scenarioId,
    citations,
    suggestedPromptExamples,
    unsupported: false,
  };
}

function scoreScenarioKeywords(normalized: string) {
  const scores: Record<Exclude<MatchKind, "liquidity">, number> = {
    "market-drop": 0,
    "inflation-spike": 0,
    recession: 0,
    "tech-boom": 0,
  };

  for (const [scenarioId, patterns] of Object.entries(keywordMap) as Array<
    [Exclude<MatchKind, "liquidity">, RegExp[]]
  >) {
    for (const pattern of patterns) {
      if (pattern.test(normalized)) scores[scenarioId] += 1;
    }
  }

  return scores;
}

function highestScenarioScore(
  scores: Record<Exclude<MatchKind, "liquidity">, number>,
) {
  let best: Exclude<MatchKind, "liquidity"> | null = null;
  let bestScore = 0;

  for (const [scenarioId, score] of Object.entries(scores) as Array<
    [Exclude<MatchKind, "liquidity">, number]
  >) {
    if (score > bestScore) {
      best = scenarioId;
      bestScore = score;
    }
  }

  return bestScore > 0 ? best : null;
}

function buildAnswer(
  prompt: string,
  matchedKind: MatchKind,
  scenarioId: ScenarioId,
  context: ScenarioChatContext,
) {
  const scenario = scenarios.find((item) => item.id === scenarioId);
  const portfolioPhrase = describePortfolio(context.holdings);
  const goalPhrase = context.goalText
    ? ` I also factored in your current goal: "${context.goalText}".`
    : "";

  if (matchedKind === "liquidity") {
    const withdrawal = extractWithdrawalPhrase(prompt);
    return `I mapped this to the Recession scenario with a liquidity lens${
      withdrawal ? ` for ${withdrawal}` : ""
    }. A recession-style stress test is the closest match because it asks a practical question: can you raise cash when markets are weak? ${portfolioPhrase}${goalPhrase} I will focus the recommendation on cash needs, downside protection, and which changes reduce forced-selling risk.`;
  }

  return `I mapped this to the ${scenario?.title ?? scenarioId} scenario. ${
    scenario?.description ?? "This is a supported scenario stress test."
  } ${portfolioPhrase}${goalPhrase} I will use that scenario to compare your current mix against a suggested mix in plain English.`;
}

function buildCitations(
  matchedKind: MatchKind,
  scenarioId: ScenarioId,
  context: ScenarioChatContext,
): ScenarioChatCitation[] {
  const scenario = scenarios.find((item) => item.id === scenarioId);
  const citations: ScenarioChatCitation[] = [
    {
      label: "Prompt match",
      value:
        matchedKind === "liquidity"
          ? "Personal liquidity need"
          : scenario?.title ?? scenarioId,
      detail:
        matchedKind === "liquidity"
          ? "Cash withdrawal language maps to the recession scenario because liquidity risk is most important when markets are stressed."
          : `Matched the user prompt to the supported ${scenario?.title ?? scenarioId} scenario.`,
    },
  ];

  if (scenario) {
    citations.push({
      label: "Scenario window",
      value: `${scenario.windowStart} to ${scenario.windowEnd}`,
      detail: scenario.marketStory,
    });
  }

  const holdings = context.holdings ?? [];
  if (holdings.length > 0) {
    const total = holdings.reduce((sum, holding) => sum + holding.amount, 0);
    const topHolding = [...holdings].sort((a, b) => b.amount - a.amount)[0];
    citations.push({
      label: "Portfolio context",
      value: `${holdings.length} holdings${total > 0 ? `, about ${formatCurrency(total)}` : ""}`,
      detail: topHolding
        ? `Largest cost-basis position is ${topHolding.ticker} at ${formatPercent(topHolding.weight)} of the portfolio.`
        : "Holdings were available for personalization.",
    });
  } else {
    citations.push({
      label: "Portfolio context",
      value: "No holdings loaded",
      detail: "The scenario can still be selected, but the full stress test will use the scenario API defaults unless holdings are available.",
    });
  }

  if (context.latestQuotes && Object.keys(context.latestQuotes).length > 0) {
    const quoteText = Object.entries(context.latestQuotes)
      .slice(0, 3)
      .map(([ticker, price]) => `${ticker}: ${formatCurrency(price)}`)
      .join("; ");
    citations.push({
      label: "Latest quotes",
      value: quoteText,
      detail: "Recent prices were available for the loaded holdings and can be used by the scenario engine.",
    });
  }

  if (context.profile?.profile_label) {
    citations.push({
      label: "Investor profile",
      value: context.profile.profile_label,
      detail:
        typeof context.profile.liquidity_window_months === "number"
          ? `Liquidity window is ${context.profile.liquidity_window_months} months.`
          : "Profile label was available for personalization.",
    });
  }

  if (context.goalText) {
    citations.push({
      label: "Goal context",
      value: "Latest goal",
      detail: context.goalText,
    });
  }

  const macroCitation = summarizeMacro(context.macroSnapshot);
  if (macroCitation) citations.push(macroCitation);

  return citations;
}

function describePortfolio(holdings?: Holding[]) {
  if (!holdings || holdings.length === 0) {
    return "I do not see holdings in this request, so the mapping is based on the prompt only.";
  }

  const stockLikeWeight = holdings
    .filter((holding) => holding.category === "Stock" || holding.category === "ETF")
    .reduce((sum, holding) => sum + holding.weight, 0);

  return `Your loaded portfolio has ${holdings.length} holdings with about ${formatPercent(
    stockLikeWeight,
  )} in stock-like assets, so this scenario is relevant to the risk mix.`;
}

function summarizeMacro(
  macroSnapshot?: ScenarioChatContext["macroSnapshot"],
): ScenarioChatCitation | null {
  if (!macroSnapshot) return null;

  const entries = Object.values(macroSnapshot).filter(
    (item) => typeof item.name === "string" && Number.isFinite(item.value),
  );
  if (entries.length === 0) return null;

  const first = entries[0];
  const second = entries[1];
  return {
    label: "Macro context",
    value: second
      ? `${first.name}: ${first.value}; ${second.name}: ${second.value}`
      : `${first.name}: ${first.value}`,
    detail: "Current macro indicators were available and can help explain why the selected scenario matters now.",
  };
}

function unsupportedResponse(): ScenarioChatResponse {
  return {
    answer:
      "I can guide market-drop, inflation-spike, recession, tech-boom, and personal liquidity what-if prompts right now. Try asking about a stock selloff, inflation, recession risk, a tech rally, or a planned withdrawal.",
    scenarioId: null,
    citations: [],
    suggestedPromptExamples,
    unsupported: true,
  };
}

function extractWithdrawalPhrase(prompt: string) {
  const percent = prompt.match(/\b\d+(?:\.\d+)?\s?%/);
  const timeframe = prompt.match(
    /\b(next\s+(?:month|quarter|year)|this\s+(?:month|quarter|year)|in\s+\d+\s+(?:months?|years?))\b/i,
  );

  if (!percent && !timeframe) return "";
  return [percent?.[0], timeframe?.[0]].filter(Boolean).join(" ");
}

function formatPercent(value: number) {
  const pct = Math.abs(value) <= 1 ? value * 100 : value;
  return `${Math.round(pct)}%`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
