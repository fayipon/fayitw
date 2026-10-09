# 自走區的連擊計數（格鬥遊戲風）：斜體大數字＋ COMBO，第 2 段連擊起才出現；
# 每多一段數字放大彈回、閃白、後面炸一圈火花，顏色由白、金、橘到紅熱（5 段以上會閃）；3 段起下面加評語；
# 一輪打完停一下再往左滑出淡掉。原點是數字左下角（基線），整個節點往右斜
extends Node2D

const Art := preload("res://scripts/art.gd")

const NUM_SIZE := 52
const WORD_SIZE := 21
const RATE_SIZE := 14
const RATINGS := ["", "", "", "GREAT!", "EXCELLENT!", "AMAZING!", "LEGENDARY!"]

var count := 0
var home := Vector2.ZERO
var _pop := 1.0
var _flash := 0.0
var _rate_in := 0.0
var _shown := false
var _t := 0.0
var _tw: Tween
var _sparks: CPUParticles2D


func _ready() -> void:
	skew = -0.22
	modulate.a = 0.0
	_sparks = CPUParticles2D.new()
	_sparks.emitting = false
	_sparks.one_shot = true
	_sparks.explosiveness = 1.0
	_sparks.amount = 22
	_sparks.lifetime = 0.45
	_sparks.spread = 180.0
	_sparks.gravity = Vector2.ZERO
	_sparks.initial_velocity_min = 90.0
	_sparks.initial_velocity_max = 200.0
	_sparks.damping_min = 160.0
	_sparks.damping_max = 260.0
	_sparks.scale_amount_min = 2.0
	_sparks.scale_amount_max = 4.0
	var ramp := Gradient.new()
	ramp.set_color(0, Color(1, 0.97, 0.75, 1))
	ramp.add_point(0.45, Color(1, 0.6, 0.15, 0.95))
	ramp.set_color(1, Color(0.85, 0.1, 0.05, 0))
	_sparks.color_ramp = ramp
	_sparks.show_behind_parent = true
	add_child(_sparks)


# 第 n 段連擊打中
func hit(n: int) -> void:
	count = n
	if n < 2:
		return
	if _tw:
		_tw.kill()
	_tw = create_tween()
	if not _shown:
		_shown = true
		position = home - Vector2(36, 0)
		_tw.tween_property(self, "position", home, 0.16).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
		_tw.parallel().tween_property(self, "modulate:a", 1.0, 0.1)
	else:
		position = home
		modulate.a = 1.0
	_pop = 1.9
	_flash = 1.0
	_tw.parallel().tween_property(self, "_pop", 1.0, 0.28).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_tw.parallel().tween_property(self, "_flash", 0.0, 0.3)
	if n >= 3:
		_rate_in = 0.0
		_tw.parallel().tween_property(self, "_rate_in", 1.0, 0.22).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT).set_delay(0.08)
	var nw := _num_width()
	_sparks.position = Vector2(nw * 0.5, -NUM_SIZE * 0.36)
	_sparks.amount = 18 + mini(n, 6) * 4
	_sparks.restart()


# 這一輪打完：停一下，往左滑出淡掉
func finish() -> void:
	if not _shown:
		count = 0
		return
	_shown = false
	if _tw:
		_tw.kill()
	_tw = create_tween()
	_tw.tween_interval(0.7)
	_tw.tween_property(self, "position", home - Vector2(48, 0), 0.3).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN)
	_tw.parallel().tween_property(self, "modulate:a", 0.0, 0.3)
	_tw.tween_callback(func(): count = 0)


func _process(delta: float) -> void:
	_t += delta
	if modulate.a > 0.0:
		queue_redraw()


func _num_width() -> float:
	return Art.font().get_string_size(str(count), HORIZONTAL_ALIGNMENT_LEFT, -1, NUM_SIZE).x


