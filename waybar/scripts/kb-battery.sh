#!/usr/bin/env bash
MAC="C3:9E:1A:4E:BD:5F"
DEV_PATH="/org/bluez/hci0/dev_${MAC//:/_}"

CONNECTED=$(busctl --system get-property org.bluez "$DEV_PATH" org.bluez.Device1 Connected 2>/dev/null | awk '{print $2}')

if [[ "$CONNECTED" != "true" ]]; then
    printf '{"text":"","tooltip":"","class":"idle"}\n'
    exit 0
fi

PCT=$(busctl --system get-property org.bluez "$DEV_PATH" org.bluez.Battery1 Percentage 2>/dev/null | awk '{print $2}')

if [[ -z "$PCT" ]]; then
    printf '{"text":"","tooltip":"","class":"idle"}\n'
    exit 0
fi

CLASS="normal"
[[ "$PCT" -le 20 ]] && CLASS="low"

printf '{"text":"󰥱","tooltip":"Aula F75 keyboard battery (Bluetooth): %s%%","class":"%s"}\n' "$PCT" "$CLASS"
