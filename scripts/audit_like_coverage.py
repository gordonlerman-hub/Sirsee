#!/usr/bin/env python3
"""Report curated merchant coverage for each like option shown in the UI."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MERCHANTS_PATH = ROOT / "data" / "merchants.json"
MIN_CURATED_MATCHES = 2

LIKE_OPTIONS = {
    "female": ["flowers", "sweets", "coffee", "home", "foodie", "cozy"],
    "male": ["coffee", "sweets", "home", "plants", "foodie", "bar"],
}


def main() -> None:
    merchants = json.loads(MERCHANTS_PATH.read_text())
    weak: list[str] = []

    for gender, likes in LIKE_OPTIONS.items():
        print(f"\n{gender}:")
        for like in likes:
            matches = sorted({m["merchant"] for m in merchants if like in m.get("likes", [])})
            status = "ok" if len(matches) >= MIN_CURATED_MATCHES else "WEAK"
            if status == "WEAK":
                weak.append(f"{gender}:{like}")
            print(f"  {like:8} {len(matches):2} curated [{status}]")
            for name in matches:
                print(f"            - {name}")

    if weak:
        print("\nWeak likes (fewer than", MIN_CURATED_MATCHES, "curated merchants):")
        for item in weak:
            print(" ", item)
    else:
        print("\nAll visible likes meet the curated coverage threshold.")


if __name__ == "__main__":
    main()
