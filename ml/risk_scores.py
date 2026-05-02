"""Per-ticker risk scores from Yahoo-aligned price data + FRED macro regime."""

from __future__ import annotations

import math

import numpy as np
import pandas as pd

from data_source import get_daily_prices


def _macro_stress_and_factors(macro_snapshot: dict) -> tuple[float, dict]:
    """
    Map FRED snapshot (from get_macro_snapshot) to a 0–100 stress score
    and human-readable factors.
    """
    factors: dict = {}
    parts: list[float] = []

    vix = macro_snapshot.get("VIXCLS") or {}
    if isinstance(vix, dict) and "value" in vix:
        vx = float(vix["value"])
        # Low VIX ~12, crisis ~35+
        stress = max(0.0, min(100.0, (vx - 12.0) / (35.0 - 12.0) * 100.0))
        factors["vix_stress_0_100"] = round(stress, 1)
        parts.append(stress)

    dff = macro_snapshot.get("DFF") or {}
    if isinstance(dff, dict) and "value" in dff:
        r = float(dff["value"])
        stress = max(0.0, min(100.0, (r / 5.75) * 100.0))
        factors["fed_funds_stress_0_100"] = round(stress, 1)
        parts.append(stress)

    ys = macro_snapshot.get("YIELD_SPREAD") or {}
    if isinstance(ys, dict) and ys.get("inverted"):
        factors["yield_curve"] = "inverted (recession-watch)"
        parts.append(35.0)
    elif isinstance(ys, dict) and "value" in ys:
        spread = float(ys["value"])
        factors["yield_spread_pct_pts"] = spread

    if not parts:
        return 45.0, {"note": "Macro snapshot sparse — using neutral stress"}

    stress = float(np.mean(parts))
    return round(min(100.0, stress), 1), factors


def _yahoo_metrics(ticker: str, bench_returns: pd.Series) -> tuple[float, float, int]:
    """Annualized vol (%), beta vs benchmark, sample days."""
    df = get_daily_prices(ticker)
    if len(df) < 30:
        return 0.0, 1.0, 0

    px = df.set_index("date")["adj_close"].astype(float)
    rets = px.pct_change().dropna()
    if len(rets) < 20:
        return 0.0, 1.0, 0

    if len(bench_returns) < 20:
        ann_vol = float(rets.tail(252).std() * math.sqrt(252) * 100)
        return round(ann_vol, 2), 1.0, min(len(rets), 252)

    merged = pd.merge(
        rets.rename("asset"),
        bench_returns.rename("bench"),
        left_index=True,
        right_index=True,
        how="inner",
    ).dropna()

    if len(merged) < 20:
        ann_vol = float(rets.tail(252).std() * math.sqrt(252) * 100)
        return round(ann_vol, 2), 1.0, min(len(rets), 252)

    cov = np.cov(merged["asset"], merged["bench"])[0][1]
    var_b = float(np.var(merged["bench"]))
    beta = float(cov / var_b) if var_b > 1e-12 else 1.0
    ann_vol = float(merged["asset"].std() * math.sqrt(252) * 100)
    return round(ann_vol, 2), round(beta, 2), len(merged)


def _yahoo_component_score(ann_vol_pct: float, beta: float) -> float:
    """Translate vol + beta into 0–100."""
    if ann_vol_pct <= 0:
        return 40.0
    vol_score = max(0.0, min(100.0, (ann_vol_pct - 8.0) / (48.0 - 8.0) * 100.0))
    beta_score = max(0.0, min(100.0, (beta - 0.65) / (1.6 - 0.65) * 100.0))
    return float(vol_score * 0.72 + beta_score * 0.28)


def _label(score: float) -> str:
    if score < 34:
        return "Lower"
    if score < 67:
        return "Moderate"
    return "Elevated"


def compute_stock_risk_scores(
    tickers: list[str],
    macro_snapshot: dict | None = None,
) -> dict[str, dict]:
    """
    For each ticker: combined 0–100 risk score using Yahoo/Kaggle price history
    and FRED-based macro regime stress.
    """
    from fred_data import get_macro_snapshot

    snap = macro_snapshot if macro_snapshot is not None else {}
    if not snap:
        try:
            snap = get_macro_snapshot()
        except Exception:
            snap = {}

    macro_stress, macro_factors = _macro_stress_and_factors(snap)

    spy = get_daily_prices("SPY")
    if len(spy) < 30:
        bench = pd.Series(dtype=float)
    else:
        px = spy.set_index("date")["adj_close"].astype(float)
        bench = px.pct_change().dropna()

    out: dict[str, dict] = {}
    for raw in tickers:
        t = raw.upper()
        ann_vol, beta, n = _yahoo_metrics(t, bench)
        yahoo_score = _yahoo_component_score(ann_vol, beta)
        combined = min(
            100.0,
            round(yahoo_score * 0.62 + macro_stress * 0.38, 1),
        )
        summary_parts = []
        if ann_vol > 0:
            summary_parts.append(f"~{ann_vol:.1f}% annualized vol")
        if beta > 1.15:
            summary_parts.append(f"beta {beta} vs SPY")
        elif beta < 0.85:
            summary_parts.append(f"defensive beta {beta}")
        if macro_stress >= 60:
            summary_parts.append("stressed macro backdrop (rates/VIX/curve)")
        elif macro_factors.get("yield_curve") == "inverted (recession-watch)":
            summary_parts.append("inverted yield curve")
        summary = (
            "; ".join(summary_parts)
            if summary_parts
            else "Limited history — interpret with caution"
        )

        out[t] = {
            "risk_score": combined,
            "label": _label(combined),
            "yahoo": {
                "annualized_vol_pct": ann_vol,
                "beta_vs_spy": beta,
                "observation_days": n,
            },
            "macro": {
                "regime_stress_0_100": macro_stress,
                "factors": macro_factors,
            },
            "summary": summary,
        }

    return out
