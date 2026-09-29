#!/usr/bin/env bash
# Build every app icon from one square source image (ImageMagick 7).
#   scripts/make_icons.sh [source]     default: apps/client/assets-src/app-icon.webp
# The source is a full-bleed square tile (rounded corners drawn on a dark ground are fine).
# The maskable icon puts the tile at 78% over a blurred copy of itself, so launcher
# masks (circle, squircle) keep the whole picture.
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=${1:-apps/client/assets-src/app-icon.webp}
OUT=apps/client/public/icons
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
magick "$SRC" -resize 512x512 -strip "$OUT/icon-512.png"
magick "$SRC" -resize 192x192 -strip "$OUT/icon-192.png"
magick "$SRC" -resize 180x180 -strip "$OUT/apple-touch-icon.png"
magick "$SRC" -resize 48x48 -strip "$OUT/favicon-48.png"
magick "$SRC" -resize 32x32 -strip "$OUT/favicon-32.png"
magick "$SRC" -resize 400x400 \( -size 400x400 xc:black -fill white -draw "roundrectangle 0,0 399,399 34,34" \) \
  -alpha off -compose CopyOpacity -composite "$TMP/tile.png"
magick \( "$SRC" -resize 666x666^ -gravity center -extent 512x512 -blur 0x24 -modulate 80 \) "$TMP/tile.png" \
  -gravity center -compose over -composite -strip "$OUT/icon-maskable-512.png"
echo "icons written to $OUT"
