#!/bin/bash

dir="$HOME/Videos/Recordings"
pidfile="/tmp/wf-recording.pid"
mkdir -p "$dir"

if [ -f "$pidfile" ] && kill -0 "$(cat "$pidfile")" 2>/dev/null; then
    kill "$(cat "$pidfile")"
    rm -f "$pidfile"
    notify-send "Screen recording stopped"
else
    file="$dir/$(date +'%Y-%m-%d_%H-%M-%S').mp4"
    wf-recorder -f "$file" &
    echo $! > "$pidfile"
    notify-send "Screen recording started" "$file"
fi

