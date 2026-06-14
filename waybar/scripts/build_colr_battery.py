#!/usr/bin/env python3
"""
iOSBattery COLRv1 — green fill + white bolt for charging glyphs.
Normal/saver use currentColor (CSS-controlled).
"""
import os, tempfile, shutil
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.colorLib.builder import buildCOLR, buildCPAL
import fontforge

SVG_W,SVG_H = 160.0,100.0
BX,BY  = 4,14; BW,BH=124,68
BR=22; STROKE=4.5; GAP=9.0
NUB_W,NUB_H=6,18; NUB_R=3
NUB_X=BX+BW+1; NUB_Y=BY+(BH-NUB_H)/2
PAD=STROKE+GAP; FX=BX+PAD; FY=BY+PAD; FH=BH-PAD*2; MAX_FW=BW-PAD*2
FR_BASE=BR-PAD+2
BCX=BX+BW/2.0; BOLT_TOP=BY-7; BOLT_BOT=BY+BH+7; MID_Y=BY+BH*0.50
UPM=1000
ADVANCE=int(UPM*SVG_W/SVG_H)

def rr(x,y,w,h,r):
    r=max(1.0,min(r,w/2,h/2))
    return (f"M {x+r},{y} H {x+w-r} Q {x+w},{y} {x+w},{y+r} "
            f"V {y+h-r} Q {x+w},{y+h} {x+w-r},{y+h} "
            f"H {x+r} Q {x},{y+h} {x},{y+h-r} "
            f"V {y+r} Q {x},{y} {x+r},{y} Z")

def bolt_path():
    return (f"M {BCX+12:.1f},{BOLT_TOP:.1f} L {BCX-15:.1f},{MID_Y+4:.1f} "
            f"L {BCX+3:.1f},{MID_Y+4:.1f} L {BCX-8:.1f},{BOLT_BOT:.1f} "
            f"L {BCX+18:.1f},{MID_Y-4:.1f} L {BCX+2:.1f},{MID_Y-4:.1f} Z")

def make_svg(pct, mode, path, layer=None):
    """
    layer=None: full glyph (normal/saver)
    layer='fill': battery body + fill only (no bolt)
    layer='bolt': bolt only
    layer='outline': outline + nub only
    """
    fw=max(6.0,MAX_FW*pct/100) if pct>0 else 0
    fr=min(float(FR_BASE),fw/2) if fw>0 else 0
    inner_r=max(4.0,BR-STROKE)

    body  = rr(BX,BY,BW,BH,BR)
    inner = rr(BX+STROKE,BY+STROKE,BW-STROKE*2,BH-STROKE*2,inner_r)
    nub   = rr(NUB_X,NUB_Y,NUB_W,NUB_H,NUB_R)
    fill_d= rr(FX,FY,fw,FH,fr) if fw>0 else ""
    bp    = bolt_path()

    if layer == 'fill':
        # Green fill layer: outline ring + nub + fill rect
        parts = (f'<path d="{body}" fill="black"/>'
                 f'<path d="{inner}" fill="white"/>'
                 f'<path d="{nub}" fill="black"/>'
                 + (f'<path d="{fill_d}" fill="black"/>' if fill_d else ""))
    elif layer == 'bolt':
        # White bolt layer only
        parts = f'<path d="{bp}" fill="black"/>'
    else:
        # Full monochrome glyph (normal/saver)
        parts = (f'<path d="{body}" fill="black"/>'
                 f'<path d="{inner}" fill="white"/>'
                 f'<path d="{nub}" fill="black"/>'
                 + (f'<path d="{fill_d}" fill="black"/>' if fill_d else ""))

    svg=(f'<?xml version="1.0"?>'
         f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SVG_W} {SVG_H}">'
         f'{parts}</svg>')
    with open(path,'w') as f:
        f.write(svg)


def import_glyph(font, cp, name, svg_path):
    g = font.createChar(cp, name)
    g.width = ADVANCE
    g.importOutlines(svg_path)
    g.removeOverlap()
    g.correctDirection()
    g.simplify()
    g.round()
    return g


def build():
    font = fontforge.font()
    font.fontname = font.familyname = "iOSBattery"
    font.fullname = "iOSBattery Regular"
    font.em=UPM; font.ascent=800; font.descent=200
    font.encoding="UnicodeFull"

    tmpdir = tempfile.mkdtemp()

    # ── Normal glyphs U+E000–U+E064 ─────────────────────────────────────────
    for pct in range(101):
        p = os.path.join(tmpdir, f"n_{pct}.svg")
        make_svg(pct, 'normal', p)
        import_glyph(font, 0xE000+pct, f"bat.n{pct:03d}", p)
    print("normal done")

    # ── Saver glyphs U+E0CA–U+E12E ──────────────────────────────────────────
    for pct in range(101):
        p = os.path.join(tmpdir, f"s_{pct}.svg")
        make_svg(pct, 'saver', p)
        import_glyph(font, 0xE0CA+pct, f"bat.s{pct:03d}", p)
    print("saver done")

    # ── Charging fill layer U+E065–U+E0C9 ───────────────────────────────────
    for pct in range(101):
        p = os.path.join(tmpdir, f"cf_{pct}.svg")
        make_svg(pct, 'charging', p, layer='fill')
        import_glyph(font, 0xE065+pct, f"bat.cf{pct:03d}", p)
    print("charging fill done")

    # ── Bolt layer U+E200–U+E264 ────────────────────────────────────────────
    # One bolt glyph reused for all percentages
    bolt_p = os.path.join(tmpdir, "bolt.svg")
    make_svg(50, 'charging', bolt_p, layer='bolt')
    import_glyph(font, 0xE200, f"bat.bolt", bolt_p)
    print("bolt done")

    out = os.path.expanduser("~/.config/waybar/iOSBattery.ttf")
    font.generate(out)
    shutil.rmtree(tmpdir)
    print(f"Saved: {out}")

build()

def add_colr_table(ttf_path):
    """
    Post-process the TTF to add COLRv1 color layers for charging glyphs.
    Each charging glyph (U+E065–U+E0C9) gets:
      Layer 1: bat.cf{pct} in green (#4CD964)
      Layer 2: bat.bolt in white (#ffffff)
    """
    from fontTools.ttLib import TTFont
    from fontTools.colorLib.builder import buildCOLR, buildCPAL

    font = TTFont(ttf_path)

    # Color palette: [green, white]
    palettes = [
        [(0x64, 0xD9, 0x4C, 0xFF),   # index 0: #4CD964 green
         (0xFF, 0xFF, 0xFF, 0xFF)],   # index 1: #ffffff white
    ]

    # Build color glyph definitions
    colorGlyphs = {}
    for pct in range(101):
        glyph_name = f"bat.cf{pct:03d}"
        colorGlyphs[glyph_name] = [
            (glyph_name, 0),    # fill layer in green
            ("bat.bolt", 1),    # bolt layer in white
        ]

    font["COLR"] = buildCOLR(colorGlyphs)
    font["CPAL"] = buildCPAL(palettes)
    font.save(ttf_path)
    print("COLRv1 table added")


add_colr_table(os.path.expanduser("~/.config/waybar/iOSBattery.ttf"))
print("All done!")
