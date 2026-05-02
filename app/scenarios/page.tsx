"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Term } from "@/components/Term"
import {
  AlertTriangle,
  DollarSign,
  Zap,
  RefreshCw,
  Shield,
  ArrowRight,
  Activity,
  TrendingUp,
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts"
import type { RebalancingResult, ScenarioId, FrontierPoint, XGBPrediction, LSTMPrediction } from "@/lib/types"
import type { TaxPreview as TaxPreviewData } from "@/lib/tax"
import type { FeeEstimate } from "@/lib/fees"
import { authFetch } from "@/lib/api"

const uiToApi: Record<string, ScenarioId> = {
  "market-crash": "market-drop",
  inflation: "inflation-spike",
  recession: "recession",
  "tech-boom": "tech-boom",
}

const apiToUi: Record<Exclude<ScenarioId, "custom">, string> = {
  "market-drop": "market-crash",
  "inflation-spike": "inflation",
  recession: "recession",
  "tech-boom": "tech-boom",
}

const promptExamples = [
  "What if stocks fall 20% next month?",
  "What if inflation spikes again?",
  "What if the economy enters a recession?",
  "What if AI and tech stocks keep booming?",
  "I need to withdraw 20% next year.",
]

interface Recommendation {
  original: Record<string, number>
  recommended: Record<string, number>
  riskReduction: string
  explanation: string
  originalVol?: number
  newVol?: number
  originalSharpe?: number
  newSharpe?: number
  maxDDOriginal?: number
  maxDDOptimized?: number
  riskContributions?: Record<string, number>
  frontier?: FrontierPoint[]
  actions?: string[]
  predictions?: Record<string, XGBPrediction>
  lstmPredictions?: Record<string, LSTMPrediction>
  pipeline?: string
  scenarioActualCurrent?: number
  scenarioActualOptimized?: number
  method?: string
  taxPreview?: TaxPreviewData
  feeEstimate?: FeeEstimate
}

type ScenarioChatCitation = {
  label: string
  value: string
  detail: string
}

type ScenarioChatResponse = {
  answer: string
  scenarioId: ScenarioId | null
  citations: ScenarioChatCitation[]
  suggestedPromptExamples?: string[]
  unsupported: boolean
}

type ExecuteResponse = {
  executed: boolean
  mock?: boolean
  totalValue?: number
  trades?: Array<{
    ticker: string
    action: "buy" | "sell" | "hold"
    dollarChange: number
    sharesChange: number
    price: number
  }>
  feeEstimate?: FeeEstimate
  warnings?: string[]
  error?: string
}

const panelClass =
  "border-[#e0e0e0] bg-white shadow-[0_20px_20px_rgba(0,0,0,0.04)]"
const insightPanelClass =
  "border-[#e0e0e0] border-l-4 border-l-[#f7e382] bg-white shadow-[0_20px_20px_rgba(0,0,0,0.04)]"
const headingClass = "font-display text-3xl font-semibold text-[#002141]"
const subcopyClass = "mt-2 max-w-4xl text-sm leading-6 text-[#43474f]"
const metricLabelClass = "text-xs font-medium uppercase text-[#43474f]"

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

const currencyWithCents = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
})

function formatAllocationPct(value: number) {
  return `${Math.round(value)}%`
}

