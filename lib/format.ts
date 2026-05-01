export const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export const usdDetail = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export function formatPercent(value: number, fractionDigits = 1) {
  return `${value >= 0 ? "" : "−"}${Math.abs(value).toFixed(fractionDigits)}%`;
}

export function formatDelta(value: number) {
  const formatted = value.toFixed(1);
  if (value > 0) return `+${formatted}%`;
  if (value < 0) return `${formatted}%`;
  return `0.0%`;
}
