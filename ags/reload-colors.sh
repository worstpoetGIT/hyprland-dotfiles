#!/bin/bash
# Regenerates matugen colors from the current wallpaper. AGS restart,
# Hyprland border refresh, and dunst reload all happen automatically via
# post_hooks in ~/.config/matugen/config.toml, so this just needs to run
# matugen -- no need to duplicate the app-restart dance here too.
WALL=$(grep "path = " ~/.config/hypr/hyprpaper.conf | awk '{print $3}')
~/.config/matugen/apply.sh "$WALL"
pkill -SIGUSR2 -x waybar
