export const GLOSSARY_SEED: Record<string, string> = {
  "sharpe ratio":
    "A Sharpe ratio compares return with risk. Higher usually means the portfolio earned more return for each unit of volatility.",
  drawdown:
    "A drawdown is how far an investment falls from a recent high before it recovers. It helps show the size of a painful dip.",
  volatility:
    "Volatility means how much an investment's price moves up and down. Higher volatility usually means a bumpier ride.",
  allocation:
    "Allocation is how your money is split across investments, such as stocks, bonds, ETFs, or cash.",
  rebalancing:
    "Rebalancing means adjusting your holdings back toward a target mix after market moves have shifted them.",
  dividend:
    "A dividend is cash a company pays to shareholders, usually from profits.",
  etf:
    "An ETF is a basket of investments that trades like a stock. It can give you diversified exposure with one ticker.",
  "mutual fund":
    "A mutual fund pools money from many investors to buy a basket of investments, usually priced once per trading day.",
  "p/e ratio":
    "A P/E ratio compares a company's stock price with its earnings. It is one quick way to judge how expensive a stock looks.",
  "market cap":
    "Market cap is the total value of a company in the stock market: share price multiplied by shares outstanding.",
  beta:
    "Beta estimates how much a stock tends to move compared with the overall market. A beta above 1 usually means bigger swings.",
  alpha:
    "Alpha is return above what a benchmark or risk model would expect. Positive alpha means an investment beat that yardstick.",
  "expense ratio":
    "An expense ratio is the yearly fee a fund charges, shown as a percent of your invested money.",
  "capital gain":
    "A capital gain is profit from selling an investment for more than you paid.",
  "dollar-cost averaging":
    "Dollar-cost averaging means investing a fixed amount on a regular schedule, which spreads purchases across different prices.",
  hedging:
    "Hedging means adding an investment that may offset losses elsewhere, like insurance for part of a portfolio.",
  liquidity:
    "Liquidity means how quickly you can turn an investment into cash without taking a large price hit.",
  correlation:
    "Correlation measures how similarly two investments move. Lower correlation can help diversification.",
  diversification:
    "Diversification means spreading money across different investments so one bad result does not dominate your portfolio.",
  bond:
    "A bond is a loan to a company or government. Investors usually receive interest and get principal back if the borrower pays.",
  yield:
    "Yield is income from an investment, such as interest or dividends, shown as a percentage of its price.",
  inflation:
    "Inflation means prices are rising over time, which reduces what each dollar can buy.",
  stagflation:
    "Stagflation is weak economic growth plus high inflation. It is difficult because prices rise while the economy feels slow.",
  recession:
    "A recession is a meaningful economic slowdown, often with weaker spending, profits, and hiring.",
  "bull market":
    "A bull market is a period when prices are generally rising and investor confidence is strong.",
  "bear market":
    "A bear market is a period when prices fall sharply, often defined as a drop of 20% or more from recent highs.",
  "efficient frontier":
    "The efficient frontier is the set of portfolios that offer the best expected return for each level of risk.",
  "feature importance":
    "Feature importance shows which inputs had the biggest influence on a model's prediction.",
  "expected return":
    "Expected return is an estimate of how much an investment might gain or lose over a future period.",
  rmse:
    "RMSE is a model error score. Lower usually means the model's predictions were closer to actual results.",
  xgboost:
    "XGBoost is a machine-learning model that looks for patterns in data to make predictions.",
  lstm:
    "LSTM is a machine-learning model that looks at sequences, such as price history over time, to make a forecast.",
  "risk contribution":
    "Risk contribution estimates how much each holding adds to the overall bumpiness of your portfolio.",
};

export function normalizeGlossaryTerm(term: string): string {
  return term.trim().toLowerCase().replace(/\s+/g, " ");
}

export function getSeedGlossaryExplanation(term: string): string | null {
  return GLOSSARY_SEED[normalizeGlossaryTerm(term)] ?? null;
}
