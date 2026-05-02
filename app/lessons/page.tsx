import { HistoricalLesson } from "@/components/HistoricalLesson";

/** Demo outcomes — replace with `/api/lesson/play` when wired. */
const LESSON_OUTCOMES = [
  { choice: "Sell most", finalReturnPct: -12.4 },
  { choice: "Sell some", finalReturnPct: -3.1 },
  { choice: "Hold", finalReturnPct: 5.2 },
  { choice: "Buy more", finalReturnPct: 14.8 },
] as const;

export default function LessonsPage() {
  return (
    <div className="p-6 md:p-8">
      <HistoricalLesson
        lessonTitle="Market stress lesson"
        lessonSubtitle="Walk through a scripted scenario with your real portfolio context."
        outcomes={[...LESSON_OUTCOMES]}
        optimalChoice="Buy more"
      />
      <p className="mt-8 max-w-2xl text-xs text-muted-foreground">
        Sign in so step 2 and the dollar line in Your Instinct Score use live{" "}
        <code className="rounded bg-muted px-1">GET /api/portfolio</code>{" "}
        <code className="rounded bg-muted px-1">totalValue</code>. On step 3, try{" "}
        <strong>Hold</strong> (close call) vs <strong>Sell most</strong> (larger gap vs optimal).
      </p>
    </div>
  );
}
