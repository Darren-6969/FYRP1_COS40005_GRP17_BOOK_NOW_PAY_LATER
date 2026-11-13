"""Renders assets/images/ambient-{light,dark}.webp from the approved mock CSS (--p-bg).

Each radial layer is `radial-gradient(RX% RY% at X% Y%, colour 0%, transparent STOP%)`,
painted bottom-up over a vertical linear gradient. Output 1080x2400 WebP.

Run from mobile/:  python scripts/generate-ambient-backgrounds.py assets/images  (needs Pillow + numpy)
"""
import sys
import numpy as np
from PIL import Image

W, H = 1080, 2400
ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)


def hexrgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float32)


def linear(top, bottom):
    t = (ys / (H - 1))[..., None]
    return hexrgb(top) * (1 - t) + hexrgb(bottom) * t


def radial(img, rx, ry, cx, cy, rgb, alpha, stop):
    # rx, ry, cx, cy as fractions of width/height, as in CSS percentages
    dx = (xs - cx * W) / (rx * W)
    dy = (ys - cy * H) / (ry * H)
    d = np.sqrt(dx * dx + dy * dy)
    a = np.clip(1 - d / stop, 0, 1) * alpha
    a = a[..., None]
    return img * (1 - a) + np.array(rgb, np.float32) * a


def finish(img, path):
    # Light dither so the soft gradients don't band after compression.
    rng = np.random.default_rng(7)
    img = img + rng.uniform(-0.8, 0.8, img.shape).astype(np.float32)
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(path, 'WEBP', quality=88, method=6)


def light(path):
    img = linear('#f3f5f0', '#e7ece3')
    img = radial(img, 0.90, 0.40, -0.12, 0.86, hexrgb('#e0e8da'), 1.0, 0.70)
    img = radial(img, 0.85, 0.42, 1.08, 0.34, hexrgb('#d6e3d0'), 1.0, 0.70)
    img = radial(img, 1.30, 0.50, 0.12, -0.06, hexrgb('#fdfdfb'), 1.0, 0.62)
    finish(img, path)


def dark(path):
    img = linear('#0b1512', '#070e0c')
    img = radial(img, 0.60, 0.30, -0.10, 0.40, (30, 79, 68), 0.28, 0.70)
    img = radial(img, 0.70, 0.38, 1.12, 0.72, (30, 79, 68), 0.50, 0.70)
    img = radial(img, 1.10, 0.42, 0.50, -0.10, (47, 117, 100), 0.62, 0.70)
    # The mock's faint grid overlay was dropped (14 Nov 2026): glows only.
    finish(img, path)


if __name__ == '__main__':
    out = sys.argv[1]
    light(f'{out}/ambient-light.webp')
    dark(f'{out}/ambient-dark.webp')
    print('ok')
