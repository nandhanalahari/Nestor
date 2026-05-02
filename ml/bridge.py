#!/usr/bin/env python3
"""
Run ML pipeline from Next.js via stdin/stdout JSON (no uvicorn).

Stdin: {"op": "analyze"|"risk_scores"|"macro"|"macro_series", "payload": {...}?}
Stdout: {"ok": true, "data": ...} or {"ok": false, "error": "...", "status": N}
Always exits 0 so Node can parse stdout; use "status" for HTTP-style errors.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path

ML_ROOT = Path(__file__).resolve().parent
os.chdir(ML_ROOT)
if str(ML_ROOT) not in sys.path:
    sys.path.insert(0, str(ML_ROOT))

from dotenv import load_dotenv

load_dotenv(ML_ROOT.parent / ".env.local")


def _json_default(obj):
    if hasattr(obj, "item"):
        try:
            return obj.item()
        except Exception:
            pass
    return str(obj)


def _emit_ok(data):
    sys.stdout.write(json.dumps({"ok": True, "data": data}, default=_json_default))
    sys.exit(0)


def _emit_err(message: str, status: int = 500):
    sys.stdout.write(
        json.dumps({"ok": False, "error": message, "status": status}, default=_json_default)
    )
    sys.exit(0)


def main():
    try:
        raw = sys.stdin.read()
        msg = json.loads(raw) if raw.strip() else {}
    except Exception as e:
        _emit_err(str(e), 400)

    op = msg.get("op")
    payload = msg.get("payload")

    try:
        from fastapi import HTTPException

        if op == "analyze":
            from server import AnalyzeRequest, analyze

            if not isinstance(payload, dict):
                _emit_err("analyze requires payload object", 400)
            req = AnalyzeRequest(**payload)
            result = asyncio.run(analyze(req))
            _emit_ok(result)

        if op == "risk_scores":
            from server import RiskScoresRequest, risk_scores_only

            if not isinstance(payload, dict):
                _emit_err("risk_scores requires payload object", 400)
            req = RiskScoresRequest(**payload)
            result = asyncio.run(risk_scores_only(req))
            _emit_ok(result)

        if op == "macro":
            from server import macro

            result = asyncio.run(macro())
            _emit_ok(result)

        if op == "macro_series":
            from server import FredSeriesRequest, macro_series

            if not isinstance(payload, dict):
                _emit_err("macro_series requires payload object", 400)
            req = FredSeriesRequest(**payload)
            result = asyncio.run(macro_series(req))
            _emit_ok(result)

        _emit_err(f"Unknown op: {op!r}", 400)

    except HTTPException as e:
        detail = e.detail
        msg = detail if isinstance(detail, str) else str(detail)
        _emit_err(msg, int(e.status_code))
    except Exception as e:
        _emit_err(str(e), 500)


if __name__ == "__main__":
    main()
