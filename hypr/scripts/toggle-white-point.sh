#!/bin/bash
# decoration:screen_shader is applied per-output by Hyprland, so this one
# toggle covers both eDP-1 and HDMI-A-1 (Philips) at once -- no per-monitor
# scoping needed here, unlike warmth (see set-warmth.sh).
SHADER=~/.config/hypr/shaders/reduce-white-point.frag
SCRIPT_DIR="$(dirname "$0")"

CURRENT=$(hyprctl getoption decoration:screen_shader | awk -F': ' '/^str:/{print $2}')

if [ "$CURRENT" = "$SHADER" ]; then
    "$SCRIPT_DIR/set-white-point.sh" off
else
    "$SCRIPT_DIR/set-white-point.sh" on
fi
