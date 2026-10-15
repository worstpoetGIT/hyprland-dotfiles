#!/bin/bash
prev_wall=""
while true; do
    wall=$(grep "path = " ~/.config/hypr/hyprpaper.conf 2>/dev/null | awk '{print $3}')
    if [ -n "$wall" ] && [ "$wall" != "$prev_wall" ]; then
        prev_wall="$wall"

        # Generate new colors
        ~/.config/matugen/apply.sh "$wall"

        # Reload waybar and AGS CSS without killing AGS
        pkill -SIGUSR2 waybar 2>/dev/null
        ags request "reload-css" 2>/dev/null

        # Update sidebar SVG icon (colors sourced from waybar's own palette,
        # not ags's, so ags-only palette overrides like AMOLED mode don't leak into waybar)
        primary=$(grep "@define-color primary " ~/.config/waybar/colors.css | awk '{print $3}' | tr -d ';')
        container=$(grep "@define-color primary_container " ~/.config/waybar/colors.css | awk '{print $3}' | tr -d ';')
        cat > ~/.config/waybar/icons/sidebar-toggle.svg << SVGEOF
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <rect x="1" y="1" width="10" height="22" rx="3" fill="${container}" opacity="0.8"/>
  <rect x="13" y="1" width="10" height="22" rx="3" fill="${primary}"/>
</svg>
SVGEOF
        pkill -SIGUSR2 waybar 2>/dev/null
    fi
    sleep 2
done
