"""Vercel cron: send due reminder digest emails."""

from __future__ import annotations

import os

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

app = FastAPI()


def authorized_cron(request: Request) -> bool:
    secret = os.environ.get("CRON_SECRET", "").strip()
    if not secret:
        return True
    auth = request.headers.get("Authorization") or request.headers.get("authorization") or ""
    return auth == f"Bearer {secret}"


@app.get("/api/cron/reminders")
def run_reminder_cron(request: Request):
    if not authorized_cron(request):
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    from scripts.send_reminder_emails import main

    try:
        main()
        return {"ok": True}
    except SystemExit as error:
        return JSONResponse({"error": str(error)}, status_code=500)
    except Exception as error:
        return JSONResponse({"error": str(error)}, status_code=500)
