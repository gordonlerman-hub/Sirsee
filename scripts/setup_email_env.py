#!/usr/bin/env python3
"""Fetch Supabase service role key and append email env vars to .env."""

from __future__ import annotations

import json
import re
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT / ".env"


def load_env() -> dict[str, str]:
    values: dict[str, str] = {}
    if not ENV_PATH.exists():
        return values
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        values[key.strip()] = value.strip()
    return values


def project_ref(env: dict[str, str]) -> str:
    explicit = env.get("SUPABASE_PROJECT_REF", "").strip()
    if explicit:
        return explicit
    url = env.get("SUPABASE_URL", "").rstrip("/")
    if url.endswith(".supabase.co"):
        return url.rsplit("/", 1)[-1].split(".", 1)[0]
    raise SystemExit("Set SUPABASE_URL in .env first.")


def fetch_service_role_key(token: str, ref: str) -> str:
    request = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{ref}/api-keys",
        headers={"Authorization": f"Bearer {token}"},
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        if error.code == 403:
            raise SystemExit(
                "Supabase access token cannot read API keys. Paste SUPABASE_SERVICE_ROLE_KEY manually:\n"
                "  Supabase Dashboard → Project Settings → API → service_role"
            ) from error
        raise
    for item in payload:
        if item.get("name") == "service_role" and item.get("api_key"):
            return item["api_key"]
    raise SystemExit("Could not find service_role key in Supabase project.")


def upsert_env_line(lines: list[str], key: str, value: str) -> list[str]:
    pattern = re.compile(rf"^{re.escape(key)}=")
    replaced = False
    next_lines: list[str] = []
    for line in lines:
        if pattern.match(line):
            next_lines.append(f"{key}={value}")
            replaced = True
        else:
            next_lines.append(line)
    if not replaced:
        if next_lines and next_lines[-1].strip():
            next_lines.append("")
        next_lines.append(f"{key}={value}")
    return next_lines


def main() -> None:
    env = load_env()
    token = env.get("SUPABASE_ACCESS_TOKEN", "").strip()
    if not token:
        raise SystemExit("Set SUPABASE_ACCESS_TOKEN in .env first.")

    service_role = fetch_service_role_key(token, project_ref(env))
    lines = ENV_PATH.read_text(encoding="utf-8").splitlines() if ENV_PATH.exists() else []

    if "# Reminder emails" not in "\n".join(lines):
        lines.extend(["", "# Reminder emails"])

    updates = {
        "SUPABASE_SERVICE_ROLE_KEY": service_role,
        "APP_URL": env.get("APP_URL", "http://127.0.0.1:4174"),
        "RESEND_FROM_EMAIL": env.get("RESEND_FROM_EMAIL", "Sirsee <onboarding@resend.dev>"),
    }
    for key, value in updates.items():
        lines = upsert_env_line(lines, key, value)

    ENV_PATH.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
    print("Updated .env with SUPABASE_SERVICE_ROLE_KEY, APP_URL, and RESEND_FROM_EMAIL.")
    if not env.get("RESEND_API_KEY"):
        print("Add RESEND_API_KEY to .env when you have a Resend key (emails log to console until then).")


if __name__ == "__main__":
    main()
