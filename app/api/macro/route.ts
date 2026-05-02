import { NextResponse } from "next/server";

const ML_API = process.env.ML_API_URL || "http://127.0.0.1:8000";

export async function GET() {
  try {
    const res = await fetch(`${ML_API}/macro`, {
      next: { revalidate: 600 }, // Cache for 10 minutes
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `ML pipeline error: ${text}` },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Could not reach ML pipeline for macro data",
      },
      { status: 503 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const res = await fetch(`${ML_API}/macro/series`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `ML pipeline error: ${text}` },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Could not reach ML pipeline for series data",
      },
      { status: 503 },
    );
  }
}
