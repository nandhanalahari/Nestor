import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getLiveQuotes } from "@/lib/yahooFinance";
import {
  getStarterPortfolio,
  DEFAULT_SEED_AMOUNT,
} from "@/lib/starterPortfolio";
import type { ProfileLabel } from "@/lib/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  let body: { seed_amount?: number; profile_label?: string } = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    body = {};
  }
  const seedAmount =
    typeof body.seed_amount === "number" && body.seed_amount > 0
      ? body.seed_amount
      : DEFAULT_SEED_AMOUNT;

  // Refuse to seed if the user already has holdings — F9 is empty-state only.
  const { count: existingCount, error: countErr } = await supabase
    .from("holdings")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (countErr) {
    return NextResponse.json({ error: countErr.message }, { status: 500 });
  }
  if ((existingCount ?? 0) > 0) {
    return NextResponse.json(
      { error: "You already have holdings. Starter portfolio is only for empty accounts." },
      { status: 409 },
    );
  }

  // Resolve the profile label. Prefer client-supplied value (from localStorage
  // fallback when the user_profiles migration hasn't been applied yet); fall
  // back to a Supabase lookup. Only the three known labels are accepted.
  const VALID_LABELS: ProfileLabel[] = [
    "Steady Builder",
    "Balanced Climber",
    "Bold Grower",
  ];
  let profileLabel: ProfileLabel | null = null;
  if (
    typeof body.profile_label === "string" &&
    (VALID_LABELS as string[]).includes(body.profile_label)
  ) {
    profileLabel = body.profile_label as ProfileLabel;
  } else {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("profile_label")
      .eq("user_id", user.id)
      .single();
    if (profile && (VALID_LABELS as string[]).includes(profile.profile_label)) {
      profileLabel = profile.profile_label as ProfileLabel;
    }
  }
  if (!profileLabel) {
    return NextResponse.json(
      { error: "Take the risk quiz first to get a personalized starter portfolio." },
      { status: 400 },
    );
  }

  const template = getStarterPortfolio(profileLabel);

  const tickers = template.tickers.map((t) => t.ticker);
  const quotes = await getLiveQuotes(tickers);
  const priceByTicker = new Map(quotes.map((q) => [q.ticker, q.price]));

  type Row = {
    user_id: string;
    ticker: string;
    name: string;
    category: string;
    shares: number;
    cost_basis: number;
  };
  const rows: Row[] = [];
  const skipped: string[] = [];
  for (const t of template.tickers) {
    const price = priceByTicker.get(t.ticker);
    if (!price || price <= 0) {
      skipped.push(t.ticker);
      continue;
    }
    const shares = Math.floor((seedAmount * t.weight) / price);
    if (shares <= 0) {
      skipped.push(t.ticker);
      continue;
    }
    rows.push({
      user_id: user.id,
      ticker: t.ticker,
      name: t.name,
      category: t.category,
      shares,
      cost_basis: shares * price,
    });
  }

  if (rows.length === 0) {
    return NextResponse.json(
      {
        error:
          "Could not fetch live prices for the starter portfolio. Try again in a moment.",
      },
      { status: 502 },
    );
  }

  const { error: insertErr, data: inserted } = await supabase
    .from("holdings")
    .insert(rows)
    .select();
  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({
    profile: profileLabel,
    seedAmount,
    inserted: inserted?.length ?? rows.length,
    skipped,
  });
}
