"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
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

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
}

const itemVariants = {
  hidden: { y: 10, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100, damping: 12 } },
}

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
      <span className="text-sm text-muted-foreground w-6 text-right font-mono">{rank}</span>
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-bold text-primary">{stock.ticker.slice(0, 4)}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground text-sm truncate">{stock.ticker}</p>
        <p className="text-xs text-muted-foreground truncate">{stock.exchange}</p>
      </div>
      <div className="text-right">
        <p className="font-medium text-foreground text-sm">{usd.format(stock.price)}</p>
        <p className={`text-xs flex items-center justify-end gap-0.5 ${isUp ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
          {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {isUp ? "+" : ""}{stock.change_percent.toFixed(2)}%
        </p>
      </div>
      <div className="text-right w-16">
        <p className="text-xs text-muted-foreground">{formatVolume(stock.volume)}</p>
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
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Flame className="w-8 h-8 text-orange-500" />
            Trending Stocks
          </h1>
          <p className="text-muted-foreground mt-1">
            Top gainers, biggest losers, and most actively traded stocks today.
            {data?.asOf && (
              <span className="text-xs ml-2">
                Updated {new Date(data.asOf).toLocaleString()} · via {data.source}
              </span>
            )}
          </p>
        </div>
        <Button onClick={fetchTrending} disabled={loading} variant="outline" className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh
        </Button>
      </motion.div>

      {error && (
        <p className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top Gainers */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  Top Gainers
                </CardTitle>
                <CardDescription>Biggest price increases today</CardDescription>
              </CardHeader>
              <CardContent>
                {data?.gainers?.length ? (
                  <motion.div variants={containerVariants} initial="hidden" animate="visible" className="divide-y">
                    {data.gainers.map((stock, i) => (
                      <StockRow key={stock.ticker} stock={stock} rank={i + 1} />
                    ))}
                  </motion.div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No data available</p>
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingDown className="w-5 h-5 text-red-500" />
                  Top Losers
                </CardTitle>
                <CardDescription>Biggest price drops today</CardDescription>
              </CardHeader>
              <CardContent>
                {data?.losers?.length ? (
                  <motion.div variants={containerVariants} initial="hidden" animate="visible" className="divide-y">
                    {data.losers.map((stock, i) => (
                      <StockRow key={stock.ticker} stock={stock} rank={i + 1} />
                    ))}
                  </motion.div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No data available</p>
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Activity className="w-5 h-5 text-primary" />
                  Most Active
                </CardTitle>
                <CardDescription>Highest trading volume today</CardDescription>
              </CardHeader>
              <CardContent>
                {data?.mostActive?.length ? (
                  <motion.div variants={containerVariants} initial="hidden" animate="visible" className="divide-y">
                    {data.mostActive.map((stock, i) => (
                      <StockRow key={stock.ticker} stock={stock} rank={i + 1} />
                    ))}
                  </motion.div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No data available</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}
    </div>
  )
}
