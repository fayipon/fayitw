# 敵人登場的橫幅（格鬥遊戲式的「挑戰者出現」）：一條斜邊的深色帶子從右邊橫掃進來，上下鑲金線、帶子裡有往左飛的速度線，
# 左邊是敵人的菱形頭像；名字從很大砸下來、落定那一下畫面震、閃一下白，副標接著淡入；停一下再整條往左掃出去。
# 假扮外婆的大灰狼（boss）帶子是深紅色、名字金色、閃紅光、震得更兇；露餡時用快版（fast）：打中的那一刻橫幅直接拍進來、
# 名字同時砸下，閃光與震動只在這一下，停一下就收，跟打擊同一拍
extends Control

signal shake(amount: float)

const Art := preload("res://scripts/art.gd")

var _band := 0.0           # 0 → 1 掃進來，1 → 2 掃出去
var _flash := 0.0
var _boss := false
var _portrait: Array = []
var _t := 0.0
var _name: Label
var _sub: Label
var _tw: Tween


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	visible = false
	_name = Art.label("", Art.label_settings(40, Art.CREAM, "num", 10, Art.INK, 4))
	_sub = Art.label("", Art.label_settings(15, Art.CREAM, "light", 6, Art.INK))
	add_child(_name)
	add_child(_sub)
	resized.connect(_place)


func _band_rect() -> Rect2:
	var h := clampf(size.y * 0.26, 58.0, 84.0)
	return Rect2(0, size.y * 0.42 - h / 2.0, size.x, h)


func _place() -> void:
	var r := _band_rect()
	var left := r.size.y * 1.1 if not _portrait.is_empty() else 0.0
	_name.position = Vector2(left, r.position.y)
	_name.size = Vector2(size.x - left, r.size.y)
	_name.pivot_offset = _name.size / 2.0
	_sub.position = Vector2(left, r.end.y + 2.0)
	_sub.size = Vector2(size.x - left, 24)


