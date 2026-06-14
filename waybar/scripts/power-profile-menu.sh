#!/bin/bash

choice=$(printf "󰓅  Performance\n󰾅  Balanced\n󰓃  Power Saver" | \
    fuzzel --dmenu --prompt "Power Profile: ")

case "$choice" in
    "󰓅  Performance")
        powerprofilesctl set performance
        ;;
    "󰾅  Balanced")
        powerprofilesctl set balanced
        ;;
    "󰓃  Power Saver")
        powerprofilesctl set power-saver
        ;;
esac

