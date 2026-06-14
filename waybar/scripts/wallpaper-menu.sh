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

cat > "$CONF" <<HYPREOF
wallpaper {
    monitor = $MONITOR
    path = $wall
    fit_mode = cover
}
splash = false
ipc = true
HYPREOF

pkill hyprpaper 2>/dev/null
hyprpaper >/dev/null 2>&1 &
sleep 1
set-sddm-wallpaper "$wall"

# Regenerate matugen colors — wait for it to finish
matugen image "$wall" --color-index 0

# Wait for colors.css to be written then restart AGS
sleep 1
pkill -9 -f gjs 2>/dev/null
sleep 0.5
setsid ags run --gtk 4 /home/worst_poet/.config/ags/app.js > /tmp/ags.log 2>&1 &
