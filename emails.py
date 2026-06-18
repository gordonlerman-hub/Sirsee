"""Transactional emails for Sirsee reminder notifications."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path


def _load_env() -> None:
    env_path = Path(__file__).resolve().parent / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_env()

FREQUENCY_INTERVALS = {
    "monthly": timedelta(days=30),
    "quarterly": timedelta(days=91),
    "biannual": timedelta(days=182),
}

FREQUENCY_LABELS = {
    "monthly": "every month",
    "quarterly": "every 3 months",
    "biannual": "every 6 months",
}


def app_url() -> str:
    return os.environ.get("APP_URL", "http://127.0.0.1:4174").rstrip("/")


def frequency_label(frequency: str) -> str:
    return FREQUENCY_LABELS.get(frequency, "on your schedule")


def next_send_at_iso(frequency: str, *, from_time: datetime | None = None) -> str:
    start = from_time or datetime.now(timezone.utc)
    interval = FREQUENCY_INTERVALS.get(frequency, FREQUENCY_INTERVALS["quarterly"])
    return (start + interval).replace(microsecond=0).isoformat()


def email_configured() -> bool:
    return bool(os.environ.get("RESEND_API_KEY", "").strip())


def send_email(*, to: str, subject: str, html: str, text: str) -> None:
    api_key = os.environ.get("RESEND_API_KEY", "").strip()
    from_address = os.environ.get("RESEND_FROM_EMAIL", "Sirsee <onboarding@resend.dev>").strip()

    if not api_key:
        print(f"[sirsee-email] To: {to}")
        print(f"[sirsee-email] Subject: {subject}")
        print(f"[sirsee-email] {text}")
        return

    payload = {
        "from": from_address,
        "to": [to],
        "subject": subject,
        "html": html,
        "text": text,
    }
    request = urllib.request.Request(
        "https://api.resend.com/emails",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            response.read()
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"Could not send email ({error.code}): {detail}") from error
    except (urllib.error.URLError, TimeoutError) as error:
        raise RuntimeError("Could not send email. Try again.") from error


def _layout(*, title: str, body_html: str, body_text: str) -> tuple[str, str]:
    html = f"""<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f6f1ea;font-family:Inter,Arial,sans-serif;color:#1f2a28;">
    <div style="max-width:560px;margin:0 auto;background:#fffdf9;border:1px solid #e7ddd1;border-radius:8px;padding:24px;">
      <p style="margin:0 0 8px;font-size:12px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#2f645d;">Sirsee</p>
      <h1 style="margin:0 0 16px;font-size:24px;line-height:1.2;">{title}</h1>
      {body_html}
      <p style="margin:24px 0 0;color:#6d7774;font-size:13px;line-height:1.5;">
        Small spontaneous gifts in Chicagoland.
      </p>
    </div>
  </body>
</html>"""
    text = f"{title}\n\n{body_text}\n\n— Sirsee"
    return html, text


def send_signup_confirmation(reminder: dict) -> None:
    name = reminder["recipientName"]
    frequency = frequency_label(reminder["frequency"])
    subject = f"You're set — Sirsee will nudge you about {name}"
    body_html = f"""
      <p style="margin:0 0 12px;line-height:1.6;color:#3a4543;">
        You're signed up for gift reminders for <strong>{name}</strong>.
      </p>
      <p style="margin:0 0 12px;line-height:1.6;color:#3a4543;">
        We'll email you <strong>{frequency}</strong> with fresh Chicagoland picks matched to your brief
        (up to ${reminder['budget']} · ZIP {reminder['zipCode']} · {reminder.get('likesSummary') or 'local surprises'}).
      </p>
      <p style="margin:0;line-height:1.6;color:#3a4543;">
        Your first nudge is on the way when your schedule hits. You can change timing or cancel anytime from your
        <a href="{app_url()}" style="color:#2f645d;">Sirsee account</a>.
      </p>
    """
    body_text = (
        f"You're signed up for gift reminders for {name}.\n"
        f"We'll email you {frequency} with fresh Chicagoland picks.\n"
        f"Manage reminders: {app_url()}"
    )
    html, text = _layout(title="Reminder confirmed", body_html=body_html, body_text=body_text)
    send_email(to=reminder["email"], subject=subject, html=html, text=text)


def send_reminder_digest(reminder: dict, gifts: list[dict], location: dict) -> None:
    name = reminder["recipientName"]
    place = location.get("place") or "Chicagoland"
    subject = f"Gift ideas for {name} — Sirsee"
    gift_lines_html = ""
    gift_lines_text = ""
    for gift in gifts[:3]:
        gift_lines_html += f"""
          <li style="margin:0 0 12px;line-height:1.5;color:#3a4543;">
            <strong>{gift['name']}</strong> from {gift['merchant']} ({gift['neighborhood']}) · ${gift['price']}<br />
            <a href="{gift['link']}" style="color:#2f645d;">View merchant</a>
          </li>
        """
        gift_lines_text += f"- {gift['name']} from {gift['merchant']} ({gift['neighborhood']}) — {gift['link']}\n"

    body_html = f"""
      <p style="margin:0 0 12px;line-height:1.6;color:#3a4543;">
        Time for a small spontaneous gift for <strong>{name}</strong>. Here are fresh picks near {place}:
      </p>
      <ul style="margin:0 0 16px;padding-left:20px;">
        {gift_lines_html}
      </ul>
      <p style="margin:0;line-height:1.6;color:#3a4543;">
        <a href="{app_url()}" style="color:#2f645d;">Open Sirsee</a> to see more ideas or update your reminder.
      </p>
    """
    body_text = (
        f"Time for a small spontaneous gift for {name}. Fresh picks near {place}:\n"
        f"{gift_lines_text}\n"
        f"Open Sirsee: {app_url()}"
    )
    html, text = _layout(title=f"Gift ideas for {name}", body_html=body_html, body_text=body_text)
    send_email(to=reminder["email"], subject=subject, html=html, text=text)


def send_unsubscribe_confirmation(reminder: dict) -> None:
    name = reminder["recipientName"]
    subject = f"Reminders canceled for {name}"
    body_html = f"""
      <p style="margin:0 0 12px;line-height:1.6;color:#3a4543;">
        You won't receive any more scheduled gift nudges for <strong>{name}</strong>.
      </p>
      <p style="margin:0;line-height:1.6;color:#3a4543;">
        Changed your mind? You can set a new reminder anytime from
        <a href="{app_url()}" style="color:#2f645d;">Sirsee</a>.
      </p>
    """
    body_text = (
        f"You won't receive any more scheduled gift nudges for {name}.\n"
        f"Set a new reminder anytime: {app_url()}"
    )
    html, text = _layout(title="You're unsubscribed", body_html=body_html, body_text=body_text)
    send_email(to=reminder["email"], subject=subject, html=html, text=text)
