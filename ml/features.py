"""Feature engineering for XGBoost predictor.

Takes raw price data and computes technical features that XGBoost uses
to predict forward returns and volatility.

Now augmented with FRED macroeconomic indicators:
  - Federal Funds Rate, CPI (YoY inflation), Unemployment
  - 10Y/2Y Treasury yields, Yield curve spread
  - VIX, rate-of-change features
"""

import numpy as np
import pandas as pd

# Lazy import to avoid circular dependency at module load time
_macro_df_cache: pd.DataFrame | None = None


def _get_macro_df() -> pd.DataFrame | None:
    """Lazy-load macro data once. Returns None if FRED unavailable."""
    global _macro_df_cache
    if _macro_df_cache is not None:
        return _macro_df_cache
    try:
        from fred_data import get_macro_features_monthly
        _macro_df_cache = get_macro_features_monthly()
        return _macro_df_cache
    except Exception as e:
        print(f"[Features] FRED macro data unavailable: {e}")
        return None


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Build ML features from a price DataFrame (needs adj_close, volume, high, low)."""
    out = df.copy()

    # Monthly returns at various lookbacks
    for lag in [1, 3, 6, 12]:
        out[f"return_{lag}m"] = out["adj_close"].pct_change(lag)

    # Rolling volatility (std of monthly returns)
    monthly_ret = out["adj_close"].pct_change()
    for window in [3, 6, 12]:
        out[f"vol_{window}m"] = monthly_ret.rolling(window).std()

    # Momentum (price vs moving averages)
    for window in [6, 12]:
        ma = out["adj_close"].rolling(window).mean()
        out[f"momentum_{window}m"] = (out["adj_close"] - ma) / ma

    # Volume trend
    if "volume" in out.columns:
        vol_ma = out["volume"].rolling(6).mean()
        out["volume_trend"] = (out["volume"] - vol_ma) / vol_ma.replace(0, np.nan)

    # High-low range (proxy for intraday volatility)
    if "high" in out.columns and "low" in out.columns:
        out["hl_range"] = (out["high"] - out["low"]) / out["low"].replace(0, np.nan)
        out["hl_range_6m"] = out["hl_range"].rolling(6).mean()

    # Dividend yield proxy
    if "dividend" in out.columns:
        out["div_yield"] = out["dividend"] / out["adj_close"].replace(0, np.nan)
        out["div_yield_12m"] = out["div_yield"].rolling(12).sum()

    # Drawdown from rolling max
    rolling_max = out["adj_close"].cummax()
    out["drawdown"] = (out["adj_close"] - rolling_max) / rolling_max

    # ── FRED Macro Features ──
    macro_df = _get_macro_df()
    if macro_df is not None and len(macro_df) > 0:
        try:
            from fred_data import merge_macro_with_prices
            out = merge_macro_with_prices(out, macro_df)
        except Exception as e:
            print(f"[Features] Could not merge macro data: {e}")

    # Forward return (target) — 1 month ahead
    out["fwd_return_1m"] = out["adj_close"].pct_change().shift(-1)
    # Forward volatility (target) — 3 month ahead std
    out["fwd_vol_3m"] = monthly_ret.rolling(3).std().shift(-1)

    return out


FEATURE_COLS = [
    # Technical features
    "return_1m", "return_3m", "return_6m", "return_12m",
    "vol_3m", "vol_6m", "vol_12m",
    "momentum_6m", "momentum_12m",
    "volume_trend",
    "hl_range_6m",
    "div_yield_12m",
    "drawdown",
    # FRED macro features (gracefully skipped if unavailable)
    "fed_funds_rate",
    "cpi_yoy",
    "unemployment",
    "treasury_10y",
    "treasury_2y",
    "yield_spread",
    "vix",
    "fed_funds_change_3m",
    "vix_ma_3m",
]

FEATURE_DESCRIPTIONS = {
    "return_1m": "Last month's return",
    "return_3m": "3-month return",
    "return_6m": "6-month return",
    "return_12m": "12-month return",
    "vol_3m": "3-month volatility",
    "vol_6m": "6-month volatility",
    "vol_12m": "12-month volatility",
    "momentum_6m": "6-month momentum (price vs average)",
    "momentum_12m": "12-month momentum (price vs average)",
    "volume_trend": "Trading volume trend",
    "hl_range_6m": "Average price swing (high-low range)",
    "div_yield_12m": "12-month dividend yield",
    "drawdown": "Current drawdown from peak",
    # FRED macro descriptions for Gemini explanations
    "fed_funds_rate": "Federal Funds interest rate (set by the Fed)",
    "cpi_yoy": "Year-over-year inflation rate (CPI)",
    "unemployment": "National unemployment rate",
    "treasury_10y": "10-year Treasury bond yield",
    "treasury_2y": "2-year Treasury bond yield",
    "yield_spread": "Yield curve spread (10Y minus 2Y, negative = inverted)",
    "vix": "Market fear index (VIX)",
    "fed_funds_change_3m": "Fed rate change over last 3 months",
    "vix_ma_3m": "3-month average VIX level",
}
