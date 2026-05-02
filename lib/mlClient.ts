import "server-only";

import { spawnSync } from "child_process";
import path from "path";

/** Use separate FastAPI only when ML_API_URL is http(s). Omit or set `inline` to run Python from Next. */
export function useRemoteMlHttp(): boolean {
  const u = process.env.ML_API_URL?.trim();
  if (!u || u.toLowerCase() === "inline") return false;
  return /^https?:\/\//i.test(u);
}

export function getRemoteMlBase(): string {
  return (process.env.ML_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
}

export class MlBridgeError extends Error {
  constructor(
    message: string,
    public status: number = 502,
  ) {
    super(message);
    this.name = "MlBridgeError";
  }
}

type BridgeOk<T> = { ok: true; data: T };
type BridgeErr = { ok: false; error: string; status?: number };

function runPythonBridge<T>(op: string, payload?: unknown): T {
  const mlDir = path.join(process.cwd(), "ml");
  const script = path.join(mlDir, "bridge.py");
  const python = process.env.PYTHON_BIN || "python3";
  const stdin =
    payload !== undefined ? JSON.stringify({ op, payload }) : JSON.stringify({ op });

  const r = spawnSync(python, [script], {
    cwd: mlDir,
    input: stdin,
    encoding: "utf-8",
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, PYTHONUNBUFFERED: "1" },
    timeout: 180_000,
  });

  if (r.signal) {
    throw new MlBridgeError(`ML process ${r.signal}`, 502);
  }
  if (r.error) {
    throw new MlBridgeError(
      `${r.error.message}. Is Python installed? Try PYTHON_BIN=python3`,
      502,
    );
  }

  const out = r.stdout?.trim() || "";
  if (!out) {
    throw new MlBridgeError(r.stderr?.slice(0, 500) || "ML bridge returned no output", 502);
  }

  let parsed: BridgeOk<T> | BridgeErr;
  try {
    parsed = JSON.parse(out) as BridgeOk<T> | BridgeErr;
  } catch {
    throw new MlBridgeError(out.slice(0, 800), 502);
  }

  if (!parsed.ok) {
    throw new MlBridgeError(parsed.error, parsed.status ?? 502);
  }
  return parsed.data;
}

async function fetchRemote(
  path: string,
  init: RequestInit,
  retries: number,
): Promise<Response> {
  const base = getRemoteMlBase();
  let last: Error | null = null;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(`${base}${path}`, init);
      return res;
    } catch (e) {
      last = e instanceof Error ? e : new Error(String(e));
      if (i < retries) await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw last ?? new MlBridgeError("ML request failed");
}

export async function mlAnalyze(body: object): Promise<unknown> {
  if (useRemoteMlHttp()) {
    const res = await fetchRemote(
      "/analyze",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(90_000),
      },
      2,
    );
    if (!res.ok) {
      throw new MlBridgeError(await res.text(), res.status);
    }
    return res.json();
  }
  return runPythonBridge("analyze", body);
}

export async function mlRiskScores(holdingsPayload: { holdings: unknown[] }): Promise<unknown> {
  if (useRemoteMlHttp()) {
    let res = await fetch(`${getRemoteMlBase()}/risk-scores`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(holdingsPayload),
      signal: AbortSignal.timeout(120_000),
    });
    if (res.status === 404) {
      res = await fetch(`${getRemoteMlBase()}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...holdingsPayload, scenario_id: "market-drop" }),
        signal: AbortSignal.timeout(120_000),
      });
    }
    if (!res.ok) {
      throw new MlBridgeError(await res.text(), res.status);
    }
    return res.json();
  }
  return runPythonBridge("risk_scores", holdingsPayload);
}

export async function mlMacro(): Promise<unknown> {
  if (useRemoteMlHttp()) {
    const res = await fetch(`${getRemoteMlBase()}/macro`, {
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      throw new MlBridgeError(await res.text(), res.status);
    }
    return res.json();
  }
  return runPythonBridge("macro");
}

export async function mlMacroSeries(body: object): Promise<unknown> {
  if (useRemoteMlHttp()) {
    const res = await fetch(`${getRemoteMlBase()}/macro/series`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      throw new MlBridgeError(await res.text(), res.status);
    }
    return res.json();
  }
  return runPythonBridge("macro_series", body);
}
