# HG-Fable01 -小紅帽 背景音樂：python scripts/auto-slot-music.py（需要 numpy 與 ffmpeg：PATH 上的、環境變數 FFMPEG，或 pip install imageio-ffmpeg）
# 原曲是 Suno 生成的三首（assets-src/auto-slot/music/*.mp3），這裡做成 Godot 用的檔案 → godot/auto-slot/music/
# - base.wav：主遊戲迴圈（Box of Shadows）。拍子是八分音符 184.17 BPM（四分 92.085），從 19.764 秒起剛好 204 個八分音符（66.46 秒）
#   跟後面那段最像（逐格比對和聲與頻譜，找出最像的頭尾），切成一段無縫迴圈
# - free.wav：Free Spins 迴圈（Cyclical Dark Fairytale）。八分 188.05 BPM，從 18.888 秒起 160 個八分音符（51.05 秒）
# - drums.wav：打狼時疊上去的戰鬥鼓（自己合成，不是 Suno）。長度跟 base 迴圈完全一樣、拍點對齊，
#   Godot 用 AudioStreamSynchronized 跟 base 同步播放，平常音量壓到最低，有狼、連擊時才推上來。
#   原曲低頻的重音每 12 個八分音符一循環（第 0、4、10 個最重），鼓就照這個型打：大太鼓、中太鼓、小鼓，每 4 小段加一次滾奏
# - bigwin.mp3：BIG WIN 曲（Triumphant Dark Fairytale）開頭 24 秒（第一拍就是重擊），最後 2 秒淡出；只播一次，不循環
# 迴圈的接縫：結尾最後一小節（8 個八分音符，約 2.6 秒）跟「開頭前面那一小節」等功率交叉淡入，繞回開頭時就是原曲本來的接續
# （頭尾兩段只是很像、旋律細節對不上，原本只淡入一個八分音符時聽得出斷層；三種接法試聽後選了拉長到一小節）；
# 再整段當成週期訊號用 FFT 重新取樣成 32 kHz（不會在接縫產生濾波邊緣），音量統一到 RMS -20 dBFS（BIG WIN -18）。
# wav 匯入 Godot 時壓成 QOA、設成向前循環（迴圈點精準到樣本；MP3、Ogg 只能設循環起點）
import os
import shutil
import subprocess
import sys
import wave

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets-src', 'auto-slot', 'music')
OUT = os.path.join(ROOT, 'godot', 'auto-slot', 'music')
SR_IN = 44100
SR = 32000

# 名稱 → (原檔, 迴圈起點秒數, 八分音符長度（44.1 kHz 樣本數）, 迴圈長度（八分音符個數）)
LOOPS = {
    'base': ('base.mp3', 19.7638, 14367.16, 204),
    'free': ('free.mp3', 18.8876, 14070.73, 160),
}
# 戰鬥鼓：12 個八分音符一小段；(位置（八分音符，可以有 .5）, 鼓, 力度)
FIGURE = [(0, 'boom', 1.0), (4, 'boom', 0.85), (10, 'boom', 0.9), (8, 'taiko', 0.7), (11, 'taiko', 0.6),
          (2, 'rim', 0.35), (3, 'rim', 0.3), (6, 'rim', 0.35), (7, 'rim', 0.3), (9, 'rim', 0.3)]
FIGURE_LEN = 12
# 迴圈接縫交叉淡入的長度（八分音符個數，8 = 一小節）
CROSSFADE = 8
# 找拍點的分析窗（46 ms）會讓量到的拍點比實際早半個窗左右；用同樣方法比對鼓與原曲的起音，鼓要晚 34 ms 才對齊
DRUM_DELAY = 0.034


def ffmpeg():
    for p in (os.environ.get('FFMPEG'), shutil.which('ffmpeg'), r'C:\Program Files\Live2D Cubism 5.3\tools\ffmpeg\ffmpeg.exe'):
        if p and os.path.exists(p):
            return p
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        sys.exit('找不到 ffmpeg：請設環境變數 FFMPEG，或 pip install imageio-ffmpeg')


