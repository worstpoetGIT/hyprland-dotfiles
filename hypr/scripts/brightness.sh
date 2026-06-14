#!/bin/bash

DEVICE="amdgpu_bl1"
MAX=64764
STEP=5

current=$(brightnessctl -d $DEVICE g)
current_percent=$(( current * 100 / MAX ))

case $1 in
    up)
        new_percent=$(( current_percent + STEP ))
        [ $new_percent -gt 100 ] && new_percent=100
        ;;
    down)
        new_percent=$(( current_percent - STEP ))
        [ $new_percent -lt 5 ] && new_percent=5
        ;;
esac

new_raw=$(( new_percent * MAX / 100 ))
brightnessctl -d $DEVICE set ${new_raw} && swayosd-client --brightness ${new_percent}
