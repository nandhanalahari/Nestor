"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import type { Variants } from "framer-motion"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Target,
  Plus,
  Home,
  GraduationCap,
  Plane,
  Car,
  Sparkles,
  Check,
  X,
  Calendar,
  TrendingUp,
  Trash2,
  Loader2,
} from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { authFetch } from "@/lib/api"
import { GoalProjection } from "@/components/GoalProjection"

interface Goal {
  id: string
  title: string
  target_amount: number
  current_amount: number
  monthly_savings_target?: number | null
  deadline: string
  icon: string
  ai_suggestion?: string
}

const iconMap: Record<string, typeof Home> = {
  home: Home,
  education: GraduationCap,
  travel: Plane,
  car: Car,
  other: Target,
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.12 } },
}

const itemVariants: Variants = {
  hidden: { y: 30, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 100, damping: 12 },
  },
}

const panelClass =
  "border-[#e0e0e0] bg-white shadow-[0_20px_20px_rgba(0,0,0,0.04)]"
const insightPanelClass =
  "border-[#e0e0e0] border-l-4 border-l-[#f7e382] bg-white shadow-[0_20px_20px_rgba(0,0,0,0.04)]"
const headingClass = "font-display text-3xl font-semibold text-[#002141]"
const subcopyClass = "mt-2 max-w-3xl text-sm leading-6 text-[#43474f]"

