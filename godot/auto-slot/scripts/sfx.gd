# 音效：全部在開場時用程式合成（正弦、三角波、雜訊加包絡），不需要音檔
# 用法：Sfx.play("pop", 1.2)；網頁版要等玩家點一下畫面才有聲音，所以開場畫面要求點一下開始
extends Node

const RATE := 22050

var enabled := true
var ready_count := 0
var _players: Array[AudioStreamPlayer] = []
var _streams := {}
var _next := 0
var _rng := RandomNumberGenerator.new()

# 名稱 → 合成函式；開場畫面逐一建立並顯示進度
var recipes := {
	"click": _click, "spin": _spin, "stop": _stop, "tease": _tease, "win": _win, "pop": _pop, "drop": _drop,
	"wild": _wild, "mult": _mult, "throw": _throw, "hit": _hit, "defeat": _defeat, "coin": _coin,
	"big": _big, "bonus": _bonus, "level": _level, "step": _step, "start": _start,
}


func _ready() -> void:
	_rng.seed = 11
	for i in 12:
		var p := AudioStreamPlayer.new()
		add_child(p)
		_players.append(p)


# 開場畫面呼叫：每建好一個就讓出一幀，進度條才會動
func build_all(progress: Callable) -> void:
	var names := recipes.keys()
	for i in names.size():
		var name: String = names[i]
		if not _streams.has(name):
			_streams[name] = _wav(recipes[name].call())
		ready_count = i + 1
		progress.call(float(i + 1) / names.size())
		await get_tree().process_frame


func play(name: String, pitch := 1.0, volume_db := 0.0) -> void:
	if not enabled or not _streams.has(name):
		return
	var p := _players[_next]
	_next = (_next + 1) % _players.size()
	p.stream = _streams[name]
	p.pitch_scale = pitch
	p.volume_db = volume_db
	p.play()


# ---------- 合成工具 ----------

func _buf(seconds: float) -> PackedFloat32Array:
	var b := PackedFloat32Array()
	b.resize(int(seconds * RATE))
	return b


# 一個音：頻率從 f0 滑到 f1；wave = sine / tri / square；attack、release 秒
func _tone(b: PackedFloat32Array, at: float, dur: float, f0: float, f1: float, vol: float, wave := "sine", attack := 0.004, release := 0.06) -> void:
	var start := int(at * RATE)
	var n := int(dur * RATE)
	var phase := 0.0
	for i in n:
		if start + i >= b.size():
			break
		var t := float(i) / RATE
		var f := lerpf(f0, f1, float(i) / n)
		phase += TAU * f / RATE
		var s := 0.0
		match wave:
			"sine":
				s = sin(phase)
			"tri":
				s = 2.0 / PI * asin(sin(phase))
			"square":
				s = clampf(sin(phase) * 3.0, -1.0, 1.0) * 0.6
		var env := minf(1.0, t / attack) * clampf((dur - t) / release, 0.0, 1.0)
		b[start + i] += s * env * vol


# 雜訊：lowpass 0~1 越小越悶；用於呼嘯、碰撞
func _noise(b: PackedFloat32Array, at: float, dur: float, vol: float, lowpass := 0.3, attack := 0.01, release := 0.1) -> void:
	var start := int(at * RATE)
	var n := int(dur * RATE)
	var y := 0.0
	for i in n:
		if start + i >= b.size():
			break
		var t := float(i) / RATE
		y += (_rng.randf_range(-1.0, 1.0) - y) * lowpass
		var env := minf(1.0, t / attack) * clampf((dur - t) / release, 0.0, 1.0)
		b[start + i] += y * env * vol


func _wav(b: PackedFloat32Array) -> AudioStreamWAV:
	var data := PackedByteArray()
	data.resize(b.size() * 2)
	for i in b.size():
		data.encode_s16(i * 2, int(clampf(b[i], -1.0, 1.0) * 32000.0))
	var s := AudioStreamWAV.new()
	s.format = AudioStreamWAV.FORMAT_16_BITS
	s.mix_rate = RATE
	s.stereo = false
	s.data = data
	return s


# ---------- 各音效 ----------

func _click() -> PackedFloat32Array:
	var b := _buf(0.06)
	_tone(b, 0, 0.05, 1400, 900, 0.35, "tri", 0.001, 0.04)
	return b


func _start() -> PackedFloat32Array:
	var b := _buf(0.7)
	for k in 4:
		_tone(b, k * 0.09, 0.3, [523.0, 659.0, 784.0, 1047.0][k], [523.0, 659.0, 784.0, 1047.0][k], 0.22, "tri", 0.005, 0.2)
	return b


func _spin() -> PackedFloat32Array:
	var b := _buf(0.45)
	_noise(b, 0, 0.45, 0.35, 0.18, 0.08, 0.25)
	_tone(b, 0, 0.35, 220, 520, 0.12, "tri", 0.02, 0.2)
	return b


