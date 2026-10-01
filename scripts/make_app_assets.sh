#!/usr/bin/env bash
# Android launcher icons and splash screen from the same square source as the
# web icons (scripts/make_icons.sh), via @capacitor/assets.
#   scripts/make_app_assets.sh [source]   default: apps/client/assets-src/app-icon.webp
# Adaptive icon: the tile with rounded corners at 70% (inside the launcher's
# safe zone) over a blurred, darker copy of itself, like the maskable web icon.
# Splash: the tile on black, landscape only (Android 12+ shows the launcher icon instead).
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=${1:-apps/client/assets-src/app-icon.webp}
IM=$(command -v magick || command -v convert)
# @capacitor/assets only reads a directory inside the project, so stage there.
OUT=$PWD/apps/client/.app-assets
rm -rf "$OUT" && mkdir -p "$OUT"
trap 'rm -rf "$OUT"' EXIT
"$IM" "$SRC" -resize 1024x1024 -strip "$OUT/icon-only.png"
"$IM" "$SRC" -resize 1334x1334^ -gravity center -extent 1024x1024 -blur 0x40 -modulate 80 -strip "$OUT/icon-background.png"
"$IM" "$SRC" -resize 716x716 \( -size 716x716 xc:black -fill white -draw "roundrectangle 0,0 715,715 60,60" \) \
  -alpha off -compose CopyOpacity -composite "$OUT/tile.png"
"$IM" -size 1024x1024 xc:none "$OUT/tile.png" -gravity center -compose over -composite -strip "$OUT/icon-foreground.png"
"$IM" -size 2732x2732 xc:black \( "$SRC" -resize 640x640 \) -gravity center -compose over -composite -strip "$OUT/splash.png"
cp "$OUT/splash.png" "$OUT/splash-dark.png"
rm "$OUT/tile.png"
cd apps/client
npx --yes @capacitor/assets@3 generate --android --assetPath .app-assets --iconBackgroundColor '#000000' --splashBackgroundColor '#000000'
# The game is landscape only and the splash is the same in dark mode: drop the
# portrait and night copies (about 4 MB of the APK).
rm -rf android/app/src/main/res/drawable-port-* android/app/src/main/res/drawable-*night*
echo "android icons and splash written to apps/client/android/app/src/main/res"
