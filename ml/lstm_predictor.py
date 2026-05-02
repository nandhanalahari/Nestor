"""LSTM predictor — second 'Eyes' of the pipeline (alongside XGBoost).

Trains a small LSTM neural network on historical price sequences and
predicts the next 30 trading days. Used for both:
  - Scenario predictions (alongside XGBoost)
  - Dashboard forecast charts
"""

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

# Use yfinance for live data since it's the same source the dashboard uses
import yfinance as yf

DEVICE = torch.device("cpu")
SEQ_LEN = 60  # 60 days of history → predict next day
EPOCHS = 30
BATCH_SIZE = 32
HIDDEN_SIZE = 50
LR = 0.001


class LSTMModel(nn.Module):
    """Simple 2-layer LSTM with a fully-connected output."""

    def __init__(self, input_size: int = 1, hidden_size: int = HIDDEN_SIZE, num_layers: int = 2):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=0.2,
        )
        self.fc = nn.Linear(hidden_size, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out, _ = self.lstm(x)
        return self.fc(out[:, -1, :])


def fetch_history(ticker: str, period: str = "5y") -> pd.DataFrame:
    """Fetch daily price history from yfinance."""
    df = yf.download(ticker, period=period, auto_adjust=True, progress=False)
    if df is None or len(df) == 0:
        raise RuntimeError(f"No history for {ticker}")
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [c[0] for c in df.columns]
    return df


def build_sequences(prices: np.ndarray, seq_len: int = SEQ_LEN):
    """Sliding window: each X is `seq_len` prices, each y is the next price."""
    X, y = [], []
    for i in range(seq_len, len(prices)):
        X.append(prices[i - seq_len : i])
        y.append(prices[i])
    return np.array(X), np.array(y)


def train_lstm(prices: np.ndarray) -> tuple[LSTMModel, float, float]:
    """
    Train LSTM on a price series. Returns (model, min, max) for de-scaling.
    """
    if len(prices) < SEQ_LEN + 10:
        raise RuntimeError("Not enough data to train LSTM (need 70+ days)")

    # Min-max scale
    p_min, p_max = float(prices.min()), float(prices.max())
    if p_max <= p_min:
        raise RuntimeError("Price range is zero")
    scaled = (prices - p_min) / (p_max - p_min)

    X, y = build_sequences(scaled)
    X_tensor = torch.tensor(X, dtype=torch.float32).unsqueeze(-1).to(DEVICE)
    y_tensor = torch.tensor(y, dtype=torch.float32).unsqueeze(-1).to(DEVICE)

    dataset = TensorDataset(X_tensor, y_tensor)
    loader = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=True)

    model = LSTMModel().to(DEVICE)
    optimizer = torch.optim.Adam(model.parameters(), lr=LR)
    criterion = nn.MSELoss()

    model.train()
    for _ in range(EPOCHS):
        for xb, yb in loader:
            optimizer.zero_grad()
            pred = model(xb)
            loss = criterion(pred, yb)
            loss.backward()
            optimizer.step()

    return model, p_min, p_max


def forecast_lstm(model: LSTMModel, prices: np.ndarray, p_min: float, p_max: float, days: int = 30) -> list[float]:
    """Recursive forecast: predict next day, append, predict next, etc."""
    model.eval()
    scaled = (prices - p_min) / (p_max - p_min)
    seq = list(scaled[-SEQ_LEN:])
    forecasts: list[float] = []

    with torch.no_grad():
        for _ in range(days):
            x = torch.tensor(seq[-SEQ_LEN:], dtype=torch.float32).reshape(1, SEQ_LEN, 1).to(DEVICE)
            pred = model(x).item()
            seq.append(pred)
            # De-scale and store
            forecasts.append(pred * (p_max - p_min) + p_min)

    return forecasts


def predict_for_ticker(ticker: str, forecast_days: int = 30) -> dict:
    """
    End-to-end LSTM prediction for one ticker.
    Returns: predicted prices, expected return, predicted volatility.
    """
    df = fetch_history(ticker, period="5y")
    closes = df["Close"].values.astype(np.float64).flatten()

    if len(closes) < SEQ_LEN + 30:
        raise RuntimeError(f"Need 90+ days of history for {ticker}, have {len(closes)}")

    model, p_min, p_max = train_lstm(closes)
    forecasts = forecast_lstm(model, closes, p_min, p_max, days=forecast_days)

    current_price = float(closes[-1])
    final_price = forecasts[-1]
    expected_return = ((final_price - current_price) / current_price) * 100

    # Predicted volatility = std of daily returns from forecasts
    forecast_returns = []
    for i in range(1, len(forecasts)):
        if forecasts[i - 1] > 0:
            forecast_returns.append((forecasts[i] - forecasts[i - 1]) / forecasts[i - 1])
    predicted_vol = (np.std(forecast_returns) * np.sqrt(252) * 100) if forecast_returns else 0.0

    # Build forecast dates
    last_date = pd.Timestamp(df.index[-1])
    forecast_dates = []
    d = last_date
    for _ in range(forecast_days):
        d = d + pd.Timedelta(days=1)
        # Skip weekends
        while d.weekday() >= 5:
            d = d + pd.Timedelta(days=1)
        forecast_dates.append(d.strftime("%Y-%m-%d"))

    return {
        "ticker": ticker,
        "current_price": round(current_price, 2),
        "predicted_return": round(expected_return, 2),
        "predicted_vol": round(predicted_vol, 2),
        "forecast": [
            {"date": d, "price": round(p, 2)}
            for d, p in zip(forecast_dates, forecasts)
        ],
        "history_days": len(closes),
        "model": "LSTM (2-layer, 50 hidden units, 60-day window)",
    }


def predict_all_lstm(tickers: list[str], forecast_days: int = 30) -> dict:
    """Run LSTM predictions for multiple tickers. Returns dict keyed by ticker."""
    results = {}
    errors = []

    for ticker in tickers:
        try:
            results[ticker] = predict_for_ticker(ticker, forecast_days=forecast_days)
        except Exception as e:
            errors.append(f"{ticker}: {e}")
            results[ticker] = {
                "ticker": ticker,
                "error": str(e),
                "predicted_return": 0.0,
                "predicted_vol": 0.0,
                "forecast": [],
            }

    return {"predictions": results, "errors": errors}
