#!/usr/bin/env python3
"""Send due Sirsee reminder digest emails. Run on a schedule (e.g. daily cron)."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from emails import next_send_at_iso, send_reminder_digest  # noqa: E402
from server import build_recommendations, load_dotenv  # noqa: E402

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")


def require_service_role() -> None:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise SystemExit(
            "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env to run scheduled emails."
        )


def service_rest(method: str, resource: str, *, query: dict | None = None, body: dict | None = None) -> dict | list | None:
    params = urllib.parse.urlencode(query or {}, doseq=True)
    url = f"{SUPABASE_URL}/rest/v1/{resource}"
    if params:
        url = f"{url}?{params}"

    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Accept": "application/json",
    }
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode("utf-8")

    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(request, timeout=30) as response:
        raw = response.read().decode("utf-8")
        return json.loads(raw) if raw else None


def reminder_from_row(row: dict) -> dict:
    return {
        "userId": row["user_id"],
        "recipientName": row["recipient_name"],
        "email": row["email"],
        "frequency": row["frequency"],
        "recipientGender": row["recipient_gender"],
        "budget": row["budget"],
        "zipCode": row["zip_code"],
        "likes": row.get("likes") or [],
        "customLike": row.get("custom_like") or "",
        "likesSummary": row.get("likes_summary") or "",
    }


def reminder_to_brief(reminder: dict) -> dict:
    return {
        "zipCode": reminder["zipCode"],
        "budget": reminder["budget"],
        "likes": reminder["likes"],
        "customLike": reminder["customLike"],
        "recipientGender": reminder["recipientGender"],
    }


def fetch_due_reminders() -> list[dict]:
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    payload = service_rest(
        "GET",
        "reminders",
        query={
            "select": "*",
            "next_send_at": f"lte.{now}",
            "order": "next_send_at.asc",
        },
    )
    return payload if isinstance(payload, list) else []


def mark_reminder_sent(row: dict) -> None:
    frequency = row["frequency"]
    now = datetime.now(timezone.utc)
    service_rest(
        "PATCH",
        "reminders",
        query={
            "user_id": f"eq.{row['user_id']}",
            "recipient_name": f"eq.{row['recipient_name']}",
        },
        body={
            "last_sent_at": now.replace(microsecond=0).isoformat(),
            "next_send_at": next_send_at_iso(frequency, from_time=now),
        },
    )


def main() -> None:
    require_service_role()
    due_rows = fetch_due_reminders()
    if not due_rows:
        print("No due reminder emails.")
        return

    sent = 0
    for row in due_rows:
        reminder = reminder_from_row(row)
        try:
            payload = build_recommendations(reminder_to_brief(reminder))
            send_reminder_digest(reminder, payload["gifts"], payload["location"])
            mark_reminder_sent(row)
            sent += 1
            print(f"Sent digest for {reminder['recipientName']} → {reminder['email']}")
        except Exception as error:
            print(f"Failed for {reminder['recipientName']}: {error}", file=sys.stderr)

    print(f"Done. Sent {sent} of {len(due_rows)} due reminders.")


if __name__ == "__main__":
    main()
