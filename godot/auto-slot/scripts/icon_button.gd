# 圓形按鈕（照設計稿與 PG Soft 的投注列）：轉動鍵（紅色圓盤＋古金圈，中間畫金色循環箭頭；自動旋轉時改寫剩幾轉）、
# 選單、TURBO（關著閃電被斜線劃掉、底下寫 OFF，開著寫 TURBO）、AUTO、押注加減（古金細圈＋深藍底，底下可帶小字）、
# 補幣（綠寶石）。圈是 art/ui 的圖，圖示用程式畫
extends BaseButton

const Art := preload("res://scripts/art.gd")

var kind := "menu"
var caption := ""
var busy := false:
	set(v):
		busy = v
		queue_redraw()
# 亮起來（AUTO 自動旋轉中）
var lit := false:
	set(v):
		lit = v
		queue_redraw()
# 轉動鍵中間顯示的數字（自動旋轉剩幾轉；0 = 畫箭頭）
var count := 0:
	set(v):
		count = v
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
	var on := lit or (toggle_mode and button_pressed)
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
		var on := lit or (toggle_mode and button_pressed)
		var base := Vector2(-10, size.y - 1)
		# TURBO 關著時底下寫 OFF
		var text := "OFF" if kind == "turbo" and not on else caption
		draw_string_outline(f, base, text, HORIZONTAL_ALIGNMENT_CENTER, size.x + 20, fs, 3, Art.INK)
		draw_string(f, base, text, HORIZONTAL_ALIGNMENT_CENTER, size.x + 20, fs, Art.GOLD_LIGHT if on else Art.CREAM)


# 古金細圈按鈕：選單三條線、TURBO 閃電、AUTO 循環箭頭、押注加減；開著的時候外圈發金光
func _ring_face(r: float) -> void:
	var on := lit or (toggle_mode and button_pressed)
	if on:
		for k in 4:
			draw_circle(Vector2.ZERO, r * (1.16 - k * 0.05), Color(1, 0.75, 0.3, 0.1))
	draw_circle(Vector2(0, r * 0.08), r * 0.98, Color(0, 0, 0, 0.45))
	var ring := Art.ui("ring")
	var rs := r * 2.0 / ring.get_width()
	draw_texture_rect(ring, Rect2(-Vector2(ring.get_width(), ring.get_height()) * rs / 2.0, Vector2(ring.get_width(), ring.get_height()) * rs), false)
	var ink := Art.GOLD_LIGHT if on or is_hovered() else Color("f3dfae")
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
			if not on:
				# 關著：一道斜線劃掉（先用深藍底色切開閃電，再畫細線）
				var from := Vector2(-s * 0.75, -s * 0.8)
				var to := Vector2(s * 0.75, s * 0.8)
				var w := maxf(1.8, r * 0.08)
				draw_line(from, to, Color("0b1020"), w * 2.4, true)
				draw_line(from, to, ink, w, true)
		"auto":
			draw_set_transform(size.x / 2.0 * Vector2.ONE, _t if on else 0.0, Vector2.ONE)
			_arrows(r * 0.4, maxf(2.0, r * 0.1), ink)
			draw_set_transform(size.x / 2.0 * Vector2.ONE)
		"plus", "minus":
			var w := maxf(2.4, r * 0.12)
			draw_line(Vector2(-r * 0.4, 0), Vector2(r * 0.4, 0), ink, w, true)
			if kind == "plus":
				draw_line(Vector2(0, -r * 0.4), Vector2(0, r * 0.4), ink, w, true)


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


# 轉動鍵：紅色圓盤＋古金圈的圖蓋滿按鈕，中間畫金色循環箭頭；自動旋轉時改寫剩幾轉
func _spin_face(r: float) -> void:
	var tex := Art.ui("spin")
	draw_circle(Vector2(0, r * 0.07), r * 0.98, Color(0, 0, 0, 0.5))
	for i in 4:
		draw_circle(Vector2.ZERO, r * (1.12 - i * 0.04), Color(1, 0.3, 0.15, 0.06))
	draw_texture_rect(tex, Rect2(-r, -r, r * 2.0, r * 2.0), false)
	if count > 0:
		var f := Art.font()
		var text := str(count)
		var fs := int(r * (0.5 if text.length() <= 2 else 0.38))
		var base := Vector2(-r, fs * 0.36)
		draw_string_outline(f, base, text, HORIZONTAL_ALIGNMENT_CENTER, r * 2.0, fs, 6, Art.GOLD_INK)
		draw_string(f, base, text, HORIZONTAL_ALIGNMENT_CENTER, r * 2.0, fs, Art.GOLD_LIGHT)
	else:
		draw_set_transform(size / 2.0, _t, Vector2.ONE * (0.93 if is_pressed() else 1.0))
		_arrows(r * 0.4, r * 0.12, Art.GOLD, Art.GOLD_INK)
		for kk in 2:
			var a0 := kk * PI + 0.45
			draw_arc(Vector2.ZERO, r * 0.4 - r * 0.028, a0, a0 + PI * 0.55, 18, Color(Art.GOLD_LIGHT, 0.8), r * 0.034, true)
		draw_set_transform(size / 2.0)
	if disabled:
		draw_circle(Vector2.ZERO, r * 0.78, Color(0, 0, 0, 0.45))