func _stop() -> PackedFloat32Array:
	var b := _buf(0.18)
	_tone(b, 0, 0.16, 140, 60, 0.6, "sine", 0.002, 0.12)
	_noise(b, 0, 0.05, 0.35, 0.5, 0.001, 0.04)
	return b


func _tease() -> PackedFloat32Array:
	var b := _buf(1.0)
	for k in 10:
		_tone(b, k * 0.09, 0.12, 600 + k * 70, 640 + k * 70, 0.18, "tri", 0.005, 0.06)
	return b


func _win() -> PackedFloat32Array:
	var b := _buf(0.6)
	var notes := [523.0, 659.0, 784.0, 1047.0]
	for k in notes.size():
		_tone(b, k * 0.07, 0.32, notes[k], notes[k], 0.2, "tri", 0.004, 0.22)
	return b


func _pop() -> PackedFloat32Array:
	var b := _buf(0.16)
	_tone(b, 0, 0.12, 900, 260, 0.45, "sine", 0.001, 0.08)
	_noise(b, 0, 0.06, 0.25, 0.6, 0.001, 0.05)
	return b


func _drop() -> PackedFloat32Array:
	var b := _buf(0.1)
	_tone(b, 0, 0.08, 260, 140, 0.4, "sine", 0.001, 0.06)
	return b


func _wild() -> PackedFloat32Array:
	var b := _buf(0.6)
	for k in 6:
		_tone(b, k * 0.05, 0.25, 1200 + k * 180, 1300 + k * 180, 0.12, "sine", 0.002, 0.18)
	return b


func _mult() -> PackedFloat32Array:
	var b := _buf(0.6)
	_tone(b, 0, 0.18, 300, 900, 0.35, "square", 0.002, 0.1)
	_tone(b, 0.12, 0.45, 1320, 1320, 0.25, "tri", 0.002, 0.35)
	_noise(b, 0, 0.08, 0.4, 0.5, 0.001, 0.06)
	return b


func _step() -> PackedFloat32Array:
	var b := _buf(0.12)
	_noise(b, 0, 0.09, 0.22, 0.25, 0.005, 0.06)
	_tone(b, 0, 0.06, 180, 120, 0.2, "sine", 0.002, 0.05)
	return b


func _throw() -> PackedFloat32Array:
	var b := _buf(0.25)
	_noise(b, 0, 0.22, 0.4, 0.35, 0.04, 0.15)
	return b


func _hit() -> PackedFloat32Array:
	var b := _buf(0.3)
	_tone(b, 0, 0.22, 180, 60, 0.7, "sine", 0.001, 0.15)
	_noise(b, 0, 0.12, 0.6, 0.55, 0.001, 0.1)
	return b


func _defeat() -> PackedFloat32Array:
	var b := _buf(0.9)
	for k in 5:
		_tone(b, k * 0.11, 0.2, 700 - k * 90, 600 - k * 90, 0.2, "square", 0.003, 0.12)
	for k in 6:
		_noise(b, 0.15 + k * 0.08, 0.05, 0.3, 0.7, 0.001, 0.04)
	return b


func _coin() -> PackedFloat32Array:
	var b := _buf(0.12)
	_tone(b, 0, 0.1, 1980, 1980, 0.18, "sine", 0.001, 0.08)
	_tone(b, 0.03, 0.08, 2640, 2640, 0.12, "sine", 0.001, 0.06)
	return b


func _big() -> PackedFloat32Array:
	var b := _buf(1.8)
	var melody := [523.0, 659.0, 784.0, 659.0, 784.0, 1047.0]
	for k in melody.size():
		_tone(b, k * 0.14, 0.35, melody[k], melody[k], 0.22, "square", 0.004, 0.25)
		_tone(b, k * 0.14, 0.35, melody[k] / 2.0, melody[k] / 2.0, 0.18, "tri", 0.004, 0.25)
	_tone(b, 0.85, 0.9, 1047, 1047, 0.2, "tri", 0.01, 0.7)
	_tone(b, 0.85, 0.9, 784, 784, 0.16, "tri", 0.01, 0.7)
	return b


func _bonus() -> PackedFloat32Array:
	var b := _buf(1.4)
	for k in 12:
		_tone(b, k * 0.07, 0.4, 392 * pow(2.0, k / 12.0 * 2.0), 392 * pow(2.0, k / 12.0 * 2.0), 0.14, "tri", 0.004, 0.3)
	return b


func _level() -> PackedFloat32Array:
	var b := _buf(1.0)
	var notes := [784.0, 988.0, 1175.0, 1568.0]
	for k in notes.size():
		_tone(b, k * 0.1, 0.5, notes[k], notes[k], 0.2, "tri", 0.004, 0.4)
	return b
