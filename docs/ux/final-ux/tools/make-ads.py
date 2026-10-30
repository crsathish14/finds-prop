"""Generates the FICTIONAL sample banner images in assets/ads/.
They stand in for finished banner images supplied by advertisers: generic placeholder copy, no real advertiser names,
prices, RERA IDs or claims. Run:  python tools/make-ads.py
Formats (see homepage-ad-variations.md):
  strip-970x90-X.svg      desktop strip, Variation A and in-results placement
  strip-m-320x100-X.svg   compact strip for phones and tablets (supply at 2x = 640x200)
  panel-524x494-X.svg     desktop panel, Variation B (supply at 2x = 1048x988)
  panel-m-640x320-X.svg   compact panel for phones and tablets (2:1)
  near-miss-*.svg         deliberately slightly off-ratio images, used to demonstrate the contain rule
"""
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'ads')
os.makedirs(OUT, exist_ok=True)
FONT = "font-family=\"Arial, Helvetica, sans-serif\""

PALS = {
    'a': dict(g1='#1B2447', g2='#2E3D75', fg='#FFF6DD', mut='#D9DDF3', acc='#E8BC5A', accfg='#1B2447', chip='#E8BC5A'),
    'b': dict(g1='#0B3D30', g2='#14624B', fg='#FFF8E6', mut='#CFE5DA', acc='#F6E7C8', accfg='#0B3D30', chip='#F6E7C8'),
    'c': dict(g1='#26211E', g2='#3A302B', fg='#FFF3E8', mut='#E5D5C8', acc='#E88553', accfg='#26211E', chip='#E88553'),
}


def art(k, x, y, w, h):
    """Illustration drawn in a 200x120 box, cropped to the target rectangle (xMidYMid slice)."""
    if k == 'a':
        body = """
<defs><linearGradient id="sa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2B3A6E"/><stop offset="1" stop-color="#D08A7C"/></linearGradient>
<pattern id="wa" width="8" height="10" patternUnits="userSpaceOnUse"><rect x="1.6" y="2" width="4.4" height="5.4" rx=".6" fill="#F4C85E"/></pattern></defs>
<rect width="200" height="120" fill="url(#sa)"/><circle cx="160" cy="34" r="14" fill="#F7D58A"/>
<rect x="14" y="62" width="36" height="58" fill="#5A669E"/><rect x="58" y="14" width="52" height="106" fill="#B7C0E6"/><rect x="58" y="14" width="52" height="106" fill="url(#wa)"/>
<rect x="54" y="10" width="60" height="5" fill="#141B38"/><rect x="118" y="44" width="38" height="76" fill="#7C89C4"/><rect x="118" y="44" width="38" height="76" fill="url(#wa)" opacity=".8"/>
<rect x="162" y="66" width="34" height="54" fill="#5A669E"/>
<g fill="#1B2447"><circle cx="10" cy="112" r="16"/><circle cx="116" cy="116" r="12"/><circle cx="196" cy="112" r="16"/></g><rect y="112" width="200" height="8" fill="#141B38"/>"""
    elif k == 'b':
        body = """
<defs><linearGradient id="sb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#CFE8DA"/><stop offset="1" stop-color="#F6EAD0"/></linearGradient>
<pattern id="wb" width="8" height="10" patternUnits="userSpaceOnUse"><rect x="1.6" y="2" width="4.4" height="5.4" rx=".6" fill="#F6E7C8"/></pattern></defs>
<rect width="200" height="120" fill="url(#sb)"/><circle cx="36" cy="30" r="13" fill="#F7D58A"/>
<rect x="40" y="40" width="46" height="80" fill="#0E4D3C"/><rect x="40" y="40" width="46" height="80" fill="url(#wb)"/>
<rect x="94" y="22" width="52" height="98" fill="#1C6B52"/><rect x="94" y="22" width="52" height="98" fill="url(#wb)"/><rect x="90" y="18" width="60" height="5" fill="#0B3D30"/>
<rect x="154" y="58" width="40" height="62" fill="#2D8A6B"/><rect x="154" y="58" width="40" height="62" fill="url(#wb)" opacity=".8"/>
<g fill="#0E4D3C"><circle cx="14" cy="104" r="22"/><circle cx="80" cy="114" r="14"/><circle cx="150" cy="116" r="12"/><circle cx="196" cy="108" r="18"/></g><rect y="114" width="200" height="6" fill="#0B3D30"/>"""
    else:
        body = """
<defs><linearGradient id="sc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F2D3BC"/><stop offset="1" stop-color="#FBEBDD"/></linearGradient></defs>
<rect width="200" height="120" fill="url(#sc)"/><circle cx="156" cy="32" r="14" fill="#FFF1CF"/>
<path d="M18 120V58a24 24 0 0 1 48 0v62z" fill="#26211E"/><path d="M76 120V40a30 30 0 0 1 60 0v80z" fill="#E88553"/><path d="M146 120V70a20 20 0 0 1 40 0v50z" fill="#3A302B"/>
<path d="M92 120V48a14 14 0 0 1 28 0v72z" fill="#FBEBDD"/><circle cx="106" cy="82" r="2.4" fill="#E88553"/><path d="M30 120V66a12 12 0 0 1 24 0v54z" fill="#E88553"/>
<rect y="112" width="200" height="8" fill="#26211E"/>"""
    return f'<svg x="{x}" y="{y}" width="{w}" height="{h}" viewBox="0 0 200 120" preserveAspectRatio="xMidYMid slice">{body}</svg>'


