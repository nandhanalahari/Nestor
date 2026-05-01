import { NextResponse } from "next/server";
import { explainRebalancing } from "@/lib/gemini";
import type { RebalancingResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: {
    result?: RebalancingResult;
    scenarioTitle?: string;
    scenarioStory?: string;
    ownerName?: string;
    goalText?: string;
  } = {};

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.result || !body.scenarioTitle || !body.scenarioStory) {
    return NextResponse.json(
      { error: "result, scenarioTitle, and scenarioStory are required." },
      { status: 400 },
    );
  }

  try {
    const explanation = await explainRebalancing({
      ownerName: body.ownerName ?? "Investor",
      scenarioTitle: body.scenarioTitle,
      scenarioStory: body.scenarioStory,
      goalText: body.goalText,
      result: body.result,
    });
    return NextResponse.json({ explanation });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Gemini failed to respond.",
      },
      { status: 500 },
    );
  }
}
