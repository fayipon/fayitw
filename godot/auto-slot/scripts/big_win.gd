# BIG WIN 演出（參考 PG Soft 的 Big Win，例如 Piñata Wins）：整個畫面壓暗、背後金色光芒慢慢轉、
# 標題字（BIG WIN → MEGA WIN → SUPER MEGA WIN）在金額跨過門檻時閃白放大並噴一波金幣、
# 金額在紅色古金底板上跳分；金幣從底部像噴泉一樣噴出（會翻面），MEGA 以上再從上方下金幣雨，夾著紅葉與金色火花。
# 點一下直接跳到最後金額，再點一下收起來
extends Control

signal upgraded(level: int)

const Art := preload("res://scripts/art.gd")
# 門檻（總押注的幾倍）、標題圖（art/ui/title-*.webp）、沒有圖時的字
const TIERS := [[10, "big", "BIG WIN"], [25, "mega", "MEGA WIN"], [50, "super", "SUPER MEGA WIN"]]
const COIN_FRAMES := 8

var _skip := false
var _tier := -1
var _rays: Control
var _title: TextureRect
var _title_text: Label
var _plate: Control
var _amount: Label
var _flash: ColorRect
var _fountain: CPUParticles2D
var _rain: CPUParticles2D
var _burst: CPUParticles2D
var _sparks: CPUParticles2D
var _petals: CPUParticles2D

static var _coin_sheet: Texture2D


# 總押注的 10 倍以上才演
static func qualifies(total: int, tb: int) -> bool:
	return total >= TIERS[0][0] * tb


func _ready() -> void:
	visible = false
	mouse_filter = Control.MOUSE_FILTER_STOP
	gui_input.connect(func(e: InputEvent):
		if e is InputEventMouseButton and e.pressed:
			_skip = true)
	_rays = Control.new()
	_rays.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_rays.draw.connect(_draw_rays)
	add_child(_rays)
	_petals = _make_petals()
	add_child(_petals)
	_rain = _make_coins()
	_rain.amount = 26
	_rain.lifetime = 2.6
	_rain.direction = Vector2.DOWN
	_rain.spread = 12.0
	_rain.gravity = Vector2(0, 700)
	_rain.initial_velocity_min = 80.0
	_rain.initial_velocity_max = 220.0
	_rain.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
	add_child(_rain)
	_fountain = _make_coins()
	_fountain.amount = 34
	_fountain.lifetime = 2.4
	_fountain.direction = Vector2.UP
	_fountain.spread = 24.0
	_fountain.gravity = Vector2(0, 1500)
	_fountain.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
	add_child(_fountain)
	_burst = _make_coins()
	_burst.amount = 40
	_burst.lifetime = 1.6
	_burst.one_shot = true
	_burst.explosiveness = 0.95
	_burst.spread = 180.0
	_burst.gravity = Vector2(0, 1100)
	_burst.initial_velocity_min = 380.0
	_burst.initial_velocity_max = 820.0
	add_child(_burst)
	_title = TextureRect.new()
	_title.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_title.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_title.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_title)
	_title_text = Art.label("", Art.label_settings(52, Art.GOLD, "num", 14, Art.GOLD_INK, 6))
	_title.add_child(_title_text)
	var plate_tex := Art.ui("buy")
	_plate = Control.new()
	_plate.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_plate.draw.connect(func(): _plate.draw_texture_rect(plate_tex, Rect2(Vector2.ZERO, _plate.size), false))
	add_child(_plate)
	_amount = Art.label("0", Art.label_settings(46, Art.GOLD_LIGHT, "num", 12, Color("3a0608"), 5))
	_plate.add_child(_amount)
	_sparks = _make_sparks()
	add_child(_sparks)
	_flash = ColorRect.new()
	_flash.color = Color(1, 0.95, 0.8, 0.0)
	_flash.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_flash)
	resized.connect(_layout)


