#!/usr/bin/env python3
"""
Copy seed notes into the Neurona vault without overwriting existing notes.
Run: python3 infra/seed_vault.py
"""
from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.resolve()
SEED_DIR = Path(__file__).parent / "seed"
VAULT_ROOT = Path(os.environ.get("VAULT_ROOT", str(REPO_ROOT / "Neurona")))


def main() -> None:
    if not SEED_DIR.exists():
        print(f"Seed directory not found: {SEED_DIR}", file=sys.stderr)
        sys.exit(1)

    seeded = 0
    skipped = 0
    for src in sorted(SEED_DIR.rglob("*.md")):
        rel = src.relative_to(SEED_DIR)
        dst = VAULT_ROOT / rel
        if dst.exists():
            print(f"  skip (exists): {rel}")
            skipped += 1
            continue
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        print(f"  seeded: {rel}")
        seeded += 1

    print(f"\nDone: {seeded} seeded, {skipped} skipped.")


if __name__ == "__main__":
    main()
