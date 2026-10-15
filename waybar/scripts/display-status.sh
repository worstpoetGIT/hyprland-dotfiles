#!/bin/bash
# Waybar custom/display module — split off the old combined soundbright
# module. Shows a plain icon normally; for ~2s after a brightness key press
# (signaled by brightness.sh via RTMIN+8) shows icon + level instead.

TRIGGER_FILE=/tmp/display-trigger
MONITOR_SN="UHB2627011915"
DDC_STATE_FILE="/tmp/ddc-brightness-state-${MONITOR_SN}"

now=$(date +%s%3N)
trigger=$(cat "$TRIGGER_FILE" 2>/dev/null || echo 0)
elapsed=$(( now - trigger ))

if [ "$elapsed" -lt 2000 ]; then
    # brightness.sh drives the Philips monitor via DDC/CI when it's the
    # connected display, not the laptop's own amdgpu_bl1 backlight — read
    # whichever one it actually adjusted, same routing logic it uses.
    if hyprctl monitors -j | jq -r '.[].name' | grep -qx "HDMI-A-1" && [ -f "$DDC_STATE_FILE" ]; then
        pct=$(cat "$DDC_STATE_FILE")
    else
        # brightnessctl's own -m percent field, not a hardcoded MAX — the real
        # device max (65535) doesn't match what was hardcoded before (64764).
        pct=$(brightnessctl -d amdgpu_bl1 -m | cut -d, -f4 | tr -d '%')
    fi
    echo "{\"text\":\"󰃟  ${pct}%\",\"class\":\"active\"}"
else
    echo "{\"text\":\"󰍹\",\"class\":\"idle\"}"
fi
