# 中間的 SLOT：5 軸 × 4 列，外面套一圈細木框（art/ui/frame.webp，開口位置與木框厚度記在 ui.json）。
# 轉輪往下捲（轉得快時符號有動態模糊）、逐軸停輪回彈；中獎格子發光，其餘變暗；
# 已經停了兩個 SCATTER 時（差一個）後面的軸一軸一軸輪流吊胃口：輪到的那軸繼續高速轉、套上竄火的光框（shader），
# 最後才煞車；還在等的軸整條壓暗、已停的軸除了 SCATTER 都壓暗、SCATTER 一跳一跳發光，落定時閃光炸開；
# 連鎖時中獎格子爆開、金框翻成 WILD、上面的往下掉、空位從上方補新符號
extends Control

signal reel_stopped(index: int)
# 吊胃口開始／結束（main 把自走區壓暗）、又落定一個 SCATTER（count = 這一轉目前幾個）
signal tension(on: bool)
signal scatter_landed(count: int)

const Rules := preload("res://scripts/rules.gd")
const Art := preload("res://scripts/art.gd")
const Tile := preload("res://scripts/symbol_tile.gd")

const GAP := 4.0
const PAD := 6.0
# 外框九宮格：四角從開口的角再往邊上多留這麼多（原圖像素），角落的金飾才不會被拉長
const CORNER := 70.0
# 吊胃口：每一軸輪到後獨自轉的秒數（turbo 時短一點；音效 tease 也是這個長度）、這期間的轉速（格／秒）、
# 最後煞車的秒數；停輪回彈的秒數
const TEASE_SLOW := 1.8
const TEASE_SLOW_TURBO := 0.9
const TEASE_SPEED := 18.0
const TEASE_BRAKE := 0.45
const TEASE_BRAKE_TURBO := 0.3
const BOUNCE := 0.16
const TeaseShader := preload("res://scripts/tease.gdshader")
# 光框比轉輪往外多大一圈（左右、上下）
const TEASE_MARGIN := Vector2(28, 13)

var cell := Vector2(70, 73)
var turbo := false
var tiles: Array = []   # 20 格，依列存：tiles[row * COLS + col]

var _reels: Array[Control] = []
var _strips: Array[Control] = []
var _spinning: Array[Tween] = []
var _fx: Node2D
var _rng := RandomNumberGenerator.new()
# 外框畫在哪裡（本地座標，會超出 size）與木框外緣
var frame_rect := Rect2()
var wood_rect := Rect2()
# 外框原圖縮放到畫面上的比例（木框厚度 = 原圖厚度 × 這個比例）
var _frame_scale := 1.0
# 中獎格子的閃光補間：下一段連鎖開始或清除標記時要停掉，不然新的 WILD 會一直亮著
var _mark_tweens: Array[Tween] = []
# 吊胃口：畫在符號上面的這一層（等待中的軸壓暗、光框與火花都放這裡）、正在吊胃口的軸與它的光框、火花，
# SCATTER 一跳一跳的補間、這一轉哪幾軸停好了、落定幾個 SCATTER
var _tease_layer: Node2D
var _tease_c := -1
var _tease_fx: ColorRect
var _tease_sparks: CPUParticles2D
var _tease_tweens: Array[Tween] = []
var _tense := false
var _tease_t := 0.0
var _stopped := [true, true, true, true, true]
var _landed := 0
# 動態模糊：每軸上一幀的位置與目前的模糊量
var _last_y := [0.0, 0.0, 0.0, 0.0, 0.0]
var _blur := [0.0, 0.0, 0.0, 0.0, 0.0]


