"""XGBoost predictor — the 'Eyes' of the pipeline.

Trains on historical prices (Kaggle CSV + Yahoo Finance fallback) for each ticker and predicts:
  1. Expected forward return (1-month)
  2. Expected forward volatility (3-month)

Also extracts feature importances so Gemini can explain *why* the model
made its predictions in plain English.
"""

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import mean_squared_error

from features import engineer_features, FEATURE_COLS, FEATURE_DESCRIPTIONS
from data_source import get_monthly_prices


class AssetPredictor:
    """XGBoost predictor for a single asset."""

    def __init__(self, ticker: str):
        self.ticker = ticker
        self.return_model: xgb.XGBRegressor | None = None
        self.vol_model: xgb.XGBRegressor | None = None
        self.feature_importances: dict[str, float] = {}
        self.predicted_return: float = 0.0
        self.predicted_vol: float = 0.0
        self.train_score: float = 0.0

    def train_and_predict(self) -> dict:
        """Fetch data, engineer features, train XGBoost, predict next period."""

        # Fetch historical monthly data from Kaggle dataset (or yfinance fallback)
        raw = get_monthly_prices(self.ticker)
        if len(raw) < 24:
            raise RuntimeError(f"Not enough history for {self.ticker} ({len(raw)} months)")

        df = engineer_features(raw)

        # Drop rows with NaN features or targets
        valid_cols = [c for c in FEATURE_COLS if c in df.columns]
        mask = df[valid_cols + ["fwd_return_1m", "fwd_vol_3m"]].notna().all(axis=1)
        df_clean = df[mask].copy()

        if len(df_clean) < 12:
            raise RuntimeError(f"Not enough clean data for {self.ticker} after feature engineering")

        X = df_clean[valid_cols].values
        y_return = df_clean["fwd_return_1m"].values
        y_vol = df_clean["fwd_vol_3m"].values

        # XGBoost parameters tuned for small financial datasets
        params = {
            "n_estimators": 100,
            "max_depth": 4,
            "learning_rate": 0.1,
            "subsample": 0.8,
            "colsample_bytree": 0.8,
            "reg_alpha": 0.1,
            "reg_lambda": 1.0,
            "random_state": 42,
        }

        # Train return predictor
        self.return_model = xgb.XGBRegressor(**params)
        self.return_model.fit(X, y_return)

        # Train volatility predictor
        self.vol_model = xgb.XGBRegressor(**params)
        self.vol_model.fit(X, y_vol)

        # Cross-validation score
        tscv = TimeSeriesSplit(n_splits=min(3, len(df_clean) // 6))
        scores = []
        for train_idx, test_idx in tscv.split(X):
            m = xgb.XGBRegressor(**params)
            m.fit(X[train_idx], y_return[train_idx])
            pred = m.predict(X[test_idx])
            scores.append(np.sqrt(mean_squared_error(y_return[test_idx], pred)))
        self.train_score = float(np.mean(scores)) if scores else 0.0

        # Feature importances from the return model
        importances = self.return_model.feature_importances_
        self.feature_importances = {}
        for i, col in enumerate(valid_cols):
            if importances[i] > 0.01:
                self.feature_importances[col] = round(float(importances[i]) * 100, 1)

        # Predict using the latest available data point
        latest = df[valid_cols].dropna()
        if len(latest) == 0:
            self.predicted_return = float(np.mean(y_return))
            self.predicted_vol = float(np.mean(y_vol))
        else:
            last_row = latest.iloc[-1:].values
            self.predicted_return = float(self.return_model.predict(last_row)[0])
            self.predicted_vol = float(self.vol_model.predict(last_row)[0])

        return {
            "ticker": self.ticker,
            "predicted_return": round(self.predicted_return * 100, 2),
            "predicted_vol": round(self.predicted_vol * 100, 2),
            "feature_importances": self.feature_importances,
            "cv_rmse": round(self.train_score * 100, 2),
            "data_points": len(df_clean),
        }


def predict_all(tickers: list[str]) -> dict:
    """Run XGBoost predictions for all tickers. Returns dict keyed by ticker."""
    results = {}
    errors = []

    for ticker in tickers:
        try:
            predictor = AssetPredictor(ticker)
            results[ticker] = predictor.train_and_predict()
        except Exception as e:
            errors.append(f"{ticker}: {str(e)}")
            # Fallback: use simple historical average
            results[ticker] = {
                "ticker": ticker,
                "predicted_return": 0.5,
                "predicted_vol": 5.0,
                "feature_importances": {},
                "cv_rmse": 0,
                "data_points": 0,
                "error": str(e),
            }

    return {"predictions": results, "errors": errors}


def format_importance_for_gemini(predictions: dict) -> str:
    """Format XGBoost feature importances into a string Gemini can interpret."""
    lines = []
    for ticker, pred in predictions.items():
        imps = pred.get("feature_importances", {})
        if not imps:
            continue
        top = sorted(imps.items(), key=lambda x: x[1], reverse=True)[:5]
        parts = []
        for feat, pct in top:
            desc = FEATURE_DESCRIPTIONS.get(feat, feat)
            parts.append(f"{desc} ({pct}%)")
        lines.append(f"{ticker}: predicted return {pred['predicted_return']}%, "
                      f"predicted vol {pred['predicted_vol']}%. "
                      f"Top drivers: {', '.join(parts)}")
    return "\n".join(lines)
