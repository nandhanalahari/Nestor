"""
Nestor ML Pipeline — FastAPI server.

Pipeline:
  1. EYES (XGBoost): Predict expected returns & volatility per asset
  2. HANDS (PyPortfolioOpt MVO): Optimize allocation using XGBoost predictions
  3. TRANSLATOR (Gemini): Explain feature importances in plain English

Endpoints:
  POST /analyze  — Run full pipeline for a user's holdings
  GET  /health   — Health check
"""

import os
import json
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from predictor import predict_all, format_importance_for_gemini
from optimizer import optimize_portfolio
from fred_data import get_macro_snapshot, get_macro_features_monthly, FRED_SERIES
from risk_scores import compute_stock_risk_scores

# Load env from parent .env.local
env_path = os.path.join(os.path.dirname(__file__), "..", ".env.local")
load_dotenv(env_path)


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Nestor ML Pipeline ready")
    yield
    print("Shutting down")


app = FastAPI(title="Nestor ML Pipeline", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class Holding(BaseModel):
    ticker: str
    name: str
    category: str = "Stock"
    weight: float = 0.0


class AnalyzeRequest(BaseModel):
    holdings: list[Holding]
    scenario_id: str = "market-drop"
    window_start: str = ""
    window_end: str = ""


class RiskScoresRequest(BaseModel):
    """Holdings with positive weights (e.g. market-value weights) for portfolio context."""

    holdings: list[Holding]


def _enrich_scores_with_weights(risk_by_ticker: dict, weights: dict[str, float]) -> dict:

    out: dict[str, dict] = {}
    for t, row in risk_by_ticker.items():
        w = float(weights.get(t, 0.0))
        rs = float(row.get("risk_score", 0.0))
        enriched = dict(row)
        enriched["portfolio_weight"] = round(w, 6)
        enriched["portfolio_weight_pct"] = round(w * 100.0, 2)
        enriched["position_risk_index"] = round(rs * w, 2)
        out[t] = enriched
    return out


SCENARIO_WINDOWS = {
    "market-drop": ("2020-01-01", "2020-06-01"),
    "inflation-spike": ("2021-06-01", "2022-12-31"),
    "recession": ("2008-01-01", "2009-06-01"),
    "tech-boom": ("2023-01-01", "2024-06-01"),
}


@app.post("/analyze")
async def analyze(req: AnalyzeRequest):
    """Run the full XGBoost → MVO → Gemini pipeline."""

    if not req.holdings:
        raise HTTPException(400, "No holdings provided")

    tickers = [h.ticker.upper() for h in req.holdings]
    current_weights = {}
    total = sum(h.weight for h in req.holdings)
    for h in req.holdings:
        current_weights[h.ticker.upper()] = h.weight / total if total > 0 else 1 / len(tickers)

    # ── Step 1: EYES — XGBoost predictions ──
    xgb_result = predict_all(tickers)
    predictions = xgb_result["predictions"]

    # ── Step 2: HANDS — MVO optimization ──
    window = SCENARIO_WINDOWS.get(req.scenario_id, ("", ""))
    w_start = req.window_start or window[0]
    w_end = req.window_end or window[1]

    try:
        optimization = optimize_portfolio(
            tickers=tickers,
            current_weights=current_weights,
            xgb_predictions=predictions,
            window_start=w_start or None,
            window_end=w_end or None,
            use_scenario_returns=True,
        )
    except Exception as e:
        raise HTTPException(500, f"Optimization failed: {str(e)}")

    # ── Step 3: TRANSLATOR — Format for Gemini ──
    importance_text = format_importance_for_gemini(predictions)

    # ── Step 4: Macro (FRED) + per-stock risk scores (FRED regime + Yahoo history) ──
    macro_context = {}
    try:
        macro_context = get_macro_snapshot()
    except Exception as e:
        print(f"[FRED] Could not fetch macro snapshot: {e}")

    risk_scores: dict = {}
    try:
        risk_scores = compute_stock_risk_scores(tickers, macro_context)
    except Exception as e:
        print(f"[risk_scores] {e}")

    risk_weights = {
        h.ticker.upper(): (h.weight / total if total > 0 else 1.0 / len(tickers))
        for h in req.holdings
    }
    risk_scores_weighted = _enrich_scores_with_weights(risk_scores, risk_weights)

    return {
        "predictions": predictions,
        "optimization": optimization,
        "xgb_importance_text": importance_text,
        "macro_snapshot": macro_context,
        "risk_scores": risk_scores_weighted,
        "scenario_id": req.scenario_id,
        "window": {"start": w_start, "end": w_end},
        "pipeline": "XGBoost (predictor) + FRED macro data → PyPortfolioOpt MVO with scenario-period data → Gemini (translator).",
    }


@app.post("/risk-scores")
async def risk_scores_only(req: RiskScoresRequest):
    """
    Per-ticker risk (vol, beta vs SPY, FRED macro stress) plus portfolio weights.
    Weights should reflect how much you hold or plan to invest in each name
    (e.g. market value / total portfolio value).
    """
    if not req.holdings:
        raise HTTPException(400, "No holdings provided")

    total = sum(max(0.0, h.weight) for h in req.holdings)
    if total <= 0:
        n = len(req.holdings)
        weights = {h.ticker.upper(): 1.0 / n for h in req.holdings}
    else:
        weights = {
            h.ticker.upper(): max(0.0, h.weight) / total for h in req.holdings
        }

    tickers = list(weights.keys())

    macro_context: dict = {}
    try:
        macro_context = get_macro_snapshot()
    except Exception as e:
        print(f"[FRED] risk-scores: {e}")

    try:
        raw_scores = compute_stock_risk_scores(tickers, macro_context)
    except Exception as e:
        raise HTTPException(500, f"Risk scores failed: {str(e)}")

    enriched = _enrich_scores_with_weights(raw_scores, weights)
    return {
        "risk_scores": enriched,
        "macro_snapshot": macro_context,
    }


@app.get("/health")
async def health():
    fred_ok = False
    try:
        from fred_data import get_latest_value
        val = get_latest_value("DFF")
        fred_ok = val is not None
    except Exception:
        pass
    return {
        "status": "ok",
        "pipeline": "XGBoost + FRED Macro + PyPortfolioOpt + Gemini",
        "fred_connected": fred_ok,
    }


@app.get("/macro")
async def macro():
    """Return a snapshot of all FRED macroeconomic indicators."""
    try:
        snapshot = get_macro_snapshot()
        return {
            "indicators": snapshot,
            "series_available": list(FRED_SERIES.keys()),
            "source": "FRED (Federal Reserve Economic Data)",
        }
    except Exception as e:
        raise HTTPException(500, f"FRED data unavailable: {str(e)}")


class FredSeriesRequest(BaseModel):
    series_id: str
    start: str = ""
    end: str = ""
    frequency: str = ""  # d, w, bw, m, q, sa, a


@app.post("/macro/series")
async def macro_series(req: FredSeriesRequest):
    """Fetch historical data for a specific FRED series."""
    if req.series_id not in FRED_SERIES:
        raise HTTPException(400, f"Unknown series: {req.series_id}. Available: {list(FRED_SERIES.keys())}")

    try:
        from fred_data import get_series
        df = get_series(
            req.series_id,
            start=req.start or None,
            end=req.end or None,
            frequency=req.frequency or None,
        )
        observations = [
            {"date": row["date"].strftime("%Y-%m-%d"), "value": round(row["value"], 4)}
            for _, row in df.iterrows()
        ]
        return {
            "series_id": req.series_id,
            "name": FRED_SERIES[req.series_id],
            "observations": observations,
            "count": len(observations),
        }
    except Exception as e:
        raise HTTPException(500, f"Error fetching {req.series_id}: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
