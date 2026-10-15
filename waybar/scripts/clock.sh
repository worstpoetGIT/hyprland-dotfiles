#!/bin/bash
# HH:MM:SS (24h) + DD.MM.YY Day, for the center waybar clock module.
# Also appends India time (Asia/Kolkata) -- labeled "IN", not "IST", since
# the system's own zone (Europe/Dublin) is *also* abbreviated IST (Irish
# Standard Time), which would collide with India Standard Time otherwise.
LOCAL=$(date +'%H:%M:%S  %d.%m.%y %a')
INDIA=$(TZ='Asia/Kolkata' date +'%H:%M:%S')
echo "{\"text\":\"$LOCAL   IN $INDIA\"}"
