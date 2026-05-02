"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, CheckCircle2, RotateCcw, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type TheoryQuestion = {
  prompt: string;
  options: string[];
  /** Index into `options` of the correct choice. */
  correctIndex: number;
  explanation: string;
};

export type TheoryDifficulty = "Beginner" | "Intermediate" | "Advanced";

export type TheoryLessonProps = {
  lessonTitle: string;
  lessonSubtitle: string;
  difficulty?: TheoryDifficulty;
  questions: TheoryQuestion[];
  className?: string;
};

const DIFFICULTY_STYLES: Record<TheoryDifficulty, string> = {
  Beginner: "bg-green-50 text-green-800 border-green-200",
  Intermediate: "bg-amber-50 text-amber-800 border-amber-200",
  Advanced: "bg-rose-50 text-rose-800 border-rose-200",
};

export function TheoryLesson({
  lessonTitle,
  lessonSubtitle,
  difficulty,
  questions,
  className,
}: TheoryLessonProps) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [done, setDone] = useState(false);

  const total = questions.length;
  const current = questions[index];
  const isCorrect = picked !== null && picked === current?.correctIndex;
  const score = useMemo(
    () =>
      answers.reduce(
        (n, ans, i) => n + (ans === questions[i]?.correctIndex ? 1 : 0),
        0,
      ),
    [answers, questions],
  );

  const handleNext = () => {
    if (picked === null) return;
    const nextAnswers = [...answers, picked];
    setAnswers(nextAnswers);
    setPicked(null);
    if (index + 1 >= total) {
      setDone(true);
    } else {
      setIndex(index + 1);
    }
  };

  const handleRestart = () => {
    setIndex(0);
    setPicked(null);
    setAnswers([]);
    setDone(false);
  };

  if (done) {
    const finalScore = score;
    const pct = Math.round((finalScore / total) * 100);
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className={cn(
          "mx-auto max-w-6xl space-y-6 font-[Inter] text-[#002141]",
          className,
        )}
      >
        <div className="flex items-center gap-2 text-sm font-medium text-[#3f5165]">
          <BookOpen className="size-4 shrink-0 text-[#7aa0d6]" />
          <span>Lesson complete — {lessonTitle}</span>
        </div>

        <Card className="border-[#f7e382] bg-[#fffbe8] shadow-[0_20px_20px_rgba(0,0,0,0.04)]">
          <CardHeader>
            <CardTitle className="font-[Manrope] text-2xl text-[#002141]">
              You scored {finalScore} / {total} ({pct}%)
            </CardTitle>
            <CardDescription className="text-[#3f5165]">
              {pct === 100
                ? "Perfect — you've nailed the fundamentals. +50 XP"
                : pct >= 70
                  ? "Solid — review the misses below to lock it in. +25 XP"
                  : "Worth another pass — concepts compound when you revisit them."}
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="space-y-3">
          {questions.map((q, i) => {
            const ans = answers[i];
            const right = ans === q.correctIndex;
            return (
              <Card
                key={i}
                className="border-[#e0e0e0] bg-white shadow-[0_20px_20px_rgba(0,0,0,0.04)]"
              >
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-start gap-2 font-[Manrope] text-sm font-semibold text-[#002141]">
                    {right ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" />
                    ) : (
                      <XCircle className="mt-0.5 size-4 shrink-0 text-red-600" />
                    )}
                    <span>
                      {i + 1}. {q.prompt}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-[#3f5165]">
                  {!right && ans !== undefined && (
                    <p>
                      <span className="font-semibold text-red-600">Your answer:</span>{" "}
                      {q.options[ans]}
                    </p>
                  )}
                  <p>
                    <span className="font-semibold text-green-700">Correct:</span>{" "}
                    {q.options[q.correctIndex]}
                  </p>
                  <p className="pt-1 leading-6 text-[#002141]">{q.explanation}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={handleRestart}
            className="gap-2 border-[#d7dce5] bg-white text-[#002141] hover:bg-[#eef4fb]"
          >
            <RotateCcw className="size-4" />
            Try again
          </Button>
        </div>
      </motion.div>
    );
  }

  if (!current) return null;

  return (
    <div
      className={cn(
        "mx-auto max-w-6xl space-y-6 font-[Inter] text-[#002141]",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium text-[#3f5165]">
        <span className="flex items-center gap-2">
          <BookOpen className="size-4 shrink-0 text-[#7aa0d6]" />
          Question {index + 1} of {total} — {lessonTitle}
          {difficulty ? (
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                DIFFICULTY_STYLES[difficulty],
              )}
            >
              {difficulty}
            </span>
          ) : null}
        </span>
        <span className="tabular-nums text-xs text-[#7aa0d6]">
          Score so far: {score}/{answers.length}
        </span>
      </div>

      <Card className="border-[#e0e0e0] bg-white shadow-[0_20px_20px_rgba(0,0,0,0.04)]">
        <CardHeader>
          <CardTitle className="font-[Manrope] text-[#002141]">
            {current.prompt}
          </CardTitle>
          <CardDescription className="text-[#3f5165]">
            {lessonSubtitle}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            {current.options.map((opt, i) => {
              const selected = picked === i;
              const reveal = picked !== null;
              const correct = i === current.correctIndex;
              return (
                <Button
                  key={i}
                  variant={selected ? "default" : "outline"}
                  disabled={reveal}
                  onClick={() => setPicked(i)}
                  className={cn(
                    "h-auto min-h-11 justify-start whitespace-normal px-4 py-3 text-left text-sm",
                    !reveal && !selected &&
                      "border-[#d7dce5] bg-white text-[#002141] hover:bg-[#eef4fb] hover:text-[#003666]",
                    !reveal && selected &&
                      "bg-[#002141] text-white hover:bg-[#003666]",
                    reveal && correct &&
                      "border-green-600 bg-green-50 text-green-900 disabled:opacity-100",
                    reveal && selected && !correct &&
                      "border-red-500 bg-red-50 text-red-900 disabled:opacity-100",
                    reveal && !selected && !correct &&
                      "border-[#e0e0e0] bg-white text-[#3f5165] disabled:opacity-70",
                  )}
                >
                  {opt}
                </Button>
              );
            })}
          </div>

          {picked !== null && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={cn(
                "rounded-md border p-3 text-sm leading-6",
                isCorrect
                  ? "border-green-200 bg-green-50 text-green-900"
                  : "border-amber-200 bg-amber-50 text-amber-900",
              )}
            >
              <p className="font-semibold">
                {isCorrect ? "Correct." : "Not quite."}
              </p>
              <p className="mt-1">{current.explanation}</p>
            </motion.div>
          )}

          <div className="flex justify-end">
            <Button
              disabled={picked === null}
              onClick={handleNext}
              className="gap-2 bg-[#002141] text-white hover:bg-[#003666]"
            >
              {index + 1 >= total ? "See results" : "Next question"}
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
