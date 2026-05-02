"use client"

import { useCallback, useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Term } from "@/components/Term"
import {
  Globe,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  AlertCircle,
  RefreshCw,
  Activity,
  Landmark,
  BarChart3,
  DollarSign,
  Briefcase,
  Shield,
  Minus,
} from "lucide-react"
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
} from "recharts"

type MacroIndicator = {
  name: string
  value?: number
  date?: string
  change_1m?: number | null
  error?: string
  inverted?: boolean
}

type SeriesPoint = { date: string; value: number }

// Icon + color mapping for each FRED series
const INDICATOR_CONFIG: Record<
  string,
  { icon: typeof Globe; color: string; unit: string; description: string }
> = {
  DFF: {
    icon: Landmark,
    color: "hsl(221, 83%, 53%)",
    unit: "%",
    description: "The overnight rate banks charge each other, set by the Federal Reserve",
  },
  CPIAUCSL: {
    icon: DollarSign,
    color: "hsl(24, 95%, 53%)",
    unit: "",
    description: "Tracks the average change in prices paid by urban consumers",
  },
  UNRATE: {
    icon: Briefcase,
    color: "hsl(355, 78%, 56%)",
    unit: "%",
    description: "Percentage of the labor force that is currently unemployed",
  },
  GDP: {
    icon: BarChart3,
    color: "hsl(142, 71%, 45%)",
    unit: "B",
    description: "Total value of goods and services produced in the United States",
  },
  DGS10: {
    icon: TrendingUp,
    color: "hsl(262, 83%, 58%)",
    unit: "%",
    description: "Yield on 10-year U.S. Treasury bonds — key long-term rate benchmark",
  },
  DGS2: {
    icon: TrendingDown,
    color: "hsl(199, 89%, 48%)",
    unit: "%",
    description: "Yield on 2-year U.S. Treasury bonds — reflects near-term rate expectations",
  },
  VIXCLS: {
    icon: Activity,
    color: "hsl(355, 78%, 56%)",
    unit: "",
    description: 'The "fear gauge" — measures expected stock market volatility',
  },
  M2SL: {
    icon: DollarSign,
    color: "hsl(45, 93%, 47%)",
    unit: "B",
    description: "Total amount of money in circulation including savings & money market",
  },
  UMCSENT: {
    icon: Globe,
    color: "hsl(330, 81%, 60%)",
    unit: "",
    description: "University of Michigan survey measuring consumer confidence",
  },
  INDPRO: {
    icon: Shield,
    color: "hsl(142, 71%, 45%)",
    unit: "",
    description: "Measures output of factories, mines, and utilities in the U.S.",
  },
  YIELD_SPREAD: {
    icon: Minus,
    color: "hsl(262, 83%, 58%)",
    unit: "%",
    description: "Difference between 10Y and 2Y yields — negative means inverted yield curve (recession signal)",
  },
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
}

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 100, damping: 12 },
  },
}

