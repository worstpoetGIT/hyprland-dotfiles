#!/bin/bash

WALLDIR="$HOME/Scripts-and-Media/2.Wallpapers"
MONITOR="eDP-1"
CONF="$HOME/.config/hypr/hyprpaper.conf"

chosen=$(find "$WALLDIR" -maxdepth 1 -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" -o -iname "*.webp" \) \
  | sed "s|$WALLDIR/||" \
  | sort \
  | fuzzel --dmenu --prompt "Wallpaper: ")

[ -z "$chosen" ] && exit 0

wall="$WALLDIR/$chosen"

cat > "$CONF" <<EOF
wallpaper {
    monitor = $MONITOR
    path = $wall
    fit_mode = cover
}

splash = false
ipc = true
EOF

pkill hyprpaper 2>/dev/null
hyprpaper >/dev/null 2>&1 &

sleep 1
matugen image "$wall" --source-color-index 0
sudo cp ~/.cache/sddm-colors.json /usr/share/sddm/themes/material-you/colors.json
sudo python3 ~/.config/hypr/scripts/update-sddm-colors.py
set-sddm-wallpaper "$wall"
