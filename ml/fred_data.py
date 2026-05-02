"""FRED (Federal Reserve Economic Data) API integration.

Fetches macroeconomic indicators that improve XGBoost predictions:
  - Federal Funds Rate (DFF) → interest rate environment
  - CPI (CPIAUCSL) → inflation
  - Unemployment Rate (UNRATE) → labor market health
  - GDP (GDP) → economic growth
  - 10-Year Treasury Yield (DGS10) → long-term rates
  - 2-Year Treasury Yield (DGS2) → short-term rates / yield curve
  - VIX (VIXCLS) → market fear / volatility
  - M2 Money Supply (M2SL) → liquidity
  - Consumer Sentiment (UMCSENT) → consumer confidence
  - Industrial Production (INDPRO) → manufacturing health

These macro features give XGBoost context about the broader economy,
not just individual stock technicals.
"""

import os
import time
import requests
import pandas as pd
import numpy as np
from typing import Optional
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(__file__), "..", ".env.local")
load_dotenv(env_path)

FRED_BASE = "https://api.stlouisfed.org/fred"

# In-process cache: series_id → (timestamp, DataFrame)
_fred_cache: dict[str, tuple[float, pd.DataFrame]] = {}
CACHE_TTL = 3600 * 6  # 6 hours — macro data doesn't change often

_last_request_time = 0.0
REQUEST_DELAY = 0.5  # FRED is generous, but let's be polite

# Key FRED series IDs and their descriptions
FRED_SERIES = {
    "DFF":      "Federal Funds Effective Rate",
    "CPIAUCSL": "Consumer Price Index (All Urban)",
    "UNRATE":   "Unemployment Rate",
    "GDP":      "Gross Domestic Product",
    "DGS10":    "10-Year Treasury Yield",
    "DGS2":     "2-Year Treasury Yield",
    "VIXCLS":   "CBOE Volatility Index (VIX)",
    "M2SL":     "M2 Money Supply",
    "UMCSENT":  "Consumer Sentiment (UMich)",
    "INDPRO":   "Industrial Production Index",
}

# Subset that changes frequently enough to be useful as XGBoost features
MACRO_FEATURE_SERIES = ["DFF", "CPIAUCSL", "UNRATE", "DGS10", "DGS2", "VIXCLS"]


def _api_key() -> str:
    key = os.getenv("FRED_API_KEY", "")
    if not key:
        raise ValueError("FRED_API_KEY not set in environment")
    return key


def _fetch_series(
    series_id: str,
    observation_start: Optional[str] = None,
    observation_end: Optional[str] = None,
    limit: int = 10000,
    sort_order: str = "asc",
    frequency: Optional[str] = None,
) -> pd.DataFrame:
    """Fetch observations for a FRED series."""
    global _last_request_time

    cache_key = f"{series_id}:{observation_start}:{observation_end}:{frequency}"
    if cache_key in _fred_cache:
        ts, df = _fred_cache[cache_key]
        if time.time() - ts < CACHE_TTL:
            return df

    # Rate limiting
    now = time.time()
    wait = REQUEST_DELAY - (now - _last_request_time)
    if wait > 0:
        time.sleep(wait)

    params = {
        "series_id": series_id,
        "api_key": _api_key(),
        "file_type": "json",
        "limit": limit,
        "sort_order": sort_order,
    }
    if observation_start:
        params["observation_start"] = observation_start
    if observation_end:
        params["observation_end"] = observation_end
    if frequency:
        params["frequency"] = frequency

    url = f"{FRED_BASE}/series/observations"
    r = requests.get(url, params=params, timeout=30)
    _last_request_time = time.time()
    r.raise_for_status()
    data = r.json()

    if "error_code" in data:
        raise RuntimeError(f"FRED API error: {data.get('error_message', 'Unknown')}")

    observations = data.get("observations", [])
    if not observations:
        return pd.DataFrame(columns=["date", "value"])

    rows = []
    for obs in observations:
        val_str = obs.get("value", ".")
        if val_str == ".":
            continue  # Missing value
        try:
            rows.append({
                "date": pd.Timestamp(obs["date"]),
                "value": float(val_str),
            })
        except (ValueError, KeyError):
            continue

    df = pd.DataFrame(rows)
    if len(df) > 0:
        df = df.sort_values("date").reset_index(drop=True)

    _fred_cache[cache_key] = (time.time(), df)
    return df


def get_series(
    series_id: str,
    start: Optional[str] = None,
    end: Optional[str] = None,
    frequency: Optional[str] = None,
) -> pd.DataFrame:
    """Public interface to fetch a FRED series."""
    return _fetch_series(
        series_id,
        observation_start=start,
        observation_end=end,
        frequency=frequency,
    )


