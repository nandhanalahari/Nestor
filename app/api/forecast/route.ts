import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ML_API = process.env.ML_API_URL || "http://127.0.0.1:8000";

function getSupabase(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    "";
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabase = getSupabase(token);
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  let body: { tickers?: string[]; days?: number } = {};
  try {
    body = await req.json();
  } catch {
    // Use user's holdings if no tickers supplied
  }

  let tickers = body.tickers ?? [];
  if (tickers.length === 0) {
    const { data: holdings } = await supabase
      .from("holdings")
      .select("ticker")
      .eq("user_id", user.id);
    tickers = (holdings ?? [])
      .map((h: { ticker: string }) => h.ticker)
      .filter(Boolean);
  }

  if (tickers.length === 0) {
    return NextResponse.json({ predictions: {}, errors: [] });
  }

  try {
    const mlRes = await fetch(`${ML_API}/forecast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tickers, days: body.days ?? 30 }),
      signal: AbortSignal.timeout(180_000),
    });

    if (!mlRes.ok) {
      const text = await mlRes.text();
      return NextResponse.json(
        { error: `ML server error: ${text}` },
        { status: 503 },
      );
    }

    const data = await mlRes.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `LSTM forecast unavailable: ${err.message}. Make sure the Python ML server is running.`
            : "LSTM forecast unavailable",
        predictions: {},
        errors: [],
      },
      { status: 503 },
    );
  }
}
