#!/bin/bash

STATE_FILE="/tmp/hypr_fullscreen_all"

if [ -f "$STATE_FILE" ]; then
    # Restore
    hyprctl eval 'hl.config({general={gaps_out=100,gaps_in=20}})'
    rm "$STATE_FILE"
else
    # Fullscreen all
    hyprctl eval 'hl.config({general={gaps_out=0,gaps_in=0}})'
    touch "$STATE_FILE"
fi
