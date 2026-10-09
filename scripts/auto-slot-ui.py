# 自走SLOT 介面：把 Leonardo 原檔（assets-src/auto-slot/r-*.jpg）轉成 Godot 用的圖
# python scripts/auto-slot-ui.py（需要 numpy、opencv-python）
# - 符號：白底上的方形滿版磚，找出每一塊切下來、往內縮掉白邊 → assets-src/auto-slot/sym-<id>.png；
#   每張磚的底和框都不一樣，所以只留符號本身：字母（10 J Q K A）在本機依飽和度切（石板底是灰的、字母很鮮豔），
#   其他圖案先跑 node scripts/auto-slot-symbols.mjs 用 Leonardo 去背成 sym-<id>-cut.png；
#   去背後縮成 256 × 266（跟轉輪格子一樣 1 : 1.04、位置不變）的透明圖 → godot/auto-slot/art/tiles/<id>.webp，
#   格子的底統一用設計稿那塊空白石板磚（r-symbols 第 8 塊）：抹掉四角的綠葉與小釘子、裁掉邊框、
#   稍微提亮加中間柔光、四邊對稱的內陰影、切圓角 → art/tiles/bg.webp；SCATTER 高亮用的「石板透金光」→ art/tiles/bg-lit.webp
# - 介面零件（r-ui）：灰底挖空（只挖連到圖邊的灰，邊緣半透明並扣掉灰色），依位置命名：
#   轉動鍵 spin（紅色圓盤，Godot 在中間畫旋轉箭頭）、小圓鈕 ring、Feature Buy 底板 buy、資訊面板 panel → art/ui/
# - 圖示（r-icons）：2 × 2 排，左上錢包、右上金幣堆、左下 WIN 徽章、右下金幣 → art/ui/
# - 標題字（r-logo，已去背）：切掉透明邊 → art/ui/logo.webp；BIG WIN 三級標題（r-title-*，已去背）→ art/ui/title-*.webp
# - 轉輪外框（r-frame-aged-c，做舊的破木框；原本的拋光細金框 r-frame 不用了）：白底挖空，量出中間黑色開口與木框厚度，
#   寫進 art/ui/ui.json 的 "frame"，Godot 依此用九宮格畫外框（四角鐵件放大、四邊木頭重複貼，不拉長）
# - 底部背景（r-floor）：縮成 768 寬 → art/ui/floor.webp
import json
import os
import sys

import cv2
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets-src', 'auto-slot')
ART = os.path.join(ROOT, 'godot', 'auto-slot', 'art')
TILE = (256, 266)


def load(name, flags=cv2.IMREAD_COLOR):
    img = cv2.imread(os.path.join(SRC, name), flags)
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


LETTERS = ['ten', 'jack', 'queen', 'king', 'ace']


def tiles(sheet, names, inset=4):
    """切出每一塊符號磚的原圖 → assets-src/auto-slot/sym-<id>.png"""
    img = load(sheet)
    boxes = rows_then_cols(blobs(img, (255, 255, 255), 20000))
    if len(boxes) != len(names):
        sys.exit(f'{sheet}: found {len(boxes)} tiles, expected {len(names)}')
    for (x, y, w, h), name in zip(boxes, names):
        if not name:
            continue
        crop = img[y + inset:y + h - inset, x + inset:x + w - inset]
        cv2.imwrite(os.path.join(SRC, f'sym-{name}.png'), crop)
        if name in LETTERS:
            letter_cut(name, crop)


def letter_cut(name, img):
    """字母：鮮豔的像素裡、碰到中間區域的連通塊（去掉四角的綠葉與邊框）；字上的小高光補回去，
    字母本身的洞（0、Q、A 中間）留著；往外長 1 像素吃進深色描邊、邊緣羽化"""
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    m = ((hsv[..., 1] > 110) & (hsv[..., 2] > 70)).astype(np.uint8)
    h, w = m.shape
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    keep = np.zeros_like(m)
    for i in range(1, n):
        x, y, ww, hh, a = st[i]
        if a > 300 and x < w * 0.75 and x + ww > w * 0.25 and y < h * 0.75 and y + hh > h * 0.25:
            keep[lab == i] = 1
    n, lab, st, _ = cv2.connectedComponentsWithStats((1 - keep).astype(np.uint8), connectivity=4)
    for i in range(1, n):
        x, y, ww, hh, a = st[i]
        if a < 150 and x > 0 and y > 0 and x + ww < w and y + hh < h:
            keep[lab == i] = 1
    alpha = cv2.GaussianBlur(cv2.dilate(keep * 255, np.ones((3, 3), np.uint8)), (3, 3), 0)
    rgba = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
    rgba[..., 3] = alpha
    cv2.imwrite(os.path.join(SRC, f'sym-{name}-cut.png'), rgba)


