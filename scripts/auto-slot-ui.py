# HG-Fable01 -小紅帽 介面：把 Leonardo 原檔（assets-src/auto-slot/s-*.jpg，2026-10 繪本奇幻版）轉成 Godot 用的圖
# python scripts/auto-slot-ui.py（需要 numpy、opencv-python）
# - 符號：深灰底上的方形磚，找出每一塊切下來 → assets-src/auto-slot/s-sym-<id>.png；
#   圖案符號（大野狼、烏鴉、提燈、藥水、籃子）是整塊木框圖塊，只挖掉框外波浪邊露出的深灰底，整塊直接用；
#   WILD（小紅帽金框肖像）整塊直接用；字母（10 J Q K A）在本機依飽和度切（羊皮紙底很淡、字母很鮮豔）；
#   金鑰匙先跑 node scripts/auto-slot-symbols.mjs 用 Leonardo 去背成 s-sym-key-cut.png；
#   都縮成 256 × 266（跟轉輪格子一樣 1 : 1.04）的圖 → godot/auto-slot/art/tiles/<id>.webp，
#   格子的底統一用 s-symbols 第 8 塊空白羊皮紙：留著做舊的邊、中間稍微提亮、切圓角 → art/tiles/bg.webp；
#   SCATTER 高亮用的「羊皮紙透金光」→ art/tiles/bg-lit.webp
# - 介面零件（s-ui）：深灰底挖空（只挖連到圖邊的灰，邊緣半透明並扣掉灰色），依位置命名：
#   轉動鍵 spin（紅寶石圓盤，Godot 在中間畫旋轉箭頭）、小圓鈕 ring（金圈木頭心）、Feature Buy 底板 buy、資訊面板 panel → art/ui/
# - 圖示（s-icons）：2 × 2 排，左上錢包、右上金幣堆、左下 WIN 徽章、右下金幣 → art/ui/
# - 標題字（s-logo，已去背）：切掉透明邊 → art/ui/logo.webp；BIG WIN 三級標題（s-title-big、s-title-mega2、s-title-super2，已去背）→ art/ui/title-*.webp
# - 轉輪外框（s-frame，纏藤蔓的蜂蜜色木框）：白底挖空，量出中間黑色開口與木框厚度，寫進 art/ui/ui.json 的 "frame"；
#   黑色開口挖成透明（Godot 自己畫開口的底色），四個角給 Godot 切下來貼；
#   四邊另外用上邊中段那段木板（EDGE），兩端交叉淡入做成可以無縫接續的長條 → art/ui/frame-edge.webp，Godot 把它轉向貼滿四邊
# - 底部背景（s-floor）：縮成 768 寬 → art/ui/floor.webp
import json
import os
import sys

import cv2
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets-src', 'auto-slot')
ART = os.path.join(ROOT, 'godot', 'auto-slot', 'art')
TILE = (256, 266)
# 這一版原檔的前綴（舊的月夜版是 r-，原檔都留著）
V = 's'
SYM = f'{V}-sym-'
# 整塊直接用的圖案符號：木框圖塊只挖掉框外的深灰底；金框肖像（WILD）直接裁
FRAMED = ['wolf', 'raven', 'lantern', 'potion', 'basket']
PLAIN = ['hood']


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
    """切出每一塊符號磚的原圖 → assets-src/auto-slot/s-sym-<id>.png；整塊直接用的順便存成 -cut.png"""
    img = load(sheet)
    bg = corner_bg(img)
    boxes = rows_then_cols(blobs(img, bg, 20000))
    if len(boxes) != len(names):
        sys.exit(f'{sheet}: found {len(boxes)} tiles, expected {len(names)}')
    for (x, y, w, h), name in zip(boxes, names):
        if not name:
            continue
        crop = img[y + inset:y + h - inset, x + inset:x + w - inset]
        cv2.imwrite(os.path.join(SRC, f'{SYM}{name}.png'), crop)
        if name in LETTERS:
            letter_cut(name, crop)
        elif name in FRAMED:
            # 多帶一圈底色，波浪邊外面的深灰才連得到圖邊、挖得掉
            m = 8
            keyed = key_out(img[max(y - m, 0):y + h + m, max(x - m, 0):x + w + m], bg, holes=False)
            cv2.imwrite(os.path.join(SRC, f'{SYM}{name}-cut.png'), trim(keyed, pad=0))
        elif name in PLAIN:
            k = 10
            rgba = cv2.cvtColor(img[y + k:y + h - k, x + k:x + w - k], cv2.COLOR_BGR2BGRA)
            cv2.imwrite(os.path.join(SRC, f'{SYM}{name}-cut.png'), rgba)


