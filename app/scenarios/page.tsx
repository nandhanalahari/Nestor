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
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import type { RebalancingResult, ScenarioId } from "@/lib/types"
import { authFetch } from "@/lib/api"

const scenarios = [
  {
    id: "inflation",
    title: "Inflation Spike",
    description: "What if inflation rises to 8%?",
    icon: TrendingUp,
    color: "text-orange-500",
    bgColor: "bg-orange-50 dark:bg-orange-900/20",
  },
  {
    id: "recession",
    title: "Market Recession",
    description: "What if we enter a recession?",
    icon: TrendingDown,
    color: "text-red-500",
    bgColor: "bg-red-50 dark:bg-red-900/20",
  },
  {
    id: "rate-hike",
    title: "Interest Rate Hike",
    description: "What if rates increase by 2%?",
    icon: DollarSign,
    color: "text-blue-500",
    bgColor: "bg-blue-50 dark:bg-blue-900/20",
  },
  {
    id: "tech-crash",
    title: "Tech Sector Crash",
    description: "What if tech stocks drop 30%?",
    icon: Zap,
    color: "text-purple-500",
    bgColor: "bg-purple-50 dark:bg-purple-900/20",
  },
]

const uiToApi: Record<string, ScenarioId> = {
  inflation: "inflation-spike",
  recession: "recession",
  "rate-hike": "inflation-spike",
  "tech-crash": "market-drop",
}

interface Recommendation {
  original: Record<string, number>
  recommended: Record<string, number>
  riskReduction: string
  explanation: string
  meta?: string
  originalVol?: number
  newVol?: number
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
  result: RebalancingResult
  source: "live" | "fallback"
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
      const scenarioRes = await authFetch("/api/scenario", {
        method: "POST",
        body: JSON.stringify({ scenarioId: apiId }),
      })
      const bundle = (await scenarioRes.json()) as ScenarioBundle & { error?: string }
      if (!scenarioRes.ok) throw new Error(bundle.error ?? "Scenario engine failed.")

      let explanation =
        "Nestor analyzed your portfolio using Alpha Vantage historical data and a min-variance optimizer. Here is the recommended allocation."
      try {
        const explainRes = await authFetch("/api/explain", {
          method: "POST",
          body: JSON.stringify({
            result: bundle.result,
            scenarioTitle: bundle.scenario.title,
            scenarioStory: bundle.scenario.marketStory,
          }),
        })
        const explainJson = (await explainRes.json()) as {
          explanation?: string
          error?: string
        }
        if (explainRes.ok && explainJson.explanation) {
          explanation = explainJson.explanation
        }
      } catch {
        /* Gemini optional */
      }

      const metaParts = [
        bundle.source === "live"
          ? "Live Alpha Vantage + optimizer"
          : "Calibrated fallback",
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
    ? Object.keys(recommendation.original).map((ticker) => ({
        ticker,
        current: Math.round(recommendation.original[ticker] ?? 0),
        recommended: Math.round(recommendation.recommended[ticker] ?? 0),
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
          Explore how different market conditions could affect your portfolio and
          get AI-powered rebalancing recommendations.
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
        {scenarios.map((scenario) => (
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
            transition={{ duration: 0.3 }}
          >
            <Card>
              <CardContent className="p-8">
                <div className="flex flex-col items-center justify-center gap-4">
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                    <RefreshCw className="w-8 h-8 text-primary" />
                  </motion.div>
                  <p className="text-muted-foreground">
                    Analyzing your portfolio with live Alpha Vantage data...
                  </p>
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
            transition={{ duration: 0.4 }}
            className="space-y-6"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    <CardTitle>AI Recommendation</CardTitle>
                  </div>
                  <CardDescription className="text-base mt-2">
                    {recommendation.explanation}
                  </CardDescription>
                  {recommendation.meta && (
                    <p className="mt-2 text-xs text-muted-foreground">{recommendation.meta}</p>
                  )}
                </CardHeader>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Allocation Comparison</CardTitle>
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
                        <Bar dataKey="recommended" name="Recommended" fill="hsl(221, 83%, 53%)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
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
                          transition={{ duration: 0.3, delay: 0.3 + index * 0.05 }}
                          className="flex items-center gap-3"
                        >
                          <span className="w-12 font-mono text-sm font-medium text-foreground">{ticker}</span>
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
                transition={{ duration: 0.4, delay: 0.3 }}
              >
                <Card className="border-green-500/30">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Shield className="w-4 h-4 text-green-500" />
                      Recommended Allocation
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(recommendation.recommended).map(([ticker, percent], index) => (
                        <motion.div
                          key={ticker}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: 0.3 + index * 0.05 }}
                          className="flex items-center gap-3"
                        >
                          <span className="w-12 font-mono text-sm font-medium text-foreground">{ticker}</span>
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

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.5 }}
            >
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Expected Risk Reduction</p>
                      <motion.p
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 200, delay: 0.6 }}
                        className="text-3xl font-bold text-green-600 dark:text-green-400"
                      >
                        {recommendation.riskReduction}
                      </motion.p>
                      {recommendation.originalVol != null && recommendation.newVol != null && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Volatility: {recommendation.originalVol.toFixed(1)}% → {recommendation.newVol.toFixed(1)}%
                        </p>
                      )}
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
