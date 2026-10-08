# 自走SLOT：把 Leonardo 生成的「關節紙板人偶」綁定圖切成部件，給 Godot 用
# python scripts/auto-slot-puppets.py [預覽輸出資料夾]
# - 來源：assets-src/auto-slot/hero-rig.jpg、wolf-rig.jpg（左邊組裝好、右邊拆成部件）
# - 每個部件只留自己那一塊（連通區域），從邊緣把灰底挖掉，邊緣半透明並扣掉灰底顏色
# - 小紅帽拆開的頭沒有臉：把組裝圖上的五官羽化移植過去
# - 大野狼的尾巴沒有拆出來：從組裝圖用多邊形切
# - 轉軸（黃銅釘）位置是看圖量的，座標都是綁定圖上的像素；輸出到 Godot 專案的 art/puppets/<角色>/，
#   rig.json 記每個部件的轉軸、接在父部件的哪一點、前後順序
# - 另外把組好的立牌存成 assets/auto-slot/<角色>-stand.webp，給網頁 loading 畫面與首頁封面用
import json, os, sys
from collections import deque
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC = 'assets-src/auto-slot'
OUT = 'godot/auto-slot/art/puppets'
LO, HI = 14, 52

# 部件：bbox（綁定圖座標）、pivot（轉軸）、parent／attach（接到父部件的哪一點）、z（負的畫在身體後面）
RIGS = {
    'hero': {
        'root': 'torso',
        'parts': {
            'torso': {'bbox': (777, 162, 1035, 483), 'pivot': (921, 421)},
            'head': {'bbox': (503, 84, 774, 375), 'pivot': (678, 330), 'parent': 'torso', 'attach': (912, 192), 'z': 2},
            'arm_back': {'bbox': (1195, 167, 1281, 402), 'pivot': (1238, 198), 'parent': 'torso', 'attach': (867, 234), 'z': -1},
            'arm_front': {'bbox': (1037, 169, 1195, 399), 'pivot': (1117, 199), 'parent': 'torso', 'attach': (952, 238), 'z': 3},
            'leg_back': {'bbox': (1192, 444, 1291, 689), 'pivot': (1233, 477), 'parent': 'torso', 'attach': (902, 368), 'z': -2},
            'leg_front': {'bbox': (1067, 444, 1165, 689), 'pivot': (1106, 476), 'parent': 'torso', 'attach': (940, 370), 'z': -1},
        },
    },
    'wolf': {
        'root': 'torso',
        'parts': {
            'torso': {'bbox': (814, 161, 1006, 459), 'pivot': (892, 416)},
            'head': {'bbox': (517, 98, 782, 358), 'pivot': (640, 330), 'parent': 'torso', 'attach': (916, 196), 'z': 2},
            'arm_back': {'bbox': (1192, 167, 1306, 405), 'pivot': (1240, 198), 'parent': 'torso', 'attach': (850, 251), 'z': -1},
            'arm_front': {'bbox': (1038, 167, 1171, 403), 'pivot': (1105, 199), 'parent': 'torso', 'attach': (968, 252), 'z': 3},
            'leg_back': {'bbox': (1195, 445, 1312, 689), 'pivot': (1248, 476), 'parent': 'torso', 'attach': (862, 412), 'z': -2},
            'leg_front': {'bbox': (1051, 444, 1161, 693), 'pivot': (1106, 476), 'parent': 'torso', 'attach': (921, 421), 'z': 1},
            'tail': {'poly': [(40, 505), (65, 505), (120, 537), (140, 547), (185, 550), (190, 595), (170, 625), (120, 635), (80, 632), (50, 595), (37, 545)],
                     'pivot': (180, 575), 'parent': 'torso', 'attach': (836, 404), 'z': -3},
        },
    },
}


def transplant_face(im):
    """把組裝圖（左）的五官羽化貼到拆開的頭（右上）上。"""
    a = im.crop((96, 71, 400, 400))
    b = im.crop((495, 71, 799, 400))
    cx, cy, rx, ry, dx, dy = 193, 180, 74, 70, -10, -1
    mask = Image.new('L', a.size, 0)
    ImageDraw.Draw(mask).ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(9))
    face = Image.new('RGB', a.size)
    face.paste(a, (dx, dy))
    shifted = Image.new('L', a.size, 0)
    shifted.paste(mask, (dx, dy))
    b.paste(face, (0, 0), shifted)
    im.paste(b, (495, 71))


def labels(img, bg):
    d = np.sqrt(((img - bg) ** 2).sum(-1))
    return d


