# 自走區上方吊著的紙板倍率牌（Pinata Wins 的皮納塔那個角色）：連鎖時倍率往上跳，牌子被打得甩來甩去
extends Node2D

const Art := preload("res://scripts/art.gd")

const COLORS := {1: Color("b8452c"), 2: Color("f08a1c"), 3: Color("e8364f"), 5: Color("8a3dff")}

var value := 1
var rope := 60.0
var board := Vector2(104, 60)

var _angle := 0.0
var _speed := 0.0
var _t := 0.0
var _label: Label


func _ready() -> void:
	_label = Art.label("×1", Art.label_settings(36, Color.WHITE, "num", 9, Color("4a1400"), 3))
	add_child(_label)
	_layout_label()


func _layout_label() -> void:
	_label.size = board
	_label.position = Vector2(-board.x / 2.0, rope)
	_label.pivot_offset = board / 2.0


func set_rope(length: float) -> void:
	rope = length
	_layout_label()
	queue_redraw()


func set_value(v: int, animate := true) -> void:
	var up := v > value
	value = v
	_label.text = "×%d" % v
	queue_redraw()
	if animate and up:
		_speed += 5.0 + v * 0.6
		_label.scale = Vector2(1.7, 1.7)
		var tw := create_tween()
		tw.tween_property(_label, "scale", Vector2.ONE, 0.35).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
		Sfx.play("mult", 0.9 + v * 0.08)
		_spark()


func _process(delta: float) -> void:
	_t += delta
	# 彈簧擺：被打一下就甩，慢慢停回來，平常輕輕晃
	_speed += (-_angle * 28.0 - _speed * 2.4) * delta
	_angle += _speed * delta
	rotation = _angle + sin(_t * 1.4) * 0.035


func _draw() -> void:
	var col: Color = COLORS.get(value, COLORS[5])
	draw_line(Vector2(0, -400), Vector2(0, rope + 4), Color("6a4520"), 3.0)
	draw_line(Vector2(-1, -400), Vector2(-1, rope + 4), Color(1, 1, 1, 0.18), 1.0)
	var r := Rect2(Vector2(-board.x / 2.0, rope), board)
	# 紙板厚度、白色切邊、本體
	draw_style_box(Art.box(Color(0.42, 0.28, 0.16), 14), Rect2(r.position + Vector2(4, 5), r.size))
	draw_style_box(Art.box(Color.WHITE, 14), r)
	draw_style_box(Art.box(col, 10, 2, col.darkened(0.35)), r.grow(-4))
	draw_rect(Rect2(r.position + Vector2(10, 7), Vector2(r.size.x - 20, 6)), Color(1, 1, 1, 0.22))
	# 黃銅釘吊著
	draw_circle(Vector2(0, rope + 4), 6.0, Color("b07a1e"))
	draw_circle(Vector2(0, rope + 4), 4.2, Color("ffd25a"))
	draw_circle(Vector2(-1.3, rope + 2.6), 1.5, Color(1, 1, 1, 0.8))


func _spark() -> void:
	var p := CPUParticles2D.new()
	p.position = Vector2(0, rope + board.y / 2.0)
	p.one_shot = true
	p.explosiveness = 1.0
	p.amount = 24
	p.lifetime = 0.7
	p.spread = 180.0
	p.initial_velocity_min = 90.0
	p.initial_velocity_max = 220.0
	p.gravity = Vector2(0, 300)
	p.scale_amount_min = 2.5
	p.scale_amount_max = 5.0
	p.color = Art.GOLD
	add_child(p)
	p.emitting = true
	p.finished.connect(p.queue_free)
