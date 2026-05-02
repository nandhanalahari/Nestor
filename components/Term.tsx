"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { getSeedGlossaryExplanation } from "@/lib/glossary-seed";
import { cn } from "@/lib/utils";

type TermProps = {
  children: string;
  term?: string;
  context?: string;
  className?: string;
};

type GlossaryState = {
  explanation: string;
  loading: boolean;
  error: string | null;
};

const STORAGE_PREFIX = "nestor_glossary:";

function normalizeTerm(term: string): string {
  return term.trim().toLowerCase().replace(/\s+/g, " ");
}

export function Term({ children, term, context, className }: TermProps) {
  const displayTerm = children;
  const lookupTerm = term ?? children;
  const cacheKey = useMemo(
    () => `${STORAGE_PREFIX}${normalizeTerm(lookupTerm)}`,
    [lookupTerm],
  );
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<GlossaryState>({
    explanation: "",
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!open || state.explanation || state.loading) return;

    const seeded = getSeedGlossaryExplanation(lookupTerm);
    if (seeded) {
      window.localStorage.setItem(cacheKey, seeded);
      setState({ explanation: seeded, loading: false, error: null });
      return;
    }

    const cached = window.localStorage.getItem(cacheKey);
    if (cached) {
      setState({ explanation: cached, loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState({ explanation: "", loading: true, error: null });

    fetch("/api/glossary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ term: lookupTerm, context }),
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          explanation?: string;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Could not explain term");
        return data.explanation ?? "";
      })
      .then((explanation) => {
        if (cancelled) return;
        if (explanation) window.localStorage.setItem(cacheKey, explanation);
        setState({ explanation, loading: false, error: null });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          explanation: "",
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "Could not explain this term",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, context, lookupTerm, open, state.explanation, state.loading]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline cursor-help border-0 border-b border-dotted border-primary bg-transparent p-0 align-baseline font-bold text-primary underline-offset-2 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            className,
          )}
        >
          {displayTerm}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-80">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">
              {lookupTerm}
            </p>
            {state.loading ? (
              <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
            ) : null}
          </div>
          {state.loading ? (
            <div className="space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          ) : state.error ? (
            <p className="text-xs leading-relaxed text-destructive">
              {state.error}
            </p>
          ) : (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {state.explanation || "Tap to load a plain-English explanation."}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