func _layout() -> void:
	var c := _center()
	var side := maxf(size.x, size.y) * 1.1
	_rays.size = Vector2(side, side)
	_rays.position = c - _rays.size / 2.0
	_rays.pivot_offset = _rays.size / 2.0
	var tw := minf(size.x * 0.9, 440.0)
	_title.size = Vector2(tw, tw * 0.5)
	_title.position = c - _title.size / 2.0
	_title.pivot_offset = _title.size / 2.0
	_title_text.size = _title.size
	var pw := minf(size.x * 0.82, 360.0)
	var tex := Art.ui("buy")
	_plate.size = Vector2(pw, pw * tex.get_height() / tex.get_width())
	_plate.position = Vector2((size.x - pw) / 2.0, _title.position.y + _title.size.y + 4.0)
	_plate.pivot_offset = _plate.size / 2.0
	_amount.size = _plate.size
	_amount.pivot_offset = _amount.size / 2.0
	_fountain.position = Vector2(size.x / 2.0, size.y + 30.0)
	_fountain.emission_rect_extents = Vector2(size.x * 0.12, 4)
	_fountain.initial_velocity_min = size.y * 1.15
	_fountain.initial_velocity_max = size.y * 1.6
	_rain.position = Vector2(size.x / 2.0, -40.0)
	_rain.emission_rect_extents = Vector2(size.x * 0.55, 4)
	_burst.position = c
	_sparks.position = c
	_sparks.emission_rect_extents = Vector2(_title.size.x * 0.45, _title.size.y * 0.35)
	_petals.position = Vector2(size.x / 2.0, -20.0)
	_petals.emission_rect_extents = Vector2(size.x * 0.6, 4)
	_flash.size = size
	queue_redraw()


func _center() -> Vector2:
	return Vector2(size.x / 2.0, size.y * 0.38)


func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.02, 0.012, 0.03, 0.84))
	var c := _center()
	for k in 9:
		draw_circle(c, size.x * (0.8 - k * 0.08), Color(0.95, 0.3, 0.08, 0.04))


# 光芒：一圈金色楔形，中心亮、往外淡掉，整片慢慢轉
func _draw_rays() -> void:
	var c := _rays.size / 2.0
	var r := _rays.size.x * 0.5
	var n := 20
	for i in n:
		var a0 := TAU * i / n
		var a1 := a0 + TAU / n * 0.42
		_rays.draw_polygon(PackedVector2Array([c, c + Vector2.RIGHT.rotated(a0) * r, c + Vector2.RIGHT.rotated(a1) * r]),
			PackedColorArray([Color(1, 0.86, 0.45, 0.26), Color(1, 0.6, 0.15, 0.0), Color(1, 0.6, 0.15, 0.0)]))


func _process(delta: float) -> void:
	if visible:
		_rays.rotation += delta * 0.32


# 金幣翻面的序列圖：同一枚金幣橫向壓扁再撐開，CPUParticles2D 逐格播
static func _coins_texture() -> Texture2D:
	if _coin_sheet:
		return _coin_sheet
	var src: Image = Art.ui("coin").get_image()
	if src.is_compressed():
		src.decompress()
	src.convert(Image.FORMAT_RGBA8)
	var w := 64
	src.resize(w, w, Image.INTERPOLATE_LANCZOS)
	var sheet := Image.create(w * COIN_FRAMES, w, false, Image.FORMAT_RGBA8)
	for i in COIN_FRAMES:
		var k := absf(cos(PI * i / COIN_FRAMES))
		var fw := maxi(4, int(w * k))
		var f := src.duplicate()
		f.resize(fw, w, Image.INTERPOLATE_BILINEAR)
		sheet.blit_rect(f, Rect2i(0, 0, fw, w), Vector2i(i * w + (w - fw) / 2, 0))
	_coin_sheet = ImageTexture.create_from_image(sheet)
	return _coin_sheet


func _make_coins() -> CPUParticles2D:
	var p := CPUParticles2D.new()
	p.texture = _coins_texture()
	var mat := CanvasItemMaterial.new()
	mat.particles_animation = true
	mat.particles_anim_h_frames = COIN_FRAMES
	mat.particles_anim_v_frames = 1
	mat.particles_anim_loop = true
	p.material = mat
	p.emitting = false
	p.anim_speed_min = 4.0
	p.anim_speed_max = 9.0
	p.anim_offset_max = 1.0
	p.scale_amount_min = 0.5
	p.scale_amount_max = 0.95
	p.angular_velocity_min = -90.0
	p.angular_velocity_max = 90.0
	return p


# 標題四周一閃一閃的金色火花
func _make_sparks() -> CPUParticles2D:
	var img := Image.create(16, 16, false, Image.FORMAT_RGBA8)
	for x in 16:
		for y in 16:
			var d := Vector2(x - 7.5, y - 7.5)
			var a := clampf(1.0 - minf(absf(d.x), absf(d.y)) / 1.6, 0.0, 1.0) * clampf(1.0 - d.length() / 8.0, 0.0, 1.0)
			a = maxf(a, clampf(1.0 - d.length() / 3.0, 0.0, 1.0))
			img.set_pixel(x, y, Color(1, 0.92, 0.6, a))
	var p := CPUParticles2D.new()
	p.texture = ImageTexture.create_from_image(img)
	p.emitting = false
	p.amount = 26
	p.lifetime = 0.9
	p.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
	p.gravity = Vector2.ZERO
	p.initial_velocity_min = 0.0
	p.initial_velocity_max = 20.0
	p.scale_amount_min = 0.6
	p.scale_amount_max = 1.8
	var fade := Gradient.new()
	# 直接指定所有點（add_point 之後點會重新排序，再用 set_color(1) 會改到中間那點）
	fade.offsets = PackedFloat32Array([0.0, 0.3, 1.0])
	fade.colors = PackedColorArray([Color(1, 1, 1, 0), Color(1, 1, 1, 1), Color(1, 1, 1, 0)])
	p.color_ramp = fade
	return p


