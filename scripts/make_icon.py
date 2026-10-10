"""Draw Kurt's logo, "⊢kurt" (the turnstile: "proves"), as images/icon.png (256 px, the
extension's icon) and images/logo-1024.png.

    python3 scripts/make_icon.py

Needs Pillow and the font Inconsolata (SIL Open Font License), which it downloads from Google
Fonts into scripts/fonts/ (not committed) the first time.
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


def draw():
    im = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, N - 1, N - 1], radius=RADIUS, fill=NAVY)
    size = 300
    for _ in range(4):             # the size at which it takes WIDTH of the width
        size = int(size * WIDTH * N / measure(d, font(size))[4])
    f = font(size)
    b, h, turnstile, gap, total = measure(d, f)
    w = stem(f) * 0.8
    x, base = N / 2 - total / 2, N / 2 + h / 2
    mid = base - h / 2
    d.rectangle([x, base - h, x + w, base], fill=GREEN)
    d.rectangle([x, mid - w / 2, x + turnstile, mid + w / 2], fill=GREEN)
    d.text((x + turnstile + gap - b[0], base), 'kurt', font=f, fill=WHITE, anchor='ls')
    return im


def main():
    if not os.path.exists(FONT):
        os.makedirs(os.path.dirname(FONT), exist_ok=True)
        urllib.request.urlretrieve(FONT_URL, FONT)
    im = draw()
    im.save(os.path.join(ROOT, 'images', 'logo-1024.png'))
    im.resize((256, 256), Image.LANCZOS).save(os.path.join(ROOT, 'images', 'icon.png'))


if __name__ == '__main__':
    main()
