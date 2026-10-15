#!/bin/bash
# Sets Reduce White Point to an explicit state ("on"/"off"), rather than
# flipping it -- used by the AGS Display popup switch, where the desired
# state is already known and blindly toggling could desync from a change
# made elsewhere (e.g. toggle-white-point.sh run by hand).
SHADER=~/.config/hypr/shaders/reduce-white-point.frag
CACHE=~/.cache/hypr-white-point-shader

if [ "$1" = "on" ]; then
    echo "$SHADER" > "$CACHE"
else
    : > "$CACHE"
fi

# hyprland.lua reads $CACHE for decoration.screen_shader on every reload
# (see white_point_shader() there). A plain `hyprctl eval` override doesn't
# survive a reload, and reload turned out to be required anyway: it does a
# full monitor reload, which is what actually stops unfocused windows from
# blinking between old/new frames on toggle -- a lighter
# force_renderer_reload wasn't enough.
hyprctl reload
