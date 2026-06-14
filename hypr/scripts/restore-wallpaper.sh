#!/bin/bash
WALLPAPER=/home/worst_poet/Scripts-and-Media/2.Wallpapers/212.png

mkdir -p "$HOME/.config/hypr"
cat > "$HOME/.config/hypr/hyprpaper.conf" <<EOF
preload = $WALLPAPER
wallpaper = ,$WALLPAPER
splash = false
ipc = true
EOF

if pgrep -x hyprpaper >/dev/null 2>&1; then
    hyprctl hyprpaper unload all >/dev/null 2>&1 || true
    hyprctl hyprpaper preload "$WALLPAPER" >/dev/null 2>&1 || true
    hyprctl hyprpaper wallpaper ",$WALLPAPER" >/dev/null 2>&1 || true
else
    setsid hyprpaper >/dev/null 2>&1 &
fi