def letter_cut(name, img):
    """字母：鮮豔的像素裡、碰到中間區域的連通塊（去掉羊皮紙做舊的焦邊：碰到磚邊的都不要）；字上的小高光補回去，
    字母本身的洞（0、Q、A 中間）留著；往外長 1 像素吃進深色描邊、邊緣羽化"""
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    m = ((hsv[..., 1] > 110) & (hsv[..., 2] > 70)).astype(np.uint8)
    h, w = m.shape
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    keep = np.zeros_like(m)
    for i in range(1, n):
        x, y, ww, hh, a = st[i]
        touches = x <= 3 or y <= 3 or x + ww >= w - 3 or y + hh >= h - 3
        if a > 300 and not touches and x < w * 0.75 and x + ww > w * 0.25 and y < h * 0.75 and y + hh > h * 0.25:
            keep[lab == i] = 1
    n, lab, st, _ = cv2.connectedComponentsWithStats((1 - keep).astype(np.uint8), connectivity=4)
    for i in range(1, n):
        x, y, ww, hh, a = st[i]
        if a < 150 and x > 0 and y > 0 and x + ww < w and y + hh < h:
            keep[lab == i] = 1
    alpha = cv2.GaussianBlur(cv2.dilate(keep * 255, np.ones((3, 3), np.uint8)), (3, 3), 0)
    rgba = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
    rgba[..., 3] = alpha
    cv2.imwrite(os.path.join(SRC, f'{SYM}{name}-cut.png'), rgba)


def rounded(W, H, r):
    mask = np.zeros((H, W), np.uint8)
    cv2.rectangle(mask, (r, 0), (W - 1 - r, H - 1), 255, -1)
    cv2.rectangle(mask, (0, r), (W - 1, H - 1 - r), 255, -1)
    for cx, cy in [(r, r), (W - 1 - r, r), (r, H - 1 - r), (W - 1 - r, H - 1 - r)]:
        cv2.circle(mask, (cx, cy), r, 255, -1, cv2.LINE_AA)
    return mask


def tile_bg(sheet=f'{V}-symbols.jpg', index=7):
    """空白羊皮紙磚：留著做舊的邊，中間稍微提亮，四邊淡淡的內陰影，切圓角"""
    img = load(sheet)
    x, y, w, h = rows_then_cols(blobs(img, corner_bg(img), 20000))[index]
    t = img[y + 3:y + h - 3, x + 3:x + w - 3]
    t = cv2.resize(t, TILE, interpolation=cv2.INTER_AREA).astype(np.float32) / 255
    W, H = TILE
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.sqrt(((xx / W - 0.5) / 0.75) ** 2 + ((yy / H - 0.45) / 0.75) ** 2)
    t = np.clip(t + np.clip(1 - d, 0, 1)[..., None] * np.array([0.03, 0.04, 0.05], np.float32), 0, 1)
    edge = np.minimum.reduce([xx, yy, W - 1 - xx, H - 1 - yy])
    base = t
    t = t * (1 - (np.clip(1 - edge / 16.0, 0, 1) ** 2 * 0.25))[..., None]
    mask = rounded(W, H, 10)
    rgba = cv2.cvtColor((np.clip(t, 0, 1) * 255).astype(np.uint8), cv2.COLOR_BGR2BGRA)
    rgba[..., 3] = mask
    save(rgba, 'tiles', 'bg.webp', quality=90)
    # 羊皮紙透金光：整塊紙像被裡面的光照亮，紋理還看得到，中間最亮、邊緣漸漸回到原本的紙色
    lum = base.mean(axis=2, keepdims=True)
    dist = np.sqrt((xx - W * 0.5) ** 2 + (yy - H * 0.45) ** 2)
    k = (np.clip(1 - dist / 230, 0, 1)[..., None] ** 1.2) * 0.85
    warm = np.array([0.22, 0.72, 1.0], np.float32) * (0.4 + lum * 0.7)
    lit = base * (1 - k) + warm * k + (np.clip(1 - dist / 110, 0, 1) ** 2.2)[..., None] * np.array([0.45, 0.8, 1.0], np.float32) * 0.5
    lit = np.clip(lit, 0, 1) * (1 - (np.clip(1 - edge / 16.0, 0, 1) ** 2 * 0.2))[..., None]
    lit = cv2.cvtColor((np.clip(lit, 0, 1) * 255).astype(np.uint8), cv2.COLOR_BGR2BGRA)
    lit[..., 3] = mask
    save(lit, 'tiles', 'bg-lit.webp', quality=90)
    print('tile bg')


