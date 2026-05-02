"""MVO optimizer — the 'Hands' of the pipeline.

Uses PyPortfolioOpt to run Mean-Variance Optimization. Instead of raw
historical averages, it uses XGBoost-predicted returns and historical
covariance to find optimal portfolios on the Efficient Frontier.
"""

import numpy as np
import pandas as pd
from pypfopt.efficient_frontier import EfficientFrontier
from pypfopt import risk_models, expected_returns, objective_functions

from alpha_vantage import get_monthly_adjusted


def build_price_df(tickers: list[str]) -> pd.DataFrame:
    """Build a DataFrame of adjusted close prices indexed by date (full history)."""
    frames = {}
    for ticker in tickers:
        df = get_monthly_adjusted(ticker)
        series = df.set_index("date")["adj_close"]
        frames[ticker] = series

    prices = pd.DataFrame(frames).dropna()
    return prices


def optimize_portfolio(
    tickers: list[str],
    current_weights: dict[str, float],
    xgb_predictions: dict[str, dict],
) -> dict:
    """
    Run MVO using XGBoost-predicted returns + historical covariance.

    Uses full available history for covariance estimation (more data = more stable).
    XGBoost predictions replace historical expected returns.
    """
    prices = build_price_df(tickers)

    if len(prices) < 6:
        raise RuntimeError("Not enough overlapping price data for optimization")

    # ── Covariance matrix from historical data ──
    cov_matrix = risk_models.sample_cov(prices, frequency=12)

    # ── Expected returns from XGBoost predictions (not historical averages!) ──
    xgb_returns = {}
    for ticker in tickers:
        pred = xgb_predictions.get(ticker, {})
        # XGBoost predictions are monthly %, annualize them
        monthly_ret = pred.get("predicted_return", 0.5) / 100
        xgb_returns[ticker] = monthly_ret * 12  # Annualize

    mu = pd.Series(xgb_returns)

    # ── Minimum Volatility Portfolio ──
    ef_min = EfficientFrontier(mu, cov_matrix, weight_bounds=(0.02, 0.6))
    ef_min.min_volatility()
    min_vol_weights = ef_min.clean_weights()
    min_vol_perf = ef_min.portfolio_performance(verbose=False, risk_free_rate=0.045)

    # ── Maximum Sharpe Portfolio ──
    ef_sharpe = EfficientFrontier(mu, cov_matrix, weight_bounds=(0.02, 0.6))
    ef_sharpe.max_sharpe(risk_free_rate=0.045)
    max_sharpe_weights = ef_sharpe.clean_weights()
    max_sharpe_perf = ef_sharpe.portfolio_performance(verbose=False, risk_free_rate=0.045)

    # ── Current portfolio stats ──
    current_w = np.array([current_weights.get(t, 0) for t in tickers])
    w_sum = current_w.sum()
    if w_sum > 0:
        current_w = current_w / w_sum

    current_return = float(np.dot(current_w, mu.values))
    current_vol = float(np.sqrt(np.dot(current_w.T, np.dot(cov_matrix.values, current_w))))
    current_sharpe = (current_return - 0.045) / current_vol if current_vol > 0 else 0

    # ── Efficient Frontier points ──
    frontier = []
    returns_range = np.linspace(mu.min(), mu.max(), 15)
    for target_ret in returns_range:
        try:
            ef_temp = EfficientFrontier(mu, cov_matrix, weight_bounds=(0.02, 0.6))
            ef_temp.efficient_return(target_ret)
            perf = ef_temp.portfolio_performance(verbose=False, risk_free_rate=0.045)
            frontier.append({
                "expectedReturn": round(perf[0] * 100, 1),
                "volatility": round(perf[1] * 100, 1),
                "sharpe": round(perf[2], 2),
            })
        except Exception:
            continue

    # ── Risk contributions for the optimized portfolio ──
    opt_weights = min_vol_weights
    opt_w = np.array([opt_weights.get(t, 0) for t in tickers])
    marginal_risk = cov_matrix.values @ opt_w
    portfolio_vol = np.sqrt(opt_w.T @ cov_matrix.values @ opt_w)
    risk_contrib = {}
    if portfolio_vol > 0:
        for i, ticker in enumerate(tickers):
            rc = opt_w[i] * marginal_risk[i] / (portfolio_vol ** 2)
            risk_contrib[ticker] = round(rc * 100, 1)

    # ── Max drawdown (from historical prices) ──
    portfolio_prices_current = (prices * pd.Series(current_weights).reindex(prices.columns, fill_value=0)).sum(axis=1)
    portfolio_prices_opt = (prices * pd.Series(opt_weights).reindex(prices.columns, fill_value=0)).sum(axis=1)

    def calc_max_dd(series: pd.Series) -> float:
        peak = series.cummax()
        dd = (series - peak) / peak
        return float(dd.min()) * -1 if len(dd) > 0 else 0

    max_dd_current = calc_max_dd(portfolio_prices_current)
    max_dd_opt = calc_max_dd(portfolio_prices_opt)

    # ── Build action summaries ──
    actions = []
    for ticker in tickers:
        curr_pct = current_weights.get(ticker, 0) * 100
        opt_pct = opt_weights.get(ticker, 0) * 100
        delta = opt_pct - curr_pct
        if abs(delta) < 1:
            continue
        verb = "Add to" if delta > 0 else "Trim"
        actions.append(f"{verb} {ticker}: {curr_pct:.0f}% → {opt_pct:.0f}% ({delta:+.0f} pts)")

    return {
        "min_volatility": {
            "weights": {k: round(v * 100, 1) for k, v in min_vol_weights.items()},
            "expected_return": round(min_vol_perf[0] * 100, 1),
            "volatility": round(min_vol_perf[1] * 100, 1),
            "sharpe": round(min_vol_perf[2], 2),
        },
        "max_sharpe": {
            "weights": {k: round(v * 100, 1) for k, v in max_sharpe_weights.items()},
            "expected_return": round(max_sharpe_perf[0] * 100, 1),
            "volatility": round(max_sharpe_perf[1] * 100, 1),
            "sharpe": round(max_sharpe_perf[2], 2),
        },
        "current": {
            "weights": {t: round(current_weights.get(t, 0) * 100, 1) for t in tickers},
            "expected_return": round(current_return * 100, 1),
            "volatility": round(current_vol * 100, 1),
            "sharpe": round(current_sharpe, 2),
        },
        "efficient_frontier": frontier,
        "risk_contributions": risk_contrib,
        "max_drawdown_current": round(max_dd_current * 100, 1),
        "max_drawdown_optimized": round(max_dd_opt * 100, 1),
        "actions": actions,
        "method": "XGBoost predictions → PyPortfolioOpt MVO (Efficient Frontier)",
    }
