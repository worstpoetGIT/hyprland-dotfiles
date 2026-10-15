#!/usr/bin/env bash
# Remembers which workspace each monitor was showing and re-focuses it after
# a dock/undock. Runs outside the compositor so it never blocks Hyprland.

SOCK="$XDG_RUNTIME_DIR/hypr/$HYPRLAND_INSTANCE_SIGNATURE/.socket2.sock"
declare -A last_ws

while IFS=$'\t' read -r name id; do
  [ -n "$name" ] && last_ws[$name]=$id
done < <(hyprctl -j monitors | jq -r '.[] | "\(.name)\t\(.activeWorkspace.id)"')

focused=$(hyprctl -j monitors | jq -r '.[] | select(.focused) | .name')
docked=false
hyprctl -j monitors | jq -e 'any(.name=="HDMI-A-1")' >/dev/null && docked=true

QUIET="$XDG_RUNTIME_DIR/dock-resume.quiet"

resume() {
  local ws=$1
  [ -z "$ws" ] && return
  touch "$QUIET"
  sleep 1
  hyprctl eval "hl.dispatch(hl.dsp.focus({ workspace = $ws }))" >/dev/null 2>&1
  sleep 2
  hyprctl eval "hl.dispatch(hl.dsp.focus({ workspace = $ws }))" >/dev/null 2>&1
  sleep 1
  rm -f "$QUIET"
}

while true; do
  while IFS= read -r line; do
    echo "$(date +%T) quiet=$([ -f "$QUIET" ] && echo 1 || echo 0) docked=$docked focused=$focused last=[${last_ws[eDP-1]},${last_ws[HDMI-A-1]}] $line" >>"$XDG_RUNTIME_DIR/dock-resume.log"
    case "$line" in
      focusedmon\>\>*)
        rest=${line#*>>}
        focused=${rest%%,*}
        ;;
      workspace\>\>*)
        id=${line#*>>}
        [[ $id =~ ^[0-9]+$ ]] || continue
        [ -f "$QUIET" ] && continue
        if [ "$focused" = "eDP-1" ] && [ "$docked" = false ]; then
          last_ws[eDP-1]=$id
        elif [ "$focused" = "HDMI-A-1" ] && [ "$docked" = true ]; then
          last_ws[HDMI-A-1]=$id
        fi
        ;;
      monitoradded\>\>HDMI-A-1)
        docked=true
        resume "${last_ws[eDP-1]}" &
        ;;
      monitorremoved\>\>HDMI-A-1)
        docked=false
        resume "${last_ws[HDMI-A-1]}" &
        ;;
    esac
  done < <(socat -u "UNIX-CONNECT:$SOCK" -)
  sleep 1
done
