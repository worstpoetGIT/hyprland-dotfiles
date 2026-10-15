#!/bin/bash

WALLDIR="$HOME/Scripts-and-Media/2.Wallpapers"
CONF="$HOME/.config/hypr/hyprpaper.conf"

chosen=$(find "$WALLDIR" -maxdepth 1 -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" -o -iname "*.webp" \) \
  | sed "s|$WALLDIR/||" \
  | sort \
  | fuzzel --dmenu --prompt "Wallpaper: ")

[ -z "$chosen" ] && exit 0

wall="$WALLDIR/$chosen"

# Apply to every currently connected monitor, not just the laptop panel,
# so it isn't blank on an external display.
monitors=$(hyprctl monitors -j | jq -r '.[].name')

{
  for mon in $monitors; do
    echo "wallpaper {"
    echo "    monitor = $mon"
    echo "    path = $wall"
    echo "    fit_mode = cover"
    echo "}"
  done
  echo
  echo "splash = false"
  echo "ipc = true"
} > "$CONF"

pkill hyprpaper 2>/dev/null
hyprpaper >/dev/null 2>&1 &

sleep 1
~/.config/matugen/apply.sh "$wall"
sudo cp ~/.cache/sddm-colors.json /usr/share/sddm/themes/material-you/colors.json
sudo python3 ~/.config/hypr/scripts/update-sddm-colors.py
set-sddm-wallpaper "$wall"
