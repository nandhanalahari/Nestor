export type FeeTrade = {
  ticker: string;
  tradedValue: number;
  category?: string | null;
};

export type FeeEstimate = {
  commission: number;
  spreadSlippage: number;
  totalCost: number;
  totalTradedValue: number;
};

const SPREAD_SLIPPAGE_RATE = 0.0005;

function isMutualFund(category?: string | null) {
  return (category ?? "").toLowerCase() === "mutual fund";
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function estimateTradeFees(trades: FeeTrade[]): FeeEstimate {
  const totalTradedValue = trades.reduce(
    (sum, trade) => sum + Math.abs(Number(trade.tradedValue) || 0),
    0,
  );
  const spreadSlippage = trades.reduce((sum, trade) => {
    if (isMutualFund(trade.category)) return sum;
    return sum + Math.abs(Number(trade.tradedValue) || 0) * SPREAD_SLIPPAGE_RATE;
  }, 0);

  return {
    commission: 0,
    spreadSlippage: roundMoney(spreadSlippage),
    totalCost: roundMoney(spreadSlippage),
    totalTradedValue: roundMoney(totalTradedValue),
  };
}
