#!/bin/bash
# Toggles waybar visibility (SIGUSR1) on Hyprland fullscreen enter/exit.
#
# Uses `socat -u SOCKET STDOUT` (read-only, unidirectional) rather than the
# old bidirectional `socat - SOCKET`: this listener never writes to the
# socket, and bidirectional stdio mode ties the connection's lifetime to
# this process's own stdin — when launched detached (stdin on /dev/null,
# EOF from the first read) that tore the connection down within ~1s of
# every connect, silently churning forever. Unidirectional mode never
# touches stdin, so it isn't affected by how this script is launched.
#
# Also wrapped in a restart loop: the socket connection itself can still
# drop (compositor reload, brief socket hiccup), and since this is launched
# via exec-once, a dead pipeline would otherwise silently never come back
# for the rest of the session.
while true; do
  socat -u "UNIX-CONNECT:$XDG_RUNTIME_DIR/hypr/$HYPRLAND_INSTANCE_SIGNATURE/.socket2.sock" STDOUT | \
  while read -r line; do
    case "$line" in
      "fullscreen>>"*) pkill -SIGUSR1 waybar ;;
    esac
  done
  sleep 1
done
