#!/bin/bash
# Supervises the AGS shell (waybar popups etc.). AGS has been observed to
# silently exit mid-session with no crash dump and no log output, and since
# it was previously launched with a bare exec_cmd (no supervisor), once it
# died it stayed dead until the next reboot — manifesting as waybar's
# on-click popups no longer opening. This loop restarts it immediately and
# timestamps each start/exit so a recurrence is actually diagnosable.
LOG=/tmp/ags.log
while true; do
  echo "[$(date '+%F %T')] starting ags" >> "$LOG"
  ags run -g 4 /home/worst_poet/.config/ags/app.js --log-file "$LOG"
  code=$?
  echo "[$(date '+%F %T')] ags exited with code $code — restarting in 1s" >> "$LOG"
  sleep 1
done
