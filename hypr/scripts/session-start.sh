#!/usr/bin/env zsh

# stop other wallpaper managers
pkill swww-daemon 2>/dev/null
pkill swww 2>/dev/null
pkill swaybg 2>/dev/null

# start hyprpaper first
setsid hyprpaper >/dev/null 2>&1 &

# give hyprpaper a moment to start
sleep 0.5

# start other things AFTER wallpaper
setsid nm-applet >/dev/null 2>&1 &
setsid blueman-applet >/dev/null 2>&1 &
setsid waybar >/dev/null 2>&1 &