func _ready() -> void:
	_rng.randomize()
	tiles.resize(Rules.CELLS)
	for c in Rules.COLS:
		var reel := Control.new()
		reel.clip_contents = false
		reel.mouse_filter = Control.MOUSE_FILTER_IGNORE
		add_child(reel)
		_reels.append(reel)
		var strip := Control.new()
		strip.mouse_filter = Control.MOUSE_FILTER_IGNORE
		reel.add_child(strip)
		_strips.append(strip)
	_fx = Node2D.new()
	_fx.z_index = 5
	add_child(_fx)
	# 只比符號高一層：上面的倍數梯（main 裡 z 22）與 Feature Buy 會蓋住光框溢出去的部分
	_tease_layer = Node2D.new()
	_tease_layer.z_index = 1
	_tease_layer.draw.connect(_draw_tease)
	add_child(_tease_layer)


# 依寬度排版（轉輪區、不含外框），回傳高度；border 是畫面上木框的厚度，外框的位置在 frame_rect
func layout(width: float, border: float) -> float:
	cell.x = floorf((width - PAD * 2.0 - GAP * (Rules.COLS - 1)) / Rules.COLS)
	cell.y = roundf(cell.x * 1.04)
	var reel_h := Rules.ROWS * cell.y + (Rules.ROWS - 1) * GAP
	# 格子寬度取整數後多出來的幾個像素平均分到左右，轉輪才會在框裡置中
	var slack := (width - PAD * 2.0 - Rules.COLS * cell.x - GAP * (Rules.COLS - 1)) / 2.0
	for c in Rules.COLS:
		_reels[c].position = Vector2(PAD + slack + c * (cell.x + GAP), PAD)
		_reels[c].size = Vector2(cell.x, reel_h)
	for i in Rules.CELLS:
		if tiles[i]:
			_place(tiles[i], i / Rules.COLS)
	size = Vector2(width, reel_h + PAD * 2.0)
	var meta: Dictionary = Art.ui_meta().frame
	_frame_scale = border / float(meta.wood)
	var s := _frame_scale
	frame_rect = Rect2(-meta.inner[0] * s, -meta.inner[1] * s,
		size.x + (meta.inner[0] + meta.size[0] - meta.inner[2]) * s,
		size.y + (meta.inner[1] + meta.size[1] - meta.inner[3]) * s)
	wood_rect = Rect2(Vector2.ZERO, size).grow(border)
	queue_redraw()
	return size.y


func _step_y() -> float:
	return cell.y + GAP


func _place(tile: Control, row: float) -> void:
	tile.size = cell
	tile.pivot_offset = cell / 2.0
	tile.position = Vector2(0, row * _step_y())


func _make(data: Dictionary) -> Control:
	var t: Control = Tile.new()
	t.setup(data)
	return t


func set_board(board: Array) -> void:
	for c in Rules.COLS:
		for child in _strips[c].get_children():
			child.queue_free()
		_strips[c].position = Vector2.ZERO
		for r in Rules.ROWS:
			var t := _make(board[r * Rules.COLS + c])
			_strips[c].add_child(t)
			_place(t, r)
			tiles[r * Rules.COLS + c] = t


func tile_center(i: int) -> Vector2:
	var c := i % Rules.COLS
	var r := i / Rules.COLS
	return _reels[c].position + Vector2(cell.x / 2.0, r * _step_y() + cell.y / 2.0)


# ---------- 外框 ----------

# 外框用九宮格畫：四角（含金飾）照 _frame_scale 等比縮放，四邊的木頭拉長；中間開口畫深色底
func _draw() -> void:
	var tex := Art.ui("frame")
	var meta: Dictionary = Art.ui_meta().frame
	var w: float = meta.size[0]
	var h: float = meta.size[1]
	var us := [0.0, meta.inner[0] + CORNER, meta.inner[2] - CORNER, w]
	var vs := [0.0, meta.inner[1] + CORNER, meta.inner[3] - CORNER, h]
	var s := _frame_scale
	var o := frame_rect
	var xs := [o.position.x, o.position.x + us[1] * s, o.end.x - (w - us[2]) * s, o.end.x]
	var ys := [o.position.y, o.position.y + vs[1] * s, o.end.y - (h - vs[2]) * s, o.end.y]
	draw_rect(Rect2(Vector2.ZERO, size), Color("05070c"))
	for i in 3:
		for j in 3:
			if i == 1 and j == 1:
				continue
			draw_texture_rect_region(tex, Rect2(xs[i], ys[j], xs[i + 1] - xs[i], ys[j + 1] - ys[j]),
				Rect2(us[i], vs[j], us[i + 1] - us[i], vs[j + 1] - vs[j]))


