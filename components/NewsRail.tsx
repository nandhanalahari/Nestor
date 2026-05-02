"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { formatDistanceToNow } from "date-fns"
import {
  Newspaper,
  Zap,
  ChevronDown,
  ExternalLink,
  Loader2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Term } from "@/components/Term"
import { cn } from "@/lib/utils"
import type { NewsItem } from "@/lib/types"

export function NewsRail({ tickers }: { tickers: string[] }) {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [newsFilter, setNewsFilter] = useState<"company" | "macro">("company")

  const fetchNews = async () => {
    setLoading(true)
    setError(null)
    try {
      const query = tickers.length > 0 ? `?tickers=${tickers.join(",")}` : ""
      const res = await fetch(`/api/news${query}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to fetch news")
      setNews(data.news || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading news")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNews()
  }, [tickers.join(",")])

  useEffect(() => {
    if (news.length === 0) return
    const hasCurrentFilter = news.some((item) => item.newsType === newsFilter)
    if (!hasCurrentFilter) {
      const fallbackFilter = news.some((item) => item.newsType === "company")
        ? "company"
        : "macro"
      setNewsFilter(fallbackFilter)
    }
  }, [news, newsFilter])

  if (loading) {
    return (
      <div className="flex w-full flex-col items-center justify-center space-y-4 rounded-lg border border-[#e0e0e0] bg-white py-6 shadow-[0_20px_20px_rgba(0,0,0,0.04)]">
        <Loader2 className="h-8 w-8 animate-spin text-[#003666]" />
        <p className="text-sm text-[#43474f]">Analyzing latest market events...</p>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="rounded-lg border-destructive/40 bg-white shadow-[0_20px_20px_rgba(0,0,0,0.04)]">
        <CardContent className="flex flex-col items-center justify-center py-6 text-center">
          <Newspaper className="mb-2 h-8 w-8 text-destructive/50" />
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchNews} className="mt-4 border-[#003666]/25 bg-white text-[#003666] hover:bg-[#eef3fa]">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (news.length === 0) {
    return null
  }

  const filteredNews = news
    .filter((n) => n.newsType === newsFilter)
    .sort((a, b) => {
      const importanceDelta =
        Number(b.importance === "high") - Number(a.importance === "high")
      if (importanceDelta !== 0) return importanceDelta
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    })

  return (
    <div className="group relative w-full space-y-2">
      {/* Filter Toggle */}
      <div className="flex items-center justify-between px-4 sm:px-0">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-[#002141]">
          <Newspaper className="h-5 w-5 text-[#7aa0d6]" />
          Live Events
        </h2>
        <div className="flex rounded-lg border border-[#e0e0e0] bg-white p-1 shadow-[0_20px_20px_rgba(0,0,0,0.04)]">
          <button
            onClick={() => setNewsFilter("company")}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
              newsFilter === "company" ? "bg-[#002141] text-white shadow-sm" : "text-[#43474f] hover:bg-[#eef3fa] hover:text-[#002141]"
            )}
          >
            My Portfolio
          </button>
          <button
            onClick={() => setNewsFilter("macro")}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
              newsFilter === "macro" ? "bg-[#002141] text-white shadow-sm" : "text-[#43474f] hover:bg-[#eef3fa] hover:text-[#002141]"
            )}
          >
            Broad Market
          </button>
        </div>
      </div>

      <div className="group relative -mx-4 w-full overflow-hidden px-4 py-4 sm:mx-0 sm:px-0">
      <style>{`
        @keyframes custom-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-custom-marquee {
          animation: custom-marquee 40s linear infinite;
        }
        .animate-custom-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
      <div 
        className="flex w-max animate-custom-marquee items-start gap-4"
        style={{ animationDuration: `${filteredNews.length * 8}s` }}
      >
        {[...filteredNews, ...filteredNews].map((item, index) => {
          // We use index in the key because items are duplicated
          const uniqueKey = `${item.id}-${index}`
          const isExpanded = expandedId === uniqueKey
          const isImportant = item.importance === "high"

          return (
            <motion.div
              key={uniqueKey}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              className="w-[300px] shrink-0 md:w-[350px]"
            >
              <Card 
                className={cn(
                  "relative h-full cursor-pointer overflow-hidden rounded-lg border bg-white transition-all duration-300 shadow-[0_20px_20px_rgba(0,0,0,0.04)]",
                  isExpanded ? "border-[#003666]" : "border-[#e0e0e0] hover:border-[#7aa0d6]",
                  isImportant && !isExpanded ? "border-[#f7e382] shadow-[0_20px_20px_rgba(247,227,130,0.22)]" : ""
                )}
                onClick={() => setExpandedId(isExpanded ? null : uniqueKey)}
              >
                {/* Accent line for important news */}
                {isImportant && (
                  <div className="absolute left-0 right-0 top-0 h-1 bg-[#f7e382]" />
                )}

                <CardContent className="flex h-full flex-col gap-3 p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6b7280]">
                        {item.source}
                      </span>
                      <span className="text-[11px] text-[#6b7280]">
                        • {formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {item.importance === "high" && (
                        <div className="flex items-center gap-1 rounded-full border border-[#f7e382] bg-[#fff8c9] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#524700]">
                          <Zap className="w-3 h-3 fill-current" />
                          Major
                        </div>
                      )}
                      {item.impact && (
                        <div className={cn(
                          "flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                          item.impact === "Positive" ? "bg-[#e9f6ef] text-[#146c43]" :
                          item.impact === "Negative" ? "bg-[#fff1f2] text-[#9f1239]" :
                          "bg-[#eeedf2] text-[#43474f]"
                        )}>
                          {item.impact === "Positive" && <TrendingUp className="w-3 h-3" />}
                          {item.impact === "Negative" && <TrendingDown className="w-3 h-3" />}
                          {item.impact === "Neutral" && <Minus className="w-3 h-3" />}
                          {item.impact}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Headline */}
                  <h3 className="line-clamp-3 font-display text-sm font-bold leading-snug text-[#002141]">
                    {item.headline}
                  </h3>

                  {/* Portfolio Impact */}
                  <div className="mt-auto pt-2">
                    {item.geminiForYou ? (
                      <div className="rounded-md border border-[#f7e382] bg-[#fffbe0] p-2.5">
                        <p className="line-clamp-3 text-[11px] font-medium leading-relaxed text-[#524700]">
                          <span className="font-bold">Portfolio Impact: </span>
                          {item.geminiForYou}
                        </p>
                      </div>
                    ) : (
                      <p className="line-clamp-2 text-xs text-[#43474f]">
                        {item.summary}
                      </p>
                    )}
                  </div>

                  {/* Expand icon */}
                  <div className="mt-2 flex justify-center opacity-60">
                    <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", isExpanded && "rotate-180")} />
                  </div>

                  {/* Expanded Content Accordion */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-2 flex flex-col gap-3 border-t border-[#e0e0e0] pt-4">
                          {(item.geminiWhy || item.summary) && (
                            <div>
                              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#6b7280]">The Context</span>
                              <p className="text-xs leading-relaxed text-[#43474f]">
                                {item.geminiWhy || item.summary}
                              </p>
                            </div>
                          )}
                          {item.jargon && item.jargon.length > 0 && (
                            <div className="rounded-md bg-[#f4f6fa] p-2">
                              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#6b7280]">Key Terms</span>
                              <ul className="space-y-1">
                                {item.jargon.map((j, i) => (
                                  <li key={i} className="text-[11px] text-[#43474f]">
                                    <Term term={j.term} context={j.definition}>
                                      {j.term}
                                    </Term>
                                    {": "}
                                    {j.definition}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {item.geminiDeepDive && (
                            <div>
                              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#6b7280]">Deep Dive</span>
                              <p className="text-xs leading-relaxed text-[#1a1c1f]">
                                {item.geminiDeepDive}
                              </p>
                            </div>
                          )}
                          {item.takeaway && (
                            <div className="rounded-md border border-[#f7e382] bg-[#fffbe0] p-3">
                              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#524700]">The Takeaway</span>
                              <p className="text-xs font-medium leading-relaxed text-[#524700]">
                                {item.takeaway}
                              </p>
                            </div>
                          )}
                          <a 
                            href={item.url} 
                            target="_blank" 
                            rel="noreferrer"
                            className="mt-4 inline-flex items-center gap-1 text-[11px] font-semibold text-[#003666] hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Read full article on {item.source}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>
    </div>
    </div>
  )
}
