"""Vercel serverless API for Sirsee."""

from __future__ import annotations

import json

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from server import (
    SUPABASE_ANON_KEY,
    SUPABASE_URL,
    authenticate_headers,
    build_recommendations,
    delete_reminder,
    list_reminders_for_user,
    upsert_reminder,
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.get("/api/config")
def get_config() -> dict:
    return {
        "supabaseUrl": SUPABASE_URL or None,
        "supabaseAnonKey": SUPABASE_ANON_KEY or None,
    }


@app.post("/api/recommendations")
async def post_recommendations(request: Request):
    try:
        body = await request.json()
        return build_recommendations(body)
    except ValueError as error:
        return JSONResponse({"error": str(error)}, status_code=400)
    except json.JSONDecodeError:
        return JSONResponse({"error": "Invalid JSON body."}, status_code=400)
    except Exception:
        return JSONResponse(
            {"error": "Something went wrong fetching local shops. Try again in a moment."},
            status_code=502,
        )


@app.get("/api/reminders")
async def get_reminders(request: Request):
    try:
        _user, token = authenticate_headers(request.headers)
        return {"reminders": list_reminders_for_user(token)}
    except ValueError as error:
        return JSONResponse({"error": str(error)}, status_code=400)


@app.post("/api/reminders")
async def post_reminders(request: Request):
    try:
        user, token = authenticate_headers(request.headers)
        body = await request.json()
        reminder = upsert_reminder(body, user, token)
        return {"reminder": reminder}
    except ValueError as error:
        return JSONResponse({"error": str(error)}, status_code=400)
    except json.JSONDecodeError:
        return JSONResponse({"error": "Invalid JSON body."}, status_code=400)


@app.delete("/api/reminders")
async def remove_reminder(request: Request):
    try:
        _user, token = authenticate_headers(request.headers)
        body = await request.json()
        recipient_name = (body.get("recipientName") or "").strip()
        reminder_id = (body.get("id") or "").strip()
        if not recipient_name and not reminder_id:
            raise ValueError("Her name is required.")
        removed = delete_reminder(token, recipient_name, reminder_id)
        if not removed:
            return JSONResponse({"error": "Reminder not found."}, status_code=404)
        return {"ok": True}
    except ValueError as error:
        return JSONResponse({"error": str(error)}, status_code=400)
    except json.JSONDecodeError:
        return JSONResponse({"error": "Invalid JSON body."}, status_code=400)