# ---------- 轉輪 ----------

# 轉到指定盤面；前面已經停了兩個 SCATTER 時，後面的軸輪流吊胃口：
# 前一軸停好（含回彈）才輪到下一軸，輪到的軸再獨自轉 slow 秒才停
func spin(board: Array) -> void:
	_spinning.clear()
	_stop_marks()
	_set_clip(true)
	_landed = 0
	var slow := TEASE_SLOW_TURBO if turbo else TEASE_SLOW
	var scatter_so_far := 0
	var land := 0.0
	var pending := Rules.COLS
	var done := [pending]
	for c in Rules.COLS:
		_stopped[c] = false
		var col := []
		for r in Rules.ROWS:
			col.append(board[r * Rules.COLS + c])
		var teasing := scatter_so_far >= 2
		for d in col:
			if Rules.is_scatter(d.id):
				scatter_so_far += 1
		var stop := land + slow if teasing else (0.34 if turbo else 0.62) + c * (0.08 if turbo else 0.15)
		_spin_reel(c, col, stop, land if teasing else -1.0, done)
		land = stop + BOUNCE
	while done[0] > 0:
		await get_tree().process_frame
	_set_clip(false)
	_end_tension()


# stop 秒時轉到定位（不含一開始往上頓一下與最後的回彈）；tease_from >= 0 是吊胃口的軸：
# 等前面的軸時就用 TEASE_SPEED 等速高速轉，tease_from 秒輪到它、套上光框，最後 brake 秒煞車
func _spin_reel(c: int, col: Array, stop: float, tease_from: float, done: Array) -> void:
	var teasing := tease_from >= 0.0
	var strip := _strips[c]
	var old := []
	for r in Rules.ROWS:
		old.append(tiles[r * Rules.COLS + c])
	var acc := 0.15 if turbo else 0.22
	var brake := TEASE_BRAKE_TURBO if turbo else TEASE_BRAKE
	var fill := 8 + c * 2
	if teasing:
		fill = maxi(fill, ceili(TEASE_SPEED * (stop - (acc + brake) * 0.5)) - Rules.ROWS)
	var step := _step_y()
	# 由上到下：新的 4 格、填充、舊的 4 格；整條往下捲到新的那 4 格
	var fresh := []
	for r in Rules.ROWS:
		var t := _make(col[r])
		strip.add_child(t)
		_place(t, r)
		fresh.append(t)
	var fillers := []
	for k in fill:
		var t := _make({"id": Rules.draw_symbol(c, _rng), "gold": false})
		t.modulate = Color(1, 1, 1, 0.85)
		strip.add_child(t)
		_place(t, Rules.ROWS + k)
		fillers.append(t)
	for r in Rules.ROWS:
		_place(old[r], Rules.ROWS + fill + r)
	strip.position.y = -(Rules.ROWS + fill) * step
	_last_y[c] = strip.position.y
	var top := strip.position.y - step * 0.18
	var end := step * 0.2
	var tw := create_tween()
	_spinning.append(tw)
	tw.tween_property(strip, "position:y", top, 0.09).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	if teasing:
		# 加速（二次曲線結束時的速度剛好接上等速）→ 等速 → 輪到它 → 等速 → 煞車（同樣接得上）
		var v := (end - top) / (stop - (acc + brake) * 0.5)
		var y := top + v * acc * 0.5
		tw.tween_property(strip, "position:y", y, acc).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
		y += v * (tease_from - acc)
		tw.tween_property(strip, "position:y", y, tease_from - acc)
		tw.tween_callback(func(): _tease_on(c))
		tw.tween_property(strip, "position:y", end - v * brake * 0.5, stop - brake - tease_from)
		tw.tween_property(strip, "position:y", end, brake).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	else:
		tw.tween_property(strip, "position:y", end, stop).set_trans(Tween.TRANS_QUART).set_ease(Tween.EASE_IN_OUT)
	tw.tween_property(strip, "position:y", 0.0, BOUNCE).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_callback(func():
		for t in fillers + old:
			t.queue_free()
		strip.position.y = 0
		for r in Rules.ROWS:
			_place(fresh[r], r)
			tiles[r * Rules.COLS + c] = fresh[r]
		Sfx.play("stop", 1.0 + c * 0.04)
		_reel_landed(c, teasing)
		reel_stopped.emit(c)
		done[0] -= 1)


