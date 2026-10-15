#!/bin/bash
# Waybar custom/audio module — split off the old combined soundbright
# module. Shows a plain icon normally; for ~2s after a volume key press
# (signaled by volume-adjust.sh via RTMIN+8) shows icon + level instead.

TRIGGER_FILE=/tmp/audio-trigger

now=$(date +%s%3N)
trigger=$(cat "$TRIGGER_FILE" 2>/dev/null || echo 0)
elapsed=$(( now - trigger ))

if [ "$elapsed" -lt 2000 ]; then
    vol_raw=$(wpctl get-volume @DEFAULT_AUDIO_SINK@)
    pct=$(echo "$vol_raw" | grep -oP '[\d.]+' | head -1 | awk '{printf "%d", $1*100}')
    if echo "$vol_raw" | grep -q MUTED; then
        echo "{\"text\":\"󰝟  Muted\",\"class\":\"active\"}"
    else
        echo "{\"text\":\"󰕾  ${pct}%\",\"class\":\"active\"}"
    fi
else
    echo "{\"text\":\"󰕾\",\"class\":\"idle\"}"
fi
