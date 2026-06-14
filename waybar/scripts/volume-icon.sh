#!/bin/bash

if wpctl get-volume @DEFAULT_AUDIO_SINK@ | grep -q '\[MUTED\]'; then
    echo '{"text":"󰝟","class":"muted"}'
else
    echo '{"text":"󰋋","class":"active"}'
fi

