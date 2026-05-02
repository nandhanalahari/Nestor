"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Edit3,
  Loader2,
  PieChart,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RiskMeter } from "@/components/RiskMeter"
import { StarterPortfolioCard } from "@/components/StarterPortfolioCard"
import { NewsRail } from "@/components/NewsRail"
import { useAuth } from "@/components/auth-provider"
import { authFetch } from "@/lib/api"
import { usd } from "@/lib/format"
import { CURATED_ASSETS } from "@/lib/curatedAssets"
import type { AssetCategory, Holding, Quote } from "@/lib/types"

type PortfolioPayload = {
  holdings: Holding[]
  quotes: Quote[]
  totalValue: number
  dailyChangePct: number
  warnings: string[]
  healthScore?: number | null
  factors?: Array<{ key: string; score: number; plainText: string }>
  scoreDelta?: number | null
  weeklyHigh?: number | null
}

type PortfolioAsset = Holding & {
  marketValue: number
  change: number
  allocation: number
}

type HoldingForm = {
  ticker: string
  name: string
  category: AssetCategory
  shares: string
  price: string
}

type PerformanceRange = "1D" | "1W" | "1M" | "1Y"

const COLORS = [
  "#002141",
  "#7aa0d6",
  "#f7e382",
  "#003666",
  "#8ca7c8",
  "#d9c95f",
  "#4c6582",
  "#b9ccea",
]

const emptyForm: HoldingForm = {
  ticker: "",
  name: "",
  category: "Stock",
  shares: "",
  price: "",
}

const performanceRanges: PerformanceRange[] = ["1D", "1W", "1M", "1Y"]

function getHoldingRisk(category: AssetCategory, ticker: string) {
  const normalizedTicker = ticker.toUpperCase()
  if (category === "Cash" || normalizedTicker === "VMFXX") {
    return {
      label: "Low risk",
      tone: "bg-[#e9f7ef] text-[#146c43] border-[#bfe6cf]",
      description: "Designed for stability and short-term money.",
    }
  }
  if (category === "Bond ETF" || normalizedTicker === "VBTLX" || normalizedTicker === "BIL") {
    return {
      label: "Lower risk",
      tone: "bg-[#e9f7ef] text-[#146c43] border-[#bfe6cf]",
      description: "Usually steadier than stocks, but still moves with rates.",
    }
  }
  if (category === "ETF" || category === "Mutual Fund") {
    return {
      label: "Medium risk",
      tone: "bg-[#fff7cc] text-[#6c5e06] border-[#f7e382]",
      description: "Diversified, but still exposed to market ups and downs.",
    }
  }
  return {
    label: "Higher risk",
    tone: "bg-[#fff1f1] text-[#9f1239] border-[#f3c3c3]",
    description: "A single company can move more sharply than a diversified fund.",
  }
}

function polarToCartesian(cx: number, cy: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  }
}

function describeDonutSlice(
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
) {
  const outerStart = polarToCartesian(cx, cy, outerRadius, startAngle)
  const outerEnd = polarToCartesian(cx, cy, outerRadius, endAngle)
  const innerStart = polarToCartesian(cx, cy, innerRadius, startAngle)
  const innerEnd = polarToCartesian(cx, cy, innerRadius, endAngle)
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ")
}

