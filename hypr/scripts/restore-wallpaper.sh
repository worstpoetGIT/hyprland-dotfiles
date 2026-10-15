#!/bin/bash
WALLPAPER=/home/worst_poet/Scripts-and-Media/2.Wallpapers/212_display.png

mkdir -p "$HOME/.config/hypr"
monitors=$(hyprctl monitors -j 2>/dev/null | jq -r '.[].name')
[ -z "$monitors" ] && monitors="eDP-1"

{
  for mon in $monitors; do
    echo "wallpaper {"
    echo "    monitor = $mon"
    echo "    path = $WALLPAPER"
    echo "    fit_mode = cover"
    echo "}"
  done
  echo
  echo "splash = false"
  echo "ipc = true"
} > "$HOME/.config/hypr/hyprpaper.conf"

pkill -x hyprpaper >/dev/null 2>&1 || true
sleep 0.3
setsid hyprpaper >/dev/null 2>&1 &
