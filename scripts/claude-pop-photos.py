# 把 Leonardo 的輸出轉成網頁用的 WebP：python scripts/claude-pop-photos.py assets-src/claude-pop assets/claude-pop
# - 劇照：維持原尺寸（1376×768），q=80
# - 全畫面去背（-cut，要跟原照片疊在同一位置）：維持原尺寸，有透明
# - 貼圖去背（walk / 伴舞）：裁到人物外框，記錄在 photos.json 的 box
import json, os, sys
from PIL import Image

src = sys.argv[1]
dst = sys.argv[2]
os.makedirs(dst, exist_ok=True)
index = json.load(open(os.path.join(src, 'index.json'), encoding='utf-8'))
SPRITES = {'walk-cut', 'dancer-blue', 'dancer-pink', 'idol-test'}
meta = {}
total = 0
for name, it in sorted(index.items()):
    f = os.path.join(src, it['file'])
    if os.path.exists(f):
        im = Image.open(f).convert('RGB')
        out = os.path.join(dst, f'{name}.webp')
        im.save(out, 'WEBP', quality=80, method=6)
        meta[name] = {'w': im.width, 'h': im.height}
        total += os.path.getsize(out)
    cut = it.get('cut')
    if cut and os.path.exists(os.path.join(src, cut)):
        im = Image.open(os.path.join(src, cut)).convert('RGBA')
        box = im.getbbox()
        if name in SPRITES and box:
            pad = 4
            box = (max(0, box[0] - pad), max(0, box[1] - pad), min(im.width, box[2] + pad), min(im.height, box[3] + pad))
            im2 = im.crop(box)
        else:
            im2 = im
            box = (0, 0, im.width, im.height)
        out = os.path.join(dst, f'{name}-cut.webp')
        im2.save(out, 'WEBP', quality=82, method=6)
        bb = im.getbbox() or (0, 0, im.width, im.height)
        meta.setdefault(name, {})['cut'] = {'box': list(box), 'w': im2.width, 'h': im2.height, 'full': [im.width, im.height], 'bbox': list(bb)}
        total += os.path.getsize(out)
json.dump(meta, open(os.path.join(dst, 'photos.json'), 'w', encoding='utf-8'), indent=1)
print('files', len(meta), 'total KB', total // 1024)
