#!/bin/bash
# Applies color temperature to the ThinkPad panel (eDP-1) only, leaving the
# Philips monitor (HDMI-A-1) untouched. wlsunset has no live IPC -- unlike
# the hyprsunset daemon this replaces, changing the temperature means
# killing and relaunching it with -t/-T pinned to the same value (a static
# override, no day/night transition). It has to stay running afterward:
# per the wlr-gamma-control-unstable-v1 protocol, the CTM resets to
# identity the moment the client that set it disconnects.
CACHE=~/.cache/hypr-warmth-k
TEMP="${1:-6500}"

pkill -x wlsunset
echo "$TEMP" > "$CACHE"
# wlsunset refuses -t == -T, and interpolates between them across its
# sunrise/sunset window based on solar position by default. Pinning manual
# sunrise/sunset to a 1-minute midnight window (rare, but not skippable
# outright) means the high (day) temp applies effectively all the time,
# with only a negligible 1K read/write gap during that window.
nohup wlsunset -o eDP-1 -t "$((TEMP - 1))" -T "$TEMP" -S 00:01 -s 00:00 -d 30 >/tmp/wlsunset.log 2>&1 &
disown