def tile_bg(sheet='r-symbols.jpg', index=7):
    img = load(sheet)
    x, y, w, h = rows_then_cols(blobs(img, (255, 255, 255), 20000))[index]
    t = img[y:y + h, x:x + w]
    hsv = cv2.cvtColor(t, cv2.COLOR_BGR2HSV)
    leaf = ((hsv[..., 0] > 30) & (hsv[..., 0] < 95) & (hsv[..., 1] > 60)) | ((hsv[..., 0] < 30) & (hsv[..., 1] > 90) & (hsv[..., 2] > 60))
    t = cv2.inpaint(t, cv2.dilate(leaf.astype(np.uint8) * 255, np.ones((7, 7), np.uint8)), 9, cv2.INPAINT_TELEA)
    t = cv2.resize(t[22:-22, 22:-22], TILE, interpolation=cv2.INTER_CUBIC).astype(np.float32) / 255
    W, H = TILE
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.sqrt(((xx / W - 0.5) / 0.75) ** 2 + ((yy / H - 0.45) / 0.75) ** 2)
    t = np.clip(t * 1.25 + np.clip(1 - d, 0, 1)[..., None] * np.array([0.16, 0.12, 0.10], np.float32), 0, 1)
    # 四邊對稱的柔和內陰影（不做單邊亮邊，免得看起來像只剩一半的框）
    edge = np.minimum.reduce([xx, yy, W - 1 - xx, H - 1 - yy])
    shade = (1 - (np.clip(1 - edge / 22.0, 0, 1) ** 2 * 0.45))[..., None]
    base = t
    t = t * shade
    rgba = cv2.cvtColor((np.clip(t, 0, 1) * 255).astype(np.uint8), cv2.COLOR_BGR2BGRA)
    mask = np.zeros((H, W), np.uint8)
    r = 14
    cv2.rectangle(mask, (r, 0), (W - 1 - r, H - 1), 255, -1)
    cv2.rectangle(mask, (0, r), (W - 1, H - 1 - r), 255, -1)
    for cx, cy in [(r, r), (W - 1 - r, r), (r, H - 1 - r), (W - 1 - r, H - 1 - r)]:
        cv2.circle(mask, (cx, cy), r, 255, -1, cv2.LINE_AA)
    rgba[..., 3] = mask
    save(rgba, 'tiles', 'bg.webp', quality=90)
    # 石板透金光：整塊石板像被裡面的光照亮，紋理（亮度）還看得到，中間最亮、邊緣漸漸回到原本的暗石板
    lum = base.mean(axis=2, keepdims=True)
    dist = np.sqrt((xx - W * 0.5) ** 2 + (yy - H * 0.45) ** 2)
    k = np.clip(1 - dist / 230, 0, 1)[..., None] ** 1.2
    warm = np.array([0.25, 0.68, 1.0], np.float32) * (0.25 + lum * 2.4)
    lit = base * (1 - k) + warm * k + (np.clip(1 - dist / 110, 0, 1) ** 2.2)[..., None] * np.array([0.5, 0.85, 1.0], np.float32) * 0.6
    lit = np.clip(lit, 0, 1) * (1 - (np.clip(1 - edge / 22.0, 0, 1) ** 2 * 0.3))[..., None]
    lit = cv2.cvtColor((np.clip(lit, 0, 1) * 255).astype(np.uint8), cv2.COLOR_BGR2BGRA)
    lit[..., 3] = mask
    save(lit, 'tiles', 'bg-lit.webp', quality=90)
    print('tile bg')


def symbols(names):
    """去背好的符號縮成格子大小的透明圖"""
    for name in names:
        rgba = cv2.imread(os.path.join(SRC, f'sym-{name}-cut.png'), cv2.IMREAD_UNCHANGED)
        if rgba is None or rgba.shape[2] != 4:
            sys.exit(f'missing sym-{name}-cut.png (run node scripts/auto-slot-symbols.mjs)')
        save(cv2.resize(rgba, TILE, interpolation=cv2.INTER_AREA), 'tiles', f'{name}.webp', quality=90)
        print('symbol', name)


def key_out(img, bg, lo=10.0, hi=42.0, holes=False):
    """只挖跟底色相近、而且連到圖邊的像素；邊緣依距離給半透明並扣掉底色。
    holes：被花紋圍住的底色也挖（含有幾乎等於底色的像素的那一塊就算）"""
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


def corner_bg(img):
    return np.median(np.concatenate([img[:8, :8].reshape(-1, 3), img[-8:, -8:].reshape(-1, 3)]), axis=0)


