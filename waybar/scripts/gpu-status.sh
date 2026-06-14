#!/bin/bash

if command -v nvidia-smi >/dev/null 2>&1; then
    usage=$(nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits | head -n1 | tr -d ' ')
    echo "{\"text\":\"󰢮  ${usage}%\",\"class\":\"gpu\"}"
elif [ -f /sys/class/drm/card0/device/gpu_busy_percent ]; then
    usage=$(cat /sys/class/drm/card0/device/gpu_busy_percent 2>/dev/null)
    echo "{\"text\":\"󰢮  ${usage}%\",\"class\":\"gpu\"}"
else
    echo "{\"text\":\"󰢮  N/A\",\"class\":\"gpu\"}"
fi

