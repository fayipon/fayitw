"""P(doom) MV：照剪接表（assets/<專案>/edl.json）把 Seedance 片段剪成一支跟原曲等長的影片

python scripts/pdoom-edit.py <原曲 mp3> [--name 專案] [--until 秒數]
- 專案預設 pdoom；精神版是 --name pdoom-jingshen
- 片段：assets-src/<專案>/clips/<名稱>.mp4（scripts/<專案>-leonardo.mjs 生成）
- 每個鏡頭：從片段的 in 秒開始，用 rate 倍速播（< 1 是慢動作，用動態補幀補出中間格），rev 是倒放
- 切點換算成第幾格（24 fps）再算長度，所以整支不會因為四捨五入慢慢偏掉
- 輸出 assets/<專案>/<專案>.mp4（H.264 + AAC，faststart，每 2 秒一個關鍵格方便跳轉；先輕微降噪，顆粒由網頁加回去）
需要 imageio-ffmpeg（pip install imageio-ffmpeg）或 PATH 上的 ffmpeg
"""
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NAME = sys.argv[sys.argv.index('--name') + 1] if '--name' in sys.argv else 'pdoom'
CLIPS = os.path.join(ROOT, 'assets-src', NAME, 'clips')
EDL = os.path.join(ROOT, 'assets', NAME, 'edl.json')
OUT = os.path.join(ROOT, 'assets', NAME, NAME + '.mp4')


def ffmpeg_bin():
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return shutil.which('ffmpeg') or sys.exit('找不到 ffmpeg')


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    song = sys.argv[1]
    ff = ffmpeg_bin()
    edl = json.load(open(EDL, encoding='utf-8'))
    # --until 秒數：只剪前面一段（預覽用）
    if '--until' in sys.argv:
        edl['end'] = float(sys.argv[sys.argv.index('--until') + 1])
    fps, w, h = edl['fps'], edl['w'], edl['h']
    shots = edl['shots']
    # 切點可以寫秒數（t）或第幾拍（b）
    for s in shots:
        if 't' not in s:
            s['t'] = edl['off'] + s['b'] * 60 / edl['bpm']
    end_f = round(edl['end'] * fps)
    tmp = tempfile.mkdtemp(prefix='pdoom-')
    parts = []
    shots = [s for s in shots if s['t'] < edl['end']]
    for i, s in enumerate(shots):
        f0 = round(s['t'] * fps)
        f1 = round(shots[i + 1]['t'] * fps) if i + 1 < len(shots) else end_f
        n = f1 - f0
        if n <= 0:
            continue
        rate = s.get('rate', 1.0)
        span = n / fps * rate
        src = os.path.join(CLIPS, s['clip'] + '.mp4')
        # 倒放：把 [in, in + span] 這段反過來播（不多留尾巴，不然開頭會多出幾格）
        vf = [f"trim=start={s.get('in', 0):.4f}:duration={span + (0 if s.get('rev') else 0.2):.4f}", 'setpts=PTS-STARTPTS']
        if s.get('rev'):
            vf.append('reverse')
        if rate < 0.8:
            # 慢動作：先用動態補幀補到 fps / rate，再拉長時間
            vf.append(f"minterpolate=fps={fps / rate:.3f}:mi_mode=mci:mc_mode=aobmc:vsbmc=1")
        vf += [f'setpts=PTS/{rate:.5f}', f'fps={fps}', f'scale={w}:{h}:flags=lanczos,setsar=1',
               'tpad=stop_mode=clone:stop_duration=2']
        part = os.path.join(tmp, f'{i:03d}.mkv')
        subprocess.run([ff, '-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-vf', ','.join(vf),
                        '-frames:v', str(n), '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '10',
                        '-pix_fmt', 'yuv420p', part], check=True)
        parts.append(part)
        print(f"{i:2d} {s['t']:7.2f}s  {s['clip']:16s} in {s.get('in', 0):4.2f}  x{rate:<4}  {n:3d} 格")
    lst = os.path.join(tmp, 'list.txt')
    with open(lst, 'w', encoding='utf-8') as f:
        f.writelines(f"file '{p}'\n" for p in parts)
    subprocess.run([ff, '-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst, '-i', song,
                    # 輕微降噪再壓：顆粒由 pdoom.js 即時加回去，壓縮率高很多
                    '-map', '0:v', '-map', '1:a', '-vf', 'hqdn3d=2:1.5:6:6',
                    '-c:v', 'libx264', '-preset', 'slow', '-crf', str(edl.get('crf', 23)),
                    '-pix_fmt', 'yuv420p', '-g', str(fps * 2), '-c:a', 'aac', '-b:a', '160k', '-t', f"{edl['end']:.3f}",
                    '-movflags', '+faststart', OUT], check=True)
    shutil.rmtree(tmp, ignore_errors=True)
    # 影片網址帶內容雜湊（/assets/ 快取一天，換片後才不會拿到舊影片）；頁面的程式從 edl.json 讀這個網址
    with open(OUT, 'rb') as f:
        ver = hashlib.sha256(f.read()).hexdigest()[:12]
    txt = open(EDL, encoding='utf-8').read()
    txt = re.sub(r'"video": "[^"]*"', f'"video": "{NAME}.mp4?v={ver}"', txt, count=1)
    open(EDL, 'w', encoding='utf-8', newline='\n').write(txt)
    print('→', os.path.relpath(OUT, ROOT), f'{os.path.getsize(OUT) / 1e6:.1f} MB', 'v=' + ver)


if __name__ == '__main__':
    main()
