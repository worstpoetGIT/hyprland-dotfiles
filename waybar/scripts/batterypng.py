python3 - << 'EOF'
with open('/home/worst_poet/.config/waybar/config.jsonc', 'r') as f:
    content = f.read()

content = content.replace(
    '"custom/battery": {\n    "exec": "~/.config/waybar/scripts/battery.sh",\n    "return-type": "json",\n    "interval": 5,\n    "tooltip": false\n  },',
    '"custom/battery": {\n    "exec": "~/.config/waybar/scripts/battery.sh",\n    "return-type": "json",\n    "interval": 5,\n    "format": "{}",\n    "markup": true,\n    "tooltip": false\n  },'
)

with open('/home/worst_poet/.config/waybar/config.jsonc', 'w') as f:
    f.write(content)
print("done")
EOF
