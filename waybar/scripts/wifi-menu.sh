#!/bin/bash

get_networks() {
    nmcli -t -f SSID,SIGNAL,SECURITY,ACTIVE dev wifi list --rescan no 2>/dev/null | \
    awk -F: 'NF>=4 && $1!="" {
        icon = ($4 == "yes") ? "󰤨 " : "󰤥 "
        lock = ($3 != "--") ? " 󰌾" : ""
        printf "%s %s%s\n", icon, $1, lock
    }'
}

CHOICE=$(get_networks | rofi -dmenu \
    -p "󰤨  WiFi" \
    -theme ~/.config/rofi/glass-theme.rasi \
    -no-custom \
    -theme-str 'window { width: 400px; } listview { lines: 6; }')

[ -z "$CHOICE" ] && exit

SSID=$(echo "$CHOICE" | sed 's/^[^ ]* //' | sed 's/ 󰌾.*$//' | xargs)
[ -z "$SSID" ] && exit

if nmcli -t -f ACTIVE,SSID dev wifi | grep -q "^yes:$SSID"; then
    notify-send "WiFi" "Already connected to $SSID"
    exit
fi

if nmcli connection show "$SSID" &>/dev/null; then
    nmcli connection up "$SSID"
    notify-send "WiFi" "Connected to $SSID"
else
    PASSWORD=$(rofi -dmenu \
        -p "Password for $SSID" \
        -theme ~/.config/rofi/glass-theme.rasi \
        -password \
        -theme-str 'window { width: 380px; } listview { lines: 0; }')
    [ -z "$PASSWORD" ] && exit
    nmcli dev wifi connect "$SSID" password "$PASSWORD" && \
        notify-send "WiFi" "Connected to $SSID" || \
        notify-send "WiFi" "Failed to connect to $SSID"
fi