export default function GoalsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [newGoal, setNewGoal] = useState({
    title: "",
    amount: "",
    monthlySavings: "",
    deadline: "",
    icon: "other",
  })
  const [isSaving, setIsSaving] = useState(false)
  const [saveNotice, setSaveNotice] = useState<string | null>(null)

  const loadGoals = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authFetch("/api/goals")
      const data = await res.json()
      if (res.ok && data.goals) {
        setGoals(data.goals)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push("/auth")
      return
    }
    loadGoals()
  }, [user, authLoading, router, loadGoals])

  const handleAddGoal = async () => {
    if (!newGoal.title || !newGoal.amount) return

    setIsSaving(true)
    setSaveNotice(null)

    try {
      const res = await authFetch("/api/goals", {
        method: "POST",
        body: JSON.stringify({
          title: newGoal.title,
          target_amount: parseFloat(newGoal.amount),
          monthly_savings_target: newGoal.monthlySavings
            ? parseFloat(newGoal.monthlySavings)
            : null,
          deadline: newGoal.deadline,
          icon: newGoal.icon,
          text: `I want to ${newGoal.title} with a target of $${newGoal.amount} by ${newGoal.deadline || "someday"}.`,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setNewGoal({
          title: "",
          amount: "",
          monthlySavings: "",
          deadline: "",
          icon: "other",
        })
        setIsAdding(false)
        await loadGoals()
      } else {
        setSaveNotice(data.error || "Could not save goal.")
      }
    } catch {
      setSaveNotice("Could not reach Nestor. Try again.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteGoal = async (id: string) => {
    try {
      const res = await authFetch(`/api/goals?id=${id}`, { method: "DELETE" })
      if (res.ok) {
        setGoals(goals.filter((g) => g.id !== id))
      }
    } catch {
      // ignore
    }
  }

  const handleProjectionSaved = (goalId: string, monthlySavingsTarget: number) => {
    setGoals((currentGoals) =>
      currentGoals.map((goal) =>
        goal.id === goalId
          ? { ...goal, monthly_savings_target: monthlySavingsTarget }
          : goal,
      ),
    )
  }

  if (authLoading || (!user && !authLoading)) {
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
        transition={{ duration: 0.4 }}
        className="flex items-start justify-between"
      >
        <div>
          <h1 className={headingClass}>My Goals</h1>
          <p className={subcopyClass}>
            Set financial goals and get AI-powered guidance from Gemini.
          </p>
        </div>
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button onClick={() => setIsAdding(true)} className="gap-2 bg-[#002141] hover:bg-[#003666]">
            <Plus className="w-4 h-4" />
            Add Goal
          </Button>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -20 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className={insightPanelClass}>
              <CardHeader>
                <CardTitle className="text-[#002141]">Create a New Goal</CardTitle>
                <CardDescription className="text-[#43474f]">
                  Tell us what you&apos;re saving for and Gemini will help you get there.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <Input
                    placeholder="e.g., New car, Emergency fund"
                    value={newGoal.title}
                    onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                  />
                  <Input
                    type="number"
                    placeholder="Target amount ($)"
                    value={newGoal.amount}
                    onChange={(e) => setNewGoal({ ...newGoal, amount: e.target.value })}
                  />
                  <Input
                    type="number"
                    placeholder="Monthly savings ($)"
                    value={newGoal.monthlySavings}
                    onChange={(e) => setNewGoal({ ...newGoal, monthlySavings: e.target.value })}
                  />
                  <Input
                    type="text"
                    placeholder="Target year (e.g., 2028)"
                    value={newGoal.deadline}
                    onChange={(e) => setNewGoal({ ...newGoal, deadline: e.target.value })}
                  />
                  <select
                    value={newGoal.icon}
                    onChange={(e) => setNewGoal({ ...newGoal, icon: e.target.value })}
                    className="rounded-md border border-[#e0e0e0] bg-white px-3 py-2 text-sm text-[#1a1c1f] outline-none focus:border-[#003666] focus:ring-2 focus:ring-[#7aa0d6]/30"
                  >
                    <option value="home">Home</option>
                    <option value="education">Education</option>
                    <option value="travel">Travel</option>
                    <option value="car">Car</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="flex gap-2 mt-4">
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button onClick={handleAddGoal} disabled={isSaving} className="gap-2 bg-[#002141] hover:bg-[#003666]">
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      {isSaving ? "Saving..." : "Save Goal"}
                    </Button>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button variant="outline" onClick={() => setIsAdding(false)} className="gap-2 border-[#e0e0e0] bg-white text-[#002141] hover:bg-[#f9f9fe]">
                      <X className="w-4 h-4" />
                      Cancel
                    </Button>
                  </motion.div>
                </div>
              </CardContent>
            </Card>
            {saveNotice && (
              <p className="mt-3 text-sm text-[#43474f]">{saveNotice}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#003666]" />
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 gap-6"
        >
          <AnimatePresence>
            {goals.map((goal, index) => {
              const Icon = iconMap[goal.icon] || Target
              const target = Number(goal.target_amount) || 1
              const current = Number(goal.current_amount) || 0
              const progress = Math.min((current / target) * 100, 100)

              return (
                <motion.div
                  key={goal.id}
                  variants={itemVariants}
                  layout
                  exit={{ opacity: 0, x: -100 }}
                >
                  <motion.div
                    whileHover={{ y: -4 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <Card className={`${panelClass} overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-[0_20px_20px_rgba(0,0,0,0.06)]`}>
                      <CardContent className="p-6">
                        <div className="flex items-start gap-6">
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{
                              type: "spring",
                              stiffness: 200,
                              delay: 0.2 + index * 0.1,
                            }}
                            className="rounded-xl bg-[#7aa0d6]/20 p-4"
                          >
                            <Icon className="h-8 w-8 text-[#003666]" />
                          </motion.div>

                          <div className="flex-1 space-y-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <h3 className="font-display text-xl font-semibold text-[#002141]">
                                  {goal.title}
                                </h3>
                                <div className="mt-1 flex items-center gap-4 text-sm text-[#43474f]">
                                  {goal.deadline && (
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-4 h-4" />
                                      Target: {goal.deadline}
                                    </span>
                                  )}
                                  <span className="flex items-center gap-1">
                                    <TrendingUp className="w-4 h-4" />
                                    {progress.toFixed(0)}% complete
                                  </span>
                                </div>
                              </div>
                              <div className="text-right flex items-start gap-2">
                                <div>
                                  <p className="text-2xl font-semibold text-[#002141]">
                                    ${current.toLocaleString()}
                                  </p>
                                  <p className="text-sm text-[#43474f]">
                                    of ${target.toLocaleString()}
                                  </p>
                                </div>
                                <button
                                  onClick={() => handleDeleteGoal(goal.id)}
                                  className="mt-1 p-1 text-[#43474f] transition-colors hover:text-[#8a1f1f]"
                                  title="Delete goal"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            <div className="h-3 overflow-hidden rounded-full bg-[#eeedf2]">
                              <motion.div
                                className="h-full rounded-full bg-[#003666]"
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                transition={{
                                  duration: 0.8,
                                  delay: 0.3 + index * 0.1,
                                  ease: "easeOut",
                                }}
                              />
                            </div>

                            <GoalProjection
                              goalId={goal.id}
                              monthlySavingsTarget={goal.monthly_savings_target}
                              onSaved={handleProjectionSaved}
                            />

                            {goal.ai_suggestion && (
                              <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: 0.5 + index * 0.1 }}
                                className="mt-4 flex items-start gap-3 rounded-lg border border-[#e0e0e0] border-l-4 border-l-[#f7e382] bg-[#f9f9fe] p-4"
                              >
                                <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#8a5d00]" />
                                <p className="text-sm text-[#1a1c1f]">
                                  {goal.ai_suggestion}
                                </p>
                              </motion.div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {!loading && goals.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card className={panelClass}>
            <CardContent className="p-12 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
              >
                <Target className="mx-auto mb-4 h-12 w-12 text-[#7aa0d6]" />
              </motion.div>
              <h3 className="font-display text-lg font-semibold text-[#002141]">No goals yet</h3>
              <p className="mt-1 text-[#43474f]">
                Click &quot;Add Goal&quot; to set your first financial goal. Gemini AI will provide personalized guidance.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  )
}
