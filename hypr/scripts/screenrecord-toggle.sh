#!/usr/bin/env bash

set -u

OUT_DIR="$HOME/Videos/Recordings"
mkdir -p "$OUT_DIR"

# Stop if already recording
if pgrep -x wf-recorder >/dev/null; then
    pkill -INT -x wf-recorder

    while pgrep -x wf-recorder >/dev/null; do
        sleep 0.15
    done

    notify-send "Screen Recorder" "Recording stopped"
    exit 0
fi

timestamp="$(date +'%Y-%m-%d_%H-%M-%S')"
outfile="$OUT_DIR/recording_${timestamp}.mkv"

audio_device="$(pactl get-default-sink).monitor"

wf-recorder --audio="$audio_device" -f "$outfile" >/dev/null 2>&1 &
disown

sleep 0.3

if pgrep -x wf-recorder >/dev/null; then
    notify-send "Screen Recorder" "Recording started with system audio"
else
    notify-send "Screen Recorder" "Recording failed to start"
    exit 1
fi
