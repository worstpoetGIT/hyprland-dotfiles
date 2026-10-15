#!/bin/bash
# "Maximize but keep waybar visible AND respected" toggle.
#
# Requirement: the maximized window must touch the waybar at the top and go
# flush to the screen edges on the other three sides -- no margin anywhere.
#
# Native Hyprland fullscreen mode=1 ("maximize") does exactly this AND gets
# correct square corners for free via the existing no-round-fullscreen
# windowrule (hyprland.lua, matches on fullscreen=true) -- confirmed by
# direct testing: flush edges, bar respected, zero corner bleed. The catch
# is it only resizes correctly when applied to a window that is already
# floating; on a still-tiled window it sets the fullscreen flag without
# resizing (a visible no-op). So this script's only real job is: float the
# window first, then hand off to native fullscreen mode=1 for everything
# else -- no manual resize/move math, no per-window rounding/border_size
# override needed.
#
# (Earlier version of this script tried to zero rounding/border_size at
# runtime via hl.dsp.window.set_prop -- confirmed non-functional in this
# build, accepts the call and returns "ok" but never changes rendering,
# even at extreme test values. That's what caused the rounded-corner bleed
# on every maximized window. A margin-inset workaround was tried next, but
# that violates the flush-to-edges requirement. Native fullscreen mode=1
# sidesteps the broken override entirely by reusing the windowrule engine,
# which does work.)
#
# State is one file PER WINDOW ADDRESS (a directory, not a single file):
# each invocation only ever maximizes-or-restores the currently ACTIVE
# window, keyed by its own address, so toggling one window never touches
# another window's state, even with several windows independently
# maximized across different workspaces.
STATE_DIR="$HOME/.cache/hypr/pseudo-maximize-state.d"
mkdir -p "$STATE_DIR"

export WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-wayland-1}"

# Prune state files for windows that no longer exist, so closing a
# maximized window doesn't leave a permanent orphan on disk.
LIVE_ADDRS=" $(hyprctl clients -j | jq -r '.[].address' | tr '\n' ' ') "
for f in "$STATE_DIR"/0x*; do
    [ -e "$f" ] || continue
    addr="$(basename "$f")"
    case "$LIVE_ADDRS" in
        *" $addr "*) ;;
        *) rm -f "$f" ;;
    esac
done

ADDR=$(hyprctl activewindow -j | jq -r '.address')
[ -z "$ADDR" ] || [ "$ADDR" = "null" ] && exit 0

# Polls this window's actual reported state instead of a blind sleep --
# a fixed 0.15s guess raced the windows/windowsMove animations (configured
# at speed 2.5-3, comfortably longer than 150ms) and would occasionally
# fire the next dispatch before the previous one had visibly committed,
# leaving the window in a mismatched floating/fullscreen state where clicks
# land on stale hit-test geometry -- reported as "workspace 5 controls
# don't respond" (that workspace's window happened to be the one stuck
# mid-transition). 1s timeout so a genuinely wedged case still exits
# instead of hanging the whole toggle forever.
wait_for() {
    local field="$1" want="$2" tries=50
    while [ "$tries" -gt 0 ]; do
        local got
        got=$(hyprctl clients -j | jq -r --arg a "$ADDR" ".[] | select(.address==\$a) | .$field")
        [ "$got" = "$want" ] && return 0
        sleep 0.02
        tries=$((tries - 1))
    done
}

STATE_FILE="$STATE_DIR/$ADDR"

if [ -f "$STATE_FILE" ]; then
    # This window is maximized -- restore it.
    hyprctl dispatch "hl.dsp.window.fullscreen({mode=1})"
    wait_for fullscreen 0
    hyprctl dispatch "hl.dsp.window.float({action=\"toggle\"})"
    rm -f "$STATE_FILE"
    exit 0
fi

hyprctl dispatch "hl.dsp.window.float({action=\"toggle\"})"
wait_for floating true
hyprctl dispatch "hl.dsp.window.fullscreen({mode=1})"
touch "$STATE_FILE"
