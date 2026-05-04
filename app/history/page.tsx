"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  GitBranch,
  Loader2,
  ChevronDown,
  ChevronRight,
  History,
  RefreshCw,
  Calendar,
  Percent,
  BarChart3,
} from "lucide-react"
import { usd, usdDetail } from "@/lib/format"
import { useAuth } from "@/components/auth-provider"
import { authFetch } from "@/lib/api"
import { SNAPSHOT_ONCE_PER_WEEK_MESSAGE } from "@/lib/snapshot"

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
  /** Sum of `profit` from every weekly snapshot row for this ticker. */
  summedPnl: number
  avgWeight: number
  weeks: Snapshot[]
}

const panelClass =
  "border-[#e0e0e0] bg-white shadow-[0_20px_20px_rgba(0,0,0,0.04)]"
const headingClass = "font-display text-3xl font-semibold text-[#002141]"
const subcopyClass = "mt-2 max-w-3xl text-sm leading-6 text-[#43474f]"
const metricLabelClass = "text-xs font-medium uppercase text-[#43474f]"

function formatPnl(n: number) {
  if (n > 0) return `+${usdDetail.format(n)}`
  return usdDetail.format(n)
}

export default function HistoryPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [snapshotError, setSnapshotError] = useState<string | null>(null)
  const [snapshotWeekLocked, setSnapshotWeekLocked] = useState(false)
  const [expandedStocks, setExpandedStocks] = useState<Set<string>>(new Set())
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set())

  const loadHistory = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authFetch("/api/history")
      const data = (await res.json()) as {
        snapshots?: Snapshot[]
        hasSnapshotForCurrentWeek?: boolean
      }
      if (res.ok) {
        setSnapshots(data.snapshots ?? [])
        setSnapshotWeekLocked(Boolean(data.hasSnapshotForCurrentWeek))
        setSnapshotError(null)
      }
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
    setSnapshotError(null)
    try {
      const res = await authFetch("/api/history", { method: "POST" })
      let data: { error?: string } = {}
      try {
        data = (await res.json()) as { error?: string }
      } catch {
        /* ignore */
      }
      if (!res.ok) {
        setSnapshotError(
          data.error ?? `Could not save snapshot (HTTP ${res.status}).`,
        )
        return
      }
      setSnapshotWeekLocked(true)
      await loadHistory()
    } catch {
      setSnapshotError("Network error — try again.")
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

  /** Sum of every row’s `profit` (matches the sum of each stock’s combined snapshot P&L). */
  const portfolioSummedPnl = snapshots.reduce(
    (sum, s) => sum + Number(s.profit),
    0,
  )

  // Build the tree structure: group snapshots by ticker
  const stockTree: StockNode[] = (() => {
    const map = new Map<string, StockNode>()
    for (const snap of snapshots) {
      if (!map.has(snap.ticker)) {
        map.set(snap.ticker, {
          ticker: snap.ticker,
          name: snap.name || snap.ticker,
          summedPnl: 0,
          avgWeight: 0,
          weeks: [],
        })
      }
      const node = map.get(snap.ticker)!
      node.weeks.push(snap)
    }
    for (const node of map.values()) {
      node.weeks.sort((a, b) => b.week_start.localeCompare(a.week_start))
      if (node.weeks.length > 0) {
        node.avgWeight =
          node.weeks.reduce((s, w) => s + w.portfolio_weight, 0) /
          node.weeks.length
      }
      node.summedPnl = node.weeks.reduce(
        (s, w) => s + Number(w.profit),
        0,
      )
    }
    return Array.from(map.values()).sort((a, b) => b.summedPnl - a.summedPnl)
  })()

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-[#003666]" />
      </div>
    )
  }

  return (
    <div className="space-y-8 bg-[#f9f9fe] text-[#1a1c1f]">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-start"
      >
        <div>
          <h1 className={`${headingClass} flex items-center gap-3`}>
            <History className="h-8 w-8 text-[#003666]" />
            Portfolio History
          </h1>
          <p className={subcopyClass}>
            Track your weekly profits, portfolio contributions, and stock performance over time.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
          {snapshotError ? (
            <p className="max-w-md rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 sm:text-right">
              {snapshotError}
            </p>
          ) : null}
          {snapshotWeekLocked ? (
            <p className="max-w-md text-sm text-[#43474f] sm:text-right">
              {SNAPSHOT_ONCE_PER_WEEK_MESSAGE}
            </p>
          ) : null}
          <Button
            onClick={handleSnapshot}
            disabled={saving || snapshotWeekLocked || loading}
            className="w-full gap-2 bg-[#002141] hover:bg-[#003666] sm:w-auto"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {saving ? "Saving..." : "Take Snapshot"}
          </Button>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <Card className={panelClass}>
          <CardContent className="p-4 text-center">
            <p className={metricLabelClass}>Portfolio P&amp;L</p>
            <p
              className={`text-2xl font-semibold tabular-nums ${portfolioSummedPnl >= 0 ? "text-green-600" : "text-[#8a1f1f]"}`}
            >
              {formatPnl(portfolioSummedPnl)}
            </p>
          </CardContent>
        </Card>
        <Card className={panelClass}>
          <CardContent className="p-4 text-center">
            <p className={metricLabelClass}>Stocks Tracked</p>
            <p className="text-2xl font-semibold text-[#002141]">{stockTree.length}</p>
          </CardContent>
        </Card>
        <Card className={panelClass}>
          <CardContent className="p-4 text-center">
            <p className={metricLabelClass}>Weekly Snapshots</p>
            <p className="text-2xl font-semibold text-[#002141]">
              {new Set(snapshots.map((s) => s.week_start)).size}
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#003666]" />
        </div>
      ) : stockTree.length === 0 ? (
        <Card className={panelClass}>
          <CardContent className="p-12 text-center">
            <GitBranch className="mx-auto mb-4 h-12 w-12 text-[#7aa0d6]" />
            <h3 className="font-display text-lg font-semibold text-[#002141]">No history yet</h3>
            <p className="mt-1 text-[#43474f]">
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
            const weightKey = `${stock.ticker}:weight`
            const contribKey = `${stock.ticker}:contrib`

            return (
              <motion.div
                key={stock.ticker}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * idx }}
              >
                <Card className={`${panelClass} overflow-hidden`}>
                  {/* Stock Root Node */}
                  <button
                    onClick={() => toggleStock(stock.ticker)}
                    className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-[#f9f9fe]"
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#7aa0d6]/20">
                      <span className="text-xs font-bold text-[#003666]">{stock.ticker}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-semibold text-[#002141]">{stock.name}</p>
                      <p className="text-xs text-[#43474f]">
                        {stock.weeks.length} snapshot{stock.weeks.length !== 1 ? "s" : ""} · avg weight{" "}
                        {stock.avgWeight.toFixed(1)}%
                        <span className="text-[#6b7280]"> · Combined P&amp;L (all weeks)</span>
                      </p>
                    </div>
                    <div className="mr-2 text-right">
                      {stock.weeks.length > 0 ? (
                        <p
                          className={`text-sm font-semibold tabular-nums sm:text-base ${stock.summedPnl > 0 ? "text-green-600" : stock.summedPnl < 0 ? "text-[#8a1f1f]" : "text-[#002141]"}`}
                        >
                          {formatPnl(stock.summedPnl)}
                        </p>
                      ) : (
                        <p className="text-sm font-medium text-[#9aa7b8]">—</p>
                      )}
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5 flex-shrink-0 text-[#7aa0d6]" />
                    ) : (
                      <ChevronRight className="h-5 w-5 flex-shrink-0 text-[#7aa0d6]" />
                    )}
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-[#e0e0e0]"
                      >
                        <div className="space-y-3 px-4 py-4">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-[#7aa0d6]">
                              Snapshot history
                            </p>
                            <p className="mt-1 text-xs text-[#43474f]">
                              Each row is one weekly capture. The amounts above sum to{" "}
                              <span className="font-medium text-[#002141]">
                                {formatPnl(stock.summedPnl)}
                              </span>{" "}
                              for this stock.
                            </p>
                            <ul className="mt-3 space-y-2">
                              {stock.weeks.map((w) => (
                                <li
                                  key={w.id}
                                  className="rounded-lg border border-[#eef0f4] bg-[#fafbff] px-3 py-2.5 text-sm"
                                >
                                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                                    <span className="font-medium text-[#002141]">
                                      Week of {w.week_start}
                                      <span className="font-normal text-[#6b7280]">
                                        {" "}
                                        – {w.week_end}
                                      </span>
                                    </span>
                                    <span
                                      className={`font-semibold tabular-nums ${w.profit > 0 ? "text-green-600" : w.profit < 0 ? "text-[#8a1f1f]" : "text-[#002141]"}`}
                                    >
                                      {formatPnl(Number(w.profit))}
                                      <span className="ml-1.5 text-xs font-normal text-[#43474f]">
                                        ({w.profit_pct >= 0 ? "+" : ""}
                                        {Number(w.profit_pct).toFixed(2)}%)
                                      </span>
                                    </span>
                                  </div>
                                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-[#43474f]">
                                    <span>
                                      Cost {usdDetail.format(Number(w.cost_basis))}
                                    </span>
                                    <span>
                                      Value {usdDetail.format(Number(w.market_value))}
                                    </span>
                                    <span>{Number(w.shares)} shares</span>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="border-t border-[#e0e0e0] pt-3">
                          <button
                            onClick={() => toggleBranch(contribKey)}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[#f9f9fe]"
                          >
                            <div className="h-8 w-1 rounded-full bg-[#003666]" />
                            <BarChart3 className="h-4 w-4 text-[#003666]" />
                            <span className="text-sm font-medium text-[#002141]">Portfolio Contribution</span>
                            <span className="ml-auto mr-2 text-xs text-[#43474f]">
                              impact on total
                            </span>
                            {expandedBranches.has(contribKey) ? (
                              <ChevronDown className="h-4 w-4 text-[#7aa0d6]" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-[#7aa0d6]" />
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
                                    <Calendar className="h-3 w-3 text-[#7aa0d6]" />
                                    <span className="w-24 text-[#43474f]">{w.week_start}</span>
                                    <span className={`font-mono ${w.portfolio_contribution >= 0 ? "text-green-600" : "text-[#8a1f1f]"}`}>
                                      {w.portfolio_contribution >= 0 ? "+" : ""}{w.portfolio_contribution.toFixed(2)}%
                                    </span>
                                    <span className="text-xs text-[#43474f]">
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
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[#f9f9fe]"
                          >
                            <div className="h-8 w-1 rounded-full bg-[#7aa0d6]" />
                            <Percent className="h-4 w-4 text-[#003666]" />
                            <span className="text-sm font-medium text-[#002141]">Weight Over Time</span>
                            <span className="ml-auto mr-2 text-xs text-[#43474f]">
                              allocation drift
                            </span>
                            {expandedBranches.has(weightKey) ? (
                              <ChevronDown className="h-4 w-4 text-[#7aa0d6]" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-[#7aa0d6]" />
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
                                    <Calendar className="h-3 w-3 text-[#7aa0d6]" />
                                    <span className="w-24 text-[#43474f]">{w.week_start}</span>
                                    <div className="flex-1 flex items-center gap-2">
                                      <div className="h-2 max-w-32 flex-1 overflow-hidden rounded-full bg-[#eeedf2]">
                                        <div
                                          className="h-full rounded-full bg-[#003666]"
                                          style={{ width: `${Math.min(w.portfolio_weight, 100)}%` }}
                                        />
                                      </div>
                                      <span className="w-14 text-right font-mono text-[#002141]">
                                        {w.portfolio_weight.toFixed(1)}%
                                      </span>
                                    </div>
                                    <span className="text-xs text-[#43474f]">
                                      {usd.format(Math.round(w.market_value))}
                                    </span>
                                  </div>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                          </div>
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
