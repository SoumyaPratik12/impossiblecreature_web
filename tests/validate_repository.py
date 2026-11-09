#!/usr/bin/env python3
"""Lightweight checks for the browser prototype repository."""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = [
    "README.md",
    "docs/architecture/OVERVIEW.md",
    "docs/research/PORTING_FEASIBILITY.md",
    "docs/decisions/ADR-0001-PORTING-STRATEGY.md",
    "prototype/index.html",
    "prototype/style.css",
    "prototype/src/main.js",
]

def main() -> int:
    missing = [path for path in REQUIRED if not (ROOT / path).is_file()]
    if missing:
        print("Missing required files:")
        for path in missing:
            print(f" - {path}")
        return 1

    html = (ROOT / "prototype/index.html").read_text(encoding="utf-8")
    js = (ROOT / "prototype/src/main.js").read_text(encoding="utf-8")
    if 'id="battlefield"' not in html:
        print("Prototype canvas element not found")
        return 1
    if not re.search(r'getElementById\(["\']battlefield["\']\)', js):
        print("JavaScript does not initialize the battlefield canvas")
        return 1
    if "localStorage" not in js:
        print("Expected prototype save/load implementation not found")
        return 1

    print(f"Repository validation passed ({len(REQUIRED)} required files).")
    return 0

if __name__ == "__main__":
    sys.exit(main())