function SimpleRebalanceCard({
  original,
  recommended,
}: {
  original: Record<string, number>
  recommended: Record<string, number>
}) {
  const rows = Object.keys({ ...original, ...recommended })
    .map((ticker) => {
      const current = original[ticker] ?? 0
      const target = recommended[ticker] ?? 0
      return {
        ticker,
        current,
        target,
        change: target - current,
      }
    })
    .filter((row) => Math.abs(row.change) >= 0.5 || row.current > 0 || row.target > 0)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))

  return (
    <Card className={insightPanelClass}>
      <CardHeader>
        <CardTitle className="text-lg text-[#002141]">Suggested change</CardTitle>
        <CardDescription className="text-[#43474f]">
          One simple view of what would move if you execute this rebalance.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {rows.map((row) => {
            const isIncrease = row.change > 0
            const isFlat = Math.abs(row.change) < 0.5

            return (
              <div
                key={row.ticker}
                className="flex flex-col gap-3 rounded-lg border border-[#e0e0e0] bg-[#f9f9fe] p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-mono text-sm font-semibold text-[#002141]">
                    {row.ticker}
                  </p>
                  <p className="mt-1 text-xs text-[#43474f]">
                    {formatAllocationPct(row.current)} now to {formatAllocationPct(row.target)} suggested
                  </p>
                </div>
                <div
                  className={`w-fit rounded-full px-3 py-1 text-sm font-semibold ${
                    isFlat
                      ? "bg-white text-[#43474f]"
                      : isIncrease
                        ? "bg-[#e6f4ef] text-[#00735f]"
                        : "bg-[#fff4d6] text-[#8a5d00]"
                  }`}
                >
                  {isFlat
                    ? "Hold steady"
                    : `${isIncrease ? "Add" : "Trim"} ${formatAllocationPct(Math.abs(row.change))}`}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function CostsAndTaxesCard({
  feeEstimate,
  taxPreview,
}: {
  feeEstimate?: FeeEstimate | null
  taxPreview?: TaxPreviewData | null
}) {
  if ((!feeEstimate || feeEstimate.totalTradedValue <= 0) && !taxPreview) return null

  const shortTermGain =
    taxPreview?.lines
      .filter((line) => line.holdingPeriod === "short-term")
      .reduce((sum, line) => sum + line.realizedGain, 0) ?? 0
  const longTermGain =
    taxPreview?.lines
      .filter((line) => line.holdingPeriod === "long-term")
      .reduce((sum, line) => sum + line.realizedGain, 0) ?? 0

  return (
    <Card className={panelClass}>
      <CardHeader>
        <CardTitle className="text-lg text-[#002141]">Costs and taxes</CardTitle>
        <CardDescription className="text-[#43474f]">
          A simple estimate before you execute. This is not tax or brokerage advice.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-[#e0e0e0] bg-[#f9f9fe] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#524700]">
              Fees
            </p>
            {feeEstimate && feeEstimate.totalTradedValue > 0 ? (
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-[#43474f]">Amount traded</p>
                  <p className="mt-1 text-2xl font-semibold text-[#002141]">
                    {currencyWithCents.format(feeEstimate.totalTradedValue)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#43474f]">Estimated cost</p>
                  <p className="mt-1 text-2xl font-semibold text-[#00735f]">
                    {currencyWithCents.format(feeEstimate.totalCost)}
                  </p>
                </div>
                <p className="col-span-2 text-xs leading-5 text-[#43474f]">
                  Assumes $0 commission and 0.05% spread/slippage for stocks and ETFs.
                  Mutual funds use 0% spread/slippage in this demo.
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-[#43474f]">
                No meaningful trading cost estimate is available for this proposal.
              </p>
            )}
          </div>

          <div className="rounded-lg border border-[#e0e0e0] bg-[#f9f9fe] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#524700]">
              Taxes
            </p>
            {taxPreview && taxPreview.lines.length > 0 ? (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-[#43474f]">Realized gain/loss</p>
                    <p className="mt-1 text-2xl font-semibold text-[#002141]">
                      {currency.format(taxPreview.totalRealizedGain)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#43474f]">Estimated tax</p>
                    <p className="mt-1 text-2xl font-semibold text-[#8a5d00]">
                      {currency.format(taxPreview.estimatedFederalTax)}
                    </p>
                  </div>
                </div>
                <p className="text-xs leading-5 text-[#43474f]">
                  Short-term gain: {currency.format(shortTermGain)}. Long-term gain:{" "}
                  {currency.format(longTermGain)}. Actual taxes depend on your filing status,
                  bracket, state, and other gains or losses.
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-[#43474f]">
                No taxable sales were estimated for this proposal.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

type ScenarioBundle = {
  scenario: { title: string; marketStory: string }
  result: RebalancingResult & {
    predictions?: Record<string, XGBPrediction>
    lstmPredictions?: Record<string, LSTMPrediction>
    xgbImportanceText?: string
    pipeline?: string
  }
  explanation?: string
  source: "live" | "fallback" | "xgboost-mvo"
  warnings: string[]
  tax_preview?: TaxPreviewData | null
  fee_estimate?: FeeEstimate | null
}

export default function ScenariosPage() {
  const router = useRouter()
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null)
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [scenarioError, setScenarioError] = useState<string | null>(null)
  const [advancedMode, setAdvancedMode] = useState(false)
  const [chatPrompt, setChatPrompt] = useState("")
  const [chatAnswer, setChatAnswer] = useState<string | null>(null)
  const [chatLoading, setChatLoading] = useState(false)
  const [executeLoading, setExecuteLoading] = useState(false)
  const [executeMessage, setExecuteMessage] = useState<string | null>(null)
  const [executeError, setExecuteError] = useState<string | null>(null)

  const runScenarioAnalysis = async (apiId: ScenarioId, uiId: string) => {
    setIsLoading(true)
    setSelectedScenario(uiId)
    setRecommendation(null)
    setScenarioError(null)
    setExecuteMessage(null)
    setExecuteError(null)

    try {
      const res = await authFetch("/api/scenario", {
        method: "POST",
        body: JSON.stringify({ scenarioId: apiId }),
      })
      const bundle = (await res.json()) as ScenarioBundle & { error?: string }
      if (!res.ok) throw new Error(bundle.error ?? "Scenario engine failed.")

      const explanation =
        bundle.explanation ||
        "The optimizer studied how your holdings have moved together and found a portfolio mix that may be less bumpy."

      setRecommendation({
        original: bundle.result.originalAllocation,
        recommended: bundle.result.newAllocation,
        riskReduction: bundle.result.expectedRiskReduction,
        explanation,
        originalVol: bundle.result.originalVolPct,
        newVol: bundle.result.newVolPct,
        originalSharpe: bundle.result.originalSharpe,
        newSharpe: bundle.result.newSharpe,
        maxDDOriginal: bundle.result.maxDrawdownOriginal,
        maxDDOptimized: bundle.result.maxDrawdownOptimized,
        riskContributions: bundle.result.riskContributions,
        frontier: bundle.result.efficientFrontier,
        actions: bundle.result.actions,
        predictions: bundle.result.predictions,
        lstmPredictions: bundle.result.lstmPredictions,
        pipeline: bundle.result.pipeline,
        scenarioActualCurrent: bundle.result.scenarioActualReturnCurrent,
        scenarioActualOptimized: bundle.result.scenarioActualReturnOptimized,
        method: bundle.result.method,
        taxPreview: bundle.tax_preview ?? undefined,
        feeEstimate: bundle.fee_estimate ?? undefined,
      })
    } catch (e) {
      setScenarioError(
        e instanceof Error ? e.message : "Could not run this scenario.",
      )
      setSelectedScenario(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleChatSubmit = async (promptOverride?: string) => {
    const prompt = (promptOverride ?? chatPrompt).trim()
    if (!prompt) return

    setChatPrompt(prompt)
    setChatLoading(true)
    setScenarioError(null)
    setChatAnswer(null)
    setExecuteMessage(null)
    setExecuteError(null)

    try {
      const res = await authFetch("/api/scenario/chat", {
        method: "POST",
        body: JSON.stringify({ prompt }),
      })
      const data = (await res.json()) as ScenarioChatResponse & { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Scenario chat failed.")

      setChatAnswer(data.answer)

      if (data.unsupported || !data.scenarioId) {
        setRecommendation(null)
        setSelectedScenario(null)
        return
      }

      await runScenarioAnalysis(data.scenarioId, apiToUi[data.scenarioId])
    } catch (e) {
      setScenarioError(
        e instanceof Error ? e.message : "Could not understand that what-if prompt.",
      )
    } finally {
      setChatLoading(false)
    }
  }

  const handleExecuteRebalance = async () => {
    if (!recommendation || executeLoading) return

    setExecuteLoading(true)
    setExecuteError(null)
    setExecuteMessage(null)

    try {
      const res = await authFetch("/api/rebalance/execute", {
        method: "POST",
        body: JSON.stringify({
          recommendedAllocation: recommendation.recommended,
          originalAllocation: recommendation.original,
          sourceScenario: selectedScenario ? uiToApi[selectedScenario] : undefined,
        }),
      })
      const data = (await res.json()) as ExecuteResponse
      if (!res.ok) throw new Error(data.error ?? "Could not execute rebalance.")

      const traded = data.feeEstimate?.totalTradedValue
      setExecuteMessage(
        data.mock
          ? "Mock mode simulated the rebalance. Sending you back to the dashboard."
          : `Rebalance executed${traded ? ` with about $${traded.toLocaleString()} traded` : ""}. Sending you back to the dashboard.`,
      )
      setTimeout(() => router.push("/dashboard"), 1200)
    } catch (e) {
      setExecuteError(
        e instanceof Error ? e.message : "Could not execute this rebalance.",
      )
    } finally {
      setExecuteLoading(false)
    }
  }

  const frontierData = (recommendation?.frontier ?? []).map((p) => ({
    volatility: Number(p.volatility.toFixed(1)),
    return: Number(p.expectedReturn.toFixed(1)),
  }))

  const riskContribData = recommendation?.riskContributions
    ? Object.entries(recommendation.riskContributions).map(([ticker, pct]) => ({
        ticker,
        contribution: Number(pct),
      }))
    : []

  return (
    <div className="space-y-8 bg-[#f9f9fe] text-[#1a1c1f]">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className={headingClass}>What-If Scenarios</h1>
        <p className={subcopyClass}>
          Stress-test your portfolio with AI forecasts that learn from your stocks&apos; history
          and real economic signals like rates, inflation, unemployment, and market fear.
          Nestor then looks for a portfolio mix with a better risk/reward tradeoff.
        </p>
      </motion.div>

      {scenarioError && (
        <p className="rounded-lg border border-[#e0e0e0] border-l-4 border-l-[#8a1f1f] bg-white px-4 py-3 text-sm text-[#8a1f1f] shadow-[0_20px_20px_rgba(0,0,0,0.04)]">
          {scenarioError}
        </p>
      )}

      <Card className={insightPanelClass}>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-[#002141]">Ask a What-If</CardTitle>
              <CardDescription className="mt-1 text-[#43474f]">
                Use plain language. Nestor will match your question to a supported scenario and cite the app data it used.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-[#e0e0e0] bg-[#f9f9fe] p-1">
              <button
                type="button"
                onClick={() => setAdvancedMode(false)}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                  !advancedMode
                    ? "bg-[#002141] text-white shadow-sm"
                    : "text-[#43474f] hover:text-[#002141]"
                }`}
              >
                Beginner
              </button>
              <button
                type="button"
                onClick={() => setAdvancedMode(true)}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                  advancedMode
                    ? "bg-[#002141] text-white shadow-sm"
                    : "text-[#43474f] hover:text-[#002141]"
                }`}
              >
                Advanced
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="flex flex-col gap-3 md:flex-row"
            onSubmit={(event) => {
              event.preventDefault()
              void handleChatSubmit()
            }}
          >
            <Input
              value={chatPrompt}
              onChange={(event) => setChatPrompt(event.target.value)}
              placeholder='Try "I need to withdraw 20% next year"'
              className="h-12 border-[#c3c6d0] bg-white text-[#002141] placeholder:text-[#737780]"
            />
            <Button
              type="submit"
              disabled={chatLoading || isLoading}
              className="h-12 bg-[#002141] px-6 hover:bg-[#003666]"
            >
              {chatLoading ? "Thinking..." : "Ask Nestor"}
            </Button>
          </form>

          <div className="flex flex-wrap gap-2">
            {promptExamples.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => void handleChatSubmit(example)}
                className="rounded-full border border-[#e0e0e0] bg-white px-3 py-1.5 text-xs font-medium text-[#003666] transition hover:border-[#003666]"
              >
                {example}
              </button>
            ))}
          </div>

          {chatAnswer && (
            <div className="rounded-lg border border-[#e0e0e0] bg-[#f9f9fe] p-4">
              <p className="text-sm leading-6 text-[#1a1c1f]">{chatAnswer}</p>
            </div>
          )}

        </CardContent>
      </Card>

      <AnimatePresence mode="wait">
        {isLoading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className={panelClass}>
              <CardContent className="p-8">
                <div className="flex flex-col items-center justify-center gap-4">
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                    <RefreshCw className="h-8 w-8 text-[#003666]" />
                  </motion.div>
                  <div className="text-center">
                    <p className="font-medium text-[#002141]">Running AI scenario analysis...</p>
                    <p className="mt-1 text-xs text-[#43474f]">
                      Fetching macro data, learning from market history, and finding the{" "}
                      <Term term="Efficient Frontier" context="Scenario optimization pipeline">
                        best risk/reward tradeoffs
                      </Term>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {recommendation && !isLoading && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* AI Explanation — Structured with Transparency */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
            >
              <Card className={insightPanelClass}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-[#003666]" />
                    <CardTitle className="text-[#002141]">AI-Powered Recommendation</CardTitle>
                  </div>
                  <p className="mt-1 text-xs text-[#43474f]">
                    Built from market forecasts, economic data, and a plain-English explanation.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {(() => {
                      // Parse structured sections from Gemini response
                      const text = recommendation.explanation || "";
                      const sections = text.split(/\*\*([^*]+)\*\*/).filter(Boolean);
                      
                      const sectionConfig: Record<string, { icon: typeof Shield; color: string }> = {
                        "what happened": { icon: AlertTriangle, color: "text-[#8a1f1f]" },
                        "why this matters now": { icon: Activity, color: "text-[#003666]" },
                        "what we recommend": { icon: Shield, color: "text-[#003666]" },
                        "costs & taxes": { icon: DollarSign, color: "text-[#8a5d00]" },
                        "how this fits your goal": { icon: TrendingUp, color: "text-[#002141]" },
                      };

                      // If the response has sections, render them nicely
                      if (sections.length > 1) {
                        const rendered: React.ReactNode[] = [];
                        for (let i = 0; i < sections.length; i++) {
                          const part = sections[i].trim();
                          if (!part) continue;
                          
                          const lowerPart = part.toLowerCase().replace(/:$/, "");
                          const config = sectionConfig[lowerPart];
                          
                          if (config && i + 1 < sections.length) {
                            const Icon = config.icon;
                            const body = sections[i + 1].trim();
                            rendered.push(
                              <div key={i} className="flex gap-3">
                                <div className="flex-shrink-0 mt-0.5">
                                  <Icon className={`h-4 w-4 ${config.color}`} />
                                </div>
                                <div>
                                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#524700]">
                                    {part.replace(/:$/, "")}
                                  </p>
                                  <p className="text-sm leading-relaxed text-[#1a1c1f]/90">
                                    {body}
                                  </p>
                                </div>
                              </div>
                            );
                            i++; // Skip the body part
                          }
                        }
                        if (rendered.length > 0) return rendered;
                      }
                      
                      // Fallback: render as plain text
                      return (
                        <p className="whitespace-pre-line text-sm leading-relaxed text-[#1a1c1f]/90">
                          {text}
                        </p>
                      );
                    })()}
                  </div>
                  {advancedMode && recommendation.method && (
                    <p className="mt-1 font-mono text-xs text-[#43474f]/80">
                      {recommendation.method}
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Key Metrics Row */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className={`grid grid-cols-1 gap-4 ${advancedMode ? "md:grid-cols-5" : "md:grid-cols-2"}`}
            >
              {recommendation.scenarioActualCurrent !== undefined &&
              recommendation.scenarioActualOptimized !== undefined ? (
                <Card className={insightPanelClass}>
                  <CardContent className="p-4 text-center">
                    <p className={metricLabelClass}>Scenario Return</p>
                    <p className="text-lg font-semibold text-[#002141]">
                      <span
                        className={
                          recommendation.scenarioActualCurrent >= 0
                            ? "text-green-600"
                            : "text-[#8a1f1f]"
                        }
                      >
                        {recommendation.scenarioActualCurrent >= 0 ? "+" : ""}
                        {recommendation.scenarioActualCurrent.toFixed(1)}%
                      </span>
                      <span className="text-[#7aa0d6]"> → </span>
                      <span
                        className={
                          recommendation.scenarioActualOptimized >= 0
                            ? "text-green-600"
                            : "text-[#8a1f1f]"
                        }
                      >
                        {recommendation.scenarioActualOptimized >= 0 ? "+" : ""}
                        {recommendation.scenarioActualOptimized.toFixed(1)}%
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-[#43474f]">
                      Actual historical performance
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card className={panelClass}>
                  <CardContent className="p-4 text-center">
                    <p className={metricLabelClass}>Scenario Return</p>
                    <p className="text-2xl font-semibold text-[#002141]">See mix below</p>
                  </CardContent>
                </Card>
              )}
              <Card className={panelClass}>
                <CardContent className="p-4 text-center">
                  <p className={metricLabelClass}>Risk Reduction</p>
                  <p className="text-2xl font-semibold text-green-600">
                    {recommendation.riskReduction}
                  </p>
                  <p className="mt-1 text-xs text-[#43474f]">
                    Lower estimated portfolio bumpiness
                  </p>
                </CardContent>
              </Card>
              {advancedMode && (
                <>
              <Card className={panelClass}>
                <CardContent className="p-4 text-center">
                  <p className={metricLabelClass}>
                    <Term term="Sharpe Ratio" context="Scenario results compare risk-adjusted return before and after rebalancing">
                      risk-adjusted return
                    </Term>
                  </p>
                  <p className="text-lg font-semibold text-[#002141]">
                    {recommendation.originalSharpe?.toFixed(2) ?? "—"} → {recommendation.newSharpe?.toFixed(2) ?? "—"}
                  </p>
                </CardContent>
              </Card>
              <Card className={panelClass}>
                <CardContent className="p-4 text-center">
                  <p className={metricLabelClass}>
                    <Term term="Volatility" context="Scenario results show annualized portfolio risk">
                      yearly price bumpiness
                    </Term>{" "}
                  </p>
                  <p className="text-lg font-semibold text-[#002141]">
                    {recommendation.originalVol?.toFixed(1)}% → {recommendation.newVol?.toFixed(1)}%
                  </p>
                </CardContent>
              </Card>
              <Card className={panelClass}>
                <CardContent className="p-4 text-center">
                  <p className={metricLabelClass}>
                    <Term term="Drawdown" context="Scenario results show the largest peak-to-trough portfolio drop">
                      biggest drop from a high
                    </Term>
                  </p>
                  <p className="text-lg font-semibold text-[#002141]">
                    {recommendation.maxDDOriginal?.toFixed(1)}% → {recommendation.maxDDOptimized?.toFixed(1)}%
                  </p>
                </CardContent>
              </Card>
                </>
              )}
            </motion.div>

            {/* XGBoost Predictions */}
            {advancedMode && recommendation.predictions && Object.keys(recommendation.predictions).length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 }}
              >
                <Card className={panelClass}>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Zap className="h-5 w-5 text-[#003666]" />
                      <Term term="XGBoost" context="Scenario page forecast model">
                        AI return forecasts
                      </Term>
                    </CardTitle>
                    <CardDescription>
                      The model estimated possible returns and{" "}
                      <Term term="Volatility" context="XGBoost prediction card for each asset">
                        expected bumpiness
                      </Term>{" "}
                      for each asset
                      {recommendation.pipeline && (
                        <span className="mt-1 block font-mono text-xs text-[#43474f]/80">
                          Forecast model + portfolio optimizer
                        </span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Object.entries(recommendation.predictions).map(([ticker, pred]) => (
                        <div
                          key={ticker}
                          className="space-y-2 rounded-lg border border-[#e0e0e0] bg-[#f9f9fe] p-4"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-semibold text-[#002141]">{ticker}</span>
                            <span
                              className={`text-sm font-medium ${
                                pred.predicted_return > 0
                                  ? "text-green-600"
                                  : "text-[#8a1f1f]"
                              }`}
                            >
                              {pred.predicted_return > 0 ? "+" : ""}{pred.predicted_return}%
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm text-[#43474f]">
                            <span>
                              <Term term="Volatility" context="Per-asset forecast card">
                                expected bumpiness
                              </Term>
                            </span>
                            <span>{pred.predicted_vol}%</span>
                          </div>
                          {pred.cv_rmse > 0 && (
                            <div className="flex items-center justify-between text-xs text-[#43474f]/80">
                              <span>
                                <Term term="RMSE" context="Per-asset forecast model validation">
                                  model error
                                </Term>
                              </span>
                              <span>{pred.cv_rmse}%</span>
                            </div>
                          )}
                          {Object.keys(pred.feature_importances || {}).length > 0 && (
                            <div className="space-y-1 border-t border-[#e0e0e0] pt-2">
                              <p className="text-xs font-medium text-[#43474f]">
                                <Term term="Feature importance" context="Top model inputs for a prediction">
                                  What influenced this
                                </Term>
                              </p>
                              {Object.entries(pred.feature_importances)
                                .sort(([, a], [, b]) => b - a)
                                .slice(0, 3)
                                .map(([feat, pct]) => (
                                  <div
                                    key={feat}
                                    className="flex items-center gap-2 text-xs"
                                  >
                                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#eeedf2]">
                                      <div
                                        className="h-full rounded-full bg-[#003666]"
                                        style={{ width: `${Math.min(pct, 100)}%` }}
                                      />
                                    </div>
                                    <span className="w-28 truncate text-[#43474f]">{feat.replace(/_/g, " ")}</span>
                                    <span className="w-10 text-right text-[#43474f]/80">{pct}%</span>
                                  </div>
                                ))}
                            </div>
                          )}
                          {pred.error && (
                            <p className="text-xs text-[#8a5d00]">Fallback: {pred.error}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* LSTM Predictions */}
            {advancedMode && recommendation.lstmPredictions && Object.keys(recommendation.lstmPredictions).length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.19 }}
              >
                <Card className={panelClass}>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Activity className="h-5 w-5 text-[#003666]" />
                      <Term term="LSTM" context="Scenario page 30-day price forecast model">
                        AI 30-day price forecast
                      </Term>
                    </CardTitle>
                    <CardDescription>
                      A time-aware model that studies 5 years of price history for each stock
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Object.entries(recommendation.lstmPredictions).map(([ticker, pred]) => (
                        <div key={ticker} className="space-y-2 rounded-lg border border-[#e0e0e0] bg-[#f9f9fe] p-4">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-semibold text-[#002141]">{ticker}</span>
                            <span
                              className={`text-sm font-medium ${
                                (pred.predicted_return ?? 0) > 0
                                  ? "text-green-600"
                                  : "text-[#8a1f1f]"
                              }`}
                            >
                              {(pred.predicted_return ?? 0) > 0 ? "+" : ""}
                              {(pred.predicted_return ?? 0).toFixed(2)}%
                            </span>
                          </div>
                          {pred.current_price !== undefined && (
                            <div className="flex items-center justify-between text-sm text-[#43474f]">
                              <span>Current</span>
                              <span>${pred.current_price.toFixed(2)}</span>
                            </div>
                          )}
                          {pred.forecast?.length > 0 && (
                            <div className="flex items-center justify-between text-sm text-[#43474f]">
                              <span>30-day target</span>
                              <span>${pred.forecast[pred.forecast.length - 1].price.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between text-sm text-[#43474f]">
                            <span>Annualized vol</span>
                            <span>{(pred.predicted_vol ?? 0).toFixed(1)}%</span>
                          </div>
                          {pred.forecast?.length > 0 && (
                            <div className="border-t border-[#e0e0e0] pt-2">
                              <div className="h-12">
                                <ResponsiveContainer width="100%" height="100%">
                                  <LineChart
                                    data={pred.forecast.map((p) => ({
                                      date: p.date,
                                      price: p.price,
                                    }))}
                                  >
                                    <Line
                                      type="monotone"
                                      dataKey="price"
                                      stroke="#7aa0d6"
                                      strokeWidth={2}
                                      dot={false}
                                    />
                                    <Tooltip
                                      formatter={(v: number) => `$${v.toFixed(2)}`}
                                      contentStyle={{ fontSize: "11px" }}
                                    />
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          )}
                          {pred.error && (
                            <p className="text-xs text-[#8a5d00]">{pred.error}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {advancedMode && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Efficient Frontier */}
              {frontierData.length > 2 && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 }}
                >
                  <Card className={panelClass}>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Activity className="h-4 w-4 text-[#003666]" />
                        <Term term="Efficient Frontier" context="Scenario chart of optimized risk and return combinations">
                          Best risk/reward tradeoffs
                        </Term>
                      </CardTitle>
                      <CardDescription>
                        Each point shows a portfolio mix designed for a different return goal
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={frontierData}>
                            <CartesianGrid stroke="#e0e0e0" strokeDasharray="3 3" />
                            <XAxis
                              dataKey="volatility"
                              fontSize={11}
                              label={{ value: "Bumpiness %", position: "bottom", offset: -5, fontSize: 11 }}
                            />
                            <YAxis
                              dataKey="return"
                              fontSize={11}
                              label={{ value: "Return %", angle: -90, position: "insideLeft", offset: 10, fontSize: 11 }}
                            />
                            <Tooltip
                              formatter={(v: number, name: string) =>
                                [`${v}%`, name === "return" ? "Possible return" : "Price bumpiness"]
                              }
                            />
                            <Line
                              type="monotone"
                              dataKey="return"
                              stroke="#003666"
                              strokeWidth={2}
                              dot={{ r: 4, fill: "#003666" }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Risk Contributions */}
              {riskContribData.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 }}
                >
                  <Card className={panelClass}>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-[#8a5d00]" />
                        <Term term="Risk contribution" context="Scenario chart shows which holdings drive portfolio risk">
                          What is driving portfolio risk
                        </Term>
                      </CardTitle>
                      <CardDescription>
                        How much each holding adds to the portfolio's overall bumpiness
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={riskContribData} layout="vertical">
                            <CartesianGrid stroke="#e0e0e0" strokeDasharray="3 3" />
                            <XAxis type="number" fontSize={11} tickFormatter={(v) => `${v}%`} />
                            <YAxis dataKey="ticker" type="category" fontSize={12} width={50} />
                            <Tooltip formatter={(v: number) => `${v}%`} />
                            <Bar dataKey="contribution" name="Risk share %" fill="#f7e382" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </div>
            )}

            <SimpleRebalanceCard
              original={recommendation.original}
              recommended={recommendation.recommended}
            />

            <CostsAndTaxesCard
              feeEstimate={recommendation.feeEstimate}
              taxPreview={recommendation.taxPreview}
            />

            {/* Execute Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Card className={panelClass}>
                <CardContent className="p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm font-medium text-[#002141]">Ready to apply this recommendation?</p>
                      <p className="mt-1 text-xs text-[#43474f]">
                        Nestor will update your demo holdings to the suggested dollar weights using current prices where available.
                      </p>
                      {executeMessage && (
                        <p className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
                          {executeMessage}
                        </p>
                      )}
                      {executeError && (
                        <p className="mt-3 rounded-md border border-[#8a1f1f]/20 bg-[#8a1f1f]/5 px-3 py-2 text-xs text-[#8a1f1f]">
                          {executeError}
                        </p>
                      )}
                    </div>
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button
                        className="gap-2 bg-[#002141] hover:bg-[#003666]"
                        size="lg"
                        disabled={executeLoading}
                        onClick={() => void handleExecuteRebalance()}
                      >
                        {executeLoading ? "Executing..." : "Execute Rebalance"}
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </motion.div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
