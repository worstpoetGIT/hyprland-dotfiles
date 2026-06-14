#!/usr/bin/env bash

if pgrep -x wf-recorder >/dev/null; then
    printf '{"text":"🔴","tooltip":"Screen recording is active","class":"recording"}\n'
else
    printf '{"text":"","tooltip":"","class":"idle"}\n'
fi