# ---------- SCATTER 差一個：吊胃口 ----------

# 輪到這一軸：套上竄火的光框、兩側冒火星；第一次進來時把自走區壓暗、已停的軸除了 SCATTER 壓暗
func _tease_on(c: int) -> void:
	_tease_c = c
	_tease_t = 0.0
	if not _tense:
		_tense = true
		tension.emit(true)
		for cc in c:
			_spotlight(cc)
	var rr := Rect2(_reels[c].position, _reels[c].size)
	var fx := ColorRect.new()
	fx.mouse_filter = Control.MOUSE_FILTER_IGNORE
	fx.position = rr.position - TEASE_MARGIN
	fx.size = rr.size + TEASE_MARGIN * 2.0
	var mat := ShaderMaterial.new()
	mat.shader = TeaseShader
	mat.set_shader_parameter("rect_size", fx.size)
	mat.set_shader_parameter("margin", TEASE_MARGIN)
	mat.set_shader_parameter("k", 0.0)
	mat.set_shader_parameter("alpha", 0.0)
	mat.set_shader_parameter("flash", 0.0)
	fx.material = mat
	_tease_layer.add_child(fx)
	fx.create_tween().tween_property(mat, "shader_parameter/alpha", 1.0, 0.15)
	_tease_fx = fx
	# 火星：從光框左右兩邊往上飄
	var pts := PackedVector2Array()
	for i in 16:
		var y := rr.position.y + rr.size.y * (i + 0.5) / 16.0
		pts.append(Vector2(rr.position.x - 4.0, y))
		pts.append(Vector2(rr.end.x + 4.0, y))
	var p := CPUParticles2D.new()
	p.amount = 40
	p.lifetime = 0.7
	p.emission_shape = CPUParticles2D.EMISSION_SHAPE_POINTS
	p.emission_points = pts
	p.direction = Vector2.UP
	p.spread = 20.0
	p.gravity = Vector2(0, -160)
	p.initial_velocity_min = 20.0
	p.initial_velocity_max = 80.0
	p.scale_amount_min = 1.5
	p.scale_amount_max = 3.5
	var ramp := Gradient.new()
	ramp.set_color(0, Color(1, 0.95, 0.6, 1))
	ramp.add_point(0.5, Color(1, 0.6, 0.15, 0.9))
	ramp.set_color(1, Color(0.9, 0.15, 0.05, 0))
	p.color_ramp = ramp
	_tease_layer.add_child(p)
	_tease_sparks = p
	_tease_layer.queue_redraw()
	# 嗡鳴往上拉、鼓點越打越密，長度剛好到停輪（turbo 兩倍速播）
	Sfx.play("tease", 2.0 if turbo else 1.0)