function generatePerformanceData(
  range: PerformanceRange,
  totalValue: number,
  dailyChangePct: number,
) {
  const pointsByRange: Record<PerformanceRange, number> = {
    "1D": 8,
    "1W": 7,
    "1M": 30,
    "1Y": 12,
  }
  const labelsByRange: Record<PerformanceRange, (index: number) => string> = {
    "1D": (index) => `${9 + index}:00`,
    "1W": (index) => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index] ?? "",
    "1M": (index) => `D${index + 1}`,
    "1Y": (index) =>
      ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][index] ?? "",
  }
  const multiplier: Record<PerformanceRange, number> = {
    "1D": 1,
    "1W": 2.2,
    "1M": 4.5,
    "1Y": 9,
  }
  const points = pointsByRange[range]
  const estimatedMove = (dailyChangePct / 100) * multiplier[range]
  const startValue = totalValue > 0 ? totalValue / Math.max(0.35, 1 + estimatedMove) : 0

  return Array.from({ length: points }, (_, index) => {
    const progress = points === 1 ? 1 : index / (points - 1)
    const curve = Math.sin(progress * Math.PI * 2) * totalValue * 0.012
    return {
      label: labelsByRange[range](index),
      value: Math.max(0, startValue + (totalValue - startValue) * progress + curve),
    }
  })
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [payload, setPayload] = useState<PortfolioPayload | null>(null)
  const [fetching, setFetching] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [showHoldingForm, setShowHoldingForm] = useState(false)
  const [editingHoldingId, setEditingHoldingId] = useState<string | null>(null)
  const [holdingForm, setHoldingForm] = useState<HoldingForm>(emptyForm)
  const [savingHolding, setSavingHolding] = useState(false)
  const [holdingQuoteLoading, setHoldingQuoteLoading] = useState(false)
  const [holdingQuoteError, setHoldingQuoteError] = useState<string | null>(null)
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null)
  const [performanceRange, setPerformanceRange] = useState<PerformanceRange>("1M")

  const portfolioBreakdownRef = useRef<HTMLDivElement | null>(null)

  const loadPortfolio = useCallback(async () => {
    setFetching(true)
    setLoadError(null)
    try {
      const res = await authFetch("/api/portfolio")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Could not load portfolio.")
      setPayload(data)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load portfolio.")
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
    void loadPortfolio()
  }, [authLoading, loadPortfolio, router, user])

  const quoteByTicker = useMemo(() => {
    const map = new Map<string, Quote>()
    payload?.quotes.forEach((quote) => map.set(quote.ticker, quote))
    return map
  }, [payload])

  const portfolioData = useMemo<PortfolioAsset[]>(() => {
    if (!payload) return []
    return payload.holdings.map((holding) => {
      const quote = quoteByTicker.get(holding.ticker)
      const marketValue = quote && holding.shares ? quote.price * holding.shares : holding.amount
      return {
        ...holding,
        marketValue,
        change: quote?.changePercent ?? 0,
        allocation: payload.totalValue > 0 ? (marketValue / payload.totalValue) * 100 : 0,
      }
    })
  }, [payload, quoteByTicker])

  const selectedAsset = useMemo(() => {
    if (portfolioData.length === 0) return null
    return (
      portfolioData.find((asset) => asset.ticker === selectedTicker) ??
      [...portfolioData].sort((a, b) => b.marketValue - a.marketValue)[0]
    )
  }, [portfolioData, selectedTicker])
  const hasFocusedSlice = selectedTicker !== null

  const pieData = useMemo(
    () =>
      portfolioData.map((asset) => ({
        ticker: asset.ticker,
        name: asset.ticker,
        value: Math.max(0, Number(asset.marketValue.toFixed(2))),
        asset,
      })),
    [portfolioData],
  )

  const pieSegments = useMemo(() => {
    let cursor = 0
    return pieData.filter((entry) => entry.value > 0).map((entry, index) => {
      const percent = payload?.totalValue ? (entry.value / payload.totalValue) * 100 : 0
      const sweep = Math.max(0, (percent / 100) * 360)
      const start = cursor
      const end = cursor + sweep
      cursor = end
      const gap = sweep > 8 ? 1 : 0
      const safeStart = start + gap
      const safeEnd = Math.max(safeStart + 0.35, end - gap)
      return {
        ...entry,
        index,
        percent,
        path: describeDonutSlice(120, 120, 58, 100, safeStart, Math.min(safeEnd, 359.99)),
      }
    })
  }, [payload?.totalValue, pieData])

  const performanceData = useMemo(
    () =>
      generatePerformanceData(
        performanceRange,
        payload?.totalValue ?? 0,
        payload?.dailyChangePct ?? 0,
      ),
    [payload?.dailyChangePct, payload?.totalValue, performanceRange],
  )

  const selectedCuratedAsset = useMemo(
    () => CURATED_ASSETS.find((asset) => asset.ticker === holdingForm.ticker),
    [holdingForm.ticker],
  )

  const holdingRisk = useMemo(
    () => getHoldingRisk(holdingForm.category, holdingForm.ticker),
    [holdingForm.category, holdingForm.ticker],
  )

  const estimatedHoldingCost = useMemo(() => {
    const shares = parseFloat(holdingForm.shares)
    const price = parseFloat(holdingForm.price)
    if (!Number.isFinite(shares) || !Number.isFinite(price)) return 0
    return shares * price
  }, [holdingForm.price, holdingForm.shares])

  const isEmpty = payload && payload.holdings.length === 0

  const fetchHoldingQuote = useCallback(async (ticker: string) => {
    if (!ticker) return
    setHoldingQuoteLoading(true)
    setHoldingQuoteError(null)
    try {
      const res = await authFetch("/api/cache", {
        method: "POST",
        body: JSON.stringify({ tickers: [ticker] }),
      })
      const data = await res.json()
      const quote = data.quotes?.[ticker]
      if (!res.ok || !quote?.price) {
        throw new Error("Live price is not available for this ticker right now.")
      }
      setHoldingForm((current) => ({
        ...current,
        price: String(Number(quote.price).toFixed(2)),
      }))
    } catch (error) {
      setHoldingQuoteError(
        error instanceof Error
          ? error.message
          : "Live price is not available for this ticker right now.",
      )
    } finally {
      setHoldingQuoteLoading(false)
    }
  }, [])

  const openAddForm = useCallback(() => {
    setEditingHoldingId(null)
    setHoldingForm(emptyForm)
    setHoldingQuoteError(null)
    setShowHoldingForm(true)
  }, [])

  const scrollToPortfolioBreakdownAndOpenAdd = useCallback(() => {
    portfolioBreakdownRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    window.setTimeout(() => {
      openAddForm()
    }, 380)
  }, [openAddForm])

  const chooseHoldingAsset = (ticker: string) => {
    const asset = CURATED_ASSETS.find((candidate) => candidate.ticker === ticker)
    if (!asset) return
    setEditingHoldingId(null)
    setHoldingForm((current) => ({
      ...current,
      ticker: asset.ticker,
      name: asset.name,
      category: asset.category,
      price: "",
    }))
    void fetchHoldingQuote(asset.ticker)
  }

  const openEditForm = (asset: PortfolioAsset) => {
    setEditingHoldingId(asset.id ?? null)
    setHoldingForm({
      ticker: asset.ticker,
      name: asset.name,
      category: asset.category as AssetCategory,
      shares: String(asset.shares ?? ""),
      price: String(
        asset.shares && asset.shares > 0
          ? Number(asset.marketValue / asset.shares).toFixed(2)
          : Number(asset.marketValue || asset.amount || 0).toFixed(2),
      ),
    })
    setHoldingQuoteError(null)
    setShowHoldingForm(true)
  }

  const closeHoldingForm = () => {
    setEditingHoldingId(null)
    setHoldingForm(emptyForm)
    setHoldingQuoteError(null)
    setShowHoldingForm(false)
  }

  const saveHolding = async () => {
    if (!holdingForm.ticker || !holdingForm.name || estimatedHoldingCost <= 0) return
    setSavingHolding(true)
    try {
      const res = await authFetch("/api/holdings", {
        method: editingHoldingId ? "PATCH" : "POST",
        body: JSON.stringify({
          id: editingHoldingId ?? undefined,
          ticker: holdingForm.ticker,
          name: holdingForm.name,
          category: holdingForm.category,
          shares: parseFloat(holdingForm.shares) || 0,
          cost_basis: estimatedHoldingCost,
        }),
      })
      if (res.ok) {
        closeHoldingForm()
        await loadPortfolio()
      }
    } finally {
      setSavingHolding(false)
    }
  }

  const deleteHolding = async (id: string) => {
    const res = await authFetch(`/api/holdings?id=${id}`, { method: "DELETE" })
    if (res.ok) await loadPortfolio()
  }

  const refreshPrices = async () => {
    if (!payload?.holdings.length) return
    setRefreshing(true)
    try {
      await authFetch("/api/cache", {
        method: "POST",
        body: JSON.stringify({ tickers: payload.holdings.map((holding) => holding.ticker) }),
      })
      await loadPortfolio()
    } finally {
      setRefreshing(false)
    }
  }

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#003666]" />
      </div>
    )
  }

  return (
    <div className="space-y-6 bg-[#f9f9fe] text-[#1a1c1f]">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="rounded-lg border border-[#e0e0e0] bg-white p-6 shadow-[0_20px_20px_rgba(0,0,0,0.04)]"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="goldman-kicker mb-3">Dashboard</p>
            <h1 className="font-display text-3xl font-extrabold text-[#002141]">
              Portfolio Overview
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#43474f]">
              Review performance, allocation, and holdings in one place.
            </p>
            {loadError && (
              <p className="mt-3 text-sm text-[#9f1239]">{loadError}</p>
            )}
            {payload?.warnings.length ? (
              <p className="goldman-insight-accent mt-4 text-sm leading-6 text-[#524700]">
                {payload.warnings.join(" ")}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {payload && payload.holdings.length > 0 && (
              <Button
                variant="outline"
                onClick={() => void refreshPrices()}
                disabled={refreshing}
                className="gap-2 border-[#003666]/25 bg-white text-[#003666] hover:bg-[#eef3fa]"
              >
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Refresh Prices
              </Button>
            )}
            <Button
              onClick={() => {
                if (payload && payload.holdings.length > 0) {
                  scrollToPortfolioBreakdownAndOpenAdd()
                } else {
                  openAddForm()
                }
              }}
              className="gap-2 bg-[#002141] text-white hover:bg-[#003666]"
            >
              <Plus className="h-4 w-4" />
              Add Holding
            </Button>
          </div>
        </div>
      </motion.div>

      {!isEmpty && portfolioData.length > 0 && (
        <NewsRail tickers={portfolioData.map((holding) => holding.ticker)} />
      )}

      {fetching && !payload ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#003666]" />
        </div>
      ) : isEmpty ? (
        <StarterPortfolioCard onSeeded={loadPortfolio} onPickMyself={openAddForm} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <Card className="rounded-lg border-[#e0e0e0] bg-white shadow-[0_20px_20px_rgba(0,0,0,0.04)]">
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <CardTitle className="flex items-center gap-2 font-display text-[#002141]">
                  <BarChart3 className="h-5 w-5 text-[#7aa0d6]" />
                  Portfolio performance
                </CardTitle>
                <div className="flex rounded-full border border-[#e0e0e0] bg-[#f9f9fe] p-1">
                  {performanceRanges.map((range) => (
                    <button
                      key={range}
                      type="button"
                      onClick={() => setPerformanceRange(range)}
                      className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                        performanceRange === range
                          ? "bg-[#002141] text-white"
                          : "text-[#43474f] hover:text-[#002141]"
                      }`}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={performanceData}>
                      <CartesianGrid stroke="#e0e0e0" strokeDasharray="3 3" opacity={0.7} />
                      <XAxis dataKey="label" fontSize={11} tick={{ fill: "#43474f" }} />
                      <YAxis
                        fontSize={11}
                        tick={{ fill: "#43474f" }}
                        tickFormatter={(value) => usd.format(Math.round(Number(value)))}
                        width={78}
                      />
                      <Tooltip
                        formatter={(value: number) => [usd.format(Math.round(value)), "Value"]}
                        contentStyle={{ borderColor: "#e0e0e0", borderRadius: 8, boxShadow: "0 20px 20px rgba(0,0,0,.04)" }}
                      />
                      <Line type="monotone" dataKey="value" stroke="#003666" strokeWidth={3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-lg border-[#e0e0e0] bg-white shadow-[0_20px_20px_rgba(0,0,0,0.04)]">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 font-display text-sm text-[#002141]">
                  <Activity className="h-4 w-4 text-[#7aa0d6]" />
                  Portfolio health
                </CardTitle>
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
          </div>

          <div ref={portfolioBreakdownRef} id="portfolio-breakdown" className="scroll-mt-6">
          <Card className="rounded-lg border-[#e0e0e0] bg-white shadow-[0_20px_20px_rgba(0,0,0,0.04)]">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2 font-display text-[#002141]">
                <PieChart className="h-5 w-5 text-[#7aa0d6]" />
                Portfolio Breakdown
              </CardTitle>
              <Button onClick={openAddForm} className="gap-2 bg-[#002141] text-white hover:bg-[#003666]">
                <Plus className="h-4 w-4" />
                Add Holding
              </Button>
            </CardHeader>
            <CardContent>
              <AnimatePresence>
                {showHoldingForm && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="mb-6 rounded-xl border border-[#d9d9e2] bg-[#f9f9fe] p-5"
                  >
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-display text-lg font-bold text-[#002141]">
                          {editingHoldingId ? "Edit Holding" : "Buy a Holding"}
                        </h3>
                        <p className="mt-1 text-sm text-[#43474f]">
                          Choose an asset, enter shares, and Nestor estimates the total from the latest available quote.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={closeHoldingForm}
                        className="rounded-full p-1 text-[#6b7280] hover:bg-white hover:text-[#002141]"
                        aria-label="Close holding dropdown"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_160px_180px]">
                      <label className="block">
                        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#6b7280]">
                          Asset
                        </span>
                        <select
                          value={holdingForm.ticker}
                          onChange={(event) => chooseHoldingAsset(event.target.value)}
                          disabled={Boolean(editingHoldingId)}
                          className="h-10 w-full rounded-lg border border-[#d9d9e2] bg-white px-3 text-sm text-[#1a1c1f] focus:outline-none focus:ring-2 focus:ring-[#003666]/25 disabled:bg-[#eef3fa]"
                        >
                          <option value="" disabled>
                            Choose a stock, ETF, bond fund, or mutual fund...
                          </option>
                          {holdingForm.ticker && !selectedCuratedAsset && (
                            <option value={holdingForm.ticker}>{holdingForm.ticker} - {holdingForm.name}</option>
                          )}
                          {CURATED_ASSETS.map((asset) => (
                            <option key={asset.ticker} value={asset.ticker}>
                              {asset.ticker} - {asset.name} ({asset.category})
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#6b7280]">
                          Shares
                        </span>
                        <Input
                          className="h-10 border-[#d9d9e2] bg-white text-[#1a1c1f] focus-visible:border-[#003666] focus-visible:ring-[#003666]/25"
                          type="number"
                          min="0"
                          step="0.001"
                          placeholder="0"
                          value={holdingForm.shares}
                          onChange={(event) => setHoldingForm({ ...holdingForm, shares: event.target.value })}
                        />
                      </label>

                      <div>
                        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#6b7280]">
                          Estimated total
                        </span>
                        <div className="flex h-10 items-center rounded-lg border border-[#d9d9e2] bg-white px-3 font-display text-lg font-bold text-[#002141]">
                          {estimatedHoldingCost > 0 ? usd.format(estimatedHoldingCost) : "$0.00"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                      <div className="rounded-lg border border-[#e0e0e0] bg-white px-4 py-3 text-sm text-[#43474f]">
                        {holdingQuoteLoading ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-[#003666]" />
                            Loading latest price...
                          </span>
                        ) : holdingForm.price ? (
                          <span>
                            Latest price: <strong className="text-[#002141]">{usd.format(Number(holdingForm.price))}</strong>
                            {holdingForm.category ? ` per share/unit - ${holdingForm.category}` : ""}
                          </span>
                        ) : (
                          <span>Select an asset to load the latest available price.</span>
                        )}
                        {holdingQuoteError && (
                          <p className="mt-2 text-xs text-[#9f1239]">
                            {holdingQuoteError} Try refreshing prices or choose another curated asset.
                          </p>
                        )}
                        {holdingForm.ticker && (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${holdingRisk.tone}`}>
                              {holdingRisk.label}
                            </span>
                            <span className="text-xs text-[#6b7280]">
                              {holdingRisk.description}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={() => void saveHolding()}
                          disabled={
                            savingHolding ||
                            holdingQuoteLoading ||
                            !holdingForm.ticker ||
                            !holdingForm.shares ||
                            estimatedHoldingCost <= 0
                          }
                          className="gap-2 bg-[#002141] text-white hover:bg-[#003666]"
                        >
                          {savingHolding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                          {savingHolding ? "Saving..." : editingHoldingId ? "Save Changes" : "Buy Holding"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={closeHoldingForm}
                          className="border-[#003666]/25 bg-white text-[#003666] hover:bg-[#eef3fa]"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid grid-cols-1 gap-8 lg:grid-cols-[360px_minmax(0,1fr)]">
                <div className="h-72">
                  <div className="flex h-full items-center justify-center">
                    <svg
                      viewBox="0 0 240 240"
                      className="h-64 w-64 overflow-visible"
                      role="img"
                      aria-label="Portfolio allocation chart"
                    >
                      <circle cx="120" cy="120" r="100" fill="#eef3fa" />
                      {pieSegments.map((entry) => {
                        const focused = selectedTicker === entry.ticker
                        const dimmed = hasFocusedSlice && !focused
                        const sliceKey = entry.asset.id ?? `pie-${entry.index}-${entry.ticker}`
                        return (
                          <path
                            key={sliceKey}
                            d={entry.path}
                            fill={dimmed ? "#d9e2ec" : COLORS[entry.index % COLORS.length]}
                            opacity={dimmed ? 0.65 : 1}
                            className="cursor-pointer transition-[fill,opacity,filter]"
                            style={{
                              filter: focused ? "drop-shadow(0 8px 12px rgba(0, 33, 65, 0.18))" : "none",
                              outline: "none",
                            }}
                            tabIndex={0}
                            onClick={() => setSelectedTicker((current) => (current === entry.ticker ? null : entry.ticker))}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault()
                                setSelectedTicker((current) => (current === entry.ticker ? null : entry.ticker))
                              }
                            }}
                          />
                        )
                      })}
                      <circle cx="120" cy="120" r="57" fill="white" />
                      <text
                        x="120"
                        y="114"
                        textAnchor="middle"
                        className="fill-[#6b7280] text-[11px] font-bold uppercase tracking-wide"
                      >
                        {hasFocusedSlice ? "Focused" : "Total"}
                      </text>
                      <text
                        x="120"
                        y="136"
                        textAnchor="middle"
                        className="fill-[#002141] text-[18px] font-extrabold"
                      >
                        {hasFocusedSlice && selectedAsset
                          ? `${selectedAsset.allocation.toFixed(1)}%`
                          : "100%"}
                      </text>
                    </svg>
                  </div>
                </div>

                <div className="flex flex-col justify-center">
                  {selectedAsset && (
                    <div className="rounded-xl border border-[#e0e0e0] bg-[#f9f9fe] p-6">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="font-mono text-sm font-bold text-[#003666]">
                            {selectedAsset.ticker}
                          </p>
                          <h3 className="mt-1 font-display text-2xl font-bold text-[#002141]">
                            {selectedAsset.name}
                          </h3>
                          <p className="mt-1 text-sm text-[#6b7280]">
                            {selectedAsset.category}
                          </p>
                        </div>
                        <span className="rounded-full border border-[#e0e0e0] bg-white px-3 py-1 text-sm font-bold text-[#002141]">
                          {selectedAsset.allocation.toFixed(1)}%
                        </span>
                      </div>
                      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div>
                          <p className="text-xs font-semibold uppercase text-[#6b7280]">Value</p>
                          <p className="mt-1 font-display text-xl font-bold text-[#002141]">
                            {usd.format(Math.round(selectedAsset.marketValue))}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase text-[#6b7280]">Today</p>
                          <p className={`mt-1 flex items-center gap-1 font-display text-xl font-bold ${selectedAsset.change >= 0 ? "text-[#146c43]" : "text-[#9f1239]"}`}>
                            {selectedAsset.change >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                            {Math.abs(selectedAsset.change).toFixed(2)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase text-[#6b7280]">Shares</p>
                          <p className="mt-1 font-display text-xl font-bold text-[#002141]">
                            {(selectedAsset.shares ?? 0).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedTicker(null)}
                        className="mt-5 text-sm font-semibold text-[#003666] hover:underline"
                      >
                        Show full portfolio
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          </div>

          <Card className="rounded-lg border-[#e0e0e0] bg-white shadow-[0_20px_20px_rgba(0,0,0,0.04)]">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="font-display text-[#002141]">Manage Holdings</CardTitle>
              <Button onClick={scrollToPortfolioBreakdownAndOpenAdd} className="gap-2 bg-[#002141] text-white hover:bg-[#003666]">
                <Plus className="h-4 w-4" />
                Add Holding
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-lg border border-[#e0e0e0]">
                <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr_110px] gap-4 bg-[#f9f9fe] px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#6b7280]">
                  <span>Holding</span>
                  <span>Category</span>
                  <span className="text-right">Value</span>
                  <span className="text-right">Allocation</span>
                  <span className="text-right">Actions</span>
                </div>
                {portfolioData.map((asset) => (
                  <div
                    key={asset.id || asset.ticker}
                    className="grid grid-cols-[1.2fr_1fr_1fr_1fr_110px] items-center gap-4 border-t border-[#e0e0e0] px-4 py-4 text-sm"
                  >
                    <div>
                      <p className="font-display font-bold text-[#002141]">{asset.ticker}</p>
                      <p className="truncate text-xs text-[#6b7280]">{asset.name}</p>
                    </div>
                    <span className="w-fit rounded-full border border-[#e0e0e0] bg-white px-2 py-0.5 text-xs text-[#43474f]">
                      {asset.category}
                    </span>
                    <span className="text-right font-semibold text-[#002141]">
                      {usd.format(Math.round(asset.marketValue))}
                    </span>
                    <span className="text-right text-[#43474f]">
                      {asset.allocation.toFixed(1)}%
                    </span>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEditForm(asset)}
                        className="rounded-md p-2 text-[#003666] hover:bg-[#eef4fb]"
                        title="Edit holding"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      {asset.id && (
                        <button
                          type="button"
                          onClick={() => void deleteHolding(asset.id!)}
                          className="rounded-md p-2 text-[#9f1239] hover:bg-[#fff1f1]"
                          title="Remove holding"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
