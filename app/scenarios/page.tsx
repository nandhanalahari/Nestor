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
import type { RebalancingResult, ScenarioId, FrontierPoint, XGBPrediction, LSTMPrediction } from "@/lib/types"
import { authFetch } from "@/lib/api"

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
  lstmPredictions?: Record<string, LSTMPrediction>
  pipeline?: string
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
  result: RebalancingResult & {
    predictions?: Record<string, XGBPrediction>
    lstmPredictions?: Record<string, LSTMPrediction>
    xgbImportanceText?: string
    pipeline?: string
  }
  explanation?: string
  source: "live" | "fallback" | "xgboost-mvo"
  warnings: string[]
}

export default function ScenariosPage() {
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null)
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [scenarioError, setScenarioError] = useState<string | null>(null)

  const handleScenarioSelect = async (id: string) => {
    const apiId = uiToApi[id]
    if (!apiId) return

    setIsLoading(true)
    setSelectedScenario(id)
    setRecommendation(null)
    setScenarioError(null)

    try {
      const res = await authFetch("/api/scenario", {
        method: "POST",
        body: JSON.stringify({ scenarioId: apiId }),
      })
      const bundle = (await res.json()) as ScenarioBundle & { error?: string }
      if (!res.ok) throw new Error(bundle.error ?? "Scenario engine failed.")

      const explanation =
        bundle.explanation ||
        "The optimizer analyzed your portfolio using the covariance matrix from historical data and found a lower-risk allocation."

      const sourceLabel =
        bundle.source === "xgboost-mvo"
          ? "XGBoost predictions → PyPortfolioOpt MVO"
          : bundle.source === "live"
            ? "Live Alpha Vantage data + MVO engine"
            : "Calibrated fallback"

      const metaParts = [
        sourceLabel,
        ...(bundle.warnings ?? []),
      ]

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
        lstmPredictions: bundle.result.lstmPredictions,
        pipeline: bundle.result.pipeline,
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
        <h1 className="text-3xl font-bold text-foreground">What-If Scenarios</h1>
        <p className="text-muted-foreground mt-1">
          Stress-test your portfolio with XGBoost predictions fed into Mean-Variance Optimization.
          The model trains on your stocks&apos; historical data and predicts which assets will perform best.
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
                    <p className="text-muted-foreground font-medium">Running XGBoost + MVO Pipeline...</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Training XGBoost on historical data → Predicting returns → Optimizing via Efficient Frontier
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
            {/* AI Explanation */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    <CardTitle>AI Recommendation</CardTitle>
                  </div>
                  <CardDescription className="text-base mt-2 leading-relaxed">
                    {recommendation.explanation}
                  </CardDescription>
                  {recommendation.meta && (
                    <p className="mt-2 text-xs text-muted-foreground">{recommendation.meta}</p>
                  )}
                </CardHeader>
              </Card>
            </motion.div>

            {/* Key Metrics Row */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4"
            >
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground">Risk Reduction</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {recommendation.riskReduction}
                  </p>
                </CardContent>
              </Card>
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

            {/* LSTM Predictions */}
            {recommendation.lstmPredictions && Object.keys(recommendation.lstmPredictions).length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.19 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Activity className="w-5 h-5 text-blue-500" />
                      LSTM 30-Day Forecast
                    </CardTitle>
                    <CardDescription>
                      A 2-layer LSTM neural network trained on 5 years of price history per stock
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Object.entries(recommendation.lstmPredictions).map(([ticker, pred]) => (
                        <div key={ticker} className="rounded-lg border p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-semibold text-foreground">{ticker}</span>
                            <span
                              className={`text-sm font-medium ${
                                (pred.predicted_return ?? 0) > 0
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-red-600 dark:text-red-400"
                              }`}
                            >
                              {(pred.predicted_return ?? 0) > 0 ? "+" : ""}
                              {(pred.predicted_return ?? 0).toFixed(2)}%
                            </span>
                          </div>
                          {pred.current_price !== undefined && (
                            <div className="flex items-center justify-between text-sm text-muted-foreground">
                              <span>Current</span>
                              <span>${pred.current_price.toFixed(2)}</span>
                            </div>
                          )}
                          {pred.forecast?.length > 0 && (
                            <div className="flex items-center justify-between text-sm text-muted-foreground">
                              <span>30-day target</span>
                              <span>${pred.forecast[pred.forecast.length - 1].price.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span>Annualized vol</span>
                            <span>{(pred.predicted_vol ?? 0).toFixed(1)}%</span>
                          </div>
                          {pred.forecast?.length > 0 && (
                            <div className="pt-2 border-t">
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
                                      stroke="hsl(199, 89%, 48%)"
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
                            <p className="text-xs text-amber-600 dark:text-amber-400">{pred.error}</p>
                          )}
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
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">This proposal has been saved to your account</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Pipeline: XGBoost (predictor) → PyPortfolioOpt MVO (optimizer) → Gemini (translator)
                      </p>
                    </div>
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button className="gap-2" size="lg">
                        Execute Rebalance
                        <ArrowRight className="w-4 h-4" />
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
