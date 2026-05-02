"""MVO optimizer — the 'Hands' of the pipeline.

For scenario testing, this uses the SCENARIO-PERIOD historical data:
  - Realized monthly returns during that period → expected returns
  - Realized covariance during that period → covariance matrix
  - MVO finds the optimal portfolio for surviving that scenario

This makes the recommendations actually reflect what would have worked
during the chosen historical crisis (2020 crash, 2008 recession, etc).
"""

import numpy as np
import pandas as pd
from pypfopt.efficient_frontier import EfficientFrontier
from pypfopt import risk_models, expected_returns

from data_source import get_monthly_prices


def build_price_df(
    tickers: list[str],
    window_start: str | None = None,
    window_end: str | None = None,
) -> pd.DataFrame:
    """Build a DataFrame of adjusted close prices indexed by date."""
    frames = {}
    for ticker in tickers:
        df = get_monthly_prices(ticker, start=window_start, end=window_end)
        if len(df) > 0:
            series = df.set_index("date")["adj_close"]
            frames[ticker] = series

    if not frames:
        return pd.DataFrame()

    prices = pd.DataFrame(frames).dropna()
    return prices


def optimize_portfolio(
    tickers: list[str],
    current_weights: dict[str, float],
    xgb_predictions: dict[str, dict] | None = None,
    window_start: str | None = None,
    window_end: str | None = None,
    use_scenario_returns: bool = True,
) -> dict:
    """
    Run MVO using scenario-period covariance + expected returns.

    Args:
        tickers: List of holdings
        current_weights: User's current allocation
        xgb_predictions: Optional XGBoost forecasts (used as fallback if scenario
                         window has too little data)
        window_start, window_end: Scenario time window
        use_scenario_returns: If True, use realized returns from scenario period
                              as expected returns (the whole point of scenario
                              testing). If False, use XGBoost predictions.
    """
    # Get full history first for context
    full_prices = build_price_df(tickers)
    if len(full_prices) < 6:
        raise RuntimeError("Not enough overlapping price data across holdings")

    # Get scenario-window prices for covariance + returns
    if window_start or window_end:
        scenario_prices = build_price_df(tickers, window_start, window_end)
    else:
        scenario_prices = full_prices

    # Use scenario window if it has enough data, otherwise full history
    if len(scenario_prices) >= 6:
        cov_source = scenario_prices
        used_window = True
    else:
        cov_source = full_prices
        used_window = False

    # ── Covariance from scenario period ──
    cov_matrix = risk_models.sample_cov(cov_source, frequency=12)

    # ── Expected returns ──
    if use_scenario_returns and used_window:
        # Use ACTUAL realized returns from the scenario period
        # This is the key insight for scenario testing
        mu = expected_returns.mean_historical_return(cov_source, frequency=12)
        return_source = "scenario-period realized returns"
    elif xgb_predictions:
        # Use XGBoost predictions
        xgb_returns = {}
        for ticker in tickers:
            pred = xgb_predictions.get(ticker, {})
            monthly_ret = pred.get("predicted_return", 0.5) / 100
            xgb_returns[ticker] = monthly_ret * 12
        mu = pd.Series(xgb_returns)
        return_source = "XGBoost predictions"
    else:
        # Fall back to long-history mean returns
        mu = expected_returns.mean_historical_return(full_prices, frequency=12)
        return_source = "long-history mean returns"

    # Align mu to cov_matrix columns
    mu = mu.reindex(cov_matrix.columns).fillna(0)

    # ── Min Volatility Portfolio ──
    ef_min = EfficientFrontier(mu, cov_matrix, weight_bounds=(0.02, 0.6))
    ef_min.min_volatility()
    min_vol_weights = ef_min.clean_weights()
    min_vol_perf = ef_min.portfolio_performance(verbose=False, risk_free_rate=0.045)

    # ── Max Sharpe Portfolio ──
    try:
        ef_sharpe = EfficientFrontier(mu, cov_matrix, weight_bounds=(0.02, 0.6))
        ef_sharpe.max_sharpe(risk_free_rate=0.045)
        max_sharpe_weights = ef_sharpe.clean_weights()
        max_sharpe_perf = ef_sharpe.portfolio_performance(
            verbose=False, risk_free_rate=0.045
        )
    except Exception:
        max_sharpe_weights = min_vol_weights
        max_sharpe_perf = min_vol_perf

    # ── Current portfolio stats during this scenario ──
    current_w = np.array([current_weights.get(t, 0) for t in tickers])
    w_sum = current_w.sum()
    if w_sum > 0:
        current_w = current_w / w_sum

    current_return = float(np.dot(current_w, mu.values))
    current_vol = float(
        np.sqrt(np.dot(current_w.T, np.dot(cov_matrix.values, current_w)))
    )
    current_sharpe = (
        (current_return - 0.045) / current_vol if current_vol > 0 else 0
    )

    # ── Efficient Frontier points ──
    frontier = []
    returns_range = np.linspace(mu.min(), mu.max(), 15)
    for target_ret in returns_range:
        try:
            ef_temp = EfficientFrontier(mu, cov_matrix, weight_bounds=(0.02, 0.6))
            ef_temp.efficient_return(target_ret)
            perf = ef_temp.portfolio_performance(verbose=False, risk_free_rate=0.045)
            frontier.append(
                {
                    "expectedReturn": round(perf[0] * 100, 1),
                    "volatility": round(perf[1] * 100, 1),
                    "sharpe": round(perf[2], 2),
                }
            )
        except Exception:
            continue

    # ── Risk contributions ──
    opt_weights = min_vol_weights
    opt_w = np.array([opt_weights.get(t, 0) for t in tickers])
    marginal_risk = cov_matrix.values @ opt_w
    portfolio_vol = np.sqrt(opt_w.T @ cov_matrix.values @ opt_w)
    risk_contrib = {}
    if portfolio_vol > 0:
        for i, ticker in enumerate(tickers):
            rc = opt_w[i] * marginal_risk[i] / (portfolio_vol**2)
            risk_contrib[ticker] = round(float(rc) * 100, 1)

    # ── Max drawdown using DAILY scenario data for accuracy ──
    daily_scenario = pd.DataFrame()
    if window_start or window_end:
        from data_source import get_daily_prices

        daily_frames = {}
        for ticker in tickers:
            ddf = get_daily_prices(ticker, start=window_start, end=window_end)
            if len(ddf) > 0:
                daily_frames[ticker] = ddf.set_index("date")["adj_close"]
        if daily_frames:
            daily_scenario = pd.DataFrame(daily_frames).dropna()

    if len(daily_scenario) == 0:
        daily_scenario = cov_source

    portfolio_prices_current = (
        daily_scenario
        * pd.Series(current_weights).reindex(daily_scenario.columns, fill_value=0)
    ).sum(axis=1)
    portfolio_prices_opt = (
        daily_scenario
        * pd.Series(opt_weights).reindex(daily_scenario.columns, fill_value=0)
    ).sum(axis=1)

    def calc_max_dd(series: pd.Series) -> float:
        if len(series) == 0:
            return 0.0
        peak = series.cummax()
        dd = (series - peak) / peak.replace(0, np.nan)
        return float(dd.min()) * -1 if len(dd) > 0 and dd.min() < 0 else 0

    max_dd_current = calc_max_dd(portfolio_prices_current)
    max_dd_opt = calc_max_dd(portfolio_prices_opt)

    # ── Scenario-period actual return for current vs optimized ──
    scenario_return_current = 0.0
    scenario_return_opt = 0.0
    if len(portfolio_prices_current) >= 2:
        scenario_return_current = (
            (portfolio_prices_current.iloc[-1] / portfolio_prices_current.iloc[0])
            - 1
        ) * 100
    if len(portfolio_prices_opt) >= 2:
        scenario_return_opt = (
            (portfolio_prices_opt.iloc[-1] / portfolio_prices_opt.iloc[0]) - 1
        ) * 100

    # ── Build action summaries ──
    actions = []
    for ticker in tickers:
        curr_pct = current_weights.get(ticker, 0) * 100
        opt_pct = opt_weights.get(ticker, 0) * 100
        delta = opt_pct - curr_pct
        if abs(delta) < 1:
            continue
        verb = "Add to" if delta > 0 else "Trim"
        actions.append(
            f"{verb} {ticker}: {curr_pct:.0f}% → {opt_pct:.0f}% ({delta:+.0f} pts)"
        )

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
            "weights": {
                t: round(current_weights.get(t, 0) * 100, 1) for t in tickers
            },
            "expected_return": round(current_return * 100, 1),
            "volatility": round(current_vol * 100, 1),
            "sharpe": round(current_sharpe, 2),
        },
        "scenario_actual_return_current": round(scenario_return_current, 1),
        "scenario_actual_return_optimized": round(scenario_return_opt, 1),
        "efficient_frontier": frontier,
        "risk_contributions": risk_contrib,
        "max_drawdown_current": round(max_dd_current * 100, 1),
        "max_drawdown_optimized": round(max_dd_opt * 100, 1),
        "actions": actions,
        "method": (
            f"Scenario-period MVO: {return_source}, "
            f"covariance from {'scenario window' if used_window else 'full history'}"
        ),
        "data_source": "Kaggle dataset + yfinance fallback",
        "scenario_window_used": used_window,
    }
