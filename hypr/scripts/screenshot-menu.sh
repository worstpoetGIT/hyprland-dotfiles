#!/usr/bin/env bash

set -euo pipefail

DIR="$HOME/Pictures/Screenshots"
mkdir -p "$DIR"

choice=$(printf "󰹑\tRegion\n󰆞\tWindow\n󰍹\tFull Screen" \
    | fuzzel --dmenu --prompt "Screenshot: ")

[ -z "$choice" ] && exit 0

case "$choice" in
    "󰹑"$'\t'"Region")
        hyprshot -m region -o "$DIR"
        ;;
    "󰆞"$'\t'"Window")
        hyprshot -m window -o "$DIR"
        ;;
    "󰍹"$'\t'"Full Screen")
        hyprshot -m output -o "$DIR"
        ;;
esac
