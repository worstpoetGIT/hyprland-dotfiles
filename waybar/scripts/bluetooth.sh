#!/usr/bin/env bash

get_state() {
  bluetoothctl show | awk '/Powered:/ {print $2}'
}

get_connected_device() {
  bluetoothctl devices Connected | sed 's/^Device [A-F0-9:]* //'
}

toggle_bluetooth() {
  state="$(get_state)"
  if [ "$state" = "yes" ]; then
    bluetoothctl power off >/dev/null 2>&1
  else
    bluetoothctl power on >/dev/null 2>&1
  fi
}

print_status() {
  state="$(get_state)"
  if [ "$state" = "yes" ]; then
    device="$(get_connected_device | head -n1)"
    if [ -n "$device" ]; then
      printf '{"text":"󰂱 %s","class":"on"}\n' "$device"
    else
      printf '{"text":"󰂯 ON","class":"on"}\n'
    fi
  else
    printf '{"text":"󰂲 OFF","class":"off"}\n'
  fi
}

case "$1" in
  --toggle)
    toggle_bluetooth
    pkill -RTMIN+8 waybar 2>/dev/null
    ;;
  --status)
    print_status
    ;;
  *)
    print_status
    ;;
esac
