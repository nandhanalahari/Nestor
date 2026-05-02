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
} from "recharts"
import type { Holding, Quote } from "@/lib/types"
import { usd, usdDetail } from "@/lib/format"
import { useAuth } from "@/components/auth-provider"
import { RiskMeter } from "@/components/RiskMeter"
import { authFetch } from "@/lib/api"
import { NewsRail } from "@/components/NewsRail"

type PortfolioPayload = {
  holdings: Holding[]
  quotes: Quote[]
  totalValue: number
  dailyChangePct: number
  asOf: string
  warnings: string[]
  healthScore?: number | null
  factors?: Array<{ key: string; score: number; plainText: string }>
  scoreDelta?: number | null
  weeklyHigh?: number | null
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

const STARTER_STOCKS = [
  { ticker: "AAPL", name: "Apple Inc.", category: "Stock" },
  { ticker: "MSFT", name: "Microsoft Corp.", category: "Stock" },
  { ticker: "NVDA", name: "NVIDIA Corp.", category: "Stock" },
  { ticker: "TSLA", name: "Tesla Inc.", category: "Stock" },
  { ticker: "SPY", name: "SPDR S&P 500 ETF", category: "ETF" },
  { ticker: "QQQ", name: "Invesco QQQ Trust", category: "ETF" },
  { ticker: "BND", name: "Vanguard Total Bond Market ETF", category: "Bond ETF" },
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
  const [addLiveQuote, setAddLiveQuote] = useState<{ price: number; asOf: string } | null>(null)
  const [addQuoteLoading, setAddQuoteLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

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

  useEffect(() => {
    if (!showAddForm) {
      setAddLiveQuote(null)
      setAddQuoteLoading(false)
      return
    }
    const raw = addForm.ticker.trim().toUpperCase()
    if (!raw) {
      setAddLiveQuote(null)
      setAddQuoteLoading(false)
      return
    }

    setAddQuoteLoading(true)
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const res = await authFetch("/api/cache", {
          method: "POST",
          body: JSON.stringify({ tickers: [raw] }),
        })
        const data = (await res.json()) as {
          quotes?: Record<string, { price: number; as_of: string }>
        }
        if (cancelled) return
        const row = data.quotes?.[raw]
        if (row?.price != null && Number.isFinite(row.price)) {
          setAddLiveQuote({ price: row.price, asOf: row.as_of })
          setAddForm((prev) => {
            const sh = parseFloat(prev.shares)
            if (Number.isFinite(sh) && sh > 0) {
              const cost = Math.round(sh * row.price * 100) / 100
              return { ...prev, cost_basis: cost.toFixed(2) }
            }
            const c = parseFloat(prev.cost_basis)
            if (Number.isFinite(c) && c > 0) {
              const shFromCost = Math.round((c / row.price) * 10000) / 10000
              return { ...prev, shares: String(shFromCost) }
            }
            return prev
          })
        } else {
          setAddLiveQuote(null)
        }
      } catch {
        if (!cancelled) setAddLiveQuote(null)
      } finally {
        if (!cancelled) setAddQuoteLoading(false)
      }
    }, 450)

    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [addForm.ticker, showAddForm])

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
    const sh = parseFloat(addForm.shares) || 0
    let cost = parseFloat(addForm.cost_basis) || 0
    if (addLiveQuote && sh > 0) {
      cost = Math.round(sh * addLiveQuote.price * 100) / 100
    }
    setAdding(true)
    try {
      const res = await authFetch("/api/holdings", {
        method: "POST",
        body: JSON.stringify({
          ticker: addForm.ticker,
          name: addForm.name,
          category: addForm.category,
          shares: sh,
          cost_basis: cost,
        }),
      })
      if (res.ok) {
        setAddForm({ ticker: "", name: "", category: "Stock", shares: "", cost_basis: "" })
        setAddLiveQuote(null)
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
                ? `Live quotes as of ${payload.asOf} — add positions here (paper portfolio); place real trades at your broker.`
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

      {/* Live Events: Finnhub headlines + Gemini cause-effect ( /api/news ) */}
      {payload && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <NewsRail tickers={payload.holdings.map((h) => h.ticker)} />
        </motion.div>
      )}

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
                <CardTitle className="text-lg">Add or buy a position</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <label className="text-sm font-medium text-muted-foreground block mb-1">Quick Select (Test Stocks)</label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const [ticker, name, category] = e.target.value.split("|");
                      setAddForm({ ...addForm, ticker, name, category });
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>Choose a starter stock...</option>
                    {STARTER_STOCKS.map((s) => (
                      <option key={s.ticker} value={`${s.ticker}|${s.name}|${s.category}`}>
                        {s.ticker} - {s.name}
                      </option>
                    ))}
                  </select>
                </div>

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
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                  >
                    <option value="Stock">Stock</option>
                    <option value="ETF">ETF</option>
                    <option value="Bond ETF">Bond ETF</option>
                    <option value="Mutual Fund">Mutual Fund</option>
                  </select>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="Shares"
                    value={addForm.shares}
                    onChange={(e) => {
                      const v = e.target.value
                      setAddForm((prev) => {
                        if (addLiveQuote) {
                          const sh = parseFloat(v)
                          if (Number.isFinite(sh) && sh > 0) {
                            const cost = Math.round(sh * addLiveQuote.price * 100) / 100
                            return { ...prev, shares: v, cost_basis: cost.toFixed(2) }
                          }
                          return { ...prev, shares: v }
                        }
                        return { ...prev, shares: v }
                      })
                    }}
                  />
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="Total cost ($)"
                    value={addForm.cost_basis}
                    onChange={(e) => {
                      const v = e.target.value
                      setAddForm((prev) => {
                        if (addLiveQuote && addLiveQuote.price > 0) {
                          const c = parseFloat(v)
                          if (Number.isFinite(c) && c > 0) {
                            const sh = Math.round((c / addLiveQuote.price) * 10000) / 10000
                            return { ...prev, cost_basis: v, shares: String(sh) }
                          }
                          return { ...prev, cost_basis: v }
                        }
                        return { ...prev, cost_basis: v }
                      })
                    }}
                  />
                </div>
                <div className="mt-3 text-sm text-muted-foreground space-y-1 min-h-[1.5rem]">
                  {addQuoteLoading && (
                    <p className="flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                      Loading live price…
                    </p>
                  )}
                  {!addQuoteLoading && addLiveQuote && (
                    <p>
                      Live{" "}
                      <span className="font-medium text-foreground">{usdDetail.format(addLiveQuote.price)}</span>
                      {" · "}
                      as of {addLiveQuote.asOf}. Total cost follows shares × this price (or edit
                      dollars to set shares).
                    </p>
                  )}
                  {!addQuoteLoading && addForm.ticker.trim() && !addLiveQuote && (
                    <p>No live quote for this symbol — enter shares and total cost manually.</p>
                  )}
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
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    Yahoo Finance · {payload?.asOf ?? ""}
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
                    Portfolio health
                  </CardTitle>
                  <Activity className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="flex flex-col items-center pt-0 pb-4">
                  <RiskMeter
                    score={payload?.healthScore ?? 0}
                    size={148}
                    showLabel={false}
                    animate
                    portfolioData={{
                      scoreDelta: payload?.scoreDelta ?? null,
                      weeklyHigh: payload?.weeklyHigh ?? null,
                    }}
                  />
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
        </>
      )}
    </div>
  )
}
