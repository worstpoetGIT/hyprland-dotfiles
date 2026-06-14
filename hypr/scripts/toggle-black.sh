#!/bin/bash

STATE_FILE="/tmp/hypr-black-toggle"
BLACK_WALLPAPER="/tmp/black.png"

MONITOR=$(hyprctl hyprpaper listactive | awk -F': ' '{print $1}')

# Create black wallpaper once
if [ ! -f "$BLACK_WALLPAPER" ]; then
    python3 -c "from PIL import Image; Image.new('RGB', (1920,1080), (0,0,0)).save('$BLACK_WALLPAPER')" 2>/dev/null || \
    convert -size 1920x1080 xc:#000000 "$BLACK_WALLPAPER" 2>/dev/null
fi

if [ -f "$STATE_FILE" ]; then
    ORIGINAL=$(cat "$STATE_FILE")
    hyprctl hyprpaper wallpaper "$MONITOR,$ORIGINAL"
    rm "$STATE_FILE"
else
    CURRENT=$(hyprctl hyprpaper listactive | awk -F': ' '{print $2}')
    echo "$CURRENT" > "$STATE_FILE"
    hyprctl hyprpaper preload "$BLACK_WALLPAPER"
    hyprctl hyprpaper wallpaper "$MONITOR,$BLACK_WALLPAPER"
fi
