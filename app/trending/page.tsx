"use client"

import { useEffect, useState } from "react"
import { motion, type Variants } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  TrendingUp,
  TrendingDown,
  Activity,
  RefreshCw,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Flame,
} from "lucide-react"
import { usd } from "@/lib/format"

type TrendingStock = {
  ticker: string
  name: string
  exchange: string
  price: number
  change_percent: number
  volume: number
}

type TrendingData = {
  gainers: TrendingStock[]
  losers: TrendingStock[]
  mostActive: TrendingStock[]
  asOf: string
  source: string
  error?: string
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
}

const itemVariants: Variants = {
  hidden: { y: 10, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100, damping: 12 } },
}

const panelClass =
  "border-[#e0e0e0] bg-white shadow-[0_20px_20px_rgba(0,0,0,0.04)]"
const headingClass = "font-display text-3xl font-semibold text-[#002141]"
const subcopyClass = "mt-2 max-w-4xl text-sm leading-6 text-[#43474f]"

function formatVolume(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`
  return String(v)
}

function StockRow({ stock, rank }: { stock: TrendingStock; rank: number }) {
  const isUp = stock.change_percent >= 0
  return (
    <motion.div variants={itemVariants} className="flex items-center gap-4 py-3">
      <span className="w-6 text-right font-mono text-sm text-[#43474f]">{rank}</span>
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#7aa0d6]/20">
        <span className="text-xs font-bold text-[#003666]">{stock.ticker.slice(0, 4)}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium text-[#002141]">{stock.ticker}</p>
        <p className="truncate text-xs text-[#43474f]">{stock.exchange}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium text-[#1a1c1f]">{usd.format(stock.price)}</p>
        <p className={`flex items-center justify-end gap-0.5 text-xs ${isUp ? "text-green-600" : "text-[#8a1f1f]"}`}>
          {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {isUp ? "+" : ""}{stock.change_percent.toFixed(2)}%
        </p>
      </div>
      <div className="text-right w-16">
        <p className="text-xs text-[#43474f]">{formatVolume(stock.volume)}</p>
      </div>
    </motion.div>
  )
}

export default function TrendingPage() {
  const [data, setData] = useState<TrendingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTrending = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/trending")
      const json = await res.json()
      if (json.error && !json.gainers?.length) {
        setError(json.error)
      } else {
        setData(json)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load trending data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTrending()
  }, [])

  return (
    <div className="space-y-8 bg-[#f9f9fe] text-[#1a1c1f]">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between"
      >
        <div>
          <h1 className={`${headingClass} flex items-center gap-3`}>
            <Flame className="h-8 w-8 text-[#8a5d00]" />
            Trending Stocks
          </h1>
          <p className={subcopyClass}>
            Top gainers, biggest losers, and most actively traded stocks today.
            {data?.asOf && (
              <span className="ml-2 text-xs">
                Updated {new Date(data.asOf).toLocaleString()} · via {data.source}
              </span>
            )}
          </p>
        </div>
        <Button onClick={fetchTrending} disabled={loading} variant="outline" className="gap-2 border-[#e0e0e0] bg-white text-[#002141] hover:bg-[#f9f9fe]">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </motion.div>

      {error && (
        <p className="rounded-lg border border-[#e0e0e0] border-l-4 border-l-[#8a1f1f] bg-white px-4 py-3 text-sm text-[#8a1f1f] shadow-[0_20px_20px_rgba(0,0,0,0.04)]">
          {error}
        </p>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#003666]" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top Gainers */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className={panelClass}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg text-[#002141]">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Top Gainers
                </CardTitle>
                <CardDescription className="text-[#43474f]">Biggest price increases today</CardDescription>
              </CardHeader>
              <CardContent>
                {data?.gainers?.length ? (
                  <motion.div variants={containerVariants} initial="hidden" animate="visible" className="divide-y divide-[#e0e0e0]">
                    {data.gainers.map((stock, i) => (
                      <StockRow key={stock.ticker} stock={stock} rank={i + 1} />
                    ))}
                  </motion.div>
                ) : (
                  <p className="py-8 text-center text-sm text-[#43474f]">No data available</p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Top Losers */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className={panelClass}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg text-[#002141]">
                  <TrendingDown className="h-5 w-5 text-[#8a1f1f]" />
                  Top Losers
                </CardTitle>
                <CardDescription className="text-[#43474f]">Biggest price drops today</CardDescription>
              </CardHeader>
              <CardContent>
                {data?.losers?.length ? (
                  <motion.div variants={containerVariants} initial="hidden" animate="visible" className="divide-y divide-[#e0e0e0]">
                    {data.losers.map((stock, i) => (
                      <StockRow key={stock.ticker} stock={stock} rank={i + 1} />
                    ))}
                  </motion.div>
                ) : (
                  <p className="py-8 text-center text-sm text-[#43474f]">No data available</p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Most Active */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className={panelClass}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg text-[#002141]">
                  <Activity className="h-5 w-5 text-[#003666]" />
                  Most Active
                </CardTitle>
                <CardDescription className="text-[#43474f]">Highest trading volume today</CardDescription>
              </CardHeader>
              <CardContent>
                {data?.mostActive?.length ? (
                  <motion.div variants={containerVariants} initial="hidden" animate="visible" className="divide-y divide-[#e0e0e0]">
                    {data.mostActive.map((stock, i) => (
                      <StockRow key={stock.ticker} stock={stock} rank={i + 1} />
                    ))}
                  </motion.div>
                ) : (
                  <p className="py-8 text-center text-sm text-[#43474f]">No data available</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}
    </div>
  )
}
