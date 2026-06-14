#!/bin/bash

PROFILE=$(cat /sys/firmware/acpi/platform_profile 2>/dev/null || echo "unknown")

case "$PROFILE" in
  low-power)   ICON="battery_saver" ;;
  balanced)    ICON="balance" ;;
  performance) ICON="speed" ;;
  *)           ICON="power_settings_new" ;;
esac

echo "{\"text\": \"<span font='Material Symbols Rounded' size='large'>${ICON}</span>\", \"class\": \"$PROFILE\", \"tooltip\": false}"
