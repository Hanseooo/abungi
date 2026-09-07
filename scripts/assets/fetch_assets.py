#!/usr/bin/env python3
"""Download only explicitly approved external entries from docs/ASSET_MANIFEST.md.

The v0.1 manifest intentionally contains no external entries, so the script is a
safe no-op today. It becomes useful if individually reviewed CC0 assets are added.
"""
from __future__ import annotations

import hashlib
import pathlib
import sys
import urllib.request
from dataclasses import dataclass

ROOT = pathlib.Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "docs" / "ASSET_MANIFEST.md"

@dataclass(frozen=True)
class Asset:
    id: str
    type: str
    source: str
    source_url: str
    license: str
    license_url: str
    author: str
    destination: str
    sha256: str
    notes: str


def approved_assets() -> list[Asset]:
    text = MANIFEST.read_text(encoding="utf-8")
    section = text.split("## External approved assets", 1)[1].split("## Local original/generated assets", 1)[0]
    rows: list[Asset] = []
    for raw in section.splitlines():
        line = raw.strip()
        if not line.startswith("|") or line.startswith("| ---") or line.startswith("| id |"):
            continue
        cells = [cell.strip() for cell in line.strip("|").split("|")]
        if len(cells) != 10:
            raise ValueError(f"Malformed manifest row: {line}")
        rows.append(Asset(cells[0], cells[1], cells[2], cells[3], cells[4], cells[5], cells[6], cells[7].strip("`"), cells[8], cells[9]))
    return rows


def sha256(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def fetch(asset: Asset) -> None:
    if not asset.source_url.startswith("https://"):
        raise ValueError(f"{asset.id}: only HTTPS asset URLs are approved")
    if not asset.license or not asset.license_url or not asset.author:
        raise ValueError(f"{asset.id}: license metadata is incomplete")
    destination = (ROOT / asset.destination).resolve()
    if ROOT not in destination.parents:
        raise ValueError(f"{asset.id}: destination escapes project root")
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        if asset.sha256 and sha256(destination).lower() == asset.sha256.lower():
            print(f"SKIP {asset.id}: checksum already matches")
            return
        raise FileExistsError(f"{asset.id}: {destination} already exists and will not be overwritten")
    print(f"GET  {asset.id}: {asset.source_url}")
    try:
        with urllib.request.urlopen(asset.source_url, timeout=30) as response:
            data = response.read()
    except Exception as exc:  # friendly CLI boundary
        raise RuntimeError(f"{asset.id}: download failed: {exc}") from exc
    destination.write_bytes(data)
    actual = sha256(destination)
    if asset.sha256 and actual.lower() != asset.sha256.lower():
        destination.unlink(missing_ok=True)
        raise ValueError(f"{asset.id}: checksum mismatch (expected {asset.sha256}, got {actual})")
    print(f"OK   {asset.id}: {asset.license} by {asset.author} -> {asset.destination}")


def main() -> int:
    try:
        assets = approved_assets()
        if not assets:
            print("No external assets are approved in docs/ASSET_MANIFEST.md; nothing to download.")
            return 0
        for asset in assets:
            fetch(asset)
        print(f"Downloaded {len(assets)} approved asset(s).")
        return 0
    except Exception as exc:
        print(f"Asset fetch failed: {exc}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    raise SystemExit(main())
