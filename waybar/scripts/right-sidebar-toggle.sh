#!/bin/bash
ags toggle right-sidebar
# Check if sidebar is now visible and hide/show battery
sleep 0.1
if ags -r "app.get_window('right-sidebar')?.visible" 2>/dev/null | grep -q "true"; then
    # sidebar opened - you could hide battery here
    echo "opened"
else
    echo "closed"  
fi
