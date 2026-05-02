"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  GitBranch,
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  Loader2,
  ChevronDown,
  ChevronRight,
  History,
  RefreshCw,
  Calendar,
  Percent,
  BarChart3,
} from "lucide-react"
import { usd } from "@/lib/format"
import { useAuth } from "@/components/auth-provider"
import { authFetch } from "@/lib/api"

type Snapshot = {
  id: string
  ticker: string
  name: string
  week_start: string
  week_end: string
  shares: number
  cost_basis: number
  market_value: number
  profit: number
  profit_pct: number
  portfolio_weight: number
  portfolio_contribution: number
}

type StockNode = {
  ticker: string
  name: string
  totalProfit: number
  avgWeight: number
  weeks: Snapshot[]
}

export default function HistoryPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [expandedStocks, setExpandedStocks] = useState<Set<string>>(new Set())
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set())

  const loadHistory = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authFetch("/api/history")
      const data = await res.json()
      if (res.ok) setSnapshots(data.snapshots ?? [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push("/auth"); return }
    loadHistory()
  }, [user, authLoading, router, loadHistory])

  const handleSnapshot = async () => {
    setSaving(true)
    try {
      const res = await authFetch("/api/history", { method: "POST" })
      if (res.ok) await loadHistory()
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  const toggleStock = (ticker: string) => {
    setExpandedStocks((prev) => {
      const next = new Set(prev)
      if (next.has(ticker)) next.delete(ticker)
      else next.add(ticker)
      return next
    })
  }

  const toggleBranch = (key: string) => {
    setExpandedBranches((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Build the tree structure: group snapshots by ticker
  const stockTree: StockNode[] = (() => {
    const map = new Map<string, StockNode>()
    for (const snap of snapshots) {
      if (!map.has(snap.ticker)) {
        map.set(snap.ticker, {
          ticker: snap.ticker,
          name: snap.name || snap.ticker,
          totalProfit: 0,
          avgWeight: 0,
          weeks: [],
        })
      }
      const node = map.get(snap.ticker)!
      node.weeks.push(snap)
      node.totalProfit += snap.profit
    }
    // Sort weeks by date descending within each stock
    for (const node of map.values()) {
      node.weeks.sort((a, b) => b.week_start.localeCompare(a.week_start))
      if (node.weeks.length > 0) {
        node.avgWeight =
          node.weeks.reduce((s, w) => s + w.portfolio_weight, 0) / node.weeks.length
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalProfit - a.totalProfit)
  })()

  const totalProfit = stockTree.reduce((s, n) => s + n.totalProfit, 0)

  if (authLoading) {
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
        className="flex items-start justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <History className="w-8 h-8 text-primary" />
            Portfolio History
          </h1>
          <p className="text-muted-foreground mt-1">
            Track your weekly profits, portfolio contributions, and stock performance over time.
          </p>
        </div>
        <Button onClick={handleSnapshot} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {saving ? "Saving..." : "Take Snapshot"}
        </Button>
      </motion.div>

      {/* Summary Cards */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Total Tracked Profit</p>
            <p className={`text-2xl font-bold ${totalProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
              {totalProfit >= 0 ? "+" : ""}{usd.format(Math.round(totalProfit))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Stocks Tracked</p>
            <p className="text-2xl font-bold text-foreground">{stockTree.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Weekly Snapshots</p>
            <p className="text-2xl font-bold text-foreground">
              {new Set(snapshots.map((s) => s.week_start)).size}
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : stockTree.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <GitBranch className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground">No history yet</h3>
            <p className="text-muted-foreground mt-1">
              Click &quot;Take Snapshot&quot; to record your current portfolio state.
              Do this weekly to build your history tree.
            </p>
          </CardContent>
        </Card>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-3"
        >
          {stockTree.map((stock, idx) => {
            const isExpanded = expandedStocks.has(stock.ticker)
            const profitsKey = `${stock.ticker}:profits`
            const weightKey = `${stock.ticker}:weight`
            const contribKey = `${stock.ticker}:contrib`

            return (
              <motion.div
                key={stock.ticker}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * idx }}
              >
                <Card className="overflow-hidden">
                  {/* Stock Root Node */}
                  <button
                    onClick={() => toggleStock(stock.ticker)}
                    className="w-full text-left p-4 flex items-center gap-4 hover:bg-accent/50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-primary">{stock.ticker}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground">{stock.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {stock.weeks.length} snapshot{stock.weeks.length !== 1 ? "s" : ""} · avg weight {stock.avgWeight.toFixed(1)}%
                      </p>
                    </div>
                    <div className="text-right mr-2">
                      <p className={`font-semibold ${stock.totalProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {stock.totalProfit >= 0 ? "+" : ""}{usd.format(Math.round(stock.totalProfit))}
                      </p>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    )}
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t"
                      >
                        <div className="pl-8 pr-4 py-2 space-y-1">
                          {/* Branch 1: Profit History */}
                          <button
                            onClick={() => toggleBranch(profitsKey)}
                            className="w-full text-left flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-accent/30 transition-colors"
                          >
                            <div className="w-1 h-8 bg-green-500 rounded-full" />
                            <DollarSign className="w-4 h-4 text-green-500" />
                            <span className="font-medium text-sm text-foreground">Profit History</span>
                            <span className="text-xs text-muted-foreground ml-auto mr-2">
                              {stock.weeks.length} weeks
                            </span>
                            {expandedBranches.has(profitsKey) ? (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            )}
                          </button>
                          <AnimatePresence>
                            {expandedBranches.has(profitsKey) && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="pl-10 space-y-1"
                              >
                                {stock.weeks.map((w) => (
                                  <div key={w.id} className="flex items-center gap-3 py-1.5 text-sm">
                                    <Calendar className="w-3 h-3 text-muted-foreground" />
                                    <span className="text-muted-foreground w-24">{w.week_start}</span>
                                    <span className={`font-mono ${w.profit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                                      {w.profit >= 0 ? "+" : ""}{usd.format(Math.round(w.profit))}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      ({w.profit_pct >= 0 ? "+" : ""}{w.profit_pct.toFixed(1)}%)
                                    </span>
                                  </div>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Branch 2: Portfolio Contribution */}
                          <button
                            onClick={() => toggleBranch(contribKey)}
                            className="w-full text-left flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-accent/30 transition-colors"
                          >
                            <div className="w-1 h-8 bg-primary rounded-full" />
                            <BarChart3 className="w-4 h-4 text-primary" />
                            <span className="font-medium text-sm text-foreground">Portfolio Contribution</span>
                            <span className="text-xs text-muted-foreground ml-auto mr-2">
                              impact on total
                            </span>
                            {expandedBranches.has(contribKey) ? (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            )}
                          </button>
                          <AnimatePresence>
                            {expandedBranches.has(contribKey) && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="pl-10 space-y-1"
                              >
                                {stock.weeks.map((w) => (
                                  <div key={w.id} className="flex items-center gap-3 py-1.5 text-sm">
                                    <Calendar className="w-3 h-3 text-muted-foreground" />
                                    <span className="text-muted-foreground w-24">{w.week_start}</span>
                                    <span className={`font-mono ${w.portfolio_contribution >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                                      {w.portfolio_contribution >= 0 ? "+" : ""}{w.portfolio_contribution.toFixed(2)}%
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      of total portfolio P&L
                                    </span>
                                  </div>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Branch 3: Weight Over Time */}
                          <button
                            onClick={() => toggleBranch(weightKey)}
                            className="w-full text-left flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-accent/30 transition-colors"
                          >
                            <div className="w-1 h-8 bg-foreground rounded-full" />
                            <Percent className="w-4 h-4 text-foreground" />
                            <span className="font-medium text-sm text-foreground">Weight Over Time</span>
                            <span className="text-xs text-muted-foreground ml-auto mr-2">
                              allocation drift
                            </span>
                            {expandedBranches.has(weightKey) ? (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            )}
                          </button>
                          <AnimatePresence>
                            {expandedBranches.has(weightKey) && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="pl-10 space-y-1"
                              >
                                {stock.weeks.map((w) => (
                                  <div key={w.id} className="flex items-center gap-3 py-1.5 text-sm">
                                    <Calendar className="w-3 h-3 text-muted-foreground" />
                                    <span className="text-muted-foreground w-24">{w.week_start}</span>
                                    <div className="flex-1 flex items-center gap-2">
                                      <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden max-w-32">
                                        <div
                                          className="h-full bg-primary rounded-full"
                                          style={{ width: `${Math.min(w.portfolio_weight, 100)}%` }}
                                        />
                                      </div>
                                      <span className="font-mono text-foreground w-14 text-right">
                                        {w.portfolio_weight.toFixed(1)}%
                                      </span>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                      {usd.format(Math.round(w.market_value))}
                                    </span>
                                  </div>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>
      )}
    </div>
  )
}
