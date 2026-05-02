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

  if (loading) {
    return (
      <div className="w-full py-6 flex flex-col items-center justify-center space-y-4 border rounded-xl bg-card/50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Analyzing latest market events...</p>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="flex flex-col items-center justify-center py-6 text-center">
          <Newspaper className="w-8 h-8 text-destructive/50 mb-2" />
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchNews} className="mt-4">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try again
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (news.length === 0) {
    return null
  }

  const filteredNews = news.filter(n => n.newsType === newsFilter);

  return (
    <div className="relative group w-full space-y-2">
      {/* Filter Toggle */}
      <div className="flex items-center justify-between px-4 sm:px-0">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Newspaper className="w-5 h-5 text-primary" />
          Live Events
        </h2>
        <div className="flex bg-secondary p-1 rounded-lg">
          <button
            onClick={() => setNewsFilter("company")}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
              newsFilter === "company" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            My Portfolio
          </button>
          <button
            onClick={() => setNewsFilter("macro")}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
              newsFilter === "macro" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Broad Market
          </button>
        </div>
      </div>

      <div className="relative overflow-hidden py-4 -mx-4 px-4 sm:mx-0 sm:px-0 group w-full">
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
        className="flex w-max animate-custom-marquee gap-4 items-start"
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
              className="w-[300px] md:w-[350px] shrink-0"
            >
              <Card 
                className={cn(
                  "h-full transition-all duration-300 cursor-pointer overflow-hidden relative border-2",
                  isExpanded ? "border-primary/50 shadow-md" : "border-border hover:border-primary/30",
                  isImportant && !isExpanded ? "border-amber-500/40 shadow-[0_0_15px_-3px_rgba(245,158,11,0.2)]" : ""
                )}
                onClick={() => setExpandedId(isExpanded ? null : uniqueKey)}
              >
                {/* Accent line for important news */}
                {isImportant && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
                )}

                <CardContent className="p-5 flex flex-col h-full gap-3">
                  {/* Header */}
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        {item.source}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        • {formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      {item.importance === "high" && (
                        <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                          <Zap className="w-3 h-3 fill-current" />
                          Major
                        </div>
                      )}
                      {item.impact && (
                        <div className={cn(
                          "flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                          item.impact === "Positive" ? "text-green-600 bg-green-500/10 dark:text-green-400" :
                          item.impact === "Negative" ? "text-red-600 bg-red-500/10 dark:text-red-400" :
                          "text-gray-500 bg-gray-500/10 dark:text-gray-400"
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
                  <h3 className="font-bold text-sm leading-snug text-foreground line-clamp-3">
                    {item.headline}
                  </h3>

                  {/* Portfolio Impact */}
                  <div className="mt-auto pt-2">
                    {item.geminiForYou ? (
                      <div className="bg-primary/5 rounded-md p-2.5 border border-primary/10">
                        <p className="text-[11px] font-medium text-primary line-clamp-3 leading-relaxed">
                          <span className="font-bold">Portfolio Impact: </span>
                          {item.geminiForYou}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {item.summary}
                      </p>
                    )}
                  </div>

                  {/* Expand icon */}
                  <div className="flex justify-center mt-2 opacity-50">
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
                        <div className="pt-4 mt-2 border-t border-border/50 flex flex-col gap-3">
                          {(item.geminiWhy || item.summary) && (
                            <div>
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 block">The Context</span>
                              <p className="text-xs text-foreground/80 leading-relaxed">
                                {item.geminiWhy || item.summary}
                              </p>
                            </div>
                          )}
                          {item.jargon && item.jargon.length > 0 && (
                            <div className="bg-secondary/50 rounded-md p-2">
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Key Terms</span>
                              <ul className="space-y-1">
                                {item.jargon.map((j, i) => (
                                  <li key={i} className="text-[11px] text-foreground/80">
                                    <span className="font-semibold text-primary">{j.term}:</span> {j.definition}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {item.geminiDeepDive && (
                            <div>
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Deep Dive</span>
                              <p className="text-xs text-foreground leading-relaxed">
                                {item.geminiDeepDive}
                              </p>
                            </div>
                          )}
                          {item.takeaway && (
                            <div className="bg-primary/10 rounded-md p-3 border border-primary/20">
                              <span className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1 block">The Takeaway</span>
                              <p className="text-xs font-medium text-primary leading-relaxed">
                                {item.takeaway}
                              </p>
                            </div>
                          )}
                          <a 
                            href={item.url} 
                            target="_blank" 
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline mt-4"
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
