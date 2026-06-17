#!/usr/bin/env python3
"""Verify curated merchant links support online ordering."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from server import MERCHANTS_PATH, qualify_order_link  # noqa: E402


def main() -> None:
    merchants = json.loads(MERCHANTS_PATH.read_text(encoding="utf-8"))
    passed = 0
    for merchant in merchants:
        item = {**merchant, "source": "curated"}
        ok, resolved = qualify_order_link(item)
        status = "OK" if ok else "FAIL"
        print(f"{status}\t{merchant['id']}\t{resolved}")
        if ok:
            passed += 1
    print(f"\n{passed}/{len(merchants)} merchants passed online-order checks.")


if __name__ == "__main__":
    main()
