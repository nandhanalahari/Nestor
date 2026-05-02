"""Unified stock data source.

Strategy:
  1. Try the Kaggle dataset first (local CSV files, no API limits).
  2. Fall back to yfinance (also free, no API key) for tickers/dates
     not in the Kaggle dataset (e.g. post-April 2020 data for newer
     scenarios like inflation-spike or tech-boom).
"""

import os
from pathlib import Path

import pandas as pd
import yfinance as yf

KAGGLE_BASE = Path(
    os.path.expanduser(
        "~/.cache/kagglehub/datasets/jacksoncrow/stock-market-dataset/versions/2"
    )
)
KAGGLE_STOCKS = KAGGLE_BASE / "stocks"
KAGGLE_ETFS = KAGGLE_BASE / "etfs"

# In-process cache so we read each CSV once
_kaggle_cache: dict[str, pd.DataFrame] = {}
_yf_cache: dict[str, pd.DataFrame] = {}


def _read_kaggle_csv(ticker: str) -> pd.DataFrame | None:
    """Read a single ticker's CSV from the Kaggle dataset."""
    upper = ticker.upper()
    if upper in _kaggle_cache:
        return _kaggle_cache[upper]

    for folder in (KAGGLE_STOCKS, KAGGLE_ETFS):
        p = folder / f"{upper}.csv"
        if p.exists():
            df = pd.read_csv(p)
            df["date"] = pd.to_datetime(df["Date"])
            df = df.rename(
                columns={
                    "Open": "open",
                    "High": "high",
                    "Low": "low",
                    "Close": "close",
                    "Adj Close": "adj_close",
                    "Volume": "volume",
                }
            )
            df = df[["date", "open", "high", "low", "close", "adj_close", "volume"]]
            df = df.sort_values("date").reset_index(drop=True)
            _kaggle_cache[upper] = df
            return df
    return None


def _fetch_yfinance(ticker: str) -> pd.DataFrame | None:
    """Fetch full history from yfinance and adapt to our column format."""
    upper = ticker.upper()
    if upper in _yf_cache:
        return _yf_cache[upper]

    try:
        df = yf.download(upper, period="max", auto_adjust=False, progress=False)
        if df is None or len(df) == 0:
            return None
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = [c[0] for c in df.columns]
        df = df.reset_index()
        df.columns = [c.lower().replace(" ", "_") for c in df.columns]
        if "adj_close" not in df.columns and "close" in df.columns:
            df["adj_close"] = df["close"]
        df["date"] = pd.to_datetime(df["date"])
        df = df[["date", "open", "high", "low", "close", "adj_close", "volume"]]
        df = df.sort_values("date").reset_index(drop=True)
        _yf_cache[upper] = df
        return df
    except Exception:
        return None


def get_daily_prices(
    ticker: str,
    start: str | None = None,
    end: str | None = None,
) -> pd.DataFrame:
    """
    Get daily prices for a ticker.

    Tries Kaggle first (fast, no network). If the requested window extends
    beyond Kaggle's last date (~April 2020), falls back to yfinance.
    """
    df = _read_kaggle_csv(ticker)
    needs_yf = False

    if df is None:
        needs_yf = True
    elif end is not None:
        end_ts = pd.Timestamp(end)
        if end_ts > df["date"].max():
            needs_yf = True

    if needs_yf:
        yf_df = _fetch_yfinance(ticker)
        if yf_df is not None:
            df = yf_df
        elif df is None:
            return pd.DataFrame(
                columns=["date", "open", "high", "low", "close", "adj_close", "volume"]
            )

    if start is not None:
        df = df[df["date"] >= pd.Timestamp(start)]
    if end is not None:
        df = df[df["date"] <= pd.Timestamp(end)]

    return df.reset_index(drop=True)


def get_monthly_prices(
    ticker: str,
    start: str | None = None,
    end: str | None = None,
) -> pd.DataFrame:
    """Resample daily prices to monthly (last close of each month)."""
    daily = get_daily_prices(ticker, start, end)
    if len(daily) == 0:
        return daily

    monthly = (
        daily.set_index("date")
        .resample("ME")
        .agg(
            {
                "open": "first",
                "high": "max",
                "low": "min",
                "close": "last",
                "adj_close": "last",
                "volume": "sum",
            }
        )
        .dropna()
        .reset_index()
    )
    return monthly


def get_latest_price(ticker: str) -> float | None:
    df = get_daily_prices(ticker)
    if len(df) == 0:
        return None
    return float(df["close"].iloc[-1])


def has_ticker(ticker: str) -> bool:
    return _read_kaggle_csv(ticker) is not None or _fetch_yfinance(ticker) is not None
