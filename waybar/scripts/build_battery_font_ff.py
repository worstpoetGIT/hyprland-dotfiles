#!/usr/bin/env python3
"""iOSBattery final — dark cutout bolt on charging glyphs."""
import fontforge, os, tempfile, shutil

SVG_W,SVG_H=160.0,100.0
BX,BY=4,14; BW,BH=124,68
BR=22; STROKE=4.5; GAP=9.0
NUB_W,NUB_H=6,18; NUB_R=3
NUB_X=BX+BW+1; NUB_Y=BY+(BH-NUB_H)/2
PAD=STROKE+GAP; FX=BX+PAD; FY=BY+PAD; FH=BH-PAD*2; MAX_FW=BW-PAD*2
FR_BASE=BR-PAD+2
BCX=BX+BW/2.0; BOLT_TOP=BY-7; BOLT_BOT=BY+BH+7; MID_Y=BY+BH*0.50
UPM=1000

def rr(x,y,w,h,r):
    r=max(1.0,min(r,w/2,h/2))
    return (f"M {x+r},{y} H {x+w-r} Q {x+w},{y} {x+w},{y+r} "
            f"V {y+h-r} Q {x+w},{y+h} {x+w-r},{y+h} "
            f"H {x+r} Q {x},{y+h} {x},{y+h-r} "
            f"V {y+r} Q {x},{y} {x+r},{y} Z")

def make_svg(pct,mode,path):
    fw=max(6.0,MAX_FW*pct/100) if pct>0 else 0
    fr=min(float(FR_BASE),fw/2) if fw>0 else 0
    inner_r=max(4.0,BR-STROKE)
    body=rr(BX,BY,BW,BH,BR)
    inner=rr(BX+STROKE,BY+STROKE,BW-STROKE*2,BH-STROKE*2,inner_r)
    nub=rr(NUB_X,NUB_Y,NUB_W,NUB_H,NUB_R)
    fill_d=rr(FX,FY,fw,FH,fr) if fw>0 else ""
    bp=(f"M {BCX+12:.1f},{BOLT_TOP:.1f} L {BCX-15:.1f},{MID_Y+4:.1f} "
        f"L {BCX+3:.1f},{MID_Y+4:.1f} L {BCX-8:.1f},{BOLT_BOT:.1f} "
        f"L {BCX+18:.1f},{MID_Y-4:.1f} L {BCX+2:.1f},{MID_Y-4:.1f} Z")
    if mode=="charging" and fw>0:
        fill_part=f'<path d="{fill_d}" fill="black"/>' 
        bolt_part=f'<path d="{bp}" fill="white"/>' 
    elif mode=="charging":
        fill_part=""
        bolt_part=f'<path d="{bp}" fill="black"/>' 
    else:
        fill_part=f'<path d="{fill_d}" fill="black"/>' if fw>0 else ""
        bolt_part=""
    svg=(f'<?xml version="1.0"?>' 
         f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SVG_W} {SVG_H}">' 
         f'<path d="{body}" fill="black"/>' 
         f'<path d="{inner}" fill="white"/>' 
         f'<path d="{nub}" fill="black"/>' 
         f'{fill_part}{bolt_part}</svg>')
    with open(path,'w') as f:
        f.write(svg)

def build():
    font=fontforge.font()
    font.fontname=font.familyname="iOSBattery"
    font.fullname="iOSBattery Regular"
    font.em=UPM; font.ascent=800; font.descent=200
    font.encoding="UnicodeFull"
    advance=int(UPM*SVG_W/SVG_H)
    tmpdir=tempfile.mkdtemp()
    for mode,base in [('normal',0xE000),('charging',0xE065),('saver',0xE0CA)]:
        for pct in range(101):
            svg_path=os.path.join(tmpdir,f"{mode}_{pct}.svg")
            make_svg(pct,mode,svg_path)
            g=font.createChar(base+pct,f"bat.{mode[0]}{pct:03d}")
            g.width=advance
            g.importOutlines(svg_path)
            g.removeOverlap()
            g.correctDirection()
            g.simplify()
            g.round()
        print(f"{mode} done")
    out=os.path.expanduser("~/.config/waybar/iOSBattery.ttf")
    font.generate(out)
    shutil.rmtree(tmpdir)
    print(f"Saved: {out}")

build()
