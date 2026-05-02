"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  ArrowRight,
  BookOpen,
  GitBranch,
  LayoutDashboard,
  Lightbulb,
  Loader2,
  TrendingUp,
} from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { authFetch } from "@/lib/api"
import { usd } from "@/lib/format"
import type { Holding } from "@/lib/types"

type PortfolioPayload = {
  holdings: Holding[]
  totalValue: number
  dailyChangePct: number
}

const jumpBackItems = [
  {
    href: "/dashboard",
    title: "Go to Dashboard",
    description: "Your full portfolio, charts and holdings",
    icon: LayoutDashboard,
    featured: true,
  },
  {
    href: "/lessons",
    title: "Today's lesson: The 2008 Crash",
    description: "Trading School · +50 XP · ~3 min",
    icon: BookOpen,
  },
  {
    href: "/scenarios",
    title: "Run a What-If Scenario",
    description: "See how your portfolio handles a market shock",
    icon: GitBranch,
  },
]

function getFirstName(userName?: string | null, email?: string | null) {
  const source = userName || email?.split("@")[0] || "Investor"
  return source.split(/\s+/)[0]
}

export default function HomePage() {
  const { user, loading: authLoading } = useAuth()
  const [portfolio, setPortfolio] = useState<PortfolioPayload | null>(null)
  const [loadingPortfolio, setLoadingPortfolio] = useState(false)

  useEffect(() => {
    if (!user) return

    let cancelled = false
    async function loadPortfolio() {
      setLoadingPortfolio(true)
      try {
        const res = await authFetch("/api/portfolio")
        if (!res.ok) return
        const data = (await res.json()) as PortfolioPayload
        if (!cancelled) setPortfolio(data)
      } finally {
        if (!cancelled) setLoadingPortfolio(false)
      }
    }

    void loadPortfolio()
    return () => {
      cancelled = true
    }
  }, [user])

  const firstName = getFirstName(
    user?.user_metadata?.display_name,
    user?.email,
  )

  const totalValue = portfolio?.totalValue ?? 12480
  const dailyChangePct = portfolio?.dailyChangePct ?? 1.34
  const holdingsCount = portfolio?.holdings?.length ?? 5
  const isPositive = dailyChangePct >= 0

  const tip = useMemo(() => {
    const largestHolding = portfolio?.holdings?.[0]?.ticker
    if (largestHolding) {
      return `${largestHolding} is one part of your portfolio. Spreading money across several holdings can reduce the impact of any single company.`
    }
    return "Index funds like SPY hold hundreds of stocks at once - instant diversification."
  }, [portfolio])

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#003666]" />
      </div>
    )
  }

  return (
    <div className="-mx-8 -mb-12 -mt-8 min-h-[calc(100vh-4rem)] bg-[#f9f9fe] px-8 py-12 text-[#002141]">
      <div className="mx-auto max-w-[820px]">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="pt-4"
        >
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#7aa0d6]">
            Good morning
          </p>
          <h1 className="mt-3 font-display text-4xl font-extrabold tracking-normal text-[#002141] md:text-5xl">
            Welcome back, {firstName}.
          </h1>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.08 }}
          className="mt-10"
        >
          <p className="text-sm font-bold tracking-wide text-[#6b7280]">
            Your portfolio
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-5">
            <p className="font-display text-6xl font-extrabold leading-none tracking-tight text-[#002141]">
              {usd.format(Math.round(totalValue))}
            </p>
            <div
              className={`rounded-full border px-4 py-2 text-lg font-bold ${
                isPositive
                  ? "border-[#a9dfc3] bg-[#e7f7ef] text-[#146c43]"
                  : "border-[#f4b7b7] bg-[#fff1f1] text-[#9f1239]"
              }`}
            >
              <span className="inline-flex items-center gap-1">
                <TrendingUp className={`h-4 w-4 ${isPositive ? "" : "rotate-180"}`} />
                {isPositive ? "+" : ""}
                {dailyChangePct.toFixed(2)}% today
              </span>
            </div>
          </div>
          <p className="mt-3 text-base font-medium text-[#9aa7b8]">
            {loadingPortfolio ? "Loading holdings" : `${holdingsCount} holdings`}
          </p>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.16 }}
          className="mt-14"
        >
          <div className="flex gap-5 rounded-xl border border-[#e0e0e0] bg-white p-6 shadow-[0_20px_20px_rgba(0,0,0,0.04)]">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#f7d645] bg-[#fff7c8] text-[#6c5e06]">
              <Lightbulb className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-[#524700]">
                Today's tip
              </p>
              <p className="mt-3 max-w-2xl text-xl font-semibold leading-8 text-[#002141]">
                {tip}
              </p>
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.24 }}
          className="mt-20"
        >
          <p className="mb-4 text-sm font-extrabold uppercase tracking-[0.18em] text-[#9aa7b8]">
            Jump back in
          </p>
          <div className="space-y-3">
            {jumpBackItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-4 rounded-xl border p-5 transition-all active:scale-[0.99] ${
                  item.featured
                    ? "border-[#002141] bg-[#002141] text-white shadow-[0_20px_20px_rgba(0,0,0,0.08)] hover:bg-[#003666]"
                    : "border-[#e0e0e0] bg-white text-[#002141] hover:border-[#7aa0d6]"
                }`}
              >
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${
                    item.featured
                      ? "bg-white/10 text-white"
                      : "bg-[#eef4fb] text-[#003666]"
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-bold">{item.title}</p>
                  <p
                    className={`mt-0.5 text-sm ${
                      item.featured ? "text-white/70" : "text-[#6b7280]"
                    }`}
                  >
                    {item.description}
                  </p>
                </div>
                <ArrowRight
                  className={`h-5 w-5 transition-transform group-hover:translate-x-1 ${
                    item.featured ? "text-white/70" : "text-[#7aa0d6]"
                  }`}
                />
              </Link>
            ))}
          </div>
        </motion.section>
      </div>
    </div>
  )
}
