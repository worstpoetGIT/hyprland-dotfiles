#!/bin/bash
# Uses brightnessctl's own relative-percent stepping (like the volume script
# uses wpctl's 5%+/-) instead of manual raw-value math, which drifted off
# clean percentages over repeated presses.
#
# When the Philips monitor is connected over HDMI, these keys drive its
# brightness via DDC/CI (ddcutil) instead of the laptop panel, since an
# external display has no /sys backlight device. Targeted by serial number
# so it keeps working if ddcutil's display numbering shifts.
DEVICE="amdgpu_bl1"
MONITOR_SN="UHB2627011915"
STATE_FILE="/tmp/ddc-brightness-state-${MONITOR_SN}"
STEP=10

external_connected() {
    hyprctl monitors -j | jq -r '.[].name' | grep -qx "HDMI-A-1"
}

if external_connected; then
    # DDC/CI over HDMI is slow and this bind repeats on key-hold; skip instead
    # of piling up stale commands if a previous call is still in flight.
    exec 200>/tmp/ddc-brightness.lock
    flock -n 200 || exit 0

    # ddcutil reads over DDC/CI are flaky (occasionally return a stale/wrong
    # value even when the write itself succeeded), which was corrupting the
    # read-modify-write step math. Track the last known-good value locally
    # instead of re-reading the monitor on every press; only fall back to a
    # real read when we don't have a cached value yet.
    if [ -f "$STATE_FILE" ]; then
        cur=$(cat "$STATE_FILE")
    else
        cur=$(ddcutil --sn "$MONITOR_SN" getvcp 10 --brief 2>/dev/null | awk '{print $4}')
    fi

    if [[ "$cur" =~ ^[0-9]+$ ]]; then
        case "$1" in
            up)   new=$(( cur + STEP )); [ "$new" -gt 100 ] && new=100 ;;
            down) new=$(( cur - STEP )); [ "$new" -lt 0 ] && new=0 ;;
        esac
        # The monitor silently drops commands sent too close together (write
        # succeeds at the bus level but never actually applies), so verify it
        # landed before trusting it, and retry a couple times if not — this
        # also acts as the throttle that gives the monitor breathing room.
        for attempt in 1 2 3; do
            ddcutil --sn "$MONITOR_SN" setvcp 10 "$new" 2>/dev/null
            sleep 0.2
            check=$(ddcutil --sn "$MONITOR_SN" getvcp 10 --brief 2>/dev/null | awk '{print $4}')
            if [ "$check" = "$new" ]; then
                echo "$new" > "$STATE_FILE"
                break
            fi
        done
    fi
else
    case "$1" in
        up)   brightnessctl -d $DEVICE set 10%+ ;;
        down) brightnessctl -d $DEVICE set 10%- ;;
    esac
fi

date +%s%3N > /tmp/display-trigger
pkill -RTMIN+8 waybar 2>/dev/null
