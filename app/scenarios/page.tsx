"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Zap,
  RefreshCw,
  ChevronRight,
  Shield,
  ArrowRight,
  Activity,
  BarChart3,
  MessageSquare,
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
  LineChart,
  Line,
} from "recharts"
import type {
  RebalancingResult,
  ScenarioId,
  FrontierPoint,
  XGBPrediction,
  StockRiskScore,
  ResolvedCustomScenario,
} from "@/lib/types"
import { authFetch } from "@/lib/api"
import { useRouter } from "next/navigation"
import { Textarea } from "@/components/ui/textarea"

const CUSTOM_CHAT_ID = "custom-chat"

const scenarioCards = [
  {
    id: "market-crash",
    title: "Market Crash",
    description: "What if stocks crash like 2020?",
    icon: TrendingDown,
    color: "text-red-500",
    bgColor: "bg-red-50 dark:bg-red-900/20",
  },
  {
    id: "inflation",
    title: "Inflation Spike",
    description: "What if inflation rises to 8%+?",
    icon: TrendingUp,
    color: "text-orange-500",
    bgColor: "bg-orange-50 dark:bg-orange-900/20",
  },
  {
    id: "recession",
    title: "Recession",
    description: "What if we enter a deep recession?",
    icon: DollarSign,
    color: "text-blue-500",
    bgColor: "bg-blue-50 dark:bg-blue-900/20",
  },
  {
    id: "tech-boom",
    title: "Tech Boom",
    description: "What if tech surges like 2023-24?",
    icon: Zap,
    color: "text-purple-500",
    bgColor: "bg-purple-50 dark:bg-purple-900/20",
  },
]

const uiToApi: Record<string, ScenarioId> = {
  "market-crash": "market-drop",
  inflation: "inflation-spike",
  recession: "recession",
  "tech-boom": "tech-boom",
}

interface Recommendation {
  original: Record<string, number>
  recommended: Record<string, number>
  riskReduction: string
  explanation: string
  meta?: string
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
  pipeline?: string
  scenarioActualCurrent?: number
  scenarioActualOptimized?: number
  method?: string
  riskScores?: Record<string, StockRiskScore>
  customScenario?: ResolvedCustomScenario & { userPrompt?: string }
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
}

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 100, damping: 12 },
  },
}

type ScenarioBundle = {
  scenario: { title: string; marketStory: string }
  resolvedCustom?: ResolvedCustomScenario & { userPrompt?: string }
  result: RebalancingResult & {
    predictions?: Record<string, XGBPrediction>
    xgbImportanceText?: string
    pipeline?: string
  }
  explanation?: string
  source: "live" | "fallback" | "xgboost-mvo"
  warnings: string[]
}

