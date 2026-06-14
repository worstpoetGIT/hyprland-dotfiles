import json, re, sys

with open('/home/worst_poet/.cache/sddm-colors.json') as f:
    c = json.load(f)

with open('/usr/share/sddm/themes/material-you/Main.qml') as f:
    content = f.read()

replacements = {
    'primary':                c.get('primary', '#ffb3ae'),
    'on_primary':             c.get('on_primary', '#571d1c'),
    'primary_container':      c.get('primary_container', '#733331'),
    'secondary':              c.get('secondary', '#e7bdb9'),
    'tertiary':               c.get('tertiary', '#ddc48c'),
    'background':             c.get('background', '#1a1111'),
    'surface':                c.get('surface', '#1a1111'),
    'surface_container':      c.get('surface_container', '#271d1d'),
    'surface_container_high': c.get('surface_container_high', '#322827'),
    'on_surface':             c.get('on_surface', '#f1dedd'),
    'on_surface_variant':     c.get('on_surface_variant', '#d8c2c0'),
    'outline':                c.get('outline', '#a08c8b'),
    'outline_variant':        c.get('outline_variant', '#534342'),
}

for key, value in replacements.items():
    content = re.sub(
        rf'({key}:\s+)"#[0-9a-fA-F]{{6}}"',
        rf'\1"{value}"',
        content
    )

with open('/usr/share/sddm/themes/material-you/Main.qml', 'w') as f:
    f.write(content)

print("SDDM colors updated")
