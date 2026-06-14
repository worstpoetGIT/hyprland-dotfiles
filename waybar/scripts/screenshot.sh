#!/bin/bash

dir="$HOME/Pictures/Screenshots"
mkdir -p "$dir"

file="$dir/$(date +'%Y-%m-%d_%H-%M-%S').png"

grim -g "$(slurp)" "$file" && notify-send "Screenshot saved" "$file"