def head(w, h, p, k):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-label="Sample advertiser banner {k.upper()}">'
            f'<defs><linearGradient id="bg{k}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{p["g1"]}"/><stop offset="1" stop-color="{p["g2"]}"/></linearGradient></defs>'
            f'<rect width="{w}" height="{h}" fill="url(#bg{k})"/>')


def t(x, y, size, weight, fill, s, anchor='start', extra=''):
    return f'<text x="{x}" y="{y}" {FONT} font-size="{size}" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}" {extra}>{s}</text>'


def strip(k):
    p = PALS[k]
    w, h = 970, 90
    s = head(w, h, p, k) + art(k, 0, 0, 150, 90)
    s += t(176, 30, 11, 700, p['acc'], 'SAMPLE DEVELOPER', extra='letter-spacing="1.6"')
    s += t(176, 58, 25, 700, p['fg'], 'Banner headline goes here')
    s += t(176, 78, 14, 400, p['mut'], 'A supporting line, written by the advertiser')
    s += t(800, 38, 11, 400, p['mut'], 'Regulatory line supplied', 'end')
    s += t(800, 52, 11, 400, p['mut'], 'by the advertiser', 'end')
    s += f'<rect x="818" y="22" width="132" height="46" rx="10" fill="{p["acc"]}"/>' + t(884, 51, 16, 700, p['accfg'], 'Learn more', 'middle')
    return s + '</svg>'


def strip_m(k):
    p = PALS[k]
    w, h = 320, 100
    s = head(w, h, p, k) + art(k, 0, 0, 104, 100)
    s += t(116, 24, 11, 700, p['acc'], 'SAMPLE DEVELOPER', extra='letter-spacing="1.2"')
    s += t(116, 46, 16, 700, p['fg'], 'Banner headline')
    s += t(116, 63, 12, 400, p['mut'], 'goes here')
    s += f'<rect x="116" y="70" width="92" height="24" rx="7" fill="{p["acc"]}"/>' + t(162, 87, 12, 700, p['accfg'], 'Learn more', 'middle')
    return s + '</svg>'


