"use client";

import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";

import { HistoricalLesson } from "@/components/HistoricalLesson";
import { TheoryLesson, type TheoryDifficulty } from "@/components/TheoryLesson";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ALL_LESSONS,
  HISTORICAL_LESSONS,
  THEORY_LESSONS,
  type Lesson,
} from "@/lib/lessons";

type DifficultyFilter = "All" | TheoryDifficulty;

const DIFFICULTY_FILTERS: DifficultyFilter[] = [
  "All",
  "Beginner",
  "Intermediate",
  "Advanced",
];

const DIFFICULTY_BADGE_STYLES: Record<TheoryDifficulty, string> = {
  Beginner: "bg-green-50 text-green-800 border-green-200",
  Intermediate: "bg-amber-50 text-amber-800 border-amber-200",
  Advanced: "bg-rose-50 text-rose-800 border-rose-200",
};

export default function LessonsPage() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<DifficultyFilter>("All");
  const active = ALL_LESSONS.find((l) => l.id === activeId) ?? null;

  const filteredQuizzes = useMemo(() => {
    if (difficulty === "All") return THEORY_LESSONS;
    return THEORY_LESSONS.filter((q) => q.difficulty === difficulty);
  }, [difficulty]);

  return (
    <div className="-mx-4 -my-8 min-h-screen bg-[#f9f9fe] px-4 py-10 font-[Inter] text-[#002141] md:-mx-8 md:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="rounded-lg border border-[#e0e0e0] bg-white p-6 shadow-[0_20px_20px_rgba(0,0,0,0.04)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7aa0d6]">
            Education Center
          </p>
          <h1 className="mt-3 font-[Manrope] text-3xl font-bold tracking-tight text-[#002141]">
            Lessons & Practice
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#3f5165]">
            Two ways to learn: historical scenarios let you practice real
            decisions against real market events using your live portfolio,
            while concept quizzes — sorted by difficulty — test the
            fundamentals every investor should know.
          </p>
        </div>

        {active === null ? (
          <div className="space-y-10">
            <section className="space-y-4">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-[Manrope] text-xl font-semibold text-[#002141]">
                  Historical scenarios
                </h2>
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7aa0d6]">
                  {HISTORICAL_LESSONS.length} lessons
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {HISTORICAL_LESSONS.map((lesson) => (
                  <LessonCard
                    key={lesson.id}
                    lesson={lesson}
                    onClick={() => setActiveId(lesson.id)}
                  />
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="font-[Manrope] text-xl font-semibold text-[#002141]">
                  Concept quizzes
                </h2>
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7aa0d6]">
                  {filteredQuizzes.length} of {THEORY_LESSONS.length} lessons
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {DIFFICULTY_FILTERS.map((d) => {
                  const isActive = difficulty === d;
                  return (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-semibold transition",
                        isActive
                          ? "border-[#002141] bg-[#002141] text-white"
                          : "border-[#d7dce5] bg-white text-[#3f5165] hover:border-[#7aa0d6] hover:text-[#003666]",
                      )}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>

              {filteredQuizzes.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#d7dce5] bg-white p-8 text-center text-sm text-[#3f5165]">
                  No quizzes at this difficulty yet.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredQuizzes.map((lesson) => (
                    <LessonCard
                      key={lesson.id}
                      lesson={lesson}
                      onClick={() => setActiveId(lesson.id)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="space-y-4">
            <Button
              variant="outline"
              onClick={() => setActiveId(null)}
              className="gap-2 border-[#d7dce5] bg-white text-[#002141] hover:bg-[#eef4fb]"
            >
              <ArrowLeft className="size-4" />
              All lessons
            </Button>
            {active.kind === "historical" ? (
              <HistoricalLesson
                key={active.id}
                lessonTitle={`${active.era} — ${active.title}`}
                lessonSubtitle={active.blurb}
                scenarioContext={active.scenarioContext}
                outcomes={active.outcomes}
                optimalChoice={active.optimalChoice}
                keyTakeaway={active.keyTakeaway}
              />
            ) : (
              <TheoryLesson
                key={active.id}
                lessonTitle={active.title}
                lessonSubtitle={active.blurb}
                difficulty={active.difficulty}
                questions={active.questions}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function LessonCard({
  lesson,
  onClick,
}: {
  lesson: Lesson;
  onClick: () => void;
}) {
  const isTheory = lesson.kind === "theory";
  const ctaLabel = isTheory ? "Start quiz →" : "Start lesson →";
  return (
    <button
      onClick={onClick}
      className={cn(
        "group flex flex-col gap-3 rounded-lg border border-[#e0e0e0] bg-white p-5 text-left",
        "shadow-[0_20px_20px_rgba(0,0,0,0.04)] transition hover:border-[#7aa0d6] hover:bg-[#eef4fb]",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7aa0d6]">
          {lesson.era}
        </span>
        {isTheory ? (
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              DIFFICULTY_BADGE_STYLES[lesson.difficulty],
            )}
          >
            {lesson.difficulty}
          </span>
        ) : (
          <span className="rounded-full border border-[#7aa0d6] bg-[#eef4fb] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#003666]">
            Scenario
          </span>
        )}
      </div>
      <h3 className="font-[Manrope] text-lg font-semibold text-[#002141]">
        {lesson.title}
      </h3>
      <p className="text-sm leading-6 text-[#3f5165]">{lesson.subtitle}</p>
      {isTheory ? (
        <p className="text-xs text-[#7aa0d6]">
          {lesson.questions.length} questions
        </p>
      ) : null}
      <span className="mt-auto text-sm font-semibold text-[#003666] group-hover:underline">
        {ctaLabel}
      </span>
    </button>
  );
}
