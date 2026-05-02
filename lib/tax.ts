export const SHORT_TERM_TAX_RATE = 0.22;
export const LONG_TERM_TAX_RATE = 0.15;
export const LONG_TERM_HOLDING_DAYS = 365;

export type TaxLotInput = {
  ticker: string;
  sharesSold: number;
  sellPrice: number;
  costBasis: number;
  costBasisDate?: string | null;
};

export type TaxPreviewLine = {
  ticker: string;
  sharesSold: number;
  sellPrice: number;
  costBasis: number;
  realizedGain: number;
  holdingPeriod: "short-term" | "long-term";
  taxRate: number;
  estimatedTax: number;
  warning?: string;
};

export type TaxPreview = {
  totalRealizedGain: number;
  estimatedFederalTax: number;
  lines: TaxPreviewLine[];
  warnings: string[];
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function daysBetween(startDate: string, endDate: Date) {
  const dateOnly = startDate.slice(0, 10);
  const start = new Date(`${dateOnly}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return null;

  const end = Date.UTC(
    endDate.getUTCFullYear(),
    endDate.getUTCMonth(),
    endDate.getUTCDate(),
  );
  return Math.floor((end - start.getTime()) / 86_400_000);
}

export function calculateTaxPreview(
  lots: TaxLotInput[],
  asOf: Date = new Date(),
): TaxPreview {
  const lines: TaxPreviewLine[] = [];
  const warnings: string[] = [];

  for (const lot of lots) {
    if (
      lot.sharesSold <= 0 ||
      lot.sellPrice < 0 ||
      lot.costBasis < 0 ||
      !Number.isFinite(lot.sharesSold) ||
      !Number.isFinite(lot.sellPrice) ||
      !Number.isFinite(lot.costBasis)
    ) {
      continue;
    }

    const holdingDays = lot.costBasisDate
      ? daysBetween(lot.costBasisDate, asOf)
      : null;
    const missingDate = holdingDays === null;
    const isLongTerm = missingDate || holdingDays >= LONG_TERM_HOLDING_DAYS;
    const holdingPeriod = isLongTerm ? "long-term" : "short-term";
    const taxRate = isLongTerm ? LONG_TERM_TAX_RATE : SHORT_TERM_TAX_RATE;
    const realizedGain = (lot.sellPrice - lot.costBasis) * lot.sharesSold;
    const warning = missingDate
      ? `${lot.ticker}: missing cost basis date, treated as long-term.`
      : undefined;

    if (warning) warnings.push(warning);

    lines.push({
      ticker: lot.ticker,
      sharesSold: roundMoney(lot.sharesSold),
      sellPrice: roundMoney(lot.sellPrice),
      costBasis: roundMoney(lot.costBasis),
      realizedGain: roundMoney(realizedGain),
      holdingPeriod,
      taxRate,
      estimatedTax: roundMoney(Math.max(0, realizedGain) * taxRate),
      warning,
    });
  }

  return {
    totalRealizedGain: roundMoney(
      lines.reduce((sum, line) => sum + line.realizedGain, 0),
    ),
    estimatedFederalTax: roundMoney(
      lines.reduce((sum, line) => sum + line.estimatedTax, 0),
    ),
    lines,
    warnings,
  };
}
