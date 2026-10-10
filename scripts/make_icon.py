"""Draw Kurt's logo, "⊢kurt" (the turnstile: "proves"), as images/icon.png (256 px, the
extension's icon), images/logo-1024.png, and, with fontTools, as vectors: images/logo.svg (the
same, e.g. a favicon) and images/wordmark.svg (only "⊢kurt", its letters in `currentColor`, e.g.
in a page's header, light or dark).

    python3 scripts/make_icon.py

Needs Pillow, the font Inconsolata (SIL Open Font License), which it downloads from Google Fonts
into scripts/fonts/ (not committed) the first time, and fontTools for the SVGs (else skipped).
"""

import os
import urllib.request

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT_URL = 'https://github.com/google/fonts/raw/main/ofl/inconsolata/Inconsolata%5Bwdth,wght%5D.ttf'
FONT = os.path.join(ROOT, 'scripts', 'fonts', 'Inconsolata.ttf')

N = 1024                 # drawn at this size, scaled down for the icon
RADIUS = 180             # the rounded corners
WIDTH = 0.88             # "⊢kurt" takes this part of the width
NAVY = (27, 38, 64)
GREEN = (46, 190, 110)
WHITE = (255, 255, 255)


def font(size):
    f = ImageFont.truetype(FONT, size)
    # the heaviest weight; the other axes (width) as designed
    f.set_variation_by_axes([a['maximum'] if a['name'] in (b'Weight', 'Weight') else a['default']
                             for a in f.get_variation_axes()])
    return f


def stem(f):
    """the width of the stem of an `l`: the turnstile's strokes are a bit thinner"""
    im = Image.new('L', (2000, 2000), 0)
    d = ImageDraw.Draw(im)
    d.text((500, 1500), 'l', font=f, fill=255, anchor='ls')
    b = d.textbbox((500, 1500), 'l', font=f, anchor='ls')
    y = (b[1] + b[3]) // 2
    return sum(1 for x in range(2000) if im.getpixel((x, y)) > 128)


def measure(d, f):
    b = d.textbbox((0, 0), 'kurt', font=f, anchor='ls')
    h = -b[1]                      # the height of the `k` above the baseline
    turnstile, gap = h * 0.62, h * 0.16
    return b, h, turnstile, gap, turnstile + gap + (b[2] - b[0])


def layout():
    """where everything goes, in pixels of the N x N icon"""
    d = ImageDraw.Draw(Image.new('RGBA', (N, N)))
    size = 300
    for _ in range(4):             # the size at which it takes WIDTH of the width
        size = int(size * WIDTH * N / measure(d, font(size))[4])
    f = font(size)
    b, h, turnstile, gap, total = measure(d, f)
    x, base = N / 2 - total / 2, N / 2 + h / 2
    return dict(size=size, h=h, turnstile=turnstile, w=stem(f) * 0.8, x=x, base=base,
                text_x=x + turnstile + gap - b[0], total=total)


def draw():
    L = layout()
    im = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, N - 1, N - 1], radius=RADIUS, fill=NAVY)
    x, base, h, w = L['x'], L['base'], L['h'], L['w']
    mid = base - h / 2
    d.rectangle([x, base - h, x + w, base], fill=GREEN)
    d.rectangle([x, mid - w / 2, x + L['turnstile'], mid + w / 2], fill=GREEN)
    d.text((L['text_x'], base), 'kurt', font=font(L['size']), fill=WHITE, anchor='ls')
    return im


def svgs():
    """the logo and the wordmark as SVG, the letters as paths (no font needed to show them)"""
    from fontTools.pens.svgPathPen import SVGPathPen
    from fontTools.pens.transformPen import TransformPen
    from fontTools.ttLib import TTFont
    from fontTools.varLib.instancer import instantiateVariableFont

    tt = TTFont(FONT)
    weight = next(a for a in tt['fvar'].axes if a.axisTag == 'wght').maxValue
    tt = instantiateVariableFont(tt, {'wght': weight})
    L = layout()
    scale = L['size'] / tt['head'].unitsPerEm
    glyphs, cmap = tt.getGlyphSet(), tt.getBestCmap()
    pen = SVGPathPen(glyphs)
    x = L['text_x']
    for ch in 'kurt':
        name = cmap[ord(ch)]
        glyphs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, x, L['base'])))
        x += glyphs[name].width * scale
    letters = pen.getCommands()
    x, base, h, w, t = L['x'], L['base'], L['h'], L['w'], L['turnstile']
    mid = base - h / 2
    green = '#%02x%02x%02x' % GREEN
    turnstile = (f'<path fill="{green}" d="M{x:.1f} {base - h:.1f}h{w:.1f}v{h:.1f}h{-w:.1f}z'
                 f'M{x:.1f} {mid - w / 2:.1f}h{t:.1f}v{w:.1f}h{-t:.1f}z"/>')
    logo = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {N} {N}">'
            f'<rect width="{N}" height="{N}" rx="{RADIUS}" fill="#%02x%02x%02x"/>' % NAVY +
            turnstile + f'<path fill="#fff" d="{letters}"/></svg>\n')
    pad = h * 0.08                 # the wordmark: only "⊢kurt", its letters in the text's colour
    top = base - h - pad
    word = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x - pad:.1f} {top:.1f} '
            f'{L["total"] + 2 * pad:.1f} {h + 2 * pad:.1f}">' + turnstile +
            f'<path fill="currentColor" d="{letters}"/></svg>\n')
    for name, text in (('logo.svg', logo), ('wordmark.svg', word)):
        with open(os.path.join(ROOT, 'images', name), 'w') as f:
            f.write(text)


def main():
    if not os.path.exists(FONT):
        os.makedirs(os.path.dirname(FONT), exist_ok=True)
        urllib.request.urlretrieve(FONT_URL, FONT)
    im = draw()
    im.save(os.path.join(ROOT, 'images', 'logo-1024.png'))
    im.resize((256, 256), Image.LANCZOS).save(os.path.join(ROOT, 'images', 'icon.png'))
    try:
        svgs()
    except ImportError:
        print('no fontTools: the SVGs are not made')


if __name__ == '__main__':
    main()
