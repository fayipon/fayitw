# 圓形按鈕：轉動（金色雙劍）、AUTO、選單、設定、加減、補幣，全部用程式畫
extends BaseButton

const Art := preload("res://scripts/art.gd")

var kind := "menu"
var busy := false:
	set(v):
		busy = v
		queue_redraw()
var _t := 0.0


func _init(k := "menu") -> void:
	kind = k
	focus_mode = Control.FOCUS_NONE
	mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND


func _ready() -> void:
	for sig in ["button_down", "button_up", "mouse_entered", "mouse_exited"]:
		connect(sig, queue_redraw)
	toggled.connect(func(_on: bool): queue_redraw())
	resized.connect(func(): pivot_offset = size / 2.0)


func _process(delta: float) -> void:
	if (kind == "auto" and button_pressed) or (kind == "spin" and busy):
		_t += delta
		queue_redraw()


func _draw() -> void:
	var c := size / 2.0
	var r := minf(size.x, size.y) / 2.0
	var down := is_pressed() and kind != "auto"
	var press := 0.94 if down else 1.0
	draw_set_transform(c, 0.0, Vector2(press, press))
	match kind:
		"spin":
			_spin_face(r)
		"plus", "minus":
			_disc(r, Color("4a3524"), Color("1c120b"), Color(Art.GOLD, 0.55))
			draw_line(Vector2(-r * 0.42, 0), Vector2(r * 0.42, 0), Art.CREAM, 3.0)
			if kind == "plus":
				draw_line(Vector2(0, -r * 0.42), Vector2(0, r * 0.42), Art.CREAM, 3.0)
		"refill":
			_disc(r, Color("7bdc4a"), Color("2f9a24"), Color(1, 1, 1, 0.5))
			draw_line(Vector2(-r * 0.45, 0), Vector2(r * 0.45, 0), Color.WHITE, 3.4)
			draw_line(Vector2(0, -r * 0.45), Vector2(0, r * 0.45), Color.WHITE, 3.4)
		_:
			var on := kind == "auto" and button_pressed
			_disc(r, Color("3a2a1d"), Color("160e09"), Art.GOLD if on else Color(Art.GOLD, 0.45))
			var ink := Art.GOLD if on else Art.CREAM
			match kind:
				"menu":
					for k in 3:
						var y := (k - 1) * r * 0.32
						draw_line(Vector2(-r * 0.42, y), Vector2(r * 0.42, y), ink, 3.0)
				"gear":
					_gear(r * 0.5, ink)
				"auto":
					draw_set_transform(c + Vector2(0, -r * 0.14), _t * 4.0 if on else 0.0, Vector2(press, press))
					var rr := r * 0.36
					draw_arc(Vector2.ZERO, rr, -PI * 0.9, -PI * 0.15, 16, ink, 2.6)
					draw_arc(Vector2.ZERO, rr, PI * 0.1, PI * 0.85, 16, ink, 2.6)
					draw_colored_polygon(PackedVector2Array([Vector2(rr * 0.75, -rr * 0.95), Vector2(rr * 1.25, -rr * 0.4), Vector2(rr * 0.55, -rr * 0.3)]), ink)
					draw_colored_polygon(PackedVector2Array([Vector2(-rr * 0.75, rr * 0.95), Vector2(-rr * 1.25, rr * 0.4), Vector2(-rr * 0.55, rr * 0.3)]), ink)
					draw_set_transform(c, 0.0, Vector2(press, press))
					var f := Art.font()
					draw_string(f, Vector2(-r, r * 0.62), "AUTO", HORIZONTAL_ALIGNMENT_CENTER, r * 2.0, int(r * 0.38), ink)
	draw_set_transform(Vector2.ZERO)


func _disc(r: float, light: Color, dark: Color, ring: Color) -> void:
	draw_circle(Vector2(0, 3), r, Color(0, 0, 0, 0.35))
	draw_circle(Vector2.ZERO, r, ring)
	draw_circle(Vector2.ZERO, r - 2.0, dark)
	draw_circle(Vector2(0, -r * 0.15), r * 0.78, light.lerp(dark, 0.35))
	draw_circle(Vector2(0, -r * 0.25), r * 0.55, light.lerp(dark, 0.15))


func _gear(r: float, ink: Color) -> void:
	for k in 8:
		var a := k * TAU / 8.0
		var p := Vector2.RIGHT.rotated(a)
		draw_line(p * r * 0.7, p * r * 1.18, ink, r * 0.42)
	draw_circle(Vector2.ZERO, r * 0.85, ink)
	draw_circle(Vector2.ZERO, r * 0.4, Color("231710"))


# 金色大按鈕：外圈深棕、亮金漸層、交叉雙劍；轉動中劍輕輕晃
func _spin_face(r: float) -> void:
	draw_circle(Vector2(0, 5), r, Color(0, 0, 0, 0.45))
	draw_circle(Vector2.ZERO, r, Color("6a3a0a"))
	draw_circle(Vector2.ZERO, r - 3.0, Color("ffe08a"))
	var layers := [[0.88, Color("a8600c")], [0.82, Color("e8a020")], [0.66, Color("ffd25a")], [0.42, Color("fff0a8")]]
	for l in layers:
		draw_circle(Vector2(0, -r * (1.0 - l[0]) * 0.5), r * l[0], l[1])
	draw_circle(Vector2(-r * 0.25, -r * 0.42), r * 0.16, Color(1, 1, 1, 0.45))
	var wobble := sin(_t * 9.0) * 0.12 if busy else 0.0
	for side in [-1.0, 1.0]:
		draw_set_transform(size / 2.0, side * PI / 4.0 + wobble * side, Vector2.ONE)
		_sword(r * 0.62)
	draw_set_transform(size / 2.0)


func _sword(l: float) -> void:
	var w := l * 0.14
	var blade := PackedVector2Array([Vector2(0, -l), Vector2(w, -l * 0.8), Vector2(w, l * 0.3), Vector2(-w, l * 0.3), Vector2(-w, -l * 0.8)])
	draw_colored_polygon(blade, Color("8a4e14"))
	draw_line(Vector2(0, -l * 0.85), Vector2(0, l * 0.25), Color("f0b462"), 1.6)
	draw_rect(Rect2(-w * 2.6, l * 0.3, w * 5.2, w * 1.3), Color("4a2606"))
	draw_rect(Rect2(-w * 0.7, l * 0.3 + w * 1.3, w * 1.4, l * 0.4), Color("6e3c0c"))
	draw_circle(Vector2(0, l * 0.78), w * 0.95, Color("4a2606"))