def panel(k):
    p = PALS[k]
    w, h = 524, 494
    s = head(w, h, p, k) + art(k, 0, 0, w, 272)
    s += f'<rect x="16" y="16" width="118" height="28" rx="14" fill="{p["chip"]}"/>' + t(75, 35, 12, 700, p['accfg'], 'BANNER TAG', 'middle', 'letter-spacing="1"')
    s += f'<rect x="16" y="222" width="190" height="38" rx="12" fill="{p["g1"]}" opacity=".94"/><rect x="24" y="229" width="24" height="24" rx="6" fill="{p["acc"]}"/>' + t(58, 246, 14, 700, p['fg'], 'Sample Developer')
    s += t(24, 318, 29, 700, p['fg'], 'Your banner headline') + t(24, 352, 29, 700, p['fg'], 'goes here')
    s += t(24, 384, 16, 400, p['mut'], 'A supporting line, written by the advertiser.')
    s += f'<rect x="24" y="406" width="{w - 48}" height="50" rx="13" fill="{p["acc"]}"/>' + t(w / 2, 437, 17, 700, p['accfg'], 'Learn more', 'middle')
    s += t(w / 2, 480, 11, 400, p['mut'], 'Regulatory line, supplied by the advertiser', 'middle')
    return s + '</svg>'


def panel_m(k):
    p = PALS[k]
    w, h = 640, 320
    s = head(w, h, p, k) + art(k, 0, 0, 250, 320)
    s += t(278, 70, 14, 700, p['acc'], 'SAMPLE DEVELOPER', extra='letter-spacing="1.6"')
    s += t(278, 126, 36, 700, p['fg'], 'Your banner') + t(278, 168, 36, 700, p['fg'], 'headline here')
    s += t(278, 202, 18, 400, p['mut'], 'Supporting line from the advertiser')
    s += f'<rect x="278" y="226" width="170" height="52" rx="13" fill="{p["acc"]}"/>' + t(363, 259, 18, 700, p['accfg'], 'Learn more', 'middle')
    s += t(278, 302, 12, 400, p['mut'], 'Regulatory line, supplied by the advertiser')
    return s + '</svg>'


def near_strip():
    """Near-miss: 970x120 supplied for a 970x90 slot (25 % off), shown whole on the neutral ground."""
    k = 'c'; p = PALS[k]; w, h = 970, 120
    s = head(w, h, p, k) + art(k, 0, 0, 200, 120)
    s += t(226, 40, 11, 700, p['acc'], 'SAMPLE DEVELOPER', extra='letter-spacing="1.6"')
    s += t(226, 78, 28, 700, p['fg'], 'Near-miss banner (970 x 120)')
    s += t(226, 102, 14, 400, p['mut'], 'Shown whole on a neutral ground, never stretched or cropped')
    s += f'<rect x="808" y="36" width="132" height="46" rx="10" fill="{p["acc"]}"/>' + t(874, 65, 16, 700, p['accfg'], 'Learn more', 'middle')
    return s + '</svg>'


def near_panel():
    """Near-miss: 524x600 supplied for a 524x494 slot (about 20 % taller)."""
    k = 'c'; p = PALS[k]; w, h = 524, 600
    s = head(w, h, p, k) + art(k, 0, 0, w, 330)
    s += t(24, 392, 29, 700, p['fg'], 'Near-miss panel') + t(24, 428, 29, 700, p['fg'], '(524 x 600)')
    s += t(24, 462, 16, 400, p['mut'], 'Shown whole on a neutral ground.')
    s += f'<rect x="24" y="492" width="{w - 48}" height="50" rx="13" fill="{p["acc"]}"/>' + t(w / 2, 523, 17, 700, p['accfg'], 'Learn more', 'middle')
    s += t(w / 2, 574, 11, 400, p['mut'], 'Regulatory line, supplied by the advertiser', 'middle')
    return s + '</svg>'


files = {}
for k in PALS:
    files[f'strip-970x90-{k}.svg'] = strip(k)
    files[f'strip-m-320x100-{k}.svg'] = strip_m(k)
    files[f'panel-524x494-{k}.svg'] = panel(k)
    files[f'panel-m-640x320-{k}.svg'] = panel_m(k)
files['near-miss-strip-970x120.svg'] = near_strip()
files['near-miss-panel-524x600.svg'] = near_panel()
for name, svg in files.items():
    with open(os.path.join(OUT, name), 'w', encoding='utf-8') as f:
        f.write(svg)
print(f'wrote {len(files)} files to {os.path.normpath(OUT)}')