def get_latest_value(series_id: str) -> Optional[float]:
    """Get the most recent observation for a series."""
    df = _fetch_series(series_id, sort_order="desc", limit=1)
    if len(df) == 0:
        return None
    return float(df["value"].iloc[0])


def get_macro_snapshot() -> dict:
    """
    Get a snapshot of all key macroeconomic indicators.
    Returns a dict with series_id → {name, value, date, change_1m}.
    """
    snapshot = {}
    for series_id, name in FRED_SERIES.items():
        try:
            df = _fetch_series(series_id, sort_order="desc", limit=30)
            if len(df) == 0:
                continue

            latest = df.iloc[0]
            value = float(latest["value"])
            date = latest["date"].strftime("%Y-%m-%d")

            # 1-month change (approximate: compare to ~30 obs ago)
            change_1m = None
            if len(df) > 1:
                prev = df.iloc[-1] if len(df) >= 20 else df.iloc[min(len(df) - 1, 5)]
                prev_val = float(prev["value"])
                if prev_val != 0:
                    change_1m = round(((value - prev_val) / abs(prev_val)) * 100, 2)

            snapshot[series_id] = {
                "name": name,
                "value": round(value, 2),
                "date": date,
                "change_1m": change_1m,
            }
        except Exception as e:
            snapshot[series_id] = {
                "name": name,
                "error": str(e),
            }

    # Derived: yield curve spread (10Y - 2Y)
    if "DGS10" in snapshot and "DGS2" in snapshot:
        val_10 = snapshot["DGS10"].get("value")
        val_2 = snapshot["DGS2"].get("value")
        if val_10 is not None and val_2 is not None:
            spread = round(val_10 - val_2, 2)
            snapshot["YIELD_SPREAD"] = {
                "name": "Yield Curve Spread (10Y-2Y)",
                "value": spread,
                "date": snapshot["DGS10"].get("date", ""),
                "change_1m": None,
                "inverted": spread < 0,
            }

    return snapshot


def get_macro_features_monthly(
    start: Optional[str] = None,
    end: Optional[str] = None,
) -> pd.DataFrame:
    """
    Build a monthly DataFrame of macro features for XGBoost.

    Columns: date, fed_funds_rate, cpi_yoy, unemployment, treasury_10y,
             treasury_2y, yield_spread, vix

    The data is resampled to month-end to align with stock monthly data.
    """
    series_map = {
        "DFF": "fed_funds_rate",
        "CPIAUCSL": "cpi",
        "UNRATE": "unemployment",
        "DGS10": "treasury_10y",
        "DGS2": "treasury_2y",
        "VIXCLS": "vix",
    }

    frames = {}
    for series_id, col_name in series_map.items():
        try:
            df = _fetch_series(
                series_id,
                observation_start=start,
                observation_end=end,
                frequency="m",  # Monthly
            )
            if len(df) > 0:
                df = df.set_index("date")
                frames[col_name] = df["value"]
        except Exception:
            continue

    if not frames:
        return pd.DataFrame()

    result = pd.DataFrame(frames)

    # Compute derived features
    if "cpi" in result.columns:
        result["cpi_yoy"] = result["cpi"].pct_change(12) * 100  # Year-over-year CPI

    if "treasury_10y" in result.columns and "treasury_2y" in result.columns:
        result["yield_spread"] = result["treasury_10y"] - result["treasury_2y"]

    # Rate of change features
    if "fed_funds_rate" in result.columns:
        result["fed_funds_change_3m"] = result["fed_funds_rate"].diff(3)

    if "vix" in result.columns:
        result["vix_ma_3m"] = result["vix"].rolling(3).mean()

    result = result.dropna(how="all").reset_index()
    result = result.rename(columns={"index": "date"})

    return result


def merge_macro_with_prices(
    price_df: pd.DataFrame,
    macro_df: Optional[pd.DataFrame] = None,
) -> pd.DataFrame:
    """
    Merge monthly macro features with a monthly price DataFrame.

    Uses merge_asof to align macro data to the nearest previous date
    for each price observation.
    """
    if macro_df is None or len(macro_df) == 0:
        try:
            macro_df = get_macro_features_monthly()
        except Exception:
            return price_df

    if len(macro_df) == 0:
        return price_df

    price_df = price_df.copy()
    macro_df = macro_df.copy()

    # Ensure date columns are datetime
    price_df["date"] = pd.to_datetime(price_df["date"])
    macro_df["date"] = pd.to_datetime(macro_df["date"])

    # Sort by date for merge_asof
    price_df = price_df.sort_values("date")
    macro_df = macro_df.sort_values("date")

    # Merge: for each price date, get the most recent macro data
    merged = pd.merge_asof(
        price_df,
        macro_df,
        on="date",
        direction="backward",
    )

    return merged
