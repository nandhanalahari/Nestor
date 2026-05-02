import { NextResponse } from "next/server";

import { mlRiskScores } from "@/lib/mlClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RiskHolding = {
  ticker: string;
  name: string;
  category: string;
  weight: number;
};

/** POST body: { holdings: [{ ticker, name, category, weight }] } — weight = dollars or any positive scale (normalized server-side). */
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const holdings = (body as { holdings?: unknown }).holdings;
  if (!Array.isArray(holdings) || holdings.length === 0) {
    return NextResponse.json(
      { error: "holdings array with at least one row is required" },
      { status: 400 },
    );
  }

  const normalized: RiskHolding[] = [];
  for (const h of holdings) {
    if (!h || typeof h !== "object") continue;
    const o = h as Record<string, unknown>;
    const ticker = typeof o.ticker === "string" ? o.ticker.trim() : "";
    const name = typeof o.name === "string" ? o.name.trim() : "";
    const category = typeof o.category === "string" ? o.category : "Stock";
    const weight = typeof o.weight === "number" && Number.isFinite(o.weight) ? o.weight : 0;
    if (!ticker) continue;
    normalized.push({
      ticker: ticker.toUpperCase(),
      name: name || ticker,
      category,
      weight: Math.max(0, weight),
    });
  }

  if (normalized.length === 0) {
    return NextResponse.json({ error: "No valid holdings to score" }, { status: 400 });
  }

  try {
    const data = (await mlRiskScores({ holdings: normalized })) as {
      risk_scores?: Record<string, unknown>;
    };
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ML risk service unavailable";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