def decode(name):
    raw = subprocess.run([ffmpeg(), '-hide_banner', '-loglevel', 'error', '-i', os.path.join(SRC, name), '-map', '0:a',
                          '-f', 'f32le', '-acodec', 'pcm_f32le', '-ac', '2', '-ar', str(SR_IN), '-'],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).astype(np.float64)


def write_wav(path, x, sr):
    x = np.clip(x, -1.0, 1.0)
    pcm = np.round(x * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(1 if x.ndim == 1 else x.shape[1])
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())


def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)


# 超過 0.8 的部分用 tanh 柔和壓住，不會硬削波
def soft_limit(x, knee=0.8):
    a = np.abs(x)
    over = a > knee
    y = x.copy()
    y[over] = np.sign(x[over]) * (knee + (1 - knee) * np.tanh((a[over] - knee) / (1 - knee)))
    return y


def normalize(x, target_db):
    return soft_limit(x * 10 ** ((target_db - rms_db(x)) / 20))


# 週期訊號重新取樣：整段做 FFT、只留新長度的頻段再轉回來，頭尾當成接在一起
def resample_loop(x, n_out):
    spec = np.fft.rfft(x, axis=0)
    keep = n_out // 2 + 1
    if keep > spec.shape[0]:
        pad = np.zeros((keep - spec.shape[0],) + spec.shape[1:], spec.dtype)
        spec = np.concatenate([spec, pad])
    return np.fft.irfft(spec[:keep], n=n_out, axis=0) * (n_out / x.shape[0])


def make_loop(name, src, start, eighth, count):
    x = decode(src)
    s = int(round(start * SR_IN))
    n = int(round(eighth * count))
    xf = int(round(eighth * CROSSFADE))
    seg = x[s:s + n].copy()
    t = np.linspace(0.0, 1.0, xf)[:, None]
    seg[n - xf:] = seg[n - xf:] * np.cos(t * np.pi / 2) + x[s - xf:s] * np.sin(t * np.pi / 2)
    n_out = int(round(n * SR / SR_IN))
    y = normalize(resample_loop(seg, n_out), -20.0)
    write_wav(os.path.join(OUT, name + '.wav'), y, SR)
    print(f'{name}: {n_out / SR:.3f}s ({n_out} samples @ {SR}), rms {rms_db(y):.1f} dB, peak {np.abs(y).max():.2f}')
    return n_out


# ---------- 戰鬥鼓 ----------

def lowpass(x, a):
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += a * (x[i] - acc)
        y[i] = acc
    return y


# 一下鼓聲：音高從 f_hi 很快滑到 f_lo 的正弦（加一個高一點、衰減更快的泛音）＋一小段低通雜訊當鼓皮的拍擊聲
def drum(rng, dur, f_hi, f_lo, bend, decay, noise, noise_lp, noise_decay, sat=1.4):
    t = np.arange(int(dur * SR)) / SR
    f = f_lo + (f_hi - f_lo) * np.exp(-t * bend)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * decay) + 0.35 * np.sin(ph * 1.58) * np.exp(-t * decay * 2.2)
    hit = lowpass(rng.standard_normal(len(t)), noise_lp) * np.exp(-t * noise_decay) * noise / noise_lp ** 0.5 * 0.12
    out = (body + hit) * np.minimum(1.0, t / 0.002)
    return np.tanh(out * sat) / np.tanh(sat)


def kit(rng):
    k = {}
    for v in range(3):
        p = 1.0 + (v - 1) * 0.025
        k[('boom', v)] = drum(rng, 1.3, 125 * p, 52 * p, 22, 4.2, 0.45, 0.08, 32)
        k[('taiko', v)] = drum(rng, 0.7, 180 * p, 96 * p, 30, 8.0, 0.5, 0.15, 45)
        k[('rim', v)] = drum(rng, 0.22, 560 * p, 400 * p, 60, 26, 0.8, 0.5, 70, sat=1.1) * 0.7
    return k


