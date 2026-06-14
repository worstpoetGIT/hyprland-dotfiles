#!/bin/bash

CURRENT=$(cat /sys/firmware/acpi/platform_profile 2>/dev/null)

case "$CURRENT" in
  low-power)   NEXT="balanced" ;;
  balanced)    NEXT="performance" ;;
  performance) NEXT="low-power" ;;
  *)           NEXT="balanced" ;;
esac

echo "$NEXT" | sudo tee /sys/firmware/acpi/platform_profile > /dev/null
pkill -RTMIN+9 waybar
