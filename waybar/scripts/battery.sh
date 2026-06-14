#!/usr/bin/env bash
CAPACITY=$(cat /sys/class/power_supply/BAT0/capacity)
AC=$(cat /sys/class/power_supply/AC/online 2>/dev/null || echo "0")
PROFILE=$(cat /sys/class/power_supply/BAT0/charge_control_end_threshold 2>/dev/null || echo "100")

[[ $CAPACITY -lt 0 ]] && CAPACITY=0
[[ $CAPACITY -gt 100 ]] && CAPACITY=100

if [[ "$AC" == "1" ]]; then
    BASE=0xE065
    CLASS="charging"
else
    BASE=0xE000
    CLASS="normal"
fi

CODEPOINT=$(( BASE + CAPACITY ))
GLYPH=$(python3 -c "print(chr($CODEPOINT), end='')")
echo "{\"text\": \"${GLYPH} <span font='SF Pro Display Bold 10'>${CAPACITY}</span>\", \"class\": \"${CLASS}\"}"
