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
from lstm_predictor import predict_all_lstm, predict_for_ticker

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

    # ── Step 1b: EYES — LSTM predictions (in parallel concept) ──
    try:
        lstm_result = predict_all_lstm(tickers, forecast_days=30)
        lstm_predictions = lstm_result["predictions"]
    except Exception as e:
        lstm_predictions = {}
        print(f"[LSTM] Failed: {e}")

    # ── Step 2: HANDS — MVO optimization ──
    window = SCENARIO_WINDOWS.get(req.scenario_id, ("", ""))
    w_start = req.window_start or window[0]
    w_end = req.window_end or window[1]

    try:
        optimization = optimize_portfolio(
            tickers=tickers,
            current_weights=current_weights,
            xgb_predictions=predictions,
        )
    except Exception as e:
        raise HTTPException(500, f"Optimization failed: {str(e)}")

    # ── Step 3: TRANSLATOR — Format for Gemini ──
    importance_text = format_importance_for_gemini(predictions)

    return {
        "predictions": predictions,
        "lstm_predictions": lstm_predictions,
        "optimization": optimization,
        "xgb_importance_text": importance_text,
        "scenario_id": req.scenario_id,
        "window": {"start": w_start, "end": w_end},
        "pipeline": "XGBoost + LSTM (predictors) → PyPortfolioOpt MVO (optimizer) → Gemini (translator)",
    }


class ForecastRequest(BaseModel):
    tickers: list[str]
    days: int = 30


@app.post("/forecast")
async def forecast(req: ForecastRequest):
    """
    LSTM forecast endpoint for the dashboard.
    Returns predicted prices for the next N days for each ticker.
    """
    if not req.tickers:
        raise HTTPException(400, "No tickers provided")

    tickers = [t.upper() for t in req.tickers]
    result = predict_all_lstm(tickers, forecast_days=req.days)
    return {
        "predictions": result["predictions"],
        "errors": result["errors"],
        "model": "LSTM (PyTorch, 2-layer, 60-day window)",
    }


@app.get("/health")
async def health():
    return {"status": "ok", "pipeline": "XGBoost + LSTM + PyPortfolioOpt + Gemini"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
