#!/usr/bin/env python3
"""Download representative merchant images from shop websites into assets/merchants/."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from server import MERCHANTS_PATH, resolve_merchant_image  # noqa: E402


def main() -> None:
    merchants = json.loads(MERCHANTS_PATH.read_text(encoding="utf-8"))
    for merchant in merchants:
        image = resolve_merchant_image(merchant)
        print(f"{merchant['id']}: {image}")


if __name__ == "__main__":
    main()