# 段數越多越燙：字色、外圈色
func _colors() -> Array:
	if count >= 5:
		var f := 0.5 + 0.5 * sin(_t * 18.0)
		return [Color(1, 0.42, 0.18).lerp(Color(1, 0.9, 0.5), f), Color(0.75, 0.04, 0.02)]
	if count == 4:
		return [Color(1, 0.66, 0.2), Color(0.72, 0.08, 0.03)]
	if count == 3:
		return [Art.GOLD_LIGHT, Color(0.7, 0.12, 0.04)]
	return [Art.CREAM, Color(0.6, 0.06, 0.06)]


func _draw() -> void:
	if count < 2:
		return
	var font := Art.font()
	var num := str(count)
	var nw := _num_width()
	var cols := _colors()
	var fill: Color = cols[0].lerp(Color.WHITE, _flash)
	var ink := Color("1a0303")
	# 5 段以上數字後面一團紅光
	if count >= 5:
		for k in 5:
			draw_circle(Vector2(nw * 0.5, -NUM_SIZE * 0.36), NUM_SIZE * (0.95 - k * 0.15), Color(1, 0.25, 0.05, 0.07))
	# 數字：以數字中心縮放彈回；最外圈深色、中間一圈紅、裡面填色
	var c := Vector2(nw * 0.5, -NUM_SIZE * 0.36)
	draw_set_transform(c, 0.0, Vector2(_pop, _pop))
	var at := -c
	draw_string_outline(font, at + Vector2(3, 4), num, HORIZONTAL_ALIGNMENT_LEFT, -1, NUM_SIZE, 16, Color(0, 0, 0, 0.6))
	draw_string_outline(font, at, num, HORIZONTAL_ALIGNMENT_LEFT, -1, NUM_SIZE, 16, ink)
	draw_string_outline(font, at, num, HORIZONTAL_ALIGNMENT_LEFT, -1, NUM_SIZE, 8, cols[1])
	draw_string(font, at, num, HORIZONTAL_ALIGNMENT_LEFT, -1, NUM_SIZE, fill)
	draw_set_transform(Vector2.ZERO)
	# COMBO：數字右邊，底下一條往右漸淡的紅條
	var x := nw + 9.0
	var y := -NUM_SIZE * 0.3
	var ww := font.get_string_size("COMBO", HORIZONTAL_ALIGNMENT_LEFT, -1, WORD_SIZE).x
	draw_polygon(PackedVector2Array([Vector2(x - 4, y + 4), Vector2(x + ww + 22, y + 4), Vector2(x + ww + 22, y + 9), Vector2(x - 4, y + 9)]),
		PackedColorArray([Color(0.85, 0.1, 0.05, 0.95), Color(0.85, 0.1, 0.05, 0), Color(0.85, 0.1, 0.05, 0), Color(0.85, 0.1, 0.05, 0.95)]))
	draw_string_outline(font, Vector2(x, y), "COMBO", HORIZONTAL_ALIGNMENT_LEFT, -1, WORD_SIZE, 7, ink)
	draw_string(font, Vector2(x, y), "COMBO", HORIZONTAL_ALIGNMENT_LEFT, -1, WORD_SIZE, Art.GOLD)
	# 評語：COMBO 底下，從左邊彈出來
	var rate: String = RATINGS[mini(count, RATINGS.size() - 1)]
	if rate != "" and _rate_in > 0.0:
		var ry := y + 9.0 + RATE_SIZE + 2.0
		var rx := x + (1.0 - _rate_in) * -16.0
		var rc := Color(Art.GOLD_LIGHT, clampf(_rate_in, 0.0, 1.0))
		draw_string_outline(font, Vector2(rx, ry), rate, HORIZONTAL_ALIGNMENT_LEFT, -1, RATE_SIZE, 6, Color(ink, rc.a))
		draw_string(font, Vector2(rx, ry), rate, HORIZONTAL_ALIGNMENT_LEFT, -1, RATE_SIZE, rc)