# 已經停好的軸：SCATTER 一跳一跳發光，其他壓暗，讓視線集中到還在轉的那一軸
func _spotlight(c: int) -> void:
	for r in Rules.ROWS:
		var t: Control = tiles[r * Rules.COLS + c]
		if Rules.is_scatter(t.id):
			t.dim = false
			var tw := create_tween().set_loops()
			_tease_tweens.append(tw)
			tw.tween_property(t, "scale", Vector2(1.12, 1.12), 0.22).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
			tw.parallel().tween_property(t, "glow", 1.0, 0.22)
			tw.tween_property(t, "scale", Vector2.ONE, 0.28).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN)
			tw.parallel().tween_property(t, "glow", 0.45, 0.28)
		else:
			t.dim = true


# 一軸停好：落定的 SCATTER 彈一下（吊胃口中落定的再加閃光、炸開）；吊胃口中的軸光框閃一下（中了閃得更亮）後淡掉、火花收掉
func _reel_landed(c: int, teased: bool) -> void:
	_stopped[c] = true
	var hit := false
	for r in Rules.ROWS:
		var i := r * Rules.COLS + c
		var t: Control = tiles[i]
		if not Rules.is_scatter(t.id):
			continue
		hit = true
		_landed += 1
		var big := teased or _landed >= 3
		t.scale = Vector2(1.45, 1.45) if big else Vector2(1.2, 1.2)
		create_tween().tween_property(t, "scale", Vector2.ONE, 0.35 if big else 0.22).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
		Sfx.play("scatter", 1.0 + (_landed - 1) * 0.12, 0.0 if big else -5.0)
		if big:
			_burst(tile_center(i), Art.GOLD)
			_sparkle(tile_center(i))
			_flash(i)
		scatter_landed.emit(_landed)
	if teased:
		_tease_c = -1
		if _tease_fx:
			var fx := _tease_fx
			var tw := fx.create_tween()
			tw.tween_property(fx.material, "shader_parameter/flash", 2.0 if hit else 0.6, 0.05)
			tw.tween_property(fx.material, "shader_parameter/alpha", 0.0, 0.35 if hit else 0.2)
			tw.tween_callback(fx.queue_free)
			_tease_fx = null
		if _tease_sparks:
			var p := _tease_sparks
			p.emitting = false
			get_tree().create_timer(0.8).timeout.connect(p.queue_free)
			_tease_sparks = null
	if _tense:
		_spotlight(c)
	_tease_layer.queue_redraw()


# 格子上閃一下白光
func _flash(i: int) -> void:
	var c := tile_center(i)
	var rect := Rect2(c - cell / 2.0, cell)
	var f := Node2D.new()
	f.set_meta("a", 0.9)
	f.draw.connect(func(): f.draw_rect(rect.grow(4), Color(1, 0.96, 0.8, f.get_meta("a"))))
	_fx.add_child(f)
	var tw := f.create_tween()
	tw.tween_method(func(v: float):
		f.set_meta("a", v)
		f.queue_redraw(), 0.9, 0.0, 0.35)
	tw.tween_callback(f.queue_free)


# 整轉結束：收掉吊胃口的效果，格子恢復原樣
func _end_tension() -> void:
	for tw in _tease_tweens:
		if tw.is_valid():
			tw.kill()
	_tease_tweens.clear()
	_tease_c = -1
	_tease_layer.queue_redraw()
	if _tense:
		_tense = false
		for t in tiles:
			if t and is_instance_valid(t):
				t.dim = false
				t.glow = 0.0
				t.scale = Vector2.ONE
		tension.emit(false)


func _process(delta: float) -> void:
	_update_blur(delta)
	if _tease_c < 0 or not _tease_fx:
		return
	_tease_t += delta
	var k := minf(_tease_t / (TEASE_SLOW_TURBO if turbo else TEASE_SLOW), 1.0)
	(_tease_fx.material as ShaderMaterial).set_shader_parameter("k", k)


# 動態模糊：照每軸這一幀移動的距離換算模糊長度（慢的回彈、停著時是 0），有變才通知格子重畫
func _update_blur(delta: float) -> void:
	if delta <= 0.0:
		return
	for c in Rules.COLS:
		var y := _strips[c].position.y
		var v := absf(y - _last_y[c]) / delta
		_last_y[c] = y
		var b := clampf((v - 400.0) * 0.012, 0.0, cell.y * 0.3)
		if absf(b - _blur[c]) < 0.5 and (b > 0.0) == (_blur[c] > 0.0):
			continue
		_blur[c] = b
		for t in _strips[c].get_children():
			t.blur = b


