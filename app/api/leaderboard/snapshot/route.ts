import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorizeCron(req: Request): boolean {
  const vercelCron = req.headers.get("x-vercel-cron") === "1";
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const secretOk =
    Boolean(process.env.CRON_SECRET) && bearer === process.env.CRON_SECRET;
  return vercelCron || secretOk;
}

async function runSnapshot() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return NextResponse.json(
      {
        error:
          "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
      },
      { status: 500 },
    );
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false },
  });

  const { data: rows, error } = await supabase
    .from("user_xp")
    .select("user_id, total_xp")
    .order("total_xp", { ascending: false })
    .order("user_id", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const list = rows ?? [];
  const snapshotDate = new Date().toISOString().slice(0, 10);

  const payloads = list.map((r, i) => ({
    user_id: r.user_id as string,
    rank: i + 1,
    total_xp: Number(r.total_xp),
    snapshot_date: snapshotDate,
  }));

  if (payloads.length === 0) {
    return NextResponse.json({
      ok: true,
      snapshotDate,
      inserted: 0,
      message: "No user_xp rows",
    });
  }

  const { error: upsertErr } = await supabase
    .from("leaderboard_snapshots")
    .upsert(payloads, { onConflict: "user_id,snapshot_date" });

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    snapshotDate,
    inserted: payloads.length,
  });
}

/**
 * GET — Vercel Cron invokes scheduled routes with GET (+ x-vercel-cron).
 * POST — manual trigger with Authorization: Bearer CRON_SECRET.
 */
export async function GET(req: Request) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runSnapshot();
}

export async function POST(req: Request) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runSnapshot();
}
