#!/bin/bash
pkill -f "ags run" 2>/dev/null
sleep 0.5
ags run --gtk 4 /home/worst_poet/.config/ags/app.js