# 吊胃口時還在等的軸（還在轉、還沒輪到）整條壓暗；光框本身是 _tease_fx 的 shader
func _draw_tease() -> void:
	if not _tense:
		return
	for c in Rules.COLS:
		if _stopped[c] or c == _tease_c:
			continue
		_tease_layer.draw_rect(Rect2(_reels[c].position, _reels[c].size).grow(2), Color(0.01, 0.01, 0.03, 0.62))


# 轉動中再按一次：全部直接停
func quick_stop() -> void:
	for tw in _spinning:
		if tw.is_valid() and tw.is_running():
			tw.custom_step(100.0)


# ---------- 中獎與連鎖 ----------

# 轉輪只有在捲動、掉落時才裁切；平常不裁，中獎的光暈與放大才不會被切掉
func _set_clip(on: bool) -> void:
	for reel in _reels:
		reel.clip_contents = on


func _stop_marks() -> void:
	for tw in _mark_tweens:
		if tw.is_valid():
			tw.kill()
	_mark_tweens.clear()
	for t in tiles:
		if t and is_instance_valid(t):
			t.scale = Vector2.ONE


func clear_marks() -> void:
	_stop_marks()
	for t in tiles:
		if t:
			t.glow = 0.0
			t.dim = false


func mark(cells: Array) -> void:
	var on := {}
	for i in cells:
		on[i] = true
	for i in Rules.CELLS:
		var t: Control = tiles[i]
		t.dim = not on.has(i)
		if on.has(i):
			var tw := create_tween().set_loops(2)
			_mark_tweens.append(tw)
			tw.tween_property(t, "glow", 1.0, 0.16)
			tw.parallel().tween_property(t, "scale", Vector2(1.1, 1.1), 0.16).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
			tw.tween_property(t, "scale", Vector2.ONE, 0.16)
			tw.tween_property(t, "glow", 0.7, 0.1)


