"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, LineChart, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authFetch } from "@/lib/api";
import { formatPercent, usdDetail } from "@/lib/format";
import { useXP } from "@/hooks/useXP";
import { cn } from "@/lib/utils";

const LESSON_COMPLETE_XP = 50;

const RETURN_EPS = 0.05;

export type LessonChoiceOutcome = {
  choice: string;
  /** Portfolio return for this choice over the lesson horizon (% points). */
  finalReturnPct: number;
};

export type HistoricalLessonProps = {
  lessonTitle?: string;
  lessonSubtitle?: string;
  /** Four choice outcomes shown side-by-side on the reveal step. */
  outcomes: LessonChoiceOutcome[];
  /** Choice label with the best `finalReturnPct`. */
  optimalChoice: string;
  /**
   * User’s choice when replaying from API results; if omitted, step 3 sets it.
   */
  userChoice?: string;
  className?: string;
};

type Step = 1 | 2 | 3 | 4;

function returnForChoice(
  outcomes: LessonChoiceOutcome[],
  choice: string,
): number | undefined {
  return outcomes.find(
    (o) => o.choice.trim().toLowerCase() === choice.trim().toLowerCase(),
  )?.finalReturnPct;
}

export function HistoricalLesson({
  lessonTitle = "Historical lesson",
  lessonSubtitle = "Walk through a real market moment with your portfolio.",
  outcomes,
  optimalChoice,
  userChoice: userChoiceProp,
  className,
}: HistoricalLessonProps) {
  const { awardXP } = useXP();
  const lessonXpAwardedRef = useRef(false);
  const [step, setStep] = useState<Step>(1);
  const [portfolioValue, setPortfolioValue] = useState<number>(0);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const [pickedChoice, setPickedChoice] = useState<string | null>(
    userChoiceProp ?? null,
  );
  const [xpAwardError, setXpAwardError] = useState<string | null>(null);

  useEffect(() => {
    if (userChoiceProp) setPickedChoice(userChoiceProp);
  }, [userChoiceProp]);

  const loadPortfolio = useCallback(async () => {
    setPortfolioLoading(true);
    try {
      const res = await authFetch("/api/portfolio");
      const data = (await res.json()) as { totalValue?: number };
      if (res.ok && typeof data.totalValue === "number") {
        setPortfolioValue(data.totalValue);
      }
    } catch {
      setPortfolioValue(0);
    } finally {
      setPortfolioLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPortfolio();
  }, [loadPortfolio]);

  const effectiveUserChoice =
    userChoiceProp ?? pickedChoice ?? outcomes[0]?.choice ?? "";

  const optimalReturn = useMemo(
    () => returnForChoice(outcomes, optimalChoice),
    [outcomes, optimalChoice],
  );

  const userChoiceReturn = useMemo(
    () => returnForChoice(outcomes, effectiveUserChoice),
    [outcomes, effectiveUserChoice],
  );

  const instinct = useMemo(() => {
    if (
      optimalReturn === undefined ||
      userChoiceReturn === undefined ||
      outcomes.length === 0
    ) {
      return null;
    }
    const gap = optimalReturn - userChoiceReturn;
    const matchedOptimal = Math.abs(gap) <= RETURN_EPS;

    return {
      gap,
      matchedOptimal,
      optimalReturn,
      userChoiceReturn,
    };
  }, [optimalReturn, userChoiceReturn, outcomes.length]);

  const dollarImpact =
    instinct && instinct.gap > RETURN_EPS
      ? (portfolioValue * instinct.gap) / 100
      : 0;

  const gapDisplay =
    instinct === null
      ? null
      : Math.abs(instinct.gap) < RETURN_EPS
        ? 0
        : Math.round(instinct.gap * 10) / 10;

  const canAdvanceStep3 = Boolean(pickedChoice);

  const goToStep = useCallback(
    (next: Step) => {
      if (next === 1) {
        lessonXpAwardedRef.current = false;
        setXpAwardError(null);
      }
      setStep(next);
    },
    [],
  );

  useEffect(() => {
    if (step !== 4 || instinct === null || lessonXpAwardedRef.current) return;

    lessonXpAwardedRef.current = true;
    setXpAwardError(null);

    void (async () => {
      try {
        await awardXP(
          LESSON_COMPLETE_XP,
          `Trading School lesson complete: ${lessonTitle}`,
        );
      } catch (e) {
        lessonXpAwardedRef.current = false;
        const msg =
          e instanceof Error ? e.message : "Could not add XP. Try again when signed in.";
        setXpAwardError(msg);
      }
    })();
  }, [step, instinct, awardXP, lessonTitle]);

  return (
    <div className={cn("mx-auto max-w-5xl space-y-8", className)}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <BookOpen className="size-4 shrink-0" />
        <span>
          Step {step} of 4 — {lessonTitle}
        </span>
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>{lessonTitle}</CardTitle>
            <CardDescription>{lessonSubtitle}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-end">
            <Button onClick={() => goToStep(2)} className="gap-2">
              Continue <ArrowRight className="size-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LineChart className="size-5 text-primary" />
              Your portfolio at the lesson date
            </CardTitle>
            <CardDescription>
              {portfolioLoading
                ? "Loading portfolio…"
                : `Approximate portfolio value today: ${usdDetail.format(portfolioValue)}.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => goToStep(1)}>
              Back
            </Button>
            <Button onClick={() => goToStep(3)} className="gap-2">
              Make a choice <ArrowRight className="size-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>What would you have done?</CardTitle>
            <CardDescription>
              Pick the move that feels closest to your instinct — you’ll see
              outcomes next.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {outcomes.map((o) => (
                <Button
                  key={o.choice}
                  variant={
                    pickedChoice === o.choice ? "default" : "outline"
                  }
                  className="h-auto min-h-11 justify-start whitespace-normal px-4 py-3 text-left text-sm"
                  onClick={() => setPickedChoice(o.choice)}
                >
                  {o.choice}
                </Button>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => goToStep(2)}>
                Back
              </Button>
              <Button
                disabled={!canAdvanceStep3}
                onClick={() => goToStep(4)}
                className="gap-2"
              >
                See reveal <ArrowRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="space-y-8"
        >
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              Outcomes by choice
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Side-by-side returns over the lesson horizon (hypothetical).
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {outcomes.map((o) => {
                const isUser = o.choice === effectiveUserChoice;
                const isOptimal =
                  o.choice.trim().toLowerCase() ===
                  optimalChoice.trim().toLowerCase();
                return (
                  <Card
                    key={o.choice}
                    className={cn(
                      "border transition-colors",
                      isOptimal &&
                        "border-primary ring-1 ring-primary/30 bg-primary/5",
                      isUser && !isOptimal && "border-amber-500/50 bg-amber-500/5",
                    )}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium leading-snug">
                        {o.choice}
                      </CardTitle>
                      {isOptimal ? (
                        <span className="text-xs font-semibold text-primary">
                          Optimal
                        </span>
                      ) : null}
                      {isUser ? (
                        <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                          Your pick
                        </span>
                      ) : null}
                    </CardHeader>
                    <CardContent>
                      <p
                        className={cn(
                          "text-2xl font-bold tabular-nums",
                          o.finalReturnPct >= 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400",
                        )}
                      >
                        {formatPercent(o.finalReturnPct)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Hypothetical return
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {xpAwardError && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {xpAwardError}
            </p>
          )}

          {/* Your Instinct Score */}
          {instinct && (
            <Card className="border-primary/25 bg-muted/30">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="size-4 text-primary" />
                  Your Instinct Score
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm leading-relaxed text-foreground">
                <p className="text-muted-foreground">
                  Lesson complete — you earned{" "}
                  <span className="font-semibold text-foreground">
                    +{LESSON_COMPLETE_XP} XP
                  </span>{" "}
                  (shown in the header when you&apos;re signed in).
                </p>
                {instinct.matchedOptimal ? (
                  <p className="font-medium text-green-700 dark:text-green-400">
                    Perfect call — you matched the optimal strategy.
                  </p>
                ) : instinct.gap > 0 && instinct.gap <= 10 ? (
                  <p>
                    Close call. You were{" "}
                    <span className="font-semibold tabular-nums">
                      {formatPercent(Math.abs(gapDisplay))}
                    </span>{" "}
                    off the optimal.
                  </p>
                ) : instinct.gap > 10 ? (
                  <p>
                    Your choice cost you{" "}
                    <span className="font-semibold tabular-nums">
                      {formatPercent(gapDisplay)}
                    </span>{" "}
                    vs. the best move. On your actual portfolio size of{" "}
                    <span className="font-semibold">
                      {usdDetail.format(portfolioValue)}
                    </span>
                    , that&apos;s{" "}
                    <span className="font-semibold text-destructive">
                      {usdDetail.format(dollarImpact)}
                    </span>
                    .
                  </p>
                ) : (
                  /* user beat optimal slightly — treat like perfect per spec bands */
                  <p className="font-medium text-green-700 dark:text-green-400">
                    Perfect call — you matched or beat the optimal strategy.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap justify-between gap-2">
            <Button variant="outline" onClick={() => goToStep(3)}>
              Back to choice
            </Button>
            <Button variant="outline" onClick={() => goToStep(1)}>
              Start over
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
