import "server-only";
import type { ResolvedCustomScenario } from "./types";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MIN_SPAN_DAYS = 60;
const MAX_SPAN_DAYS = 620;

function parseIsoUtc(s: string): Date {
  const d = new Date(`${s}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${s}`);
  return d;
}

/** Validates Gemini output for custom historical scenarios. */
export function assertValidResolvedCustomScenario(r: ResolvedCustomScenario): void {
  for (const [key, val] of Object.entries({
    title: r.title,
    eventName: r.eventName,
    marketStory: r.marketStory,
    windowStart: r.windowStart,
    windowEnd: r.windowEnd,
  })) {
    if (typeof val !== "string" || !val.trim()) {
      throw new Error(`Custom scenario is missing "${key}".`);
    }
  }

  if (!Number.isFinite(r.year) || r.year < 1920 || r.year > new Date().getUTCFullYear()) {
    throw new Error("Custom scenario must include a plausible historical year.");
  }

  if (!ISO.test(r.windowStart) || !ISO.test(r.windowEnd)) {
    throw new Error("Window dates must be YYYY-MM-DD.");
  }

  const start = parseIsoUtc(r.windowStart);
  const end = parseIsoUtc(r.windowEnd);
  if (start >= end) {
    throw new Error("Scenario window: start must be before end.");
  }

  const spanDays = (end.getTime() - start.getTime()) / 86_400_000;
  if (spanDays < MIN_SPAN_DAYS) {
    throw new Error("Scenario window must span at least about two months.");
  }
  if (spanDays > MAX_SPAN_DAYS) {
    throw new Error("Scenario window must be at most about twenty months.");
  }

  const todayEnd = new Date();
  todayEnd.setUTCHours(23, 59, 59, 999);
  if (end.getTime() >= todayEnd.getTime()) {
    throw new Error("Scenario window must end in the past.");
  }

  const yStart = start.getUTCFullYear();
  const yEnd = end.getUTCFullYear();
  if (r.year < yStart - 1 || r.year > yEnd + 1) {
    throw new Error("Listed year does not match the resolved date window.");
  }
}
