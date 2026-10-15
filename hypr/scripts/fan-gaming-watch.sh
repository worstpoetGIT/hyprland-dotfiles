#!/bin/bash
# Bumps the ThinkPad's EC fan level while a game is actually running, and
# reverts to EC auto control once it isn't. Detection is process-based, not
# a CPU/GPU load threshold -- a load threshold would also fire on compiles,
# video encodes, or Blender renders, none of which the user meant by
# "gaming". Steam wraps every game it launches (native or Proton) in a
# `reaper SteamLaunch ...` process, which only exists while a game is
# actually running (not just Steam sitting open) -- confirmed live via
# `ps` against a real Watch Dogs 2 (Proton) session. wineserver is checked
# too, to also catch non-Steam Wine/Lutris/Heroic titles.
#
# level 7 is the highest EC-managed level (still thermally interlocked by
# the EC, unlike "disengaged"/"full-speed" which ignore it and can run loud
# even at idle temps) -- see /proc/acpi/ibm/fan for the level list.
GRACE_SECS=30

is_gaming() {
    pgrep -f "reaper SteamLaunch" >/dev/null 2>&1 && return 0
    pgrep -x wineserver >/dev/null 2>&1 && return 0
    return 1
}

set_fan() {
    sudo -n sh -c "echo 'level $1' > /proc/acpi/ibm/fan" 2>/dev/null
}

current="auto"
idle_since=""

while true; do
    if is_gaming; then
        idle_since=""
        if [ "$current" != "gaming" ]; then
            set_fan 7
            current="gaming"
        fi
    elif [ "$current" = "gaming" ]; then
        now=$(date +%s)
        [ -z "$idle_since" ] && idle_since=$now
        if [ $((now - idle_since)) -ge $GRACE_SECS ]; then
            set_fan auto
            current="auto"
            idle_since=""
        fi
    fi
    sleep 5
done
