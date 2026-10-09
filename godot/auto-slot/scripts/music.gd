# 背景音樂（三首是 Suno 生成的，scripts/auto-slot-music.py 切成無縫迴圈；戰鬥鼓是自己合成的）：
# - 主遊戲：base 迴圈底下同步疊一軌戰鬥鼓（AudioStreamSynchronized：兩軌長度相同、拍點對齊）。平常鼓聲關著，
#   狼出現時淡入一點（狼王更大聲），每打中一下依連擊段數推高，停手後慢慢退回去
# - Free Spins：換成 free 迴圈；主遊戲那首暫停在原位，回來時接著播
# - BIG WIN：目前的音樂淡出、從頭播 BIG WIN 曲，演完淡出再回到該播的那首
# 全部走 Music 匯流排；選單的 Music 開關把整條匯流排靜音（音效另外一個開關）
extends Node

const VOLUME_DB := -6.0      # 整條音樂匯流排：墊在音效底下
const DRUMS_MAX_DB := -3.0   # 戰鬥鼓推到最大時的音量（鼓的檔案比音樂大聲一點）
const SILENT := -60.0
const FADE := 0.9

var enabled := true:
	set(v):
		enabled = v
		if _bus >= 0:
			AudioServer.set_bus_mute(_bus, not v)

var _bus := -1
var _players := {}            # base / free / bigwin → AudioStreamPlayer
var _fades := {}
var _base: AudioStreamSynchronized
var _mode := ""               # 現在該播哪首：base 或 free
var _fanfare := false
var _wolf := 0.0              # 狼在場時鼓的基本音量（0～1）
var _boost := 0.0             # 連擊推上去的音量
var _hold := 0.0
var _drums := 0.0             # 鼓目前的音量（平滑過，推上去快、退下來慢）
var _drums_db := SILENT


func _ready() -> void:
	_bus = AudioServer.bus_count
	AudioServer.add_bus(_bus)
	AudioServer.set_bus_name(_bus, "Music")
	AudioServer.set_bus_send(_bus, "Master")
	AudioServer.set_bus_volume_db(_bus, VOLUME_DB)
	AudioServer.set_bus_mute(_bus, not enabled)
	_base = AudioStreamSynchronized.new()
	_base.stream_count = 2
	_base.set_sync_stream(0, preload("res://music/base.wav"))
	_base.set_sync_stream(1, preload("res://music/drums.wav"))
	_base.set_sync_stream_volume(1, SILENT)
	_players.base = _player(_base)
	_players.free = _player(preload("res://music/free.wav"))
	_players.bigwin = _player(preload("res://music/bigwin.mp3"))


func _player(stream: AudioStream) -> AudioStreamPlayer:
	var p := AudioStreamPlayer.new()
	p.stream = stream
	p.bus = "Music"
	p.volume_db = SILENT
	add_child(p)
	return p


# 換到主遊戲（base）或 Free Spins（free）的音樂；BIG WIN 演出中只先記下來，演完再換
func mode(m: String) -> void:
	if m == _mode:
		return
	var old := _mode
	_mode = m
	if _fanfare:
		return
	if old != "":
		_fade_out(old)
	_fade_in(m)


func fanfare_start() -> void:
	_fanfare = true
	if _mode != "":
		_fade_out(_mode, 0.4)
	var p: AudioStreamPlayer = _players.bigwin
	_fade(p, 0.0, 0.05)
	p.play()


func fanfare_end() -> void:
	if not _fanfare:
		return
	_fanfare = false
	_fade_out("bigwin", 1.2)
	if _mode != "":
		_fade_in(_mode)


# 狼出現（狼王 boss = true）／打倒時呼叫：鼓聲的基本音量
func wolf(on: bool, boss := false) -> void:
	_wolf = (0.85 if boss else 0.55) if on else 0.0


# 打中一下：連擊段數越多鼓越大聲，停手 2 秒後慢慢退回去
func hit(combo: int) -> void:
	_boost = maxf(_boost, clampf(0.65 + 0.08 * combo, 0.0, 1.0))
	_hold = 2.0


func _process(delta: float) -> void:
	if _hold > 0.0:
		_hold -= delta
	else:
		_boost = move_toward(_boost, 0.0, delta * 0.2)
	var target := maxf(_wolf, _boost)
	_drums = move_toward(_drums, target, delta * (2.5 if target > _drums else 0.3))
	var db := DRUMS_MAX_DB + linear_to_db(_drums) if _drums > 0.001 else SILENT
	if absf(db - _drums_db) > 0.05:
		_drums_db = db
		_base.set_sync_stream_volume(1, db)


func _fade_in(name: String, dur := FADE) -> void:
	var p: AudioStreamPlayer = _players[name]
	if p.stream_paused:
		p.stream_paused = false
	elif not p.playing:
		p.play()
	_fade(p, 0.0, dur)


# 主遊戲那首淡出後暫停（回來接著播），其他的停掉（下次從頭）
func _fade_out(name: String, dur := FADE) -> void:
	var p: AudioStreamPlayer = _players[name]
	_fade(p, SILENT, dur).tween_callback(func():
		if name == "base":
			p.stream_paused = true
		else:
			p.stop())


# 音量用線性振幅補間（用 dB 直線補間的話前段幾乎聽不到）
func _fade(p: AudioStreamPlayer, to_db: float, dur: float) -> Tween:
	if _fades.has(p) and _fades[p].is_valid():
		_fades[p].kill()
	var tw := create_tween()
	tw.tween_method(func(v: float): p.volume_db = linear_to_db(maxf(v, 0.001)), db_to_linear(p.volume_db), db_to_linear(to_db), dur)
	_fades[p] = tw
	return tw


# 關遊戲時停掉、放開同步串流裡的兩軌（不然音訊伺服器還抓著，結束時會報資源還在用）
func _exit_tree() -> void:
	for p in _players.values():
		p.stop()
		p.stream = null
	_base.set_sync_stream(0, null)
	_base.set_sync_stream(1, null)
