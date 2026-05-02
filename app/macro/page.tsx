"use client"

import { useCallback, useEffect, useState } from "react"
import { motion, AnimatePresence, type Variants } from "framer-motion"
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
    color: "#003666",
    unit: "%",
    description: "The overnight rate banks charge each other, set by the Federal Reserve",
  },
  CPIAUCSL: {
    icon: DollarSign,
    color: "#8a5d00",
    unit: "",
    description: "Tracks the average change in prices paid by urban consumers",
  },
  UNRATE: {
    icon: Briefcase,
    color: "#8a1f1f",
    unit: "%",
    description: "Percentage of the labor force that is currently unemployed",
  },
  GDP: {
    icon: BarChart3,
    color: "#7aa0d6",
    unit: "B",
    description: "Total value of goods and services produced in the United States",
  },
  DGS10: {
    icon: TrendingUp,
    color: "#002141",
    unit: "%",
    description: "Yield on 10-year U.S. Treasury bonds — key long-term rate benchmark",
  },
  DGS2: {
    icon: TrendingDown,
    color: "#7aa0d6",
    unit: "%",
    description: "Yield on 2-year U.S. Treasury bonds — reflects near-term rate expectations",
  },
  VIXCLS: {
    icon: Activity,
    color: "#8a1f1f",
    unit: "",
    description: 'The "fear gauge" — measures expected stock market volatility',
  },
  M2SL: {
    icon: DollarSign,
    color: "#8a5d00",
    unit: "B",
    description: "Total amount of money in circulation including savings & money market",
  },
  UMCSENT: {
    icon: Globe,
    color: "#003666",
    unit: "",
    description: "University of Michigan survey measuring consumer confidence",
  },
  INDPRO: {
    icon: Shield,
    color: "#7aa0d6",
    unit: "",
    description: "Measures output of factories, mines, and utilities in the U.S.",
  },
  YIELD_SPREAD: {
    icon: Minus,
    color: "#002141",
    unit: "%",
    description: "Difference between 10Y and 2Y yields — negative means inverted yield curve (recession signal)",
  },
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
}

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 100, damping: 12 },
  },
}

const panelClass =
  "border-[#e0e0e0] bg-white shadow-[0_20px_20px_rgba(0,0,0,0.04)]"
const insightPanelClass =
  "border-[#e0e0e0] border-l-4 border-l-[#f7e382] bg-white shadow-[0_20px_20px_rgba(0,0,0,0.04)]"
