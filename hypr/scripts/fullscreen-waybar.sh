#!/bin/bash
handle() {
  case $1 in
    fullscreen>>1) waybar & ;;        # exiting fullscreen → show waybar
    fullscreen>>0) killall waybar ;;  # entering fullscreen → hide waybar
  esac
}

socat - "UNIX-CONNECT:$XDG_RUNTIME_DIR/hypr/$HYPRLAND_INSTANCE_SIGNATURE/.socket2.sock" | while read -r line; do
  handle "$line"
done