export default function MacroPage() {
  const [indicators, setIndicators] = useState<Record<string, MacroIndicator>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Series chart state
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null)
  const [seriesData, setSeriesData] = useState<SeriesPoint[]>([])
  const [seriesLoading, setSeriesLoading] = useState(false)
  const [seriesName, setSeriesName] = useState("")

  const fetchMacro = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/macro")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to fetch macro data")
      setIndicators(data.indicators || {})
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load macro data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMacro()
  }, [fetchMacro])

  const fetchSeries = useCallback(async (seriesId: string) => {
    setSeriesLoading(true)
    setSelectedSeries(seriesId)
    setSeriesName(INDICATOR_CONFIG[seriesId]?.description || seriesId)
    try {
      const res = await fetch("/api/macro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          series_id: seriesId,
          start: "2019-01-01",
          frequency: seriesId === "GDP" ? "q" : "m",
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to fetch series")
      setSeriesData(data.observations || [])
      setSeriesName(data.name || seriesId)
    } catch {
      setSeriesData([])
    } finally {
      setSeriesLoading(false)
    }
  }, [])

  // Separate yield spread from normal indicators
  const sortedKeys = Object.keys(indicators).filter(
    (k) => k !== "YIELD_SPREAD"
  )
  const yieldSpread = indicators["YIELD_SPREAD"]

  // Highlight cards for key indicators
  const highlights = [
    { id: "DFF", label: "Fed Rate" },
    { id: "VIXCLS", label: "VIX" },
    { id: "UNRATE", label: "Unemployment" },
    { id: "YIELD_SPREAD", label: "Yield Spread" },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-start justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Globe className="w-8 h-8 text-primary" />
            Macro Indicators
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time economic data from the Federal Reserve (FRED). These
            indicators are automatically fed into XGBoost predictions.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={fetchMacro}
          disabled={loading}
          className="gap-2"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Refresh
        </Button>
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-destructive" />
              <div>
                <p className="text-sm font-medium text-destructive">{error}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Make sure the ML pipeline is running (npm run dev) and
                  FRED_API_KEY is set in .env.local
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {loading && !Object.keys(indicators).length ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground mt-3">
              Fetching economic data from FRED...
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Highlight Cards */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {highlights.map(({ id, label }) => {
              const ind = indicators[id]
              if (!ind || ind.error) return null
              const config = INDICATOR_CONFIG[id]
              const isUp = (ind.change_1m ?? 0) > 0
              const isDown = (ind.change_1m ?? 0) < 0
              const isInverted = id === "YIELD_SPREAD" && (ind as any).inverted

              return (
                <motion.div key={id} variants={itemVariants}>
                  <Card
                    className="hover:shadow-lg transition-all duration-300 cursor-pointer group border-l-4"
                    style={{ borderLeftColor: config?.color }}
                    onClick={() => id !== "YIELD_SPREAD" && fetchSeries(id)}
                  >
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        {label}
                      </CardTitle>
                      {config && (
                        <config.icon
                          className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors"
                        />
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-foreground">
                        {ind.value?.toFixed(2)}
                        {config?.unit && (
                          <span className="text-sm font-normal text-muted-foreground ml-1">
                            {config.unit}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {ind.change_1m != null && (
                          <span
                            className={`text-xs flex items-center gap-0.5 ${
                              isUp
                                ? "text-green-600 dark:text-green-400"
                                : isDown
                                  ? "text-red-600 dark:text-red-400"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {isUp ? (
                              <ArrowUpRight className="w-3 h-3" />
                            ) : isDown ? (
                              <ArrowDownRight className="w-3 h-3" />
                            ) : null}
                            {ind.change_1m > 0 ? "+" : ""}
                            {ind.change_1m?.toFixed(2)}%
                          </span>
                        )}
                        {isInverted && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400 font-medium">
                            INVERTED
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </motion.div>

          {/* Chart Panel */}
          <AnimatePresence>
            {selectedSeries && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Activity className="w-5 h-5 text-primary" />
                        {seriesName}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        {INDICATOR_CONFIG[selectedSeries]?.description}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedSeries(null)}
                    >
                      Close
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {seriesLoading ? (
                      <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    ) : seriesData.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-16">
                        No data available for this series.
                      </p>
                    ) : (
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={seriesData}>
                            <defs>
                              <linearGradient
                                id="chartGradient"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="0%"
                                  stopColor={
                                    INDICATOR_CONFIG[selectedSeries]?.color ||
                                    "hsl(221, 83%, 53%)"
                                  }
                                  stopOpacity={0.3}
                                />
                                <stop
                                  offset="100%"
                                  stopColor={
                                    INDICATOR_CONFIG[selectedSeries]?.color ||
                                    "hsl(221, 83%, 53%)"
                                  }
                                  stopOpacity={0.0}
                                />
                              </linearGradient>
                            </defs>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              opacity={0.15}
                            />
                            <XAxis
                              dataKey="date"
                              fontSize={11}
                              tickFormatter={(d) => d.slice(0, 7)}
                              interval="preserveStartEnd"
                            />
                            <YAxis fontSize={11} width={60} />
                            <Tooltip
                              contentStyle={{
                                borderRadius: "8px",
                                fontSize: "12px",
                                border: "1px solid hsl(var(--border))",
                                background: "hsl(var(--card))",
                              }}
                              labelStyle={{ fontWeight: 600 }}
                            />
                            <Area
                              type="monotone"
                              dataKey="value"
                              stroke={
                                INDICATOR_CONFIG[selectedSeries]?.color ||
                                "hsl(221, 83%, 53%)"
                              }
                              strokeWidth={2}
                              fill="url(#chartGradient)"
                              dot={false}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* All Indicators Grid */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {sortedKeys.map((seriesId) => {
              const ind = indicators[seriesId]
              if (!ind || ind.error) return null
              const config = INDICATOR_CONFIG[seriesId]
              const isUp = (ind.change_1m ?? 0) > 0
              const isDown = (ind.change_1m ?? 0) < 0
              const IconComponent = config?.icon || Globe

              return (
                <motion.div key={seriesId} variants={itemVariants}>
                  <Card
                    className="hover:shadow-lg hover:border-primary/30 transition-all duration-300 cursor-pointer group"
                    onClick={() => fetchSeries(seriesId)}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                            style={{
                              backgroundColor: config
                                ? `${config.color}20`
                                : "hsl(var(--accent))",
                            }}
                          >
                            <IconComponent
                              className="w-5 h-5"
                              style={{ color: config?.color }}
                            />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {ind.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {seriesId}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-2xl font-bold text-foreground">
                            {ind.value !== undefined
                              ? ind.value >= 1000
                                ? `${(ind.value / 1000).toFixed(1)}T`
                                : ind.value.toFixed(2)
                              : "—"}
                            {config?.unit &&
                              ind.value !== undefined &&
                              ind.value < 1000 && (
                                <span className="text-sm font-normal text-muted-foreground ml-0.5">
                                  {config.unit}
                                </span>
                              )}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            as of {ind.date}
                          </p>
                        </div>

                        {ind.change_1m != null && (
                          <div
                            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${
                              isUp
                                ? "bg-green-500/10 text-green-600 dark:text-green-400"
                                : isDown
                                  ? "bg-red-500/10 text-red-600 dark:text-red-400"
                                  : "bg-secondary text-muted-foreground"
                            }`}
                          >
                            {isUp ? (
                              <ArrowUpRight className="w-3 h-3" />
                            ) : isDown ? (
                              <ArrowDownRight className="w-3 h-3" />
                            ) : null}
                            {ind.change_1m > 0 ? "+" : ""}
                            {ind.change_1m.toFixed(2)}%
                          </div>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                        {config?.description}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </motion.div>

          {/* Info Banner */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Activity className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      How FRED data improves your predictions
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      These macroeconomic indicators are automatically merged
                      into the XGBoost model as additional features. For
                      example, the Federal Funds Rate impacts growth stocks
                      differently than value stocks, while VIX levels help
                      predict near-term volatility. The yield curve spread
                      (10Y−2Y) is one of the most reliable recession
                      predictors — when it inverts, XGBoost adjusts its risk
                      estimates accordingly.
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Learn:{" "}
                      <Term context="Macro dashboard explanation">
                        volatility
                      </Term>
                      {" / "}
                      <Term context="Macro dashboard explanation">
                        yield
                      </Term>
                      {" / "}
                      <Term context="Macro dashboard explanation">
                        recession
                      </Term>
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Data source:{" "}
                      <a
                        href="https://fred.stlouisfed.org/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Federal Reserve Economic Data (FRED)
                      </a>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}
    </div>
  )
}