# 梳狀濾波、全通濾波：一次算一整段延遲長度（每段只依賴前一段），比逐樣本快很多
def comb(x, d, g):
    y = x.copy()
    for i in range(d, len(x), d):
        e = min(len(x), i + d)
        y[i:e] += g * y[i - d:e - d]
    return y


def allpass(x, d, g):
    y = np.empty_like(x)
    y[:d] = -g * x[:d]
    for i in range(d, len(x), d):
        e = min(len(x), i + d)
        y[i:e] = -g * x[i:e] + x[i - d:e - d] + g * y[i - d:e - d]
    return y


def reverb(x):
    wet = sum(comb(x, int(SR * ms / 1000), 0.8) for ms in (29.7, 37.1, 41.1, 43.7)) / 4
    for ms in (5.0, 1.7):
        wet = allpass(wet, int(SR * ms / 1000), 0.7)
    return wet


def make_drums(n_out, count):
    rng = np.random.default_rng(7)
    k = kit(rng)
    eighth = n_out / count
    figures = count // FIGURE_LEN
    buf = np.zeros(n_out * 2)
    for f in range(figures):
        fill = f % 4 == 3 or f == figures - 1
        hits = [h for h in FIGURE if not (fill and h[0] >= 8 and h[1] != 'boom')]
        if fill:
            # 滾奏：最後 4 個八分音符改成十六分音符的中太鼓，越打越大聲
            hits += [(8 + i * 0.5, 'taiko', 0.45 + 0.55 * i / 7) for i in range(8)]
        for pos, name, vel in hits:
            if f % 4 == 0 and pos == 0:
                vel = 1.1
            at = int(round((f * FIGURE_LEN + pos) * eighth + SR * DRUM_DELAY + rng.normal(0, SR * 0.002)))
            s = k[(name, int(rng.integers(3)))] * vel * rng.uniform(0.92, 1.08)
            # 畫兩圈，之後取第二圈：結尾的餘音會繞回開頭
            for base in (0, n_out):
                a = (base + at) % (2 * n_out)
                e = min(2 * n_out, a + len(s))
                buf[a:e] += s[:e - a]
    mix = buf + 0.22 * reverb(buf)
    y = mix[n_out:2 * n_out]
    y = y / np.abs(y).max() * 0.9
    write_wav(os.path.join(OUT, 'drums.wav'), y, SR)
    print(f'drums: {n_out / SR:.3f}s ({n_out} samples, mono), {figures} figures, rms {rms_db(y):.1f} dB')


def make_bigwin():
    x = decode('bigwin.mp3')[:int(24 * SR_IN)]
    n = len(x)
    fade = int(2 * SR_IN)
    x[:int(0.005 * SR_IN)] *= np.linspace(0, 1, int(0.005 * SR_IN))[:, None]
    x[n - fade:] *= np.cos(np.linspace(0, np.pi / 2, fade))[:, None]
    y = normalize(x, -18.0)
    pcm = np.round(np.clip(y, -1, 1) * 32767).astype('<i2').tobytes()
    subprocess.run([ffmpeg(), '-hide_banner', '-loglevel', 'error', '-y', '-f', 's16le', '-ar', str(SR_IN), '-ac', '2', '-i', '-',
                    '-codec:a', 'libmp3lame', '-b:a', '160k', os.path.join(OUT, 'bigwin.mp3')], input=pcm, check=True)
    print(f'bigwin: {n / SR_IN:.2f}s, rms {rms_db(y):.1f} dB')


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    n_base = make_loop('base', *LOOPS['base'])
    make_loop('free', *LOOPS['free'])
    make_drums(n_base, LOOPS['base'][3])
    make_bigwin()
