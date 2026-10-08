# 圓形按鈕：轉動鍵（荊棘古金圈＋金色循環箭頭）、選單、TURBO、AUTO（銅圈＋金色圖示，底下可帶小字）、
# 押注加減（細金圈）、補幣（綠寶石）。圈是 art/ui 的圖，圖示用程式畫
extends BaseButton

const Art := preload("res://scripts/art.gd")

var kind := "menu"
var caption := ""
var busy := false:
	set(v):
		busy = v
		queue_redraw()
var _t := 0.0
var _spin_speed := 0.0


func _init(k := "menu", cap := "") -> void:
	kind = k
	caption = cap
	focus_mode = Control.FOCUS_NONE
	mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND


func _ready() -> void:
	for sig in ["button_down", "button_up", "mouse_entered", "mouse_exited"]:
		connect(sig, queue_redraw)
	toggled.connect(func(_on: bool): queue_redraw())
	resized.connect(func(): pivot_offset = size / 2.0)


func _process(delta: float) -> void:
	var on := toggle_mode and button_pressed
	if kind == "spin":
		# 轉動中箭頭加速旋轉，停下來慢慢減速
		_spin_speed = move_toward(_spin_speed, 9.0 if busy else 0.6, delta * 12.0)
		_t += delta * _spin_speed
		queue_redraw()
	elif on and kind == "auto":
		_t += delta * 3.0
		queue_redraw()


func _draw() -> void:
	var d := size.x
	var c := Vector2(d / 2.0, d / 2.0)
	var r := d / 2.0
	var down := is_pressed() and not toggle_mode
	var press := 0.93 if down else 1.0
	draw_set_transform(c, 0.0, Vector2(press, press))
	match kind:
		"spin":
			_spin_face(r)
		"plus", "minus":
			draw_circle(Vector2.ZERO, r, Color(0, 0, 0, 0.55))
			draw_arc(Vector2.ZERO, r - 1.0, 0, TAU, 40, Art.GOLD_DEEP, 1.6, true)
			draw_line(Vector2(-r * 0.42, 0), Vector2(r * 0.42, 0), Art.GOLD, 2.2, true)
			if kind == "plus":
				draw_line(Vector2(0, -r * 0.42), Vector2(0, r * 0.42), Art.GOLD, 2.2, true)
		"refill":
			draw_circle(Vector2(0, 1.5), r, Color(0, 0, 0, 0.4))
			draw_circle(Vector2.ZERO, r, Art.GOLD_DEEP)
			draw_circle(Vector2.ZERO, r - 1.5, Color("1f6a1a"))
			draw_circle(Vector2(0, -r * 0.12), r * 0.78, Color("3f9a2f"))
			draw_circle(Vector2(-r * 0.25, -r * 0.35), r * 0.22, Color(1, 1, 1, 0.3))
			draw_line(Vector2(-r * 0.45, 0), Vector2(r * 0.45, 0), Color.WHITE, 2.8, true)
			draw_line(Vector2(0, -r * 0.45), Vector2(0, r * 0.45), Color.WHITE, 2.8, true)
		_:
			_ring_face(r)
	draw_set_transform(Vector2.ZERO)
	if caption != "":
		var f := Art.font()
		var fs := int(clampf(d * 0.26, 9, 13))
		var on := toggle_mode and button_pressed
		var base := Vector2(-10, size.y - 1)
		draw_string_outline(f, base, caption, HORIZONTAL_ALIGNMENT_CENTER, size.x + 20, fs, 3, Art.INK)
		draw_string(f, base, caption, HORIZONTAL_ALIGNMENT_CENTER, size.x + 20, fs, Art.GOLD_LIGHT if on else Art.GOLD)