def cut(img, dist, bbox=None, poly=None):
    """切出一個部件：bbox 用連通區域，poly 用多邊形。回傳 RGBA 影像與左上角座標。"""
    H, W = dist.shape
    if poly:
        xs, ys = zip(*poly)
        x0, y0, x1, y1 = min(xs) - 4, min(ys) - 4, max(xs) + 4, max(ys) + 4
        keep = Image.new('L', (W, H), 0)
        ImageDraw.Draw(keep).polygon(poly, fill=255)
        region = np.asarray(keep) > 0
    else:
        x0, y0, x1, y1 = bbox
        x0, y0, x1, y1 = x0 - 6, y0 - 6, x1 + 6, y1 + 6
        # 從 bbox 中心那一塊開始長，只留這個部件（旁邊的部件不會連過來）
        fg = dist > 26
        region = np.zeros_like(fg)
        seeds = [(y, x) for y in range(y0, y1) for x in range(x0, x1) if fg[y, x]]
        cyx = ((y0 + y1) // 2, (x0 + x1) // 2)
        seeds.sort(key=lambda p: (p[0] - cyx[0]) ** 2 + (p[1] - cyx[1]) ** 2)
        q = deque([seeds[0]])
        region[seeds[0]] = True
        while q:
            y, x = q.pop()
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if y0 <= ny < y1 and x0 <= nx < x1 and fg[ny, nx] and not region[ny, nx]:
                    region[ny, nx] = True
                    q.append((ny, nx))
        # 補回邊緣抗鋸齒的半透明像素
        region = np.asarray(Image.fromarray(region.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(5))) > 0
    sub = img[y0:y1, x0:x1].astype(np.float64)
    dsub = dist[y0:y1, x0:x1]
    t = np.clip((dsub - LO) / (HI - LO), 0, 1)
    a = t * t * (3 - 2 * t)
    a[~region[y0:y1, x0:x1]] = 0
    bg = img[0:6, 0:6].reshape(-1, 3).mean(0)
    rgb = np.where(a[..., None] > .02, (sub - bg * (1 - a[..., None])) / np.maximum(a[..., None], .02), sub)
    rgba = np.dstack([np.clip(rgb, 0, 255), a * 255]).astype(np.uint8)
    return Image.fromarray(rgba, 'RGBA'), (x0, y0)


def assemble(rig, parts, size=(700, 760), origin=(330, 520), bg=(60, 120, 90, 255)):
    """依轉軸把部件組回去：預覽綁定有沒有對齊，也輸出網頁 loading 畫面與封面用的立牌圖。"""
    canvas = Image.new('RGBA', size, bg)
    root = rig['parts'][rig['root']]
    order = sorted(rig['parts'], key=lambda n: rig['parts'][n].get('z', 0))
    for name in order:
        p = rig['parts'][name]
        im, (ox, oy) = parts[name]
        if name == rig['root']:
            px, py = p['pivot']
            pos = (origin[0] - (px - ox), origin[1] - (py - oy))
        else:
            ax, ay = p['attach']
            rx, ry = root['pivot']
            px, py = p['pivot']
            # 父部件上的接點（相對 root 轉軸）→ 畫布座標，再扣掉部件自己的轉軸
            pos = (origin[0] + (ax - rx) - (px - ox), origin[1] + (ay - ry) - (py - oy))
        canvas.alpha_composite(im, (int(pos[0]), int(pos[1])))
    return canvas


def main():
    preview = sys.argv[1] if len(sys.argv) > 1 else None
    for who, rig in RIGS.items():
        img_pil = Image.open(f'{SRC}/{who}-rig.jpg').convert('RGB')
        if who == 'hero':
            transplant_face(img_pil)
        img = np.asarray(img_pil).astype(np.int32)
        bg = img[0:8, 0:8].reshape(-1, 3).mean(0)
        dist = labels(img, bg)
        out = f'{OUT}/{who}'
        os.makedirs(out, exist_ok=True)
        parts, meta = {}, {}
        for name, p in rig['parts'].items():
            im, origin = cut(img, dist, p.get('bbox'), p.get('poly'))
            parts[name] = (im, origin)
            im.save(f'{out}/{name}.png', optimize=True)
            px, py = p['pivot']
            entry = {'pivot': [px - origin[0], py - origin[1]], 'z': p.get('z', 0)}
            if 'parent' in p:
                pp = rig['parts'][p['parent']]
                ppim, ppo = parts.get(p['parent']) or (None, None)
                # attach 存成「相對父部件轉軸」的位移，Godot 直接當子節點 position
                entry['parent'] = p['parent']
                entry['attach'] = [p['attach'][0] - pp['pivot'][0], p['attach'][1] - pp['pivot'][1]]
            meta[name] = entry
        with open(f'{out}/rig.json', 'w', encoding='utf-8') as f:
            json.dump({'root': rig['root'], 'parts': meta}, f, indent=1)
        if preview:
            assemble(rig, parts).save(f'{preview}/{who}-assembled.png')
        stand = assemble(rig, parts, bg=(0, 0, 0, 0))
        stand = stand.crop(stand.getbbox())
        os.makedirs('assets/auto-slot', exist_ok=True)
        stand.save(f'assets/auto-slot/{who}-stand.webp', quality=88)
        print(who, {n: parts[n][0].size for n in parts})


main()