export default function ScenariosPage() {
  const router = useRouter()
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null)
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [scenarioError, setScenarioError] = useState<string | null>(null)
  const [applyBusy, setApplyBusy] = useState(false)
  const [applyMsg, setApplyMsg] = useState<string | null>(null)
  const [customPrompt, setCustomPrompt] = useState("")

  const applyBundle = (bundle: ScenarioBundle) => {
    const explanation =
      bundle.explanation ||
      "The optimizer analyzed your portfolio using the covariance matrix from historical data and found a lower-risk allocation."

    const sourceLabel =
      bundle.source === "xgboost-mvo"
        ? "XGBoost + FRED + scenario-window MVO (Yahoo/Kaggle prices)"
        : bundle.source === "live"
          ? "Live Yahoo Finance data + MVO engine"
          : "Calibrated fallback"

    const metaParts = [sourceLabel, ...(bundle.warnings ?? [])]

    setRecommendation({
      original: bundle.result.originalAllocation,
      recommended: bundle.result.newAllocation,
      riskReduction: bundle.result.expectedRiskReduction,
      explanation,
      meta: metaParts.filter(Boolean).join(" · "),
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
      pipeline: bundle.result.pipeline,
      scenarioActualCurrent: bundle.result.scenarioActualReturnCurrent,
      scenarioActualOptimized: bundle.result.scenarioActualReturnOptimized,
      method: bundle.result.method,
      riskScores: bundle.result.riskScores,
      customScenario: bundle.resolvedCustom,
    })
  }

  const handleScenarioSelect = async (id: string) => {
    const apiId = uiToApi[id]
    if (!apiId) return

    setIsLoading(true)
    setSelectedScenario(id)
    setRecommendation(null)
    setScenarioError(null)
    setApplyMsg(null)

    try {
      const res = await authFetch("/api/scenario", {
        method: "POST",
        body: JSON.stringify({ scenarioId: apiId }),
      })
      const bundle = (await res.json()) as ScenarioBundle & { error?: string }
      if (!res.ok) throw new Error(bundle.error ?? "Scenario engine failed.")
      applyBundle(bundle)
    } catch (e) {
      setScenarioError(
        e instanceof Error ? e.message : "Could not run this scenario.",
      )
      setSelectedScenario(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCustomScenarioSubmit = async () => {
    const text = customPrompt.trim()
    if (text.length < 10) {
      setScenarioError("Add a bit more detail so we can map your question to a real historical period.")
      return
    }

    setIsLoading(true)
    setSelectedScenario(CUSTOM_CHAT_ID)
    setRecommendation(null)
    setScenarioError(null)
    setApplyMsg(null)

    try {
      const res = await authFetch("/api/scenario", {
        method: "POST",
        body: JSON.stringify({ customPrompt: text }),
      })
      const bundle = (await res.json()) as ScenarioBundle & { error?: string }
      if (!res.ok) throw new Error(bundle.error ?? "Scenario engine failed.")
      applyBundle(bundle)
    } catch (e) {
      setScenarioError(
        e instanceof Error ? e.message : "Could not run this scenario.",
      )
      setSelectedScenario(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleApplyRebalance = async () => {
    if (!recommendation) return
    setApplyBusy(true)
    setApplyMsg(null)
    try {
      const res = await authFetch("/api/portfolio/apply-targets", {
        method: "POST",
        body: JSON.stringify({ targets: recommendation.recommended }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Could not update portfolio.")
      router.push("/dashboard")
    } catch (e) {
      setApplyMsg(e instanceof Error ? e.message : "Could not apply allocation.")
    } finally {
      setApplyBusy(false)
    }
  }

  const comparisonData = recommendation
    ? Object.keys({
        ...recommendation.original,
        ...recommendation.recommended,
      }).map((ticker) => ({
        ticker,
        current: Math.round(recommendation.original[ticker] ?? 0),
        recommended: Math.round(recommendation.recommended[ticker] ?? 0),
      }))
    : []

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
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-3xl font-bold text-foreground">Scenario-Driven Rebalancing</h1>
        <p className="text-muted-foreground mt-1">
          Stress-test your portfolio against historical regimes, then apply a lower-risk allocation back into
          your Nestor holdings. The optimizer uses returns and covariance from each scenario&apos;s date window
          (same windows on the server and in the TypeScript fallback), plus XGBoost on Kaggle/Yahoo history and FRED
          for macro context and per-stock risk scores.
        </p>
      </motion.div>

      {scenarioError && (
        <p className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {scenarioError}
        </p>
      )}

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {scenarioCards.map((scenario) => (
          <motion.div key={scenario.id} variants={itemVariants}>
            <motion.div
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Card
                className={`cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-primary/50 ${selectedScenario === scenario.id ? "border-primary/60" : ""}`}
                onClick={() => handleScenarioSelect(scenario.id)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${scenario.bgColor}`}>
                      <scenario.icon className={`w-6 h-6 ${scenario.color}`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{scenario.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{scenario.description}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        ))}
        <motion.div key="custom-chat" variants={itemVariants} className="md:col-span-2">
          <Card
            className={`border-2 transition-shadow ${selectedScenario === CUSTOM_CHAT_ID ? "border-primary/60 shadow-md" : "border-border"}`}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-violet-50 dark:bg-violet-950/40">
                  <MessageSquare className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <CardTitle className="text-base">Ask a custom historical “what if”</CardTitle>
                  <CardDescription>
                    Describe a worry or shock in plain English. We map it to a real past episode with a date window—the
                    same optimizer and scenario covariance logic as the cards above.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder='e.g. "What if oil spikes like the 1970s?" or "Another flash crash like 2010?"'
                className="min-h-[88px] resize-y"
                disabled={isLoading}
              />
              <div className="flex flex-wrap gap-2">
                {[
                  "Euro debt crisis stress like 2011",
                  "Taper tantrum bond shock 2013",
                  "Dot-com bust around 2000–02",
                ].map((ex) => (
                  <Button
                    key={ex}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    disabled={isLoading}
                    onClick={() => {
                      setCustomPrompt(ex)
                      setScenarioError(null)
                    }}
                  >
                    {ex}
                  </Button>
                ))}
              </div>
              <Button
                className="gap-2"
                disabled={isLoading || customPrompt.trim().length < 10}
                onClick={() => void handleCustomScenarioSubmit()}
              >
                Run custom scenario
                <ChevronRight className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      <AnimatePresence mode="wait">
        {isLoading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card>
              <CardContent className="p-8">
                <div className="flex flex-col items-center justify-center gap-4">
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                    <RefreshCw className="w-8 h-8 text-primary" />
                  </motion.div>
                  <div className="text-center">
                    <p className="text-muted-foreground font-medium">Running XGBoost + FRED Macro + MVO Pipeline...</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Fetching FRED macro data → Training XGBoost on historical + macro features → Optimizing via Efficient Frontier
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
            {/* Resolved custom scenario (historical anchor) */}
            {recommendation.customScenario && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
              >
                <Card className="border-violet-500/30 bg-violet-500/5 dark:bg-violet-950/20">
                  <CardHeader className="py-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                      Your prompt → historical window
                    </CardTitle>
                    <CardDescription className="text-foreground/90">
                      <span className="font-medium text-foreground">{recommendation.customScenario.title}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        — {recommendation.customScenario.eventName} ({recommendation.customScenario.year})
                      </span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 text-sm text-muted-foreground space-y-2">
                    {recommendation.customScenario.userPrompt && (
                      <p>
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                          You asked
                        </span>
                        <br />
                        <span className="text-foreground/90">&ldquo;{recommendation.customScenario.userPrompt}&rdquo;</span>
                      </p>
                    )}
                    <p>
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                        Stress-test window
                      </span>
                      <br />
                      {recommendation.customScenario.windowStart} → {recommendation.customScenario.windowEnd}
                    </p>
                    <p className="text-foreground/85 leading-relaxed">{recommendation.customScenario.marketStory}</p>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* AI Explanation — Structured with Transparency */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    <CardTitle>AI-Powered Recommendation</CardTitle>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Powered by XGBoost predictions + FRED macroeconomic data → Gemini translation
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {(() => {
                      // Parse structured sections from Gemini response
                      const text = recommendation.explanation || "";
                      const sections = text.split(/\*\*([^*]+)\*\*/).filter(Boolean);
                      
                      const sectionConfig: Record<string, { icon: typeof Shield; color: string }> = {
                        "what happened": { icon: AlertTriangle, color: "text-red-500" },
                        "why this matters now": { icon: Activity, color: "text-blue-500" },
                        "what we recommend": { icon: Shield, color: "text-green-500" },
                        "costs & taxes": { icon: DollarSign, color: "text-amber-500" },
                        "how this fits your goal": { icon: TrendingUp, color: "text-purple-500" },
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
                                  <Icon className={`w-4 h-4 ${config.color}`} />
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                                    {part.replace(/:$/, "")}
                                  </p>
                                  <p className="text-sm text-foreground/90 leading-relaxed">
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
                        <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">
                          {text}
                        </p>
                      );
                    })()}
                  </div>
                  {recommendation.meta && (
                    <p className="mt-4 pt-3 border-t text-xs text-muted-foreground">{recommendation.meta}</p>
                  )}
                  {recommendation.method && (
                    <p className="mt-1 text-xs text-muted-foreground/70 font-mono">
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
              className="grid grid-cols-2 md:grid-cols-4 gap-4"
            >
              {recommendation.scenarioActualCurrent !== undefined &&
              recommendation.scenarioActualOptimized !== undefined ? (
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground">Scenario Return</p>
                    <p className="text-lg font-bold text-foreground">
                      <span
                        className={
                          recommendation.scenarioActualCurrent >= 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }
                      >
                        {recommendation.scenarioActualCurrent >= 0 ? "+" : ""}
                        {recommendation.scenarioActualCurrent.toFixed(1)}%
                      </span>
                      <span className="text-muted-foreground"> → </span>
                      <span
                        className={
                          recommendation.scenarioActualOptimized >= 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }
                      >
                        {recommendation.scenarioActualOptimized >= 0 ? "+" : ""}
                        {recommendation.scenarioActualOptimized.toFixed(1)}%
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Actual historical performance
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground">Risk Reduction</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {recommendation.riskReduction}
                    </p>
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground">Sharpe Ratio</p>
                  <p className="text-lg font-bold text-foreground">
                    {recommendation.originalSharpe?.toFixed(2) ?? "—"} → {recommendation.newSharpe?.toFixed(2) ?? "—"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground">Volatility (ann.)</p>
                  <p className="text-lg font-bold text-foreground">
                    {recommendation.originalVol?.toFixed(1)}% → {recommendation.newVol?.toFixed(1)}%
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground">Max Drawdown</p>
                  <p className="text-lg font-bold text-foreground">
                    {recommendation.maxDDOriginal?.toFixed(1)}% → {recommendation.maxDDOptimized?.toFixed(1)}%
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            {/* XGBoost Predictions */}
            {recommendation.predictions && Object.keys(recommendation.predictions).length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Zap className="w-5 h-5 text-purple-500" />
                      XGBoost Predictions
                    </CardTitle>
                    <CardDescription>
                      The model predicted expected returns and volatility for each asset
                      {recommendation.pipeline && (
                        <span className="block mt-1 text-xs font-mono text-muted-foreground/70">
                          {recommendation.pipeline}
                        </span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Object.entries(recommendation.predictions).map(([ticker, pred]) => (
                        <div
                          key={ticker}
                          className="rounded-lg border p-4 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-semibold text-foreground">{ticker}</span>
                            <span
                              className={`text-sm font-medium ${
                                pred.predicted_return > 0
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-red-600 dark:text-red-400"
                              }`}
                            >
                              {pred.predicted_return > 0 ? "+" : ""}{pred.predicted_return}%
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span>Predicted Vol</span>
                            <span>{pred.predicted_vol}%</span>
                          </div>
                          {pred.cv_rmse > 0 && (
                            <div className="flex items-center justify-between text-xs text-muted-foreground/70">
                              <span>CV RMSE</span>
                              <span>{pred.cv_rmse}%</span>
                            </div>
                          )}
                          {Object.keys(pred.feature_importances || {}).length > 0 && (
                            <div className="pt-2 border-t space-y-1">
                              <p className="text-xs text-muted-foreground font-medium">Top Drivers</p>
                              {Object.entries(pred.feature_importances)
                                .sort(([, a], [, b]) => b - a)
                                .slice(0, 3)
                                .map(([feat, pct]) => (
                                  <div
                                    key={feat}
                                    className="flex items-center gap-2 text-xs"
                                  >
                                    <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-purple-500 rounded-full"
                                        style={{ width: `${Math.min(pct, 100)}%` }}
                                      />
                                    </div>
                                    <span className="text-muted-foreground w-28 truncate">{feat.replace(/_/g, " ")}</span>
                                    <span className="text-muted-foreground/70 w-10 text-right">{pct}%</span>
                                  </div>
                                ))}
                            </div>
                          )}
                          {pred.error && (
                            <p className="text-xs text-amber-600 dark:text-amber-400">Fallback: {pred.error}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Per-stock risk (FRED regime + Yahoo/Kaggle history) */}
            {recommendation.riskScores && Object.keys(recommendation.riskScores).length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.185 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Shield className="w-5 h-5 text-amber-500" />
                      Risk scores by holding
                    </CardTitle>
                    <CardDescription>
                      0–100 scale (higher = more risk). Blends realized volatility and beta vs SPY from price data with
                      a FRED-based macro stress reading (VIX, Fed funds, yield curve).
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Object.entries(recommendation.riskScores).map(([ticker, r]) => (
                        <div key={ticker} className="rounded-lg border p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-semibold text-foreground">{ticker}</span>
                            <span
                              className={`text-sm font-medium ${
                                r.risk_score >= 67
                                  ? "text-amber-600 dark:text-amber-400"
                                  : r.risk_score >= 34
                                    ? "text-foreground"
                                    : "text-green-600 dark:text-green-400"
                              }`}
                            >
                              {r.risk_score} — {r.label}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{r.summary}</p>
                          <div className="text-xs text-muted-foreground space-y-1 pt-1 border-t">
                            <div className="flex justify-between">
                              <span>Ann. vol</span>
                              <span>{r.yahoo.annualized_vol_pct}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Beta vs SPY</span>
                              <span>{r.yahoo.beta_vs_spy}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Macro stress</span>
                              <span>{r.macro.regime_stress_0_100}/100</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Allocation Comparison Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    Allocation Comparison
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={comparisonData} barGap={4}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="ticker" fontSize={12} />
                        <YAxis fontSize={12} tickFormatter={(v) => `${v}%`} />
                        <Tooltip formatter={(v: number) => `${v}%`} />
                        <Bar dataKey="current" name="Current" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} opacity={0.5} />
                        <Bar dataKey="recommended" name="Optimized" fill="hsl(221, 83%, 53%)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Efficient Frontier */}
              {frontierData.length > 2 && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 }}
                >
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Activity className="w-4 h-4 text-primary" />
                        Efficient Frontier
                      </CardTitle>
                      <CardDescription>
                        Each point is an optimal portfolio for a given return level
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={frontierData}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <XAxis
                              dataKey="volatility"
                              fontSize={11}
                              label={{ value: "Volatility %", position: "bottom", offset: -5, fontSize: 11 }}
                            />
                            <YAxis
                              dataKey="return"
                              fontSize={11}
                              label={{ value: "Return %", angle: -90, position: "insideLeft", offset: 10, fontSize: 11 }}
                            />
                            <Tooltip
                              formatter={(v: number, name: string) =>
                                [`${v}%`, name === "return" ? "Expected Return" : "Volatility"]
                              }
                            />
                            <Line
                              type="monotone"
                              dataKey="return"
                              stroke="hsl(221, 83%, 53%)"
                              strokeWidth={2}
                              dot={{ r: 4, fill: "hsl(221, 83%, 53%)" }}
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
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-orange-500" />
                        Risk Contribution by Asset
                      </CardTitle>
                      <CardDescription>
                        How much each asset contributes to total portfolio risk
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={riskContribData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <XAxis type="number" fontSize={11} tickFormatter={(v) => `${v}%`} />
                            <YAxis dataKey="ticker" type="category" fontSize={12} width={50} />
                            <Tooltip formatter={(v: number) => `${v}%`} />
                            <Bar dataKey="contribution" name="Risk %" fill="hsl(24, 95%, 53%)" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </div>

            {/* Allocation Detail Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                      Current Allocation
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(recommendation.original).map(([ticker, percent], index) => (
                        <motion.div
                          key={ticker}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 + index * 0.05 }}
                          className="flex items-center gap-3"
                        >
                          <span className="w-12 font-mono text-sm font-medium">{ticker}</span>
                          <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden">
                            <motion.div
                              className="h-full bg-muted-foreground/50 rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(percent, 100)}%` }}
                              transition={{ duration: 0.6, delay: 0.4 + index * 0.05 }}
                            />
                          </div>
                          <span className="w-10 text-sm text-muted-foreground text-right">{Math.round(percent)}%</span>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="border-green-500/30">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Shield className="w-4 h-4 text-green-500" />
                      Optimized Allocation
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(recommendation.recommended).map(([ticker, percent], index) => (
                        <motion.div
                          key={ticker}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 + index * 0.05 }}
                          className="flex items-center gap-3"
                        >
                          <span className="w-12 font-mono text-sm font-medium">{ticker}</span>
                          <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden">
                            <motion.div
                              className="h-full bg-primary rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(percent, 100)}%` }}
                              transition={{ duration: 0.6, delay: 0.4 + index * 0.05 }}
                            />
                          </div>
                          <span className="w-10 text-sm text-muted-foreground text-right">{Math.round(percent)}%</span>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Actions */}
            {recommendation.actions && recommendation.actions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Suggested Moves</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {recommendation.actions.map((action, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <ArrowRight className="w-3 h-3 text-primary flex-shrink-0" />
                          <span className="text-foreground">{action}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Execute Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Card>
                <CardContent className="p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Proposal saved to your account. Apply updates your Nestor portfolio weights at current Yahoo
                        quotes (paper portfolio). Place the same trades at your real broker to invest actual capital.
                      </p>
                      {applyMsg && (
                        <p className="text-xs text-destructive mt-2">{applyMsg}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Pipeline: XGBoost (predictor) → PyPortfolioOpt MVO (optimizer) → Gemini (translator)
                      </p>
                    </div>
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button
                        className="gap-2"
                        size="lg"
                        disabled={applyBusy}
                        onClick={() => void handleApplyRebalance()}
                      >
                        {applyBusy ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Applying…
                          </>
                        ) : (
                          <>
                            Apply allocation to portfolio
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
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
