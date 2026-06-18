#!/usr/bin/env python3
"""Enable Google sign-in on the Sirsee Supabase project via the Management API."""

from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
API_BASE = "https://api.supabase.com/v1"
LOCAL_ORIGINS = (
    "http://127.0.0.1:4174",
    "http://127.0.0.1:4174/**",
    "http://localhost:4174",
    "http://localhost:4174/**",
)


def load_dotenv() -> None:
    env_path = ROOT / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def project_ref() -> str:
    explicit = os.environ.get("SUPABASE_PROJECT_REF", "").strip()
    if explicit:
        return explicit
    url = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
    match = re.search(r"https://([^.]+)\.supabase\.co", url)
    if match:
        return match.group(1)
    raise ValueError("Set SUPABASE_URL or SUPABASE_PROJECT_REF in .env.")


def require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise ValueError(f"Missing {name} in .env.")
    return value


def api_request(method: str, path: str, token: str, body: dict | None = None) -> dict:
    url = f"{API_BASE}{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    request = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "Sirsee/1.0 (configure-google-auth)",
        },
        method=method,
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as error:
        raw = error.read().decode("utf-8", errors="ignore")
        try:
            payload = json.loads(raw)
            message = payload.get("message") or payload.get("error") or raw
        except json.JSONDecodeError:
            message = raw or str(error)
        raise ValueError(f"Supabase API error ({error.code}): {message}") from error


def merge_redirect_urls(existing: str) -> str:
    current = [part.strip() for part in (existing or "").split(",") if part.strip()]
    merged: list[str] = []
    for value in current + list(LOCAL_ORIGINS):
        if value not in merged:
            merged.append(value)
    return ",".join(merged)


def main() -> int:
    load_dotenv()
    ref = project_ref()
    token = require_env("SUPABASE_ACCESS_TOKEN")
    client_id = require_env("GOOGLE_CLIENT_ID")
    client_secret = require_env("GOOGLE_CLIENT_SECRET")

    current = api_request("GET", f"/projects/{ref}/config/auth", token)
    payload = {
        "site_url": "http://127.0.0.1:4174",
        "uri_allow_list": merge_redirect_urls(current.get("uri_allow_list", "")),
        "external_google_enabled": True,
        "external_google_client_id": client_id,
        "external_google_secret": client_secret,
    }
    api_request("PATCH", f"/projects/{ref}/config/auth", token, payload)

    callback = f"https://{ref}.supabase.co/auth/v1/callback"
    print("Google sign-in enabled for Sirsee.")
    print(f"Supabase callback URL: {callback}")
    print("Google Cloud OAuth client must include:")
    print("  Authorized JavaScript origins: http://127.0.0.1:4174")
    print(f"  Authorized redirect URIs: {callback}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ValueError as error:
        print(f"Error: {error}", file=sys.stderr)
        print(
            "\nRequired .env values:\n"
            "  SUPABASE_ACCESS_TOKEN — https://supabase.com/dashboard/account/tokens\n"
            "  GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET — Google Cloud OAuth web client\n"
            "  SUPABASE_URL — already set for this project",
            file=sys.stderr,
        )
        raise SystemExit(1) from error
