#!/bin/bash
# Single entry point for running matugen. Applies the source color the user
# picked for this wallpaper (palette-picker.py writes choices.json), falling
# back to index 0 (most dominant) for wallpapers with no saved choice.
#   usage: apply.sh [wallpaper-path]   (defaults to the current hyprpaper one)

WALL="${1:-$(grep -m1 'path = ' ~/.config/hypr/hyprpaper.conf | awk '{print $3}')}"
CHOICES="$HOME/.config/matugen/choices.json"

IDX=$(python3 -I -c '
import json, sys
try:
    print(int(json.load(open(sys.argv[1])).get(sys.argv[2], 0)))
except Exception:
    print(0)
' "$CHOICES" "$WALL")

# Saved index can be stale if a wallpaper yields fewer colors than before.
matugen image "$WALL" --dry-run -q --source-color-index "$IDX" >/dev/null 2>&1 || IDX=0

# --continue-on-error: the dunst post_hook fails (dunst is masked here) and
# would otherwise abort the run before the later templates are written.
matugen image "$WALL" --source-color-index "$IDX" -m dark --continue-on-error >/dev/null 2>&1

# hyprland.lua only reads colors.css at startup/reload; push the border live.
PRIMARY=$(grep -oP '@define-color primary #\K[0-9a-fA-F]+' ~/.config/ags/style/colors.css)
if [ -n "$PRIMARY" ] && [ -n "$HYPRLAND_INSTANCE_SIGNATURE" ]; then
    hyprctl eval "hl.config({general={col={active_border=\"rgba(${PRIMARY}cc)\"}}})" >/dev/null 2>&1
fi
