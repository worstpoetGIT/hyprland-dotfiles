#!/usr/bin/env python3
"""Accent-color backend for the AGS accent popup (waybar palette icon).

  accent-dot.py list       JSON of every color matugen extracts from the
                           current wallpaper, with the active one flagged
  accent-dot.py select N   make color N the wallpaper's accent and apply it
                           everywhere (borders, waybar, AGS, ...)

The pick is remembered per wallpaper in ~/.config/matugen/choices.json, which
~/.config/matugen/apply.sh reads on every matugen run.
"""
import colorsys
import fcntl
import json
import os
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

HOME = os.path.expanduser("~")
CHOICES = f"{HOME}/.config/matugen/choices.json"
CACHE = f"{HOME}/.cache/matugen-palette.json"
N_COLORS = 4  # matugen's --source-color-index accepts 0..3


def current_wallpaper():
    for line in open(f"{HOME}/.config/hypr/hyprpaper.conf"):
        m = re.match(r"\s*path\s*=\s*(.+)", line)
        if m:
            return m.group(1).strip()
    raise SystemExit(1)


def extract(wall, i):
    r = subprocess.run(
        ["matugen", "image", wall, "--dry-run", "-q", "-j", "hex",
         "--source-color-index", str(i)],
        capture_output=True, text=True)
    try:
        c = json.loads(r.stdout)["colors"]
        return [c[k]["dark"]["color"] if "dark" in c[k] else c[k]["color"]
                for k in ("primary", "secondary", "tertiary")]
    except Exception:
        return None


def palette(wall):
    """[primary, secondary, tertiary] of each source color, cached per wallpaper (+mtime) since
    each matugen pass over a 4K image takes a few seconds."""
    key = f"v2:{wall}:{os.path.getmtime(wall)}"
    with open(CACHE + ".lock", "w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)  # serialize concurrent callers; compute once
        try:
            cache = json.load(open(CACHE))
        except Exception:
            cache = {}
        if key not in cache:
            with ThreadPoolExecutor(N_COLORS) as ex:
                cols = list(ex.map(lambda i: extract(wall, i), range(N_COLORS)))
            cache[key] = [c for c in cols if c]
            json.dump(cache, open(CACHE, "w"))
        return cache[key]


def hue_name(hexcol):
    r, g, b = (int(hexcol[i:i + 2], 16) / 255 for i in (1, 3, 5))
    h, _, s = colorsys.rgb_to_hls(r, g, b)
    h *= 360
    if s < 0.12:
        return "Neutral"
    for limit, name in ((15, "Red"), (40, "Orange"), (70, "Gold"), (160, "Green"),
                        (195, "Teal"), (255, "Blue"), (290, "Purple"),
                        (335, "Pink"), (361, "Red")):
        if h < limit:
            return name


def saved_index(wall):
    try:
        return int(json.load(open(CHOICES)).get(wall, 0))
    except Exception:
        return 0


def list_colors():
    wall = current_wallpaper()
    active = saved_index(wall)
    colors = [{"index": i, "name": hue_name(c[0]), "swatches": c, "selected": i == active}
              for i, c in enumerate(palette(wall))]
    print(json.dumps({"wallpaper": os.path.basename(wall), "colors": colors}))


def select(n):
    wall = current_wallpaper()
    try:
        data = json.load(open(CHOICES))
    except Exception:
        data = {}
    data[wall] = n
    os.makedirs(os.path.dirname(CHOICES), exist_ok=True)
    json.dump(data, open(CHOICES, "w"), indent=2)
    subprocess.run([f"{HOME}/.config/matugen/apply.sh", wall])
    # Re-read colors.css + re-run the dot scripts. Only done here, not in
    # apply.sh: wallpaper-menu.sh restarts waybar right after calling
    # apply.sh, and SIGUSR2 on a waybar that hasn't installed its handler
    # yet would kill it.
    subprocess.run(["pkill", "-SIGUSR2", "-x", "waybar"])


if __name__ == "__main__":
    if sys.argv[1] == "select":
        select(int(sys.argv[2]))
    else:
        list_colors()
