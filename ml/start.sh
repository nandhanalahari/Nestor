#!/usr/bin/env bash
# Auto-install Python deps and start the ML server.
# Called by `npm run dev` via concurrently — no manual step needed.

set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "[ML] Checking Python dependencies..."
pip3 install --user -q -r requirements.txt 2>/dev/null || pip install --user -q -r requirements.txt 2>/dev/null || {
  echo "[ML] WARNING: Could not install Python deps. The app will fall back to TypeScript MVO."
  exit 0
}

echo "[ML] Starting XGBoost + MVO pipeline on port 8000..."
exec python3 server.py