# 銅圈按鈕：選單三條線、TURBO 閃電、AUTO 循環箭頭；開著的時候外圈發金光
func _ring_face(r: float) -> void:
	var on := toggle_mode and button_pressed
	if on:
		for k in 4:
			draw_circle(Vector2.ZERO, r * (1.12 - k * 0.04), Color(1, 0.75, 0.3, 0.08))
	var ring := Art.ui("ring")
	var rs := r * 2.0 / ring.get_width()
	draw_texture_rect(ring, Rect2(-Vector2(ring.get_width(), ring.get_height()) * rs / 2.0, Vector2(ring.get_width(), ring.get_height()) * rs), false)
	var ink := Art.GOLD_LIGHT if on else (Art.GOLD if not is_hovered() else Art.GOLD_LIGHT)
	match kind:
		"menu":
			for k in 3:
				var y := (k - 1) * r * 0.26
				draw_line(Vector2(-r * 0.34, y), Vector2(r * 0.34, y), ink, maxf(2.0, r * 0.1), true)
		"turbo":
			var s := r * 0.5
			var bolt := PackedVector2Array([Vector2(0.15, -1.0), Vector2(-0.55, 0.12), Vector2(-0.05, 0.12), Vector2(-0.2, 1.0), Vector2(0.55, -0.15), Vector2(0.05, -0.15)])
			for i in bolt.size():
				bolt[i] *= s
			draw_colored_polygon(bolt, ink)
		"auto":
			draw_set_transform(size.x / 2.0 * Vector2.ONE, _t if on else 0.0, Vector2.ONE)
			_arrows(r * 0.4, maxf(2.0, r * 0.09), ink)
			draw_set_transform(size.x / 2.0 * Vector2.ONE)
			var f := Art.font()
			var fs := int(r * 0.5)
			draw_string(f, Vector2(-r, fs * 0.36), "A", HORIZONTAL_ALIGNMENT_CENTER, r * 2.0, fs, ink)


# 兩段弧＋箭頭的循環符號
func _arrows(rr: float, width: float, ink: Color, outline := Color.TRANSPARENT) -> void:
	for k in 2:
		var a0 := k * PI + 0.35
		var a1 := a0 + PI * 0.72
		if outline.a > 0.0:
			draw_arc(Vector2.ZERO, rr, a0, a1, 24, outline, width + 3.0, true)
		draw_arc(Vector2.ZERO, rr, a0, a1, 24, ink, width, true)
		var tip := Vector2.RIGHT.rotated(a1) * rr
		var fwd := Vector2.RIGHT.rotated(a1 + PI / 2.0)
		var side := Vector2.RIGHT.rotated(a1)
		var head := PackedVector2Array([tip + fwd * width * 2.2, tip + side * width * 1.7, tip - side * width * 1.7])
		if outline.a > 0.0:
			var big := PackedVector2Array([tip + fwd * (width * 2.2 + 2.0), tip + side * (width * 1.7 + 2.0), tip - side * (width * 1.7 + 2.0)])
			draw_colored_polygon(big, outline)
		draw_colored_polygon(head, ink)


# 轉動鍵：荊棘古金圈（圓心對準按鈕中心），深色圓心裡畫金色循環箭頭
func _spin_face(r: float) -> void:
	var ring := Art.ui("spin-ring")
	var hole: Array = Art.ui_meta()["spin-ring-hole"]
	var k := r * 0.6 / float(hole[2])
	draw_circle(Vector2(0, r * 0.06), r * 0.86, Color(0, 0, 0, 0.45))
	draw_texture_rect(ring, Rect2(-Vector2(hole[0], hole[1]) * k, Vector2(ring.get_width(), ring.get_height()) * k), false)
	# 圓心微微透出紅光
	for i in 5:
		draw_circle(Vector2.ZERO, r * (0.58 - i * 0.09), Color(0.6, 0.05, 0.05, 0.08))
	draw_set_transform(size / 2.0, _t, Vector2.ONE * (0.93 if is_pressed() else 1.0))
	_arrows(r * 0.36, r * 0.11, Art.GOLD, Art.GOLD_INK)
	draw_set_transform(size / 2.0, _t, Vector2.ONE * (0.93 if is_pressed() else 1.0))
	for kk in 2:
		var a0 := kk * PI + 0.45
		draw_arc(Vector2.ZERO, r * 0.36 - r * 0.025, a0, a0 + PI * 0.55, 18, Color(Art.GOLD_LIGHT, 0.8), r * 0.03, true)
	draw_set_transform(size / 2.0)
	if disabled:
		draw_circle(Vector2.ZERO, r * 0.6, Color(0, 0, 0, 0.45))
