# HAPPY GAME（開發商）LOGO 拆圖層：python scripts/happy-game-logo.py（需要 numpy、opencv-python）
# 不生成新圖，只用兩張原圖（1254 × 1254，象牙紙底上的紅色剪紙徽章，徽章的位置一模一樣）：
# - assets-src/happy-game/logo.png：完整的 LOGO（有翅膀、花草），從這張拆出翅膀、左邊花枝（連小鳥）、右邊花草、
#   頭髮上的花、緞帶下的花、HAPPY GAME 字母，各自一層（webp，背景透明）
# - assets-src/happy-game/logo2.png：同一個徽章但沒有翅膀和花草、頭髮完整，直接當底圖 base（徽章外的紙底挖成透明），
#   翅膀展開前、花草長出來前看到的就是完整的人物；字母那層只拿來做亮起來、金光掃過的效果（字本來就在底圖上）
# 拆法：紅色（飽和、偏暗）以外的淺色都是「剪紙片」；剪紙片彼此貼在一起（葉子碰翅膀、葉子碰金環），
# 先把徽章外的紙底、金環、緞帶上緣切開，再腐蝕成小碎片，依碎片中心落在哪個範圍（POLY）分類，
# 最後用分水嶺把碎片長回原本的形狀（邊界會沿著剪紙之間的陰影線）。翅膀跟枝幹貼著一長條分不開，
# 落在翅膀範圍外的就歸給花枝。字母在紅緞帶上一個個獨立，直接依顏色取。每一層比本體多帶 4 px（剪紙的陰影）
# 輸出到 assets/happy-game/（縮成 1024 寬）：base.webp、wing.webp、left.webp、right.webp、hair-flower.webp、
# banner-flower.webp、letters.webp，與 logo.json（每層的位置、生長的根部、翅膀的支點、每個字母的範圍）
import json
import os

import cv2
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets-src', 'happy-game', 'logo.png')
BASE_SRC = os.path.join(ROOT, 'assets-src', 'happy-game', 'logo2.png')
OUT = os.path.join(ROOT, 'assets', 'happy-game')
SIZE = 1024
# 徽章圓心與三圈金環的半徑（原圖座標，沿幾個方向量淺色的環線得到）
CENTER = (625, 520)

BASE, WING, LEFT, HAIRF, RIGHT, BANF, LETTER = 1, 2, 3, 4, 5, 6, 7
# 分類用的大概範圍（原圖座標）：碎片中心落在哪個多邊形就歸哪一層
POLY = {
    WING: [(520, 410), (545, 440), (600, 560), (632, 640), (662, 682), (712, 752), (745, 795), (392, 800), (372, 760), (356, 700), (352, 600), (360, 550), (395, 505), (440, 465), (480, 440)],
    LEFT: [(200, 420), (300, 300), (380, 200), (450, 160), (600, 160), (600, 330), (500, 345), (480, 440), (440, 465), (395, 505), (360, 550), (352, 600), (356, 700), (372, 760), (392, 800), (200, 800)],
    HAIRF: [(478, 335), (585, 335), (585, 432), (478, 432)],
    RIGHT: [(770, 560), (1040, 560), (1040, 805), (770, 805)],
    LETTER: [(250, 815), (995, 815), (995, 995), (250, 995)],
}
# 緞帶下的花：圓心與半徑
FLOWER = ((625, 1042), 72)
# 動畫用的點（原圖座標）：花草從根部長出來、花從中心綻開、翅膀繞著肩膀拍動
ANCHORS = {'left': (365, 795), 'right': (800, 795), 'hair-flower': (527, 386), 'banner-flower': (625, 1042), 'wing': (540, 445)}
LAYERS = [(LEFT, 'left'), (RIGHT, 'right'), (WING, 'wing'), (HAIRF, 'hair-flower'), (LETTER, 'letters'), (BANF, 'banner-flower')]


def poly_mask(shape, pts):
    m = np.zeros(shape, np.uint8)
    cv2.fillPoly(m, [np.array(pts, np.int32)], 1)
    return m.astype(bool)


def red_like(im):
    L = cv2.cvtColor(im, cv2.COLOR_BGR2LAB)[:, :, 0].astype(int)
    S = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)[:, :, 1].astype(int)
    return (S > 120) & (L < 150)


# 徽章外輪廓：紅色區域閉合、填洞、往外擴一圈（含最外圈金邊）；外面是紙底
def silhouette(im):
    h, w = im.shape[:2]
    closed = cv2.morphologyEx(red_like(im).astype(np.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31)))
    ff = closed * 255
    cv2.floodFill(ff, np.zeros((h + 2, w + 2), np.uint8), (0, 0), 128)
    return cv2.dilate((ff != 128).astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25)))


