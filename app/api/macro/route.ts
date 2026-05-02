import { NextResponse } from "next/server";

import { MlBridgeError, mlMacro, mlMacroSeries } from "@/lib/mlClient";

export async function GET() {
  try {
    const data = await mlMacro();
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof MlBridgeError ? e.message : e instanceof Error ? e.message : "Macro unavailable";
    return NextResponse.json({ error: msg }, { status: e instanceof MlBridgeError ? e.status : 503 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = await mlMacroSeries(body);
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof MlBridgeError ? e.message : e instanceof Error ? e.message : "Series unavailable";
    return NextResponse.json({ error: msg }, { status: e instanceof MlBridgeError ? e.status : 503 });
  }
}