def parts(sheet, classify, sizes=None, holes=True):
    """灰底素材表：挖空後依 classify(中心 x, y, 寬, 高) 回傳的名字分組，各自切成一張圖"""
    img = load(sheet)
    bg = corner_bg(img)
    keyed = key_out(img, bg, holes=holes)
    h, w = img.shape[:2]
    named = {}
    for (x, y, bw, bh) in blobs(img, bg, 3000, thresh=30):
        name = classify((x + bw / 2) / w, (y + bh / 2) / h)
        named.setdefault(name, []).append((x, y, bw, bh))
    meta = {}
    for name, bs in named.items():
        x0 = min(b[0] for b in bs)
        y0 = min(b[1] for b in bs)
        x1 = max(b[0] + b[2] for b in bs)
        y1 = max(b[1] + b[3] for b in bs)
        part = trim(keyed[max(y0 - 6, 0):y1 + 6, max(x0 - 6, 0):x1 + 6])
        if sizes and name in sizes and part.shape[1] > sizes[name]:
            k = sizes[name] / part.shape[1]
            part = cv2.resize(part, (sizes[name], round(part.shape[0] * k)), interpolation=cv2.INTER_AREA)
        save(part, 'ui', f'{name}.webp', quality=90)
        meta[name] = [int(part.shape[1]), int(part.shape[0])]
        print('ui', name, part.shape[1], part.shape[0])
    return meta


def ui_parts():
    # 上排左邊大圓是轉動鍵、右邊小圓是一般按鈕；中間寬的是 Feature Buy 底板；下面是資訊面板
    return parts('r-ui.jpg', lambda cx, cy: ('spin' if cx < 0.5 else 'ring') if cy < 0.4 else ('buy' if cy < 0.66 else 'panel'))


def icons():
    names = {(0, 0): 'wallet', (1, 0): 'coins', (0, 1): 'win', (1, 1): 'coin'}
    return parts('r-icons.jpg', lambda cx, cy: names[(int(cx >= 0.5), int(cy >= 0.5))],
                 sizes={'wallet': 160, 'coins': 160, 'win': 200, 'coin': 128})


def cutout(src, out, width):
    """已去背的圖：切掉透明邊、縮到指定寬度"""
    part = trim(load(src, cv2.IMREAD_UNCHANGED))
    if part.shape[1] > width:
        part = cv2.resize(part, (width, round(part.shape[0] * width / part.shape[1])), interpolation=cv2.INTER_AREA)
    save(part, 'ui', f'{out}.webp', quality=90)
    print(out, part.shape[1], part.shape[0])
    return [int(part.shape[1]), int(part.shape[0])]


def logo():
    return cutout('r-logo-cut.png', 'logo', 640)


def titles():
    return {f'title-{k}': cutout(f'r-title-{k}-cut.png', f'title-{k}', 760) for k in ['big', 'mega', 'super']}



def frame(src='r-frame-aged-c.jpg', out='frame.webp'):
    img = load(src)
    keyed = key_out(img, (255, 255, 255), lo=8, hi=36, holes=True)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    # 先做一次開運算，深色木頭跟黑色開口只隔著細縫時不會連成一塊
    dark = cv2.morphologyEx((gray < 14).astype(np.uint8), cv2.MORPH_OPEN, np.ones((9, 9), np.uint8))
    n, labels, stats, _ = cv2.connectedComponentsWithStats(dark)
    h, w = gray.shape
    x, y, bw, bh = stats[labels[h // 2, w // 2]][:4]
    # 黑色開口要整片不透明（被 holes 挖掉的話補回來）
    keyed[y:y + bh, x:x + bw, 3] = 255
    ys, xs = np.nonzero(keyed[..., 3] > 8)
    oy, ox = max(ys.min() - 2, 0), max(xs.min() - 2, 0)
    keyed = keyed[oy:ys.max() + 3, ox:xs.max() + 3]
    # 木框厚度：從開口左緣往外走到第一個透明的像素；中間 40% 的每一行都量，取中位數（做舊的框邊緣有缺角）
    walls = []
    for yy in range(y - oy + bh * 3 // 10, y - oy + bh * 7 // 10, 4):
        clear = np.nonzero(keyed[yy, :x - ox, 3] < 40)[0]
        walls.append(x - ox - (clear.max() + 1) if len(clear) else x - ox)
    wood = int(np.median(walls))
    save(keyed, 'ui', out, quality=88)
    inner = [int(x - ox), int(y - oy), int(x + bw - ox), int(y + bh - oy)]
    print('frame', keyed.shape[1], keyed.shape[0], 'inner', inner, 'wood', wood)
    return {'size': [int(keyed.shape[1]), int(keyed.shape[0])], 'inner': inner, 'wood': wood}


def floor():
    img = load('r-floor.jpg')
    save(cv2.resize(img, (768, img.shape[0] * 768 // img.shape[1]), interpolation=cv2.INTER_AREA), 'ui', 'floor.webp', quality=80)


if __name__ == '__main__':
    tiles('r-symbols.jpg', ['wolf', 'raven', 'lantern', 'potion', 'basket', 'key', 'hood', None])
    tiles('r-royals.jpg', LETTERS)
    symbols(['wolf', 'raven', 'lantern', 'potion', 'basket', 'key', 'hood'] + LETTERS)
    tile_bg()
    meta = ui_parts()
    meta.update(icons())
    meta['logo'] = logo()
    meta.update(titles())
    meta['frame'] = frame()
    floor()
    with open(os.path.join(ART, 'ui', 'ui.json'), 'w', encoding='utf-8') as fp:
        json.dump(meta, fp, indent=1)
    print(json.dumps(meta))
