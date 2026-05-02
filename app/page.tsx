"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import {
  TrendingUp,
  Shield,
  Brain,
  Target,
  ArrowRight,
  LineChart,
  Zap,
  PieChart,
  BookOpen,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/auth-provider"

const features = [
  {
    icon: Brain,
    title: "AI-Powered Insights",
    description:
      "Gemini explains every recommendation in plain English so you always know what's happening.",
  },
  {
    icon: Shield,
    title: "Risk Management",
    description:
      "Stress-test your portfolio against real historical crises with live Alpha Vantage data.",
  },
  {
    icon: Target,
    title: "Goal Tracking",
    description:
      "Set financial goals in plain language and get AI guidance to stay on track.",
  },
  {
    icon: LineChart,
    title: "What-If Scenarios",
    description:
      "Simulate inflation spikes, recessions, and market crashes — see how your portfolio responds.",
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 100, damping: 12 },
  },
}

export default function HomePage() {
  const { user } = useAuth()

  return (
    <div className="space-y-16 pb-16">
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center pt-8"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6"
        >
          <Zap className="w-4 h-4" />
          AI-Powered Portfolio Management
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 text-balance"
        >
          Smarter Investing for{" "}
          <span className="text-primary">Everyone</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 text-pretty"
        >
          Nestor uses Gemini AI and live market data to help you make better
          investment decisions, manage risk, and achieve your financial goals.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          {user ? (
            <Button asChild size="lg" className="gap-2">
              <Link href="/dashboard">
                Go to Dashboard
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          ) : (
            <Button asChild size="lg" className="gap-2">
              <Link href="/auth">
                Get Started
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" size="lg" className="gap-2">
            <Link href="/scenarios">
              <PieChart className="w-4 h-4" />
              Try What-If Scenarios
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="gap-2">
            <Link href="/lessons">
              <BookOpen className="w-4 h-4" />
              Trading School
            </Link>
          </Button>
        </motion.div>
      </motion.section>

      <motion.section
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
      >
        <motion.div variants={itemVariants} className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Everything You Need to Invest Smarter
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Powered by live Alpha Vantage market data and Gemini AI explanations.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              whileHover={{ y: -4 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Card className="h-full hover:shadow-lg transition-all duration-300 hover:border-primary/20">
                <CardContent className="p-6 flex gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-2xl bg-primary p-8 md:p-12 text-center"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.15),_transparent_50%)]" />
        <div className="relative z-10">
          <TrendingUp className="w-12 h-12 text-primary-foreground mx-auto mb-6 opacity-90" />
          <h2 className="text-2xl md:text-3xl font-bold text-primary-foreground mb-4 text-balance">
            Ready to Take Control of Your Investments?
          </h2>
          <p className="text-primary-foreground/80 max-w-lg mx-auto mb-8">
            Create an account to save your portfolio, track goals, and get
            personalized AI recommendations.
          </p>
          <Button
            asChild
            size="lg"
            variant="secondary"
            className="gap-2 bg-white text-primary hover:bg-white/90"
          >
            <Link href={user ? "/dashboard" : "/auth"}>
              {user ? "Go to Dashboard" : "Get Started Free"}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </motion.section>
    </div>
  )
}