# 演一次：title 是大字（敵人名字）、sub 是副標、portrait 是 field.portrait() 給的 [圖, 臉中心 uv, 半徑 uv]、fast 是快版
func play(title: String, sub: String, portrait: Array, boss: bool, fast := false) -> void:
	if _tw:
		_tw.kill()
	_boss = boss
	_portrait = portrait
	visible = true
	_place()
	var room := _name.size.x - 24.0
	var fs := 42 if boss else 38
	while fs > 18 and Art.font().get_string_size(title, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x > room:
		fs -= 1
	_name.label_settings = Art.label_settings(fs, Art.GOLD_LIGHT if boss else Art.CREAM, "num", 12, Color("4a0306") if boss else Art.INK, 5)
	_name.text = title
	_sub.text = sub
	_name.modulate.a = 0.0
	_sub.modulate.a = 0.0
	_name.scale = Vector2(1.7 if fast else 2.4, 1.7 if fast else 2.4)
	_band = 0.0
	_tw = create_tween()
	if fast:
		# 快版：橫幅一拍就到、名字同時砸下，閃光與震動跟打擊同一拍
		_tw.tween_property(self, "_band", 1.0, 0.07).set_ease(Tween.EASE_OUT)
		_tw.parallel().tween_property(_name, "modulate:a", 1.0, 0.05)
		_tw.parallel().tween_property(_name, "scale", Vector2.ONE, 0.09).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	else:
		_tw.tween_property(self, "_band", 1.0, 0.18).set_trans(Tween.TRANS_QUART).set_ease(Tween.EASE_OUT)
		# 名字從很大砸下來
		_tw.tween_property(_name, "modulate:a", 1.0, 0.06)
		_tw.parallel().tween_property(_name, "scale", Vector2.ONE, 0.14).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	_tw.tween_callback(func():
		_flash = 1.0
		shake.emit(9.0 if boss else 5.0)
		Sfx.play("hit", 0.7 if boss else 0.85, -3.0))
	_tw.tween_property(_name, "scale", Vector2(1.08, 1.08), 0.05)
	_tw.tween_property(_name, "scale", Vector2.ONE, 0.12).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_tw.parallel().tween_property(_sub, "modulate:a", 1.0, 0.15)
	_tw.tween_interval(0.75 if fast else (1.1 if boss else 0.9))
	# 整條往左掃出去
	_tw.tween_property(self, "_band", 2.0, 0.16 if fast else 0.22).set_trans(Tween.TRANS_QUART).set_ease(Tween.EASE_IN)
	_tw.parallel().tween_property(_name, "modulate:a", 0.0, 0.18)
	_tw.parallel().tween_property(_sub, "modulate:a", 0.0, 0.18)
	_tw.tween_callback(func(): visible = false)
	await _tw.finished


func _process(delta: float) -> void:
	if not visible:
		return
	_t += delta
	_flash = maxf(0.0, _flash - delta * 3.5)
	# 名字和副標跟著帶子一起滑
	var dx := _slide()
	var r := _band_rect()
	var left := r.size.y * 1.1 if not _portrait.is_empty() else 0.0
	_name.position.x = left + dx
	_sub.position.x = left + dx
	queue_redraw()


# 帶子目前往右（進場前）或往左（出場）偏多少
func _slide() -> float:
	if _band < 1.0:
		return size.x * (1.0 - _band)
	return -size.x * (_band - 1.0)


func _draw() -> void:
	var r := _band_rect()
	var dx := _slide()
	var skew := r.size.y * 0.35
	# 閃光：落定那一下整片亮一下（boss 是紅光）
	if _flash > 0.0:
		draw_rect(Rect2(Vector2.ZERO, size), Color(1.0, 0.3, 0.2, 0.3 * _flash) if _boss else Color(1, 1, 1, 0.28 * _flash))
	var x0 := dx - skew - 10.0
	var x1 := dx + size.x + skew + 10.0
	var top := r.position.y
	var bot := r.end.y
	var fill := Color(0.36, 0.03, 0.06, 0.9) if _boss else Color(0.12, 0.06, 0.03, 0.86)
	var poly := PackedVector2Array([Vector2(x0 + skew, top), Vector2(x1 + skew, top), Vector2(x1, bot), Vector2(x0, bot)])
	draw_colored_polygon(poly, fill)
	# 帶子裡往左飛的速度線
	for i in 9:
		var y := lerpf(top + 6.0, bot - 6.0, fposmod(i * 0.381, 1.0))
		var ln := 50.0 + 70.0 * fposmod(i * 0.618, 1.0)
		var x := fposmod(-_t * (700.0 + i * 60.0) + i * 173.0, size.x + 240.0) - 120.0 + dx
		draw_line(Vector2(x, y), Vector2(x + ln, y), Color(1, 0.9, 0.7, 0.16), 2.0, true)
	# 上下的金線（往兩端淡掉）
	var gold := Color(Art.GOLD, 0.95)
	for edge in [[top, Vector2(skew, 0)], [bot, Vector2.ZERO]]:
		var yy: float = edge[0]
		var off: Vector2 = edge[1]
		draw_line(Vector2(x0, yy) + off, Vector2(x1, yy) + off, gold, 2.5, true)
	# 頭像：帶子左邊一顆菱形
	if not _portrait.is_empty():
		_draw_portrait(Vector2(dx + r.size.y * 0.62, r.get_center().y), r.size.y * 0.62)


func _draw_portrait(c: Vector2, rad: float) -> void:
	var tex: Texture2D = _portrait[0]
	var cu: Vector2 = _portrait[1]
	var ru: Vector2 = _portrait[2]
	var dirs := [Vector2(0, -1), Vector2(1, 0), Vector2(0, 1), Vector2(-1, 0)]
	var outer := PackedVector2Array()
	var inner := PackedVector2Array()
	var uvs := PackedVector2Array()
	for d in dirs:
		outer.append(c + d * rad)
		inner.append(c + d * rad * 0.84)
		uvs.append(cu + d * ru)
	draw_colored_polygon(outer, Art.GOLD_DEEP if not _boss else Color("c4161c"))
	draw_colored_polygon(inner, Color.WHITE, uvs, tex)
	outer.append(outer[0])
	draw_polyline(outer, Art.GOLD_LIGHT, 2.0, true)
