import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runScenario } from "@/lib/scenario";
import type { Holding, ScenarioId } from "@/lib/types";

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
  let body: { scenarioId?: ScenarioId } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.scenarioId) {
    return NextResponse.json(
      { error: "scenarioId is required." },
      { status: 400 },
    );
  }

  let holdings: Holding[] | undefined;

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (token) {
    try {
      const supabase = getSupabase(token);
      const {
        data: { user },
      } = await supabase.auth.getUser(token);

      if (user) {
        const { data: dbHoldings } = await supabase
          .from("holdings")
          .select("*")
          .eq("user_id", user.id);

        if (dbHoldings && dbHoldings.length > 0) {
          const totalCost = dbHoldings.reduce(
            (s: number, h: { cost_basis: number }) => s + Number(h.cost_basis),
            0,
          );
          holdings = dbHoldings.map(
            (h: {
              ticker: string;
              name: string;
              category: string;
              cost_basis: number;
            }) => ({
              ticker: h.ticker,
              name: h.name,
              category: h.category as Holding["category"],
              amount: Number(h.cost_basis),
              weight: totalCost > 0 ? Number(h.cost_basis) / totalCost : 0,
            }),
          );
        }
      }
    } catch {
      // Fall through to run without holdings
    }
  }

  try {
    const bundle = await runScenario(body.scenarioId, holdings);
    return NextResponse.json(bundle);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Scenario engine failed to respond.",
      },
      { status: 500 },
    );
  }
}
