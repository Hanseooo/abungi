# Abungi Asset Manifest

Runtime assets are local. The current v0.2 identity illustrations/backgrounds are original temporary SVG cutouts generated specifically for this project by `scripts/generate_local_assets.py`; the WAV files are original synthesized tones/loops generated locally for this project. They are not third-party downloads and have no external runtime dependency.

## External approved assets

The downloader reads the table below. **There are currently no external approved entries**, so running it performs no downloads. Add a row only after inspecting the exact asset and verifying its license.

| id | type | source | sourceUrl | license | licenseUrl | author | destination | sha256 | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

## Local original/generated assets

| group | count | location | provenance | notes |
| --- | ---: | --- | --- | --- |
| playable cutouts | 11 | `public/assets/cutouts/character-*.svg` | project-original generated vector | stable IDs; replaceable |
| normal enemy cutouts | 10 | `public/assets/cutouts/enemy-*.svg` | project-original generated vector | stable IDs; replaceable |
| elite cutouts | 3 | `public/assets/cutouts/elite-*.svg` | project-original generated vector | stable IDs; replaceable |
| boss cutouts | 3 | `public/assets/cutouts/boss-*.svg` | project-original generated vector | stable IDs; replaceable |
| theatre backgrounds | 4 | `public/assets/backgrounds/*.svg` | project-original generated vector | title + 3 regions |
| install icons | 2 | `public/assets/icons/*.png` | project-original generated icon | PWA 192/512 |
| SFX/music | 16 | `public/audio/*.wav` | project-original synthesized audio | UI/combat/shop/music |

If future external audio/UI assets are introduced, prefer CC0 (Kenney where suitable), record every required field above, download locally, verify checksums, and never hotlink.