def segment(im):
    h, w = im.shape[:2]
    L = cv2.cvtColor(im, cv2.COLOR_BGR2LAB)[:, :, 0].astype(int)
    S = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)[:, :, 1].astype(int)
    red_like = (S > 120) & (L < 150)
    sil = silhouette(im)
    inner = cv2.erode(sil, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (41, 41)))
    yy, xx = np.mgrid[0:h, 0:w]
    rr = np.hypot(xx - CENTER[0], yy - CENTER[1])
    # 切開：金環、緞帶上緣、徽章外緣
    cut = (((rr > 374) & (rr < 388)) | ((rr > 398) & (rr < 432)) | (rr > 442)) & (yy < 800)
    cut |= (yy > 774) & (yy < 806)
    cut |= inner == 0
    free = (~red_like) & ~cut
    cls = np.zeros((h, w), np.uint8)
    for k, pts in POLY.items():
        cls[poly_mask((h, w), pts) & (cls == 0)] = k
    flower = np.hypot(xx - FLOWER[0][0], yy - FLOWER[0][1]) < FLOWER[1]
    cls[flower] = BANF
    markers = np.zeros((h, w), np.int32)
    markers[red_like | (sil == 0)] = BASE
    ringline = (((rr > 379) & (rr < 386)) | ((rr > 405) & (rr < 425)) | ((rr > 446) & (rr < 462))) & (yy < 780) & ~red_like
    markers[ringline & ~np.isin(cls, [LEFT, RIGHT, WING])] = BASE
    markers[(yy > 806) & ~flower & ~red_like & (cls != LETTER)] = BASE
    er = cv2.erode(free.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    n, lab, st, cen = cv2.connectedComponentsWithStats(er, 8)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] < 12:
            continue
        k = int(cls[int(cen[i][1]), int(cen[i][0])])
        markers[lab == i] = BASE if k in (0, LETTER) else k
    ws = cv2.watershed(im, markers)
    wing_poly = poly_mask((h, w), POLY[WING])
    left_poly = poly_mask((h, w), POLY[LEFT])
    stray = (ws == WING) & ~wing_poly
    ws[stray & left_poly] = LEFT
    ws[stray & ~left_poly] = BASE
    ws[(ws == LEFT) & ~left_poly] = BASE
    ws[(yy >= 788) & np.isin(ws, [WING, LEFT, RIGHT])] = BASE
    lightp = ((L > 140) & (S < 140) & poly_mask((h, w), POLY[LETTER]) & ~flower).astype(np.uint8)
    n2, lab2, st2, _ = cv2.connectedComponentsWithStats(lightp, 8)
    letters = []
    for i in range(1, n2):
        if st2[i, cv2.CC_STAT_HEIGHT] > 60 and st2[i, cv2.CC_STAT_AREA] > 400:
            ws[lab2 == i] = LETTER
            letters.append([int(v) for v in st2[i, :4]])
    letters.sort()
    return ws, sil.astype(bool), letters


def main():
    im = cv2.imread(SRC)
    h, w = im.shape[:2]
    ws, sil, letters = segment(im)
    cores = {k: ws == k for k, _ in LAYERS}
    allcore = np.zeros((h, w), bool)
    for m in cores.values():
        allcore |= m
    k4 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    os.makedirs(OUT, exist_ok=True)
    s = SIZE / w
    meta = {'size': SIZE, 'layers': {}, 'letters': [[round(v * s, 1) for v in b] for b in letters]}
    for k, name in LAYERS:
        core = cores[k]
        # 多帶 4 px 的剪紙陰影，但不吃到別層的本體
        m = cv2.dilate(core.astype(np.uint8), k4).astype(bool) & ~(allcore & ~core)
        alpha = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 1.0)
        alpha = np.maximum(alpha, core.astype(np.float32))
        ys, xs = np.where(alpha > 0.01)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        # 對齊到縮圖後的整數像素，避免疊回去時錯開半格
        x0, y0 = int(np.floor(np.floor(x0 * s) / s)), int(np.floor(np.floor(y0 * s) / s))
        rgba = np.dstack([im[y0:y1, x0:x1], (alpha[y0:y1, x0:x1] * 255).astype(np.uint8)])
        ow, oh = max(1, round((x1 - x0) * s)), max(1, round((y1 - y0) * s))
        small = cv2.resize(rgba, (ow, oh), interpolation=cv2.INTER_AREA)
        cv2.imwrite(os.path.join(OUT, name + '.webp'), small, [cv2.IMWRITE_WEBP_QUALITY, 90])
        entry = {'x': round(x0 * s, 2), 'y': round(y0 * s, 2), 'w': ow, 'h': oh}
        if name in ANCHORS:
            entry['anchor'] = [round(v * s, 1) for v in ANCHORS[name]]
        meta['layers'][name] = entry
    # 底圖：沒有翅膀和花草的那張，徽章外的紙底挖成透明
    im2 = cv2.imread(BASE_SRC)
    a = cv2.GaussianBlur(silhouette(im2).astype(np.float32), (0, 0), 1.5)
    rgba = np.dstack([im2, (a * 255).astype(np.uint8)])
    cv2.imwrite(os.path.join(OUT, 'base.webp'), cv2.resize(rgba, (SIZE, SIZE), interpolation=cv2.INTER_AREA), [cv2.IMWRITE_WEBP_QUALITY, 88])
    # 紙底的顏色（網頁背景用）
    bgc = np.median(im[~cv2.dilate(sil.astype(np.uint8), k4).astype(bool)], axis=0)
    meta['paper'] = '#%02x%02x%02x' % (int(bgc[2]), int(bgc[1]), int(bgc[0]))
    with open(os.path.join(OUT, 'logo.json'), 'w', encoding='utf-8') as f:
        json.dump(meta, f, indent=1)
    for name in ['base'] + [n for _, n in LAYERS]:
        print(name, os.path.getsize(os.path.join(OUT, name + '.webp')), 'bytes')
    print('paper', meta['paper'], 'letters', len(letters))


if __name__ == '__main__':
    main()
