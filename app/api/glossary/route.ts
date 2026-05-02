import { NextResponse } from "next/server";

import { explainGlossaryTerm } from "@/lib/gemini";
import {
  getSeedGlossaryExplanation,
  normalizeGlossaryTerm,
} from "@/lib/glossary-seed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cache = new Map<string, { explanation: string; expiresAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  let body: { term?: unknown; context?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const term = typeof body.term === "string" ? body.term.trim() : "";
  const context = typeof body.context === "string" ? body.context.trim() : "";

  if (!term || term.length > 80) {
    return NextResponse.json(
      { error: "term is required and must be 80 characters or fewer" },
      { status: 400 },
    );
  }

  const key = normalizeGlossaryTerm(term);
  const seeded = getSeedGlossaryExplanation(key);
  if (seeded) {
    return NextResponse.json({ explanation: seeded, source: "seed" });
  }

  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) {
    return NextResponse.json({
      explanation: cached.explanation,
      source: "cache",
    });
  }

  try {
    const explanation = await explainGlossaryTerm(
      term,
      context.slice(0, 240) || undefined,
    );
    cache.set(key, {
      explanation,
      expiresAt: now + CACHE_TTL_MS,
    });
    return NextResponse.json({ explanation, source: "gemini" });
  } catch (error) {
    console.error("[POST /api/glossary]", error);
    return NextResponse.json(
      {
        explanation:
          "This is an investing term. Try again in a moment for a plain-English explanation.",
        source: "fallback",
      },
      { status: 200 },
    );
  }
}
