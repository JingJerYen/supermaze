#!/usr/bin/env bash
# Build the home-screen images from the sources in apps/client/assets-src/ui (ImageMagick 7).
#   home-bg.png            -> public/ui/home-bg.webp   (background painting, kept at source size)
#   btn-{gold,blue,stone}  -> public/ui/btn-*.webp     (button plates drawn on black: the black
#                                                       round the plate becomes transparent,
#                                                       then trimmed and scaled to 200 px high)
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=apps/client/assets-src/ui
OUT=apps/client/public/ui
mkdir -p "$OUT"
magick "$SRC/home-bg.png" -strip -quality 84 "$OUT/home-bg.webp"
for b in gold blue stone; do
  magick "$SRC/btn-$b.png" -alpha set -fuzz 9% -fill none \
    -draw "color 0,0 floodfill" -draw "color %[fx:w-1],0 floodfill" \
    -draw "color 0,%[fx:h-1] floodfill" -draw "color %[fx:w-1],%[fx:h-1] floodfill" \
    -trim +repage -resize x200 -strip -quality 90 "$OUT/btn-$b.webp"
done
magick identify -format "%f %wx%h %b\n" "$OUT"/*.webp