const headingClass = "font-display text-3xl font-semibold text-[#002141]"
const subcopyClass = "mt-2 max-w-4xl text-sm leading-6 text-[#43474f]"

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
    <div className="space-y-8 bg-[#f9f9fe] text-[#1a1c1f]">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-start justify-between"
      >
        <div>
          <h1 className={`${headingClass} flex items-center gap-3`}>
            <Globe className="h-8 w-8 text-[#003666]" />
            Macro Indicators
          </h1>
          <p className={subcopyClass}>
            Real-time economic data from the Federal Reserve (FRED). These
            indicators are automatically fed into XGBoost predictions.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={fetchMacro}
          disabled={loading}
          className="gap-2 border-[#e0e0e0] bg-white text-[#002141] hover:bg-[#f9f9fe]"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </Button>
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-[#e0e0e0] border-l-4 border-l-[#8a1f1f] bg-white shadow-[0_20px_20px_rgba(0,0,0,0.04)]">
            <CardContent className="flex items-center gap-3 p-4">
              <AlertCircle className="h-5 w-5 text-[#8a1f1f]" />
              <div>
                <p className="text-sm font-medium text-[#8a1f1f]">{error}</p>
                <p className="mt-1 text-xs text-[#43474f]">
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
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#003666]" />
            <p className="mt-3 text-sm text-[#43474f]">
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
                    className="group cursor-pointer border-[#e0e0e0] border-l-4 bg-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_20px_rgba(0,0,0,0.06)]"
                    style={{ borderLeftColor: config?.color }}
                    onClick={() => id !== "YIELD_SPREAD" && fetchSeries(id)}
                  >
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-[#43474f]">
                        {label}
                      </CardTitle>
                      {config && (
                        <config.icon
                          className="h-4 w-4 text-[#7aa0d6] transition-colors group-hover:text-[#003666]"
                        />
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-semibold text-[#002141]">
                        {ind.value?.toFixed(2)}
                        {config?.unit && (
                          <span className="ml-1 text-sm font-normal text-[#43474f]">
                            {config.unit}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {ind.change_1m != null && (
                          <span
                            className={`flex items-center gap-0.5 text-xs ${
                              isUp
                                ? "text-green-600"
                                : isDown
                                  ? "text-[#8a1f1f]"
                                  : "text-[#43474f]"
                            }`}
                          >
                            {isUp ? (
                              <ArrowUpRight className="h-3 w-3" />
                            ) : isDown ? (
                              <ArrowDownRight className="h-3 w-3" />
                            ) : null}
                            {ind.change_1m > 0 ? "+" : ""}
                            {ind.change_1m?.toFixed(2)}%
                          </span>
                        )}
                        {isInverted && (
                          <span className="rounded bg-[#f7e382]/45 px-1.5 py-0.5 text-xs font-medium text-[#8a1f1f]">
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
                <Card className={`${panelClass} overflow-hidden`}>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-[#003666]" />
                        {seriesName}
                      </CardTitle>
                      <p className="mt-1 text-xs text-[#43474f]">
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
                        <Loader2 className="h-6 w-6 animate-spin text-[#003666]" />
                      </div>
                    ) : seriesData.length === 0 ? (
                      <p className="py-16 text-center text-sm text-[#43474f]">
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
                                    "#003666"
                                  }
                                  stopOpacity={0.3}
                                />
                                <stop
                                  offset="100%"
                                  stopColor={
                                    INDICATOR_CONFIG[selectedSeries]?.color ||
                                    "#003666"
                                  }
                                  stopOpacity={0.0}
                                />
                              </linearGradient>
                            </defs>
                            <CartesianGrid
                              stroke="#e0e0e0"
                              strokeDasharray="3 3"
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
                                border: "1px solid #e0e0e0",
                                background: "#ffffff",
                              }}
                              labelStyle={{ fontWeight: 600 }}
                            />
                            <Area
                              type="monotone"
                              dataKey="value"
                              stroke={
                                INDICATOR_CONFIG[selectedSeries]?.color ||
                                "#003666"
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
                    className="group cursor-pointer border-[#e0e0e0] bg-white transition-all duration-300 hover:-translate-y-0.5 hover:border-[#003666] hover:shadow-[0_20px_20px_rgba(0,0,0,0.06)]"
                    onClick={() => fetchSeries(seriesId)}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                            style={{
                              backgroundColor: config ? `${config.color}20` : "#f9f9fe",
                            }}
                          >
                            <IconComponent
                              className="h-5 w-5"
                              style={{ color: config?.color }}
                            />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-[#002141]">
                              {ind.name}
                            </p>
                            <p className="text-xs text-[#43474f]">
                              {seriesId}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-2xl font-semibold text-[#002141]">
                            {ind.value !== undefined
                              ? ind.value >= 1000
                                ? `${(ind.value / 1000).toFixed(1)}T`
                                : ind.value.toFixed(2)
                              : "—"}
                            {config?.unit &&
                              ind.value !== undefined &&
                              ind.value < 1000 && (
                                <span className="ml-0.5 text-sm font-normal text-[#43474f]">
                                  {config.unit}
                                </span>
                              )}
                          </p>
                          <p className="mt-0.5 text-xs text-[#43474f]">
                            as of {ind.date}
                          </p>
                        </div>

                        {ind.change_1m != null && (
                          <div
                            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${
                              isUp
                                ? "bg-green-500/10 text-green-600"
                                : isDown
                                  ? "bg-[#f7e382]/45 text-[#8a1f1f]"
                                  : "bg-[#eeedf2] text-[#43474f]"
                            }`}
                          >
                            {isUp ? (
                              <ArrowUpRight className="h-3 w-3" />
                            ) : isDown ? (
                              <ArrowDownRight className="h-3 w-3" />
                            ) : null}
                            {ind.change_1m > 0 ? "+" : ""}
                            {ind.change_1m.toFixed(2)}%
                          </div>
                        )}
                      </div>

                      <p className="mt-3 text-xs leading-relaxed text-[#43474f]">
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
            <Card className={insightPanelClass}>
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#7aa0d6]/20">
                    <Activity className="h-4 w-4 text-[#003666]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#002141]">
                      How FRED data improves your predictions
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-[#43474f]">
                      These macroeconomic indicators are automatically merged
                      into the XGBoost model as additional features. For
                      example, the Federal Funds Rate impacts growth stocks
                      differently than value stocks, while VIX levels help
                      predict near-term volatility. The yield curve spread
                      (10Y−2Y) is one of the most reliable recession
                      predictors — when it inverts, XGBoost adjusts its risk
                      estimates accordingly.
                    </p>
                    <p className="mt-2 text-xs text-[#43474f]">
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
                    <p className="mt-2 text-xs text-[#43474f]">
                      Data source:{" "}
                      <a
                        href="https://fred.stlouisfed.org/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#003666] hover:underline"
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
