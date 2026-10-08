# 中間的 SLOT：5 軸 × 4 列，外面套一圈荊棘木框（art/ui/frame.webp，開口位置記在 ui.json）。
# 轉輪往下捲、逐軸停輪回彈；中獎格子發光，其餘變暗；
# 連鎖時中獎格子爆開、金框翻成 WILD、上面的往下掉、空位從上方補新符號
extends Control

signal reel_stopped(index: int)

const Rules := preload("res://scripts/rules.gd")
const Art := preload("res://scripts/art.gd")
const Tile := preload("res://scripts/symbol_tile.gd")

const GAP := 4.0
const PAD := 6.0

var cell := Vector2(70, 73)
var turbo := false
var tiles: Array = []   # 20 格，依列存：tiles[row * COLS + col]
var tease := [false, false, false, false, false]

var _reels: Array[Control] = []
var _strips: Array[Control] = []
var _spinning: Array[Tween] = []
var _fx: Node2D
var _rng := RandomNumberGenerator.new()
# 外框畫在哪裡（本地座標，會超出 size）：top／bottom 兩段照比例，中段直向拉長補足 4 列的高度
var frame_rect := Rect2()
# 木框外緣（不含伸出去的藤蔓）與頂端紅寶石的位置
var wood_rect := Rect2()
var gem_point := Vector2.ZERO
var _frame_scale := 1.0
# 中獎格子的閃光補間：下一段連鎖開始或清除標記時要停掉，不然新的 WILD 會一直亮著
var _mark_tweens: Array[Tween] = []


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


# 依寬度排版（轉輪區、不含外框），回傳高度；外框的位置在 frame_rect
func layout(width: float) -> float:
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
	var inner := Rect2(meta.inner[0], meta.inner[1], meta.inner[2] - meta.inner[0], meta.inner[3] - meta.inner[1])
	_frame_scale = size.x / inner.size.x
	var s := _frame_scale
	frame_rect = Rect2(-inner.position.x * s, -inner.position.y * s, meta.size[0] * s,
		size.y + (inner.position.y + meta.size[1] - inner.end.y) * s)
	wood_rect = Rect2(Vector2.ZERO, size).grow(meta.wood * s)
	gem_point = frame_rect.position + Vector2(meta.gem[0], meta.gem[1]) * s
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

# 外框分三段畫：上段（含頂端花飾）與下段照比例縮放，中段直向拉長，花紋只在側邊的直藤上變長一點
func _draw() -> void:
	var tex := Art.ui("frame")
	var meta: Dictionary = Art.ui_meta().frame
	var w: float = meta.size[0]
	var h: float = meta.size[1]
	var band := 110.0
	var top_src := Rect2(0, 0, w, meta.inner[1] + band)
	var bot_src := Rect2(0, meta.inner[3] - band, w, h - meta.inner[3] + band)
	var mid_src := Rect2(0, top_src.end.y, w, bot_src.position.y - top_src.end.y)
	var s := _frame_scale
	var top := Rect2(frame_rect.position, top_src.size * s)
	var bot := Rect2(Vector2(frame_rect.position.x, frame_rect.end.y - bot_src.size.y * s), bot_src.size * s)
	var mid := Rect2(Vector2(frame_rect.position.x, top.end.y), Vector2(frame_rect.size.x, bot.position.y - top.end.y))
	draw_texture_rect_region(tex, top, top_src)
	draw_texture_rect_region(tex, mid, mid_src)
	draw_texture_rect_region(tex, bot, bot_src)
	for c in Rules.COLS:
		if tease[c]:
			var rr := Rect2(_reels[c].position, _reels[c].size).grow(3)
			var sb := Art.box(Color.TRANSPARENT, 10, 3, Color("ff6a50"))
			sb.draw_center = false
			sb.shadow_color = Color(1, 0.5, 0.2, 0.8)
			sb.shadow_size = 14
			draw_style_box(sb, rr)


# ---------- 轉輪 ----------

# 轉到指定盤面；前面已經停了兩個 BONUS 時後面的軸轉久一點、亮框
func spin(board: Array) -> void:
	_spinning.clear()
	_stop_marks()
	_set_clip(true)
	var scatter_so_far := 0
	var extra := 0.0
	var pending := Rules.COLS
	var done := [pending]
	for c in Rules.COLS:
		var col := []
		for r in Rules.ROWS:
			col.append(board[r * Rules.COLS + c])
		var teasing := scatter_so_far >= 2
		if teasing:
			extra += 0.55 if turbo else 1.0
		for d in col:
			if Rules.is_scatter(d.id):
				scatter_so_far += 1
		var dur := (0.34 if turbo else 0.62) + c * (0.08 if turbo else 0.15) + extra
		_spin_reel(c, col, dur, teasing, done)
	while done[0] > 0:
		await get_tree().process_frame
	_set_clip(false)


func _spin_reel(c: int, col: Array, dur: float, teasing: bool, done: Array) -> void:
	var strip := _strips[c]
	var old := []
	for r in Rules.ROWS:
		old.append(tiles[r * Rules.COLS + c])
	var fill := 8 + c * 2 + (12 if teasing else 0)
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
	var tw := create_tween()
	_spinning.append(tw)
	tw.tween_property(strip, "position:y", -(Rules.ROWS + fill) * step - step * 0.18, 0.09).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	tw.tween_property(strip, "position:y", step * 0.2, dur).set_trans(Tween.TRANS_QUART).set_ease(Tween.EASE_IN_OUT)
	if teasing:
		tw.parallel().tween_callback(func():
			tease[c] = true
			queue_redraw()
			Sfx.play("tease")).set_delay(maxf(0.0, dur - (0.55 if turbo else 1.0) - 0.1))
	tw.tween_property(strip, "position:y", 0.0, 0.16).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_callback(func():
		for t in fillers + old:
			t.queue_free()
		strip.position.y = 0
		for r in Rules.ROWS:
			_place(fresh[r], r)
			tiles[r * Rules.COLS + c] = fresh[r]
		tease[c] = false
		queue_redraw()
		Sfx.play("stop", 1.0 + c * 0.04)
		reel_stopped.emit(c)
		done[0] -= 1)


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