# 一段連鎖的消除與補位；k 是第幾段（音高跟著升）
func cascade(step: Dictionary, k: int) -> void:
	var speed := 0.6 if turbo else 1.0
	_stop_marks()
	_set_clip(true)
	# 1. 爆開
	for i in step.removed:
		var t: Control = tiles[i]
		_burst(tile_center(i), Art.SYMBOL_COLORS.get(t.id, Art.GOLD))
		var tw := create_tween()
		tw.tween_property(t, "scale", Vector2(1.28, 1.28), 0.09 * speed).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
		tw.tween_property(t, "scale", Vector2(0.1, 0.1), 0.14 * speed).set_ease(Tween.EASE_IN)
		tw.parallel().tween_property(t, "modulate:a", 0.0, 0.14 * speed)
	if not step.removed.is_empty():
		Sfx.play("pop", 1.0 + k * 0.12)
	# 2. 金框翻成 WILD
	for i in step.to_wild:
		var t: Control = tiles[i]
		var tw := create_tween()
		tw.tween_property(t, "scale:x", 0.0, 0.12 * speed).set_ease(Tween.EASE_IN)
		tw.tween_callback(func():
			t.setup({"id": "hood", "gold": false})
			t.dim = false
			_sparkle(tile_center(i)))
		tw.tween_property(t, "scale:x", 1.0, 0.18 * speed).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	if not step.to_wild.is_empty():
		Sfx.play("wild")
	await get_tree().create_timer(0.3 * speed).timeout
	# 3. 往下掉、補新符號（照 Rules.resolve 同樣的順序：每軸由下往上收集留下來的格子）
	var removed := {}
	for i in step.removed:
		removed[i] = true
		tiles[i].queue_free()
	var next_tiles := []
	next_tiles.resize(Rules.CELLS)
	var fall := 0.0
	for c in Rules.COLS:
		var keep := []
		for r in range(Rules.ROWS - 1, -1, -1):
			var i := r * Rules.COLS + c
			if not removed.has(i):
				keep.append({"tile": tiles[i], "from": r})
		var added: Array = step.added.filter(func(a): return a.col == c)
		var n := 0
		for r in range(Rules.ROWS - 1, -1, -1):
			var i := r * Rules.COLS + c
			var t: Control
			var from := float(r)
			if n < keep.size():
				t = keep[n].tile
				from = keep[n].from
			else:
				var data: Dictionary = step.next[i]
				t = _make(data)
				_strips[c].add_child(t)
				from = r - added.size() - 0.6
				_place(t, from)
			t.dim = false
			t.glow = 0.0
			next_tiles[i] = t
			if from != r:
				var d := (0.22 + (r - from) * 0.05) * speed
				fall = maxf(fall, d + c * 0.03)
				var tw := create_tween()
				tw.tween_interval(c * 0.03 * speed)
				tw.tween_property(t, "position:y", r * _step_y(), d).set_trans(Tween.TRANS_BOUNCE).set_ease(Tween.EASE_OUT)
			n += 1
	tiles = next_tiles
	if fall > 0.0:
		get_tree().create_timer(fall * 0.55).timeout.connect(func(): Sfx.play("drop"))
	await get_tree().create_timer(fall + 0.05).timeout
	# 掉落途中畫面縮放過的話，補間會把格子帶回舊的位置；結束時全部對齊一次
	for i in Rules.CELLS:
		if tiles[i]:
			tiles[i].glow = 0.0
			_place(tiles[i], i / Rules.COLS)
	_set_clip(false)


# 碎片：符號的顏色加白、金色
func _burst(at: Vector2, color: Color) -> void:
	var p := CPUParticles2D.new()
	p.position = at
	p.one_shot = true
	p.explosiveness = 1.0
	p.amount = 22
	p.lifetime = 0.75
	p.direction = Vector2.UP
	p.spread = 180.0
	p.initial_velocity_min = 110.0
	p.initial_velocity_max = 260.0
	p.gravity = Vector2(0, 640)
	p.angular_velocity_min = -540.0
	p.angular_velocity_max = 540.0
	p.scale_amount_min = 3.0
	p.scale_amount_max = 6.5
	var g := Gradient.new()
	g.set_color(0, Color.WHITE)
	g.set_color(1, Color(1, 1, 1, 0))
	p.color_ramp = g
	var colors := Gradient.new()
	colors.set_color(0, color)
	colors.set_color(1, Art.GOLD)
	colors.add_point(0.5, Color.WHITE)
	p.color_initial_ramp = colors
	_fx.add_child(p)
	p.emitting = true
	p.finished.connect(p.queue_free)


func _sparkle(at: Vector2) -> void:
	var p := CPUParticles2D.new()
	p.position = at
	p.one_shot = true
	p.explosiveness = 0.9
	p.amount = 16
	p.lifetime = 0.6
	p.spread = 180.0
	p.initial_velocity_min = 40.0
	p.initial_velocity_max = 140.0
	p.gravity = Vector2.ZERO
	p.scale_amount_min = 2.0
	p.scale_amount_max = 4.0
	p.color = Art.GOLD
	_fx.add_child(p)
	p.emitting = true
	p.finished.connect(p.queue_free)


func scatter_glow(cells: Array) -> void:
	for i in cells:
		var t: Control = tiles[i]
		t.dim = false
		var tw := create_tween().set_loops(3)
		_mark_tweens.append(tw)
		tw.tween_property(t, "glow", 1.0, 0.18)
		tw.parallel().tween_property(t, "scale", Vector2(1.15, 1.15), 0.18)
		tw.tween_property(t, "scale", Vector2.ONE, 0.18)