def symbols(names):
    """去背好的符號縮成格子大小的圖；整塊直接用的切圓角，跟羊皮紙底一樣"""
    for name in names:
        rgba = cv2.imread(os.path.join(SRC, f'{SYM}{name}-cut.png'), cv2.IMREAD_UNCHANGED)
        if rgba is None or rgba.shape[2] != 4:
            sys.exit(f'missing {SYM}{name}-cut.png (run node scripts/auto-slot-symbols.mjs)')
        out = cv2.resize(rgba, TILE, interpolation=cv2.INTER_AREA)
        if name in FRAMED or name in PLAIN:
            out[..., 3] = np.minimum(out[..., 3], rounded(TILE[0], TILE[1], 10))
        save(out, 'tiles', f'{name}.webp', quality=90)
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
    return parts(f'{V}-ui.jpg', lambda cx, cy: ('spin' if cx < 0.5 else 'ring') if cy < 0.4 else ('buy' if cy < 0.66 else 'panel'))


def icons():
    names = {(0, 0): 'wallet', (1, 0): 'coins', (0, 1): 'win', (1, 1): 'coin'}
    return parts(f'{V}-icons.jpg', lambda cx, cy: names[(int(cx >= 0.5), int(cy >= 0.5))],
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
    return cutout(f'{V}-logo-cut.png', 'logo', 640)


def titles():
    # MEGA、SUPER MEGA 用重畫的第二版（第一版字上鑲了太多紅寶石）
    src = {'big': f'{V}-title-big', 'mega': f'{V}-title-mega2', 'super': f'{V}-title-super2'}
    return {f'title-{k}': cutout(f'{src[k]}-cut.png', f'title-{k}', 760) for k in src}



# 四邊用的木板：上邊中段 x 從 EDGE[0] 到 EDGE[1]（裁好的外框圖座標），厚度從外緣到開口往內 EDGE_IN 像素
EDGE = (290, 680)
EDGE_IN = 90


def frame_edge(keyed, inner_top):
    """上邊那段木板做成無縫長條：右端最後 30% 疊回左端交叉淡入，接起來就看不出接縫"""
    strip = keyed[:inner_top + EDGE_IN, EDGE[0]:EDGE[1]].astype(np.float32)
    w = strip.shape[1]
    o = int(w * 0.3)
    out = strip[:, :w - o].copy()
    t = np.linspace(0, 1, o, dtype=np.float32)[None, :, None]
    out[:, :o] = strip[:, :o] * t + strip[:, w - o:] * (1 - t)
    save(np.clip(out, 0, 255).astype(np.uint8), 'ui', 'frame-edge.webp', quality=88)


def frame(src=f'{V}-frame.jpg', out='frame.webp'):
    img = load(src)
    keyed = key_out(img, (255, 255, 255), lo=8, hi=36, holes=True)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    # 先做一次開運算，深色木頭跟黑色開口只隔著細縫時不會連成一塊
    dark = cv2.morphologyEx((gray < 14).astype(np.uint8), cv2.MORPH_OPEN, np.ones((9, 9), np.uint8))
    n, labels, stats, _ = cv2.connectedComponentsWithStats(dark)
    h, w = gray.shape
    x, y, bw, bh = stats[labels[h // 2, w // 2]][:4]
    # 黑色開口挖成透明：開口的底色、四角切片與四邊長條往內多出來的部分都交給 Godot（開口畫暖棕色）
    keyed[y:y + bh, x:x + bw] = 0
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
    if out == 'frame.webp':
        frame_edge(keyed, inner[1])
    print('frame', keyed.shape[1], keyed.shape[0], 'inner', inner, 'wood', wood)
    return {'size': [int(keyed.shape[1]), int(keyed.shape[0])], 'inner': inner, 'wood': wood}


# 連續格（整張去背後的一排動作）：依連通塊切出 n 格、照 x 排好；每格用同一個高度範圍（保留圖上原本的著地線，
# 騰空那格自然比較高）、同一個寬度，水平以頭部（上面 30% 的重心）對齊，播放時頭才不會左右晃；
# flip 是原圖畫反了方向（大野狼要面向左）。統一縮成 720 高 → godot/auto-slot/art/field/<out>-<i>.webp
def frames(src, out, n, flip=False):
    rgba = load(src, cv2.IMREAD_UNCHANGED)
    a = rgba[..., 3]
    # 各格排得很近（尾巴快碰到前一隻）：小膨脹找色塊，每塊依中心落在整張平均分的哪一欄歸到那一格
    mask = cv2.dilate((a > 40).astype(np.uint8), np.ones((5, 5), np.uint8))
    count, lab0, st, cents = cv2.connectedComponentsWithStats(mask)
    lab = np.zeros_like(lab0)
    W = rgba.shape[1]
    for i in range(1, count):
        if st[i][4] >= 150:
            lab[lab0 == i] = min(int(cents[i][0] / (W / n)), n - 1) + 1
    blobs_ = list(range(1, n + 1))
    boxes = []
    for i in blobs_:
        ys, xs = np.nonzero((lab == i) & (a > 40))
        if not len(ys):
            sys.exit(f'{src}: frame {i} is empty')
        top = ys.min()
        head = (ys < top + (ys.max() - top) * 0.3)
        boxes.append((xs.min(), ys.min(), xs.max(), ys.max(), xs[head].mean()))
    y0 = min(b[1] for b in boxes) - 6
    y1 = max(b[3] for b in boxes) + 6
    half = max(max(cx - b[0], b[2] - cx) for b in boxes for cx in [b[4]]) + 6
    for k, (bx0, by0, bx1, by1, cx) in enumerate(boxes):
        x0 = int(round(cx - half))
        crop = np.zeros((y1 - y0, int(half * 2), 4), np.uint8)
        sx0, sx1 = max(x0, 0), min(x0 + crop.shape[1], rgba.shape[1])
        # 只拿這一格自己的像素（隔壁格的披風、尾巴伸過來也不要）
        part = rgba[y0:y1, sx0:sx1].copy()
        part[lab[y0:y1, sx0:sx1] != blobs_[k]] = 0
        crop[:, sx0 - x0:sx0 - x0 + part.shape[1]] = part
        if flip:
            crop = crop[:, ::-1]
        h = 720
        crop = cv2.resize(crop, (round(crop.shape[1] * h / crop.shape[0]), h), interpolation=cv2.INTER_CUBIC)
        path = os.path.join(ART, 'field', f'{out}-{k + 1}.webp')
        cv2.imwrite(path, crop, [cv2.IMWRITE_WEBP_QUALITY, 88])
    print('frames', out, n, crop.shape[1], crop.shape[0])


def floor():
    img = load(f'{V}-floor.jpg')
    save(cv2.resize(img, (768, img.shape[0] * 768 // img.shape[1]), interpolation=cv2.INTER_AREA), 'ui', 'floor.webp', quality=80)


if __name__ == '__main__':
    tiles(f'{V}-symbols.jpg', ['wolf', 'raven', 'lantern', 'potion', 'basket', 'key', 'hood', None])
    tiles(f'{V}-royals.jpg', LETTERS)
    symbols(['wolf', 'raven', 'lantern', 'potion', 'basket', 'key', 'hood'] + LETTERS)
    tile_bg()
    meta = ui_parts()
    meta.update(icons())
    meta['logo'] = logo()
    meta.update(titles())
    meta['frame'] = frame()
    frames(f'{V}-hero-runsheet-cut.png', 'hero-run', 4)
    frames(f'{V}-wolf-walksheet-cut.png', 'wolf-walk', 4, flip=True)
    floor()
    with open(os.path.join(ART, 'ui', 'ui.json'), 'w', encoding='utf-8') as fp:
        json.dump(meta, fp, indent=1)
    print(json.dumps(meta))
