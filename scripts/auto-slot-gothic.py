# 自走SLOT 暗黑哥德版介面：把 Leonardo 原檔（assets-src/auto-slot/g-*.jpg）轉成 Godot 用的圖
# python scripts/auto-slot-gothic.py（需要 numpy、opencv-python）
# - 符號磚：白底上的方形滿版磚，找出每一塊切下來、往內縮掉白邊，統一成 256 × 266（跟轉輪格子一樣 1 : 1.04）
#   → godot/auto-slot/art/tiles/<id>.webp
# - 介面零件：灰底挖空（只挖連到圖邊的灰，邊緣半透明並扣掉灰色），依位置命名 → art/ui/
# - 轉輪外框（g-frame2）：白底挖空，量出中間黑色開口、木框厚度與頂端紅寶石的位置，
#   寫進 art/ui/ui.json 的 "frame"，Godot 依此把轉輪對進開口
# - 森林地面背景：縮成 768 寬 → art/ui/floor.webp
import json
import os
import sys

import cv2
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets-src', 'auto-slot')
ART = os.path.join(ROOT, 'godot', 'auto-slot', 'art')
TILE = (256, 266)


def load(name):
    img = cv2.imread(os.path.join(SRC, name), cv2.IMREAD_COLOR)
    if img is None:
        sys.exit(f'missing {name}')
    return img


def save(img, *parts, quality=88):
    path = os.path.join(ART, *parts)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    cv2.imwrite(path, img, [cv2.IMWRITE_WEBP_QUALITY, quality])
    return path


def blobs(img, bg, min_area, thresh=40):
    """跟底色差很多的區塊（依面積過濾），回傳 bbox 列表 (x, y, w, h)"""
    dist = np.linalg.norm(img.astype(np.float32) - np.array(bg, np.float32), axis=2)
    mask = (dist > thresh).astype(np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    n, _, stats, _ = cv2.connectedComponentsWithStats(mask)
    return [tuple(stats[i][:4]) for i in range(1, n) if stats[i][4] >= min_area]


def rows_then_cols(boxes, row_gap=80):
    boxes = sorted(boxes, key=lambda b: b[1])
    rows, cur = [], []
    for b in boxes:
        if cur and b[1] - cur[0][1] > row_gap:
            rows.append(cur)
            cur = []
        cur.append(b)
    if cur:
        rows.append(cur)
    return [b for row in rows for b in sorted(row, key=lambda b: b[0])]


def tiles(sheet, names, inset=4):
    img = load(sheet)
    boxes = rows_then_cols(blobs(img, (255, 255, 255), 20000))
    if len(boxes) != len(names):
        sys.exit(f'{sheet}: found {len(boxes)} tiles, expected {len(names)}')
    for (x, y, w, h), name in zip(boxes, names):
        if not name:
            continue
        crop = img[y + inset:y + h - inset, x + inset:x + w - inset]
        save(cv2.resize(crop, TILE, interpolation=cv2.INTER_AREA), 'tiles', f'{name}.webp', quality=90)
        print('tile', name, w, h)


def key_out(img, bg, lo=10.0, hi=42.0, holes=False):
    """只挖跟底色相近、而且連到圖邊的像素；邊緣依距離給半透明並扣掉底色。
    holes：被花紋或藤蔓圍住的底色也挖（含有幾乎等於底色的像素的那一塊就算）"""
    f = img.astype(np.float32)
    bgv = np.array(bg, np.float32)
    dist = np.linalg.norm(f - bgv, axis=2)
    cand = (dist < hi).astype(np.uint8)
    n, labels = cv2.connectedComponents(cand)
    edge = set(np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))) - {0}
    if holes:
        edge |= set(np.unique(labels[dist < lo * 0.6])) - {0}
    is_bg = np.isin(labels, list(edge))
    t = np.clip((dist - lo) / (hi - lo), 0, 1)
    a = np.where(is_bg, t * t * (3 - 2 * t), 1.0)
    a[a < 0.04] = 0
    safe = np.maximum(a, 1e-3)[..., None]
    rgb = np.clip((f - bgv * (1 - a[..., None])) / safe, 0, 255)
    out = np.dstack([rgb, a * 255]).astype(np.uint8)
    out[a == 0] = 0
    return out


def trim(rgba, pad=4):
    ys, xs = np.nonzero(rgba[..., 3] > 8)
    y0, y1, x0, x1 = max(ys.min() - pad, 0), ys.max() + pad + 1, max(xs.min() - pad, 0), xs.max() + pad + 1
    return rgba[y0:y1, x0:x1]


