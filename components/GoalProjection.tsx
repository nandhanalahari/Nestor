"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { authFetch } from "@/lib/api"
import { CalendarClock, Loader2, PiggyBank, TrendingUp } from "lucide-react"

type Projection = {
  projected_date: string | null
  on_track: boolean | null
  monthly_needed_to_be_on_time: number | null
  monthly_savings_target: number
  annual_return_assumption: number
  profile_label: string
  months_to_target: number | null
  target_deadline: string | null
}

type GoalProjectionProps = {
  goalId: string
  monthlySavingsTarget?: number | null
  onSaved: (goalId: string, monthlySavingsTarget: number) => void
}

function formatDate(value: string | null) {
  if (!value) return "No projection yet"
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`))
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

export function GoalProjection({
  goalId,
  monthlySavingsTarget,
  onSaved,
}: GoalProjectionProps) {
  const [projection, setProjection] = useState<Projection | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState(
    monthlySavingsTarget ? String(monthlySavingsTarget) : "",
  )

  const loadProjection = useCallback(async () => {
    if (!monthlySavingsTarget) return

    setLoading(true)
    setError(null)
    try {
      const res = await authFetch(`/api/goals/projection?goal_id=${goalId}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Could not load projection.")
        return
      }
      setProjection(data)
    } catch {
      setError("Could not reach Nestor.")
    } finally {
      setLoading(false)
    }
  }, [goalId, monthlySavingsTarget])

  useEffect(() => {
    loadProjection()
  }, [loadProjection])

  const saveMonthlyTarget = async () => {
    const monthlyTarget = Number(inputValue)
    if (!Number.isFinite(monthlyTarget) || monthlyTarget <= 0) {
      setError("Enter a positive monthly savings amount.")
      return
    }

    setSaving(true)
    setError(null)
    try {
      const res = await authFetch("/api/goals", {
        method: "PATCH",
        body: JSON.stringify({
          id: goalId,
          monthly_savings_target: monthlyTarget,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Could not save monthly target.")
        return
      }
      onSaved(goalId, Number(data.goal.monthly_savings_target))
    } catch {
      setError("Could not save monthly target.")
    } finally {
      setSaving(false)
    }
  }

  if (!monthlySavingsTarget) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border bg-background p-4">
        <div className="flex items-start gap-3">
          <PiggyBank className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">
              Add a monthly savings target to project this goal.
            </p>
            <p className="text-sm text-muted-foreground">
              We will use it with your risk profile and portfolio value.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="number"
            min="1"
            inputMode="decimal"
            placeholder="Monthly savings ($)"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          <Button onClick={saveMonthlyTarget} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-accent p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Calculating projection...
      </div>
    )
  }

  if (error) {
    return <p className="rounded-lg bg-accent p-4 text-sm text-muted-foreground">{error}</p>
  }

  if (!projection) return null

  const projectionCopy =
    projection.on_track === true
      ? `On track for ${formatDate(projection.projected_date)}.`
      : projection.on_track === false
        ? `Projected for ${formatDate(projection.projected_date)}, after your target date.`
        : `Projected for ${formatDate(projection.projected_date)}.`

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-accent p-4">
      <div className="flex items-start gap-3">
        <CalendarClock className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{projectionCopy}</p>
          <p className="text-sm text-muted-foreground">
            Assumes {formatCurrency(projection.monthly_savings_target)}/mo and{" "}
            {(projection.annual_return_assumption * 100).toFixed(0)}% annual growth for{" "}
            {projection.profile_label}.
          </p>
        </div>
      </div>

      {projection.on_track === false && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            To hit the target date, aim for{" "}
            {projection.monthly_needed_to_be_on_time === null
              ? "a higher monthly contribution"
              : `${formatCurrency(projection.monthly_needed_to_be_on_time)}/mo`}
            .
          </p>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/scenarios">
              <TrendingUp className="h-4 w-4" />
              Try scenarios
            </Link>
          </Button>
        </div>
      )}
    </div>
  )
}
