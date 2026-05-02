import type { ProfileLabel } from "./profile";

export const DEFAULT_MONTHLY_CONTRIBUTION = 200;

export const ANNUAL_RETURN_BY_PROFILE: Record<ProfileLabel, number> = {
  "Steady Builder": 0.05,
  "Balanced Climber": 0.07,
  "Bold Grower": 0.09,
};

export type ProjectionInput = {
  principal: number;
  targetAmount: number;
  monthlyContribution?: number | null;
  profileLabel?: ProfileLabel | null;
};

export function getAnnualReturn(profileLabel?: ProfileLabel | null): number {
  if (!profileLabel) return ANNUAL_RETURN_BY_PROFILE["Balanced Climber"];
  return (
    ANNUAL_RETURN_BY_PROFILE[profileLabel] ??
    ANNUAL_RETURN_BY_PROFILE["Balanced Climber"]
  );
}

export function getMonthlyContribution(
  monthlyContribution?: number | null,
): number {
  const contribution = Number(monthlyContribution);
  return Number.isFinite(contribution) && contribution > 0
    ? contribution
    : DEFAULT_MONTHLY_CONTRIBUTION;
}

export function futureValue({
  principal,
  monthlyContribution,
  annualReturn,
  months,
}: {
  principal: number;
  monthlyContribution: number;
  annualReturn: number;
  months: number;
}): number {
  const monthlyRate = annualReturn / 12;
  const factor = (1 + monthlyRate) ** months;

  if (monthlyRate === 0) {
    return principal + monthlyContribution * months;
  }

  return (
    principal * factor +
    monthlyContribution * ((factor - 1) / monthlyRate)
  );
}

export function monthsToTarget({
  principal,
  targetAmount,
  monthlyContribution,
  profileLabel,
}: ProjectionInput): number | null {
  const target = Number(targetAmount);
  const startingValue = Math.max(0, Number(principal) || 0);
  const contribution = getMonthlyContribution(monthlyContribution);
  const annualReturn = getAnnualReturn(profileLabel);
  const monthlyRate = annualReturn / 12;

  if (!Number.isFinite(target) || target <= 0) return null;
  if (startingValue >= target) return 0;

  if (monthlyRate === 0) {
    return Math.ceil((target - startingValue) / contribution);
  }

  const numerator = target + contribution / monthlyRate;
  const denominator = startingValue + contribution / monthlyRate;
  if (denominator <= 0 || numerator <= denominator) return null;

  return Math.ceil(Math.log(numerator / denominator) / Math.log(1 + monthlyRate));
}

export function monthlyNeededForTargetDate({
  principal,
  targetAmount,
  profileLabel,
  months,
}: {
  principal: number;
  targetAmount: number;
  profileLabel?: ProfileLabel | null;
  months: number;
}): number | null {
  const target = Number(targetAmount);
  const startingValue = Math.max(0, Number(principal) || 0);
  const monthCount = Math.max(0, Math.floor(months));
  const annualReturn = getAnnualReturn(profileLabel);
  const monthlyRate = annualReturn / 12;

  if (!Number.isFinite(target) || target <= 0) return null;
  if (startingValue >= target) return 0;
  if (monthCount <= 0) return target - startingValue;

  const factor = (1 + monthlyRate) ** monthCount;
  if (monthlyRate === 0) {
    return Math.max(0, (target - startingValue) / monthCount);
  }

  const needed = ((target - startingValue * factor) * monthlyRate) / (factor - 1);
  return Math.max(0, needed);
}

export function addMonths(date: Date, months: number): Date {
  const projected = new Date(date);
  projected.setMonth(projected.getMonth() + months);
  return projected;
}

export function monthsUntil(date: Date, from = new Date()): number {
  const years = date.getFullYear() - from.getFullYear();
  const months = date.getMonth() - from.getMonth();
  const dayAdjustment = date.getDate() < from.getDate() ? -1 : 0;
  return Math.max(0, years * 12 + months + dayAdjustment);
}

export function parseGoalDeadline(deadline?: string | null): Date | null {
  if (!deadline) return null;
  const trimmed = deadline.trim();
  if (!trimmed) return null;

  if (/^\d{4}$/.test(trimmed)) {
    return new Date(Number(trimmed), 11, 31);
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}
