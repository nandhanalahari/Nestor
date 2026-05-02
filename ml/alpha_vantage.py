"""Alpha Vantage data fetcher with caching."""

import os
import time
import requests
import pandas as pd
from functools import lru_cache

BASE = "https://www.alphavantage.co/query"

_cache: dict[str, tuple[float, pd.DataFrame]] = {}
CACHE_TTL = 86400  # 24 hours
_last_request_time = 0.0
REQUEST_DELAY = 1.5  # seconds between API calls (free tier: 1/sec)


def _api_key() -> str:
    key = os.getenv("ALPHA_VANTAGE_API_KEY", "")
    if not key:
        raise ValueError("ALPHA_VANTAGE_API_KEY not set")
    return key


def _fetch(params: dict) -> dict:
    global _last_request_time
    now = time.time()
    wait = REQUEST_DELAY - (now - _last_request_time)
    if wait > 0:
        time.sleep(wait)

    params["apikey"] = _api_key()
    r = requests.get(BASE, params=params, timeout=30)
    _last_request_time = time.time()
    r.raise_for_status()
    data = r.json()
    if "Note" in data or "Information" in data:
        raise RuntimeError(data.get("Note") or data.get("Information", "Rate limited"))
    if "Error Message" in data:
        raise RuntimeError(data["Error Message"])
    return data


def get_monthly_adjusted(symbol: str) -> pd.DataFrame:
    """Return monthly adjusted close prices for a symbol."""
    cache_key = f"monthly:{symbol}"
    if cache_key in _cache:
        ts, df = _cache[cache_key]
        if time.time() - ts < CACHE_TTL:
            return df

    data = _fetch({"function": "TIME_SERIES_MONTHLY_ADJUSTED", "symbol": symbol})
    series = data.get("Monthly Adjusted Time Series", {})
    if not series:
        raise RuntimeError(f"No monthly data for {symbol}")

    rows = []
    for date_str, fields in series.items():
        rows.append({
            "date": pd.Timestamp(date_str),
            "open": float(fields.get("1. open", 0)),
            "high": float(fields.get("2. high", 0)),
            "low": float(fields.get("3. low", 0)),
            "close": float(fields.get("4. close", 0)),
            "adj_close": float(fields.get("5. adjusted close", fields.get("4. close", 0))),
            "volume": float(fields.get("6. volume", 0)),
            "dividend": float(fields.get("7. dividend amount", 0)),
        })

    df = pd.DataFrame(rows).sort_values("date").reset_index(drop=True)
    _cache[cache_key] = (time.time(), df)
    return df


def get_daily(symbol: str, outputsize: str = "compact") -> pd.DataFrame:
    """Return daily close prices (last 100 trading days by default)."""
    cache_key = f"daily:{symbol}:{outputsize}"
    if cache_key in _cache:
        ts, df = _cache[cache_key]
        if time.time() - ts < CACHE_TTL:
            return df

    data = _fetch({
        "function": "TIME_SERIES_DAILY_ADJUSTED",
        "symbol": symbol,
        "outputsize": outputsize,
    })
    series = data.get("Time Series (Daily)", {})
    if not series:
        raise RuntimeError(f"No daily data for {symbol}")

    rows = []
    for date_str, fields in series.items():
        rows.append({
            "date": pd.Timestamp(date_str),
            "open": float(fields.get("1. open", 0)),
            "high": float(fields.get("2. high", 0)),
            "low": float(fields.get("3. low", 0)),
            "close": float(fields.get("4. close", 0)),
            "adj_close": float(fields.get("5. adjusted close", fields.get("4. close", 0))),
            "volume": float(fields.get("6. volume", 0)),
        })

    df = pd.DataFrame(rows).sort_values("date").reset_index(drop=True)
    _cache[cache_key] = (time.time(), df)
    return df


def get_global_quote(symbol: str) -> dict:
    """Return current price info for a symbol."""
    data = _fetch({"function": "GLOBAL_QUOTE", "symbol": symbol})
    quote = data.get("Global Quote", {})
    return {
        "ticker": symbol,
        "price": float(quote.get("05. price", 0)),
        "change_pct": float(quote.get("10. change percent", "0").replace("%", "")),
    }