def ui_parts():
    img = load('g-ui.jpg')
    bg = np.median(np.concatenate([img[:8, :8].reshape(-1, 3), img[-8:, -8:].reshape(-1, 3)]), axis=0)
    keyed = key_out(img, bg, holes=True)
    boxes = blobs(img, bg, 6000, thresh=30)
    # 依位置認零件：左上大圓、右上小圓、中間寬的花飾、左下金幣、右下名牌
    named = {}
    h, w = img.shape[:2]
    for (x, y, bw, bh) in boxes:
        cx, cy = x + bw / 2, y + bh / 2
        if cy < h * 0.45:
            name = 'spin-ring' if cx < w * 0.5 else 'ring'
        elif cy < h * 0.68:
            name = 'crest'
        else:
            name = 'coin' if cx < w * 0.35 else 'plate'
        named.setdefault(name, []).append((x, y, bw, bh))
    meta = {}
    for name, bs in named.items():
        x0 = min(b[0] for b in bs)
        y0 = min(b[1] for b in bs)
        x1 = max(b[0] + b[2] for b in bs)
        y1 = max(b[1] + b[3] for b in bs)
        part = trim(keyed[max(y0 - 6, 0):y1 + 6, max(x0 - 6, 0):x1 + 6])
        if name == 'coin':
            part = cv2.resize(part, (128, 128 * part.shape[0] // part.shape[1]), interpolation=cv2.INTER_AREA)
        save(part, 'ui', f'{name}.webp', quality=90)
        meta[name] = [int(part.shape[1]), int(part.shape[0])]
        print('ui', name, part.shape[1], part.shape[0])
    # 轉動鍵的深色圓心：量出半徑，Godot 在上面畫旋轉箭頭
    ring = cv2.imread(os.path.join(ART, 'ui', 'spin-ring.webp'), cv2.IMREAD_UNCHANGED)
    gray = cv2.cvtColor(ring[..., :3], cv2.COLOR_BGR2GRAY)
    dark = ((gray < 40) & (ring[..., 3] > 200)).astype(np.uint8)
    n, labels, stats, cents = cv2.connectedComponentsWithStats(dark)
    k = 1 + int(np.argmax(stats[1:, 4]))
    meta['spin-ring-hole'] = [round(float(cents[k][0]), 1), round(float(cents[k][1]), 1), round(float(np.sqrt(stats[k][4] / np.pi)), 1)]
    return meta


def frame():
    img = load('g-frame2.jpg')
    keyed = key_out(img, (255, 255, 255), lo=8, hi=36, holes=True)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    n, labels, stats, _ = cv2.connectedComponentsWithStats((gray < 22).astype(np.uint8))
    h, w = gray.shape
    x, y, bw, bh = stats[labels[h // 2, w // 2]][:4]
    # 黑色開口要整片不透明（被 holes 挖掉的話補回來）
    keyed[y:y + bh, x:x + bw, 3] = 255
    ys, xs = np.nonzero(keyed[..., 3] > 8)
    oy, ox = max(ys.min() - 2, 0), max(xs.min() - 2, 0)
    keyed = keyed[oy:ys.max() + 3, ox:xs.max() + 3]
    # 木框厚度：從開口左緣沿中線往外，走到第一個透明的像素
    row = keyed[y - oy + bh // 2, :x - ox, 3]
    clear = np.nonzero(row < 40)[0]
    wood = int(x - ox - (clear.max() + 1)) if len(clear) else 0
    save(keyed, 'ui', 'frame.webp', quality=88)
    inner = [int(x - ox), int(y - oy), int(x + bw - ox), int(y + bh - oy)]
    # 頂端花飾的紅寶石中心：倍率徽章疊在這裡
    top = keyed[:inner[1], :, :3].astype(int)
    red = (top[..., 2] > 150) & (top[..., 1] < 70) & (top[..., 0] < 80) & (keyed[:inner[1], :, 3] > 200)
    red[:, :int(keyed.shape[1] * 0.42)] = False
    red[:, int(keyed.shape[1] * 0.58):] = False
    gy, gx = np.nonzero(red)
    gem = [round(float(gx.mean()), 1), round(float(gy.mean()), 1)] if len(gx) else [keyed.shape[1] / 2, inner[1] / 2]
    print('frame', keyed.shape[1], keyed.shape[0], 'inner', inner, 'wood', wood, 'gem', gem)
    return {'size': [int(keyed.shape[1]), int(keyed.shape[0])], 'inner': inner, 'wood': wood, 'gem': gem}


def floor():
    img = load('g-floor.jpg')
    save(cv2.resize(img, (768, img.shape[0] * 768 // img.shape[1]), interpolation=cv2.INTER_AREA), 'ui', 'floor.webp', quality=80)


if __name__ == '__main__':
    tiles('g-symbols.jpg', ['wolf', 'raven', 'lantern', 'potion', 'basket', 'key', 'hood', None])
    tiles('g-royals.jpg', ['ten', 'jack', 'queen', 'king', 'ace'])
    meta = ui_parts()
    meta['frame'] = frame()
    floor()
    with open(os.path.join(ART, 'ui', 'ui.json'), 'w', encoding='utf-8') as fp:
        json.dump(meta, fp, indent=1)
    print(json.dumps(meta))
