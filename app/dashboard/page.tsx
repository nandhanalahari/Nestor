"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  BarChart3,
  RefreshCw,
  Activity,
  Sparkles,
} from "lucide-react"
import {
  PieChart as RechartsPie,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from "recharts"
import type { Holding, Quote } from "@/lib/types"
import { usd } from "@/lib/format"
import { useAuth } from "@/components/auth-provider"
import { authFetch } from "@/lib/api"

type PortfolioPayload = {
  holdings: Holding[]
  quotes: Quote[]
  totalValue: number
  dailyChangePct: number
  asOf: string
  warnings: string[]
}

const COLORS = [
  "hsl(221, 83%, 53%)",
  "hsl(142, 71%, 45%)",
  "hsl(262, 83%, 58%)",
  "hsl(24, 95%, 53%)",
  "hsl(355, 78%, 56%)",
  "hsl(199, 89%, 48%)",
  "hsl(45, 93%, 47%)",
  "hsl(330, 81%, 60%)",
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
}

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 100, damping: 12 },
  },
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [payload, setPayload] = useState<PortfolioPayload | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [fetching, setFetching] = useState(true)

  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({
    ticker: "",
    name: "",
    category: "Stock",
    shares: "",
    cost_basis: "",
  })
  const [adding, setAdding] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  type ForecastPoint = { date: string; price: number }
  type LSTMForecast = {
    ticker: string
    current_price?: number
    predicted_return: number
    forecast: ForecastPoint[]
    error?: string
  }
  const [forecasts, setForecasts] = useState<Record<string, LSTMForecast>>({})
  const [forecastLoading, setForecastLoading] = useState(false)
  const [forecastError, setForecastError] = useState<string | null>(null)

  const fetchForecast = useCallback(async (tickers: string[]) => {
    if (tickers.length === 0) return
    setForecastLoading(true)
    setForecastError(null)
    try {
      const res = await authFetch("/api/forecast", {
        method: "POST",
        body: JSON.stringify({ tickers, days: 30 }),
      })
      const data = await res.json()
      if (res.ok && data.predictions) {
        setForecasts(data.predictions)
      } else {
        setForecastError(data.error || "Could not run LSTM forecast")
      }
    } catch (e) {
      setForecastError(e instanceof Error ? e.message : "Forecast failed")
    } finally {
      setForecastLoading(false)
    }
  }, [])

  const refreshPrices = useCallback(async (tickers: string[]) => {
    if (tickers.length === 0) return
    setRefreshing(true)
    try {
      await authFetch("/api/cache", {
        method: "POST",
        body: JSON.stringify({ tickers }),
      })
    } catch {
      // ignore
    } finally {
      setRefreshing(false)
    }
  }, [])

  const loadPortfolio = useCallback(async () => {
    setFetching(true)
    setLoadError(null)
    try {
      const res = await authFetch("/api/portfolio")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Could not load portfolio.")
      setPayload(data)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load portfolio.")
    } finally {
      setFetching(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push("/auth")
      return
    }
    loadPortfolio()
  }, [user, authLoading, router, loadPortfolio])

  const quoteByTicker = useMemo(() => {
    const m = new Map<string, Quote>()
    payload?.quotes.forEach((q) => m.set(q.ticker, q))
    return m
  }, [payload])

  const portfolioData = useMemo(() => {
    if (!payload) return []
    return payload.holdings.map((h) => {
      const q = quoteByTicker.get(h.ticker)
      const marketValue = q && h.shares ? q.price * h.shares : h.amount
      const change = q?.changePercent ?? 0
      return {
        ...h,
        marketValue,
        change,
        allocation: payload.totalValue > 0
          ? (marketValue / payload.totalValue) * 100
          : 0,
      }
    })
  }, [payload, quoteByTicker])

  const pieData = useMemo(() => {
    return portfolioData.map((d) => ({
      name: d.ticker,
      value: Math.round(d.marketValue),
    }))
  }, [portfolioData])

  const barData = useMemo(() => {
    return portfolioData.map((d) => ({
      ticker: d.ticker,
      change: Number(d.change.toFixed(2)),
    }))
  }, [portfolioData])

  const handleAddHolding = async () => {
    if (!addForm.ticker || !addForm.name) return
    setAdding(true)
    try {
      const res = await authFetch("/api/holdings", {
        method: "POST",
        body: JSON.stringify({
          ticker: addForm.ticker,
          name: addForm.name,
          category: addForm.category,
          shares: parseFloat(addForm.shares) || 0,
          cost_basis: parseFloat(addForm.cost_basis) || 0,
        }),
      })
      if (res.ok) {
        setAddForm({ ticker: "", name: "", category: "Stock", shares: "", cost_basis: "" })
        setShowAddForm(false)
        await loadPortfolio()
      }
    } catch {
      // ignore
    } finally {
      setAdding(false)
    }
  }

  const handleDeleteHolding = async (id: string) => {
    try {
      const res = await authFetch(`/api/holdings?id=${id}`, { method: "DELETE" })
      if (res.ok) await loadPortfolio()
    } catch {
      // ignore
    }
  }

  const totalValue = payload?.totalValue ?? 0
  const dailyChangePct = payload?.dailyChangePct ?? 0
  const dayUp = dailyChangePct >= 0
  const isEmpty = payload && payload.holdings.length === 0

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-start justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Welcome back, {user?.user_metadata?.display_name || user?.email?.split("@")[0]}!
          </h1>
          <p className="text-muted-foreground mt-1">
            {isEmpty
              ? "Add your first holding to get started."
              : payload?.asOf
                ? `Live quotes as of ${payload.asOf} via Yahoo Finance.`
                : "Loading your portfolio..."}
          </p>
          {loadError && (
            <p className="mt-2 text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {loadError}
            </p>
          )}
          {payload?.warnings.length ? (
            <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
              {payload.warnings.join(" ")}
            </p>
          ) : null}
        </div>
        <div className="flex gap-2">
          {payload && payload.holdings.length > 0 && (
            <Button
              variant="outline"
              onClick={async () => {
                const tickers = payload.holdings.map((h) => h.ticker)
                await refreshPrices(tickers)
                await loadPortfolio()
              }}
              disabled={refreshing}
              className="gap-2"
            >
              {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Refresh Prices
            </Button>
          )}
          <Button onClick={() => setShowAddForm(!showAddForm)} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Holding
          </Button>
        </div>
      </motion.div>

      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border-primary/30">
              <CardHeader>
                <CardTitle className="text-lg">Add a Holding</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <Input
                    placeholder="Ticker (e.g. AAPL)"
                    value={addForm.ticker}
                    onChange={(e) => setAddForm({ ...addForm, ticker: e.target.value.toUpperCase() })}
                  />
                  <Input
                    placeholder="Name (e.g. Apple)"
                    value={addForm.name}
                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  />
                  <select
                    value={addForm.category}
                    onChange={(e) => setAddForm({ ...addForm, category: e.target.value })}
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="Stock">Stock</option>
                    <option value="ETF">ETF</option>
                    <option value="Bond ETF">Bond ETF</option>
                    <option value="Mutual Fund">Mutual Fund</option>
                  </select>
                  <Input
                    type="number"
                    placeholder="Shares"
                    value={addForm.shares}
                    onChange={(e) => setAddForm({ ...addForm, shares: e.target.value })}
                  />
                  <Input
                    type="number"
                    placeholder="Total cost ($)"
                    value={addForm.cost_basis}
                    onChange={(e) => setAddForm({ ...addForm, cost_basis: e.target.value })}
                  />
                </div>
                <div className="flex gap-2 mt-4">
                  <Button onClick={handleAddHolding} disabled={adding} className="gap-2">
                    {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    {adding ? "Adding..." : "Add"}
                  </Button>
                  <Button variant="outline" onClick={() => setShowAddForm(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {fetching && !payload ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : isEmpty ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card>
            <CardContent className="p-12 text-center">
              <PieChart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground">No holdings yet</h3>
              <p className="text-muted-foreground mt-1">
                Click &quot;Add Holding&quot; to add your first stock or ETF.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <motion.div variants={itemVariants}>
              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Portfolio Value
                  </CardTitle>
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{usd.format(Math.round(totalValue))}</div>
                  <p className={`text-xs flex items-center gap-1 mt-1 ${dayUp ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                    {dayUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {dayUp ? "+" : ""}{dailyChangePct.toFixed(2)}% today
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Holdings
                  </CardTitle>
                  <BarChart3 className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{portfolioData.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    across {new Set(portfolioData.map((d) => d.category)).size} categories
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Data Source
                  </CardTitle>
                  <TrendingUp className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">Yahoo Finance</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Live · {payload?.asOf ?? ""}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-primary" />
                    Portfolio Allocation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPie>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="value"
                          nameKey="name"
                          label={({ name, percent }) =>
                            `${name} ${(percent * 100).toFixed(0)}%`
                          }
                        >
                          {pieData.map((_entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => usd.format(value)}
                        />
                      </RechartsPie>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    Today&apos;s Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="ticker" fontSize={12} />
                        <YAxis fontSize={12} tickFormatter={(v) => `${v}%`} />
                        <Tooltip formatter={(v: number) => `${v}%`} />
                        <Bar dataKey="change" radius={[4, 4, 0, 0]}>
                          {barData.map((entry, index) => (
                            <Cell
                              key={`bar-${index}`}
                              fill={
                                entry.change >= 0
                                  ? "hsl(142, 71%, 45%)"
                                  : "hsl(355, 78%, 56%)"
                              }
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Card className="hover:shadow-lg transition-shadow duration-300">
              <CardHeader>
                <CardTitle>Your Holdings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {portfolioData.map((asset, index) => (
                    <motion.div
                      key={asset.id || asset.ticker}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.1 + index * 0.05 }}
                      className="flex items-center gap-4"
                    >
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">
                          {asset.ticker}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-medium text-foreground">
                            {asset.name}
                          </span>
                          <span className="text-xs text-muted-foreground px-2 py-0.5 rounded bg-secondary">
                            {asset.category}
                          </span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-primary rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(asset.allocation, 100)}%` }}
                            transition={{ duration: 0.8, delay: 0.2 + index * 0.05, ease: "easeOut" }}
                          />
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-foreground">
                          {usd.format(Math.round(asset.marketValue))}
                        </p>
                        <p className={`text-xs flex items-center justify-end gap-1 ${asset.change >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                          {asset.change >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {Math.abs(asset.change).toFixed(2)}%
                        </p>
                      </div>
                      {asset.id && (
                        <button
                          onClick={() => handleDeleteHolding(asset.id!)}
                          className="text-muted-foreground hover:text-destructive transition-colors p-1"
                          title="Remove holding"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* LSTM Price Forecast */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <Card className="hover:shadow-lg transition-shadow duration-300">
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-blue-500" />
                    LSTM 30-Day Price Forecast
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    A 2-layer LSTM neural network predicts the next 30 trading days
                    for each holding using 5 years of price history.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => fetchForecast(portfolioData.map((d) => d.ticker))}
                  disabled={forecastLoading || portfolioData.length === 0}
                  className="gap-2"
                >
                  {forecastLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Activity className="w-4 h-4" />
                  )}
                  {Object.keys(forecasts).length > 0 ? "Re-run" : "Run Forecast"}
                </Button>
              </CardHeader>
              <CardContent>
                {forecastError && (
                  <p className="text-sm text-destructive mb-3">{forecastError}</p>
                )}
                {forecastLoading && (
                  <div className="text-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                    <p className="text-sm text-muted-foreground mt-2">
                      Training LSTM models... this may take 1-2 minutes per stock.
                    </p>
                  </div>
                )}
                {!forecastLoading && Object.keys(forecasts).length === 0 && !forecastError && (
                  <div className="text-center py-8">
                    <Sparkles className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Click &quot;Run Forecast&quot; to generate LSTM price predictions for your holdings.
                    </p>
                  </div>
                )}
                {Object.keys(forecasts).length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(forecasts).map(([ticker, f]) => {
                      if (f.error) {
                        return (
                          <div key={ticker} className="rounded-lg border p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-mono font-semibold">{ticker}</span>
                              <span className="text-xs text-amber-600 dark:text-amber-400">
                                Error
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">{f.error}</p>
                          </div>
                        )
                      }

                      const isUp = f.predicted_return > 0
                      const targetPrice =
                        f.forecast?.length > 0
                          ? f.forecast[f.forecast.length - 1].price
                          : 0

                      return (
                        <div key={ticker} className="rounded-lg border p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <span className="font-mono font-semibold text-foreground">{ticker}</span>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                ${f.current_price?.toFixed(2)} → ${targetPrice.toFixed(2)}
                              </p>
                            </div>
                            <span
                              className={`text-sm font-semibold ${
                                isUp
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-red-600 dark:text-red-400"
                              }`}
                            >
                              {isUp ? "+" : ""}{f.predicted_return.toFixed(2)}%
                            </span>
                          </div>
                          <div className="h-32">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={f.forecast}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                                <XAxis
                                  dataKey="date"
                                  fontSize={10}
                                  tick={{ fontSize: 10 }}
                                  tickFormatter={(d) => d.slice(5)}
                                />
                                <YAxis fontSize={10} tickFormatter={(v) => `$${v}`} />
                                <Tooltip
                                  formatter={(v: number) => [`$${v.toFixed(2)}`, "Price"]}
                                  labelStyle={{ fontSize: "11px" }}
                                  contentStyle={{ fontSize: "11px" }}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="price"
                                  stroke={isUp ? "hsl(142, 71%, 45%)" : "hsl(355, 78%, 56%)"}
                                  strokeWidth={2}
                                  dot={false}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}
    </div>
  )
}