# 紅葉：跟自走區一樣的小橢圓葉片，從上面飄下來
func _make_petals() -> CPUParticles2D:
	var img := Image.create(14, 8, false, Image.FORMAT_RGBA8)
	for x in 14:
		for y in 8:
			var d := Vector2((x - 6.5) / 7.0, (y - 3.5) / 4.0).length()
			if d < 1.0:
				img.set_pixel(x, y, Color(0.82, 0.08, 0.1, clampf((1.0 - d) * 3.0, 0.0, 1.0)))
	var p := CPUParticles2D.new()
	p.texture = ImageTexture.create_from_image(img)
	p.emitting = false
	p.amount = 22
	p.lifetime = 3.2
	p.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
	p.direction = Vector2(-0.4, 1.0)
	p.spread = 30.0
	p.gravity = Vector2(-10, 60)
	p.initial_velocity_min = 40.0
	p.initial_velocity_max = 120.0
	p.angular_velocity_min = -200.0
	p.angular_velocity_max = 200.0
	p.scale_amount_min = 1.0
	p.scale_amount_max = 1.8
	return p


func _set_title(level: int) -> void:
	var tex: Texture2D = null
	var path := "res://art/ui/title-%s.webp" % TIERS[level][1]
	if ResourceLoader.exists(path):
		tex = Art.tex(path)
	_title.texture = tex
	_title_text.text = "" if tex else TIERS[level][2]


# 升級：換標題、閃白、標題放大彈回、中間噴一波金幣；MEGA 以上開金幣雨
func _upgrade(level: int) -> void:
	_tier = level
	_set_title(level)
	_flash.color.a = 0.65
	create_tween().tween_property(_flash, "color:a", 0.0, 0.35)
	_title.scale = Vector2(1.6, 1.6)
	create_tween().tween_property(_title, "scale", Vector2.ONE, 0.45).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_burst.restart()
	_burst.emitting = true
	if level >= 1:
		_rain.emitting = true
		Sfx.play("mult", 1.0 + level * 0.15)
	upgraded.emit(level)


# 演一次；turbo 時跳分快一點
func play(total: int, tb: int, turbo: bool) -> void:
	_skip = false
	_tier = -1
	visible = true
	modulate.a = 0.0
	_layout()
	_amount.text = Art.money(0)
	create_tween().tween_property(self, "modulate:a", 1.0, 0.2)
	_upgrade(0)
	_title.scale = Vector2(0.2, 0.2)
	create_tween().tween_property(_title, "scale", Vector2.ONE, 0.5).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_plate.scale = Vector2(0.6, 0.6)
	create_tween().tween_property(_plate, "scale", Vector2.ONE, 0.35).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	for p in [_fountain, _sparks, _petals]:
		p.emitting = true
	Sfx.play("big")
	# 金額越大跳越久：每升一級多跳一段
	var top := 0
	for i in TIERS.size():
		if total >= TIERS[i][0] * tb:
			top = i
	var dur := (1.6 if turbo else 2.6) + top * (0.6 if turbo else 1.1)
	var t := 0.0
	var tick := -1
	while t < dur and not _skip:
		await get_tree().process_frame
		t += get_process_delta_time()
		var k := 1.0 - pow(1.0 - minf(t / dur, 1.0), 2.0)
		var shown := total * k
		_amount.text = Art.money(shown)
		for i in range(TIERS.size() - 1, _tier, -1):
			if shown >= TIERS[i][0] * tb:
				_upgrade(i)
				break
		if int(t * 7) != tick:
			tick = int(t * 7)
			Sfx.play("coin", 1.0 + k * 0.5, -9.0)
	if _tier < top:
		_upgrade(top)
	_amount.text = Art.money(total)
	_amount.scale = Vector2(1.3, 1.3)
	create_tween().tween_property(_amount, "scale", Vector2.ONE, 0.3).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	Sfx.play("coin")
	_skip = false
	var hold := 0.0
	while hold < 2.0 and not _skip:
		await get_tree().process_frame
		hold += get_process_delta_time()
	for p in [_fountain, _rain, _sparks, _petals]:
		p.emitting = false
	var tw := create_tween()
	tw.tween_property(self, "modulate:a", 0.0, 0.3)
	await tw.finished
	visible = false
