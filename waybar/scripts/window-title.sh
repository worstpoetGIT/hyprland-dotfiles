#!/bin/bash
title=$(hyprctl activewindow -j 2>/dev/null | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    title = d.get('title', '')
    # Output as proper JSON using json.dumps to escape all special chars
    print(json.dumps({'text': title, 'class': 'active' if title else 'empty'}))
except:
    print('{\"text\": \"\", \"class\": \"empty\"}')
" 2>/dev/null)

if [[ -z "$title" ]]; then
    echo '{"text": "", "class": "empty"}'
else
    echo "$title"
fi
