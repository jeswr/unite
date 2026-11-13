#!/usr/bin/env bash
# Vercel build for the overview: fetch the walkthrough videos from the showcase-media branch.
set -euo pipefail
BASE="https://raw.githubusercontent.com/jeswr/unite/showcase-media"
mkdir -p media
for f in unite-walkthrough.mp4 unite-walkthrough.vtt common-picture-walkthrough.mp4 common-picture-walkthrough.vtt common-picture-poster.jpg; do
  [ -s "media/$f" ] && continue
  curl -fsSL --retry 3 -o "media/$f" "$BASE/$f"
done
ls -la media
