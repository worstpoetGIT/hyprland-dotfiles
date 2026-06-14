#!/bin/bash

STAMP_FILE="/tmp/waybar_media_stamp"
PAUSED_STAMP="/tmp/waybar_media_paused_stamp"

status=$(playerctl status 2>/dev/null)
player=$(playerctl metadata --format "{{playerName}}" 2>/dev/null)

if [[ "$status" == "Playing" ]]; then
    touch "$STAMP_FILE"
    rm -f "$PAUSED_STAMP"
    echo "{\"text\": \"▶  $player\", \"class\": \"playing\"}"

elif [[ "$status" == "Paused" ]]; then
    if [[ ! -f "$PAUSED_STAMP" ]]; then
        touch "$PAUSED_STAMP"
    fi

    paused_for=$(( $(date +%s) - $(stat -c %Y "$PAUSED_STAMP") ))

    if [[ $paused_for -ge 120 ]]; then
        echo "{\"text\": \"\", \"class\": \"hidden\"}"
    else
        echo "{\"text\": \"⏸  $player\", \"class\": \"paused\"}"
    fi

else
    if [[ ! -f "$STAMP_FILE" ]]; then
        touch "$STAMP_FILE"
    fi

    stopped_for=$(( $(date +%s) - $(stat -c %Y "$STAMP_FILE") ))

    if [[ $stopped_for -ge 60 ]]; then
        echo "{\"text\": \"\", \"class\": \"hidden\"}"
    else
        echo "{\"text\": \"\", \"class\": \"hidden\"}"
    fi
fi
