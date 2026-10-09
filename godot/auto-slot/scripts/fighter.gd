# 自走區的角色（繪本風立繪）：一張圖一個姿勢，動作用程式做——
# 跑步上下彈（著地壓扁、騰空拉長）、站著呼吸、揮砍時往前衝、倒下時從邊緣燒成灰（溶解 shader）；
# 被打：閃紅、往後仰、壓扁再彈回、往後退，有受擊立繪（hurt）的換成受擊姿勢，重擊頭上轉一圈金星；
# 連段招式用的零件：轉身（turn 從 1 翻到 -1 再翻回來）、前傾（tilt）、殘影（ghost）、換面向（face）、落地壓扁（land）、伸展（stretch）；
# 劍上的火（flame，SCATTER 落下時點燃）：劍身一道橘光、沿著劍身冒火焰與火星（火焰留在原地往上飄，衝刺時會拖出一道火尾），
# 全身外圍泛出火光（glow，fighter_glow.gdshader）；點燃那一下 flare 讓光再亮一點
extends Node2D

# 跑步時每一步腳著地（field 在腳後揚起一小團塵土）
signal stepped

const SHADER := preload("res://scripts/fighter.gdshader")
const GLOW_SHADER := preload("res://scripts/fighter_glow.gdshader")

var poses := {}            # 名稱 → Texture2D
var pose := ""
# 各姿勢的身高倍率（縮成身子的跳躍姿勢等）；沒寫的是 1
var pose_k := {}
# 算身高上限時只看這幾個姿勢（空的就全部看）：特殊姿勢比較寬，不該讓角色整個縮小
var sizing: Array = []
# 跑步／走路的連續格：走路中、目前姿勢是其中一格時，每秒 run_fps 格輪流播（第 1、3 格著地、第 2、4 格換腳）
var run_frames: Array = []
var run_fps := 8.0
var walking := false
var height := 200.0        # 畫面上的身高（像素），腳底在原點
var facing := 1.0          # 1 面向右、-1 面向左（圖本來的方向由 flip_source 決定）
var flip_source := false
var base_tint := Color.WHITE
var aura := 0.0             # 身後一圈光：狼王是暗紅色，小紅帽存著傷害時是金色
var aura_color := Color(0.8, 0.05, 0.05)
# 動作都疊在圖上（不動節點位置），畫面縮放時節點直接放回原位就好
var kick_x := 0.0           # 被打往後退
var hop_y := 0.0            # 跳一下
var fade := 1.0             # 燒成灰時影子與光暈一起淡掉
var turn := 1.0             # 水平縮放：1 → -1 → 1 看起來像原地轉一圈
var tilt := 0.0             # 以腳底為軸前傾（衝刺時）
var recoil := 0.0           # 被打往後仰（以腳底為軸）
var squash := Vector2.ONE   # 壓扁／拉長（以腳底為準，寬高反向變）
var dizzy := 0.0            # 頭上轉圈的金星還剩幾秒
# 劍的位置：姿勢 → [護手, 劍尖]（以圖的寬高為 1 的座標），沒有的姿勢不冒火
var blades := {}
var flame := 0.0            # 劍上的火（0～1）
var glow := 0.0             # 全身的火光（0～1）
var flare := 0.0            # 點燃那一下多亮的光

var _sprite: Sprite2D
var _mat: ShaderMaterial
var _t := 0.0
var _s := 1.0
var _base_x := 0.0
var _move: Tween
var _lift := 0.0
var _breath := 0.0
var _rot := 0.0
var _run_sq := 1.0
var _step := 0
var _hurt_until := -1.0
var _rest_pose := ""
var _sq: Tween
var _halo: Node2D
var _halo_mat: ShaderMaterial
var _blade_fx: Node2D
var _fire: CPUParticles2D
var _embers: CPUParticles2D
static var _soft: GradientTexture2D


func _init(textures: Dictionary, first: String) -> void:
	poses = textures
	pose = first


func _ready() -> void:
	# 火光畫在角色後面
	_halo = Node2D.new()
	_halo_mat = ShaderMaterial.new()
	_halo_mat.shader = GLOW_SHADER
	_halo.material = _halo_mat
	_halo.visible = false
	_halo.draw.connect(_draw_halo)
	add_child(_halo)
	_sprite = Sprite2D.new()
	_sprite.centered = false
	_mat = ShaderMaterial.new()
	_mat.shader = SHADER
	_sprite.material = _mat
	add_child(_sprite)
	_blade_fx = Node2D.new()
	_blade_fx.material = _additive()
	_blade_fx.draw.connect(_draw_blade)
	add_child(_blade_fx)
	_fire = _make_fire()
	add_child(_fire)
	_embers = _make_embers()
	add_child(_embers)
	set_pose(pose)
	_t = randf() * 10.0


func set_pose(name: String) -> void:
	pose = name
	if not _sprite:
		return
	var tex: Texture2D = poses[name]
	_sprite.texture = tex
	_fit()


# 主要姿勢裡最寬的寬高比：用來依寬度限制身高，換姿勢時大小才不會跳
func widest() -> float:
	var k := 1.0
	for name in poses:
		if sizing.is_empty() or name in sizing:
			var t: Texture2D = poses[name]
			k = maxf(k, float(t.get_width()) / t.get_height())
	return k


func set_height(h: float) -> void:
	height = h
	_fit()


# 圖的腳底中心對到原點；高度依 height 縮放
func _fit() -> void:
	if not _sprite or not _sprite.texture:
		return
	var tex := _sprite.texture
	_s = height * float(pose_k.get(pose, 1.0)) / tex.get_height()
	var flip := (facing < 0.0) != flip_source
	_sprite.scale = Vector2(-_s if flip else _s, _s)
	_base_x = tex.get_width() * _s * (0.5 if flip else -0.5)
	_sprite.position = Vector2(_base_x + kick_x, -tex.get_height() * _s)
	queue_redraw()


func _process(delta: float) -> void:
	_t += delta
	if walking:
		# 跑步：一步一彈、身體微微前後擺；腳一著地壓扁、騰空時拉長，每一步著地發一次 stepped。
		# 有連續格的話照格播（格子本身就有腳步，彈得小一點）；只有一張圖時用正弦波彈
		var step: float
		if not run_frames.is_empty() and running_pose():
			var phase := fposmod(_t * run_fps, float(run_frames.size()))
			var want: String = run_frames[int(phase)]
			if want != pose:
				set_pose(want)
				if int(phase) % 2 == 0:
					stepped.emit()
			step = sin(PI * fposmod(phase, 2.0) / 2.0)
			_lift = step * height * 0.025
			_rot = sin(PI * phase) * 0.02
		else:
			step = absf(sin(_t * 9.0))
			_lift = step * height * 0.045
			_rot = sin(_t * 9.0) * 0.03
			var n := int(floorf(_t * 9.0 / PI))
			if n != _step:
				_step = n
				stepped.emit()
		_run_sq = 1.0 + (step - 0.35) * 0.08
		_breath = 0.0
	else:
		_lift = move_toward(_lift, 0.0, delta * 60.0)
		_rot = move_toward(_rot, 0.0, delta)
		_run_sq = move_toward(_run_sq, 1.0, delta)
		_breath = sin(_t * 2.4) * 0.012
	if pose == "hurt" and _t > _hurt_until:
		set_pose(_rest_pose)
	dizzy = maxf(0.0, dizzy - delta)
	rotation = _rot + tilt + recoil
	_apply()
	_update_fire()
	queue_redraw()


func _apply() -> void:
	if _sprite and _sprite.texture:
		var sq := squash * Vector2(1.0 / _run_sq, _run_sq)
		var sy := _s * (1.0 + _breath) * sq.y
		var flip := (facing < 0.0) != flip_source
		_sprite.scale = Vector2((-_s if flip else _s) * turn * sq.x, sy)
		_sprite.position = Vector2(_base_x * turn * sq.x + kick_x, -_sprite.texture.get_height() * sy - _lift - hop_y)


# 腳下的影子（有光暈的話身後再加一圈光）
func _draw() -> void:
	if aura > 0.0:
		for k in 6:
			draw_circle(Vector2(0, -height * 0.5), height * (0.62 - k * 0.07), Color(aura_color, 0.06 * aura * fade))
	var w := height * 0.36
	for k in 4:
		var f := 1.0 - k * 0.22
		draw_set_transform(Vector2(0, 0), 0.0, Vector2(1.0, 0.22))
		draw_circle(Vector2.ZERO, w * f * (1.0 - (_lift + hop_y) / (height * 0.2)), Color(0, 0, 0, 0.16 * fade))
	draw_set_transform(Vector2.ZERO)
	if dizzy > 0.0:
		_draw_stars()


# 被重擊時頭上轉一圈小金星（橢圓軌道，後面那半圈小一點、暗一點）
func _draw_stars() -> void:
	var a := clampf(dizzy / 0.25, 0.0, 1.0) * fade
	var head := Vector2(facing * height * 0.14, -height * 1.0 - hop_y)
	for i in 3:
		var ang := _t * 7.0 + TAU * i / 3.0
		var p := head + Vector2(cos(ang) * height * 0.16, sin(ang) * height * 0.04)
		var r := height * (0.035 + 0.012 * sin(ang))
		var pts := PackedVector2Array()
		for k in 10:
			var rr := r if k % 2 == 0 else r * 0.45
			var t := -PI / 2.0 + PI * k / 5.0 + _t * 3.0
			pts.append(p + Vector2(cos(t), sin(t)) * rr)
		draw_colored_polygon(pts, Color(1.0, 0.86, 0.3, a * (0.75 + 0.25 * sin(ang))))


# 目前是不是跑步／走路的姿勢（單張的 run 或連續格的其中一格）
func running_pose() -> bool:
	return pose == "run" or pose in run_frames


# 換面向（1 向右、-1 向左）
func face(dir: float) -> void:
	facing = dir
	_fit()


# 殘影：照現在的樣子複製一張圖（疊加混色、染色），留在原地淡掉；衝刺、連段時用
func ghost(color: Color, life := 0.3) -> void:
	if not _sprite or not _sprite.texture or not get_parent():
		return
	var g := Sprite2D.new()
	g.texture = _sprite.texture
	g.centered = false
	g.transform = transform * _sprite.transform
	g.modulate = color
	var m := CanvasItemMaterial.new()
	m.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	g.material = m
	get_parent().add_child(g)
	get_parent().move_child(g, get_index())
	var tw := g.create_tween()
	tw.tween_property(g, "modulate:a", 0.0, life)
	tw.tween_callback(g.queue_free)


# 被打：閃紅（越重閃越紅，連段的小刀只閃一點）、往後仰再彈回、壓扁再彈回、往後退一點再回來；
# 有受擊立繪的換成受擊姿勢（連續被打就一直維持，最後一下過了一段時間才換回來）；重擊（strength ≥ 1）頭上轉金星
func hurt(strength := 1.0) -> void:
	var f := clampf(strength * 0.7, 0.25, 1.0)
	_mat.set_shader_parameter("flash", f)
	var tw := create_tween()
	tw.tween_method(func(v: float): _mat.set_shader_parameter("flash", v), f, 0.0, 0.3)
	if poses.has("hurt"):
		if pose != "hurt":
			_rest_pose = pose
			set_pose("hurt")
		_hurt_until = maxf(_hurt_until, _t + clampf(0.14 + 0.2 * strength, 0.18, 0.5))
	if strength >= 1.0:
		dizzy = maxf(dizzy, 0.5 + 0.3 * strength)
	var back := clampf(0.07 + 0.08 * strength, 0.08, 0.22)
	var rt := create_tween()
	rt.tween_property(self, "recoil", -facing * back, 0.05)
	rt.tween_property(self, "recoil", 0.0, 0.32).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)
	bump(Vector2(1.0 + 0.06 * strength, 1.0 - 0.07 * strength), 0.05, 0.3)
	_restart_move()
	_move.tween_property(self, "kick_x", facing * -height * 0.08 * strength, 0.06)
	_move.tween_property(self, "kick_x", 0.0, 0.22).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)


# 壓扁／拉長一下再彈回原樣（to：寬高倍率；hold：變形花多久；back：彈回花多久）
func bump(to: Vector2, hold := 0.06, back := 0.25) -> void:
	if _sq:
		_sq.kill()
	_sq = create_tween()
	_sq.tween_property(self, "squash", to, hold).set_ease(Tween.EASE_OUT)
	_sq.tween_property(self, "squash", Vector2.ONE, back).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)


# 落地：壓扁一下（越重壓越扁）
func land(strength := 1.0) -> void:
	bump(Vector2(1.0 + 0.1 * strength, 1.0 - 0.12 * strength), 0.04, 0.28)


# 小跳一下（升級、打倒敵人）
func cheer() -> void:
	_restart_move()
	_move.tween_property(self, "hop_y", height * 0.12, 0.16).set_ease(Tween.EASE_OUT)
	_move.tween_property(self, "hop_y", 0.0, 0.2).set_trans(Tween.TRANS_BOUNCE).set_ease(Tween.EASE_OUT)


# 退後與小跳共用一條補間：新的動作開始時先把舊的停掉、歸零
func _restart_move() -> void:
	if _move:
		_move.kill()
	kick_x = 0.0
	hop_y = 0.0
	_move = create_tween()


# 從邊緣燒成灰
func dissolve(duration := 0.9) -> void:
	set_process(false)
	var tw := create_tween()
	tw.tween_method(func(v: float):
		_mat.set_shader_parameter("dissolve", v)
		fade = clampf(1.0 - v * 1.3, 0.0, 1.0)
		queue_redraw(), 0.0, 1.0, duration).set_ease(Tween.EASE_IN)
	await tw.finished


func tint(c: Color) -> void:
	base_tint = c
	_mat.set_shader_parameter("tint", c)


func sprite_rect() -> Rect2:
	var sz := _sprite.texture.get_size() * _s
	return Rect2(position + Vector2(-sz.x / 2.0, -sz.y), sz)


# ---------- 劍上的火、全身的火光 ----------

static func _additive() -> CanvasItemMaterial:
	var m := CanvasItemMaterial.new()
	m.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	return m


# 火焰、火星用的柔邊圓點
static func _soft_dot() -> GradientTexture2D:
	if not _soft:
		var g := Gradient.new()
		g.offsets = PackedFloat32Array([0.0, 0.35, 1.0])
		g.colors = PackedColorArray([Color(1, 1, 1, 1), Color(1, 1, 1, 0.55), Color(1, 1, 1, 0)])
		_soft = GradientTexture2D.new()
		_soft.gradient = g
		_soft.fill = GradientTexture2D.FILL_RADIAL
		_soft.fill_from = Vector2(0.5, 0.5)
		_soft.fill_to = Vector2(1.0, 0.5)
		_soft.width = 64
		_soft.height = 64
	return _soft


# 火焰：沿著劍身冒出來、往上竄，由白黃、橘到暗紅淡掉；不跟著角色動（衝刺時拖出火尾）
func _make_fire() -> CPUParticles2D:
	var p := CPUParticles2D.new()
	p.emitting = false
	p.amount = 64
	p.lifetime = 0.5
	p.local_coords = false
	p.texture = _soft_dot()
	p.material = _additive()
	p.emission_shape = CPUParticles2D.EMISSION_SHAPE_POINTS
	p.direction = Vector2(0, -1)
	p.spread = 25.0
	p.gravity = Vector2(0, -240)
	p.initial_velocity_min = 10.0
	p.initial_velocity_max = 45.0
	p.damping_min = 10.0
	p.damping_max = 30.0
	var curve := Curve.new()
	curve.add_point(Vector2(0.0, 0.7))
	curve.add_point(Vector2(0.25, 1.0))
	curve.add_point(Vector2(1.0, 0.15))
	p.scale_amount_curve = curve
	var ramp := Gradient.new()
	ramp.offsets = PackedFloat32Array([0.0, 0.25, 0.6, 1.0])
	ramp.colors = PackedColorArray([Color(1, 0.95, 0.7, 0.95), Color(1, 0.62, 0.16, 0.85), Color(0.9, 0.2, 0.05, 0.5), Color(0.35, 0.03, 0.02, 0)])
	p.color_ramp = ramp
	return p


# 火星：少少幾顆亮點，飄得比較高、比較久
func _make_embers() -> CPUParticles2D:
	var p := CPUParticles2D.new()
	p.emitting = false
	p.amount = 14
	p.lifetime = 1.1
	p.local_coords = false
	p.texture = _soft_dot()
	p.material = _additive()
	p.emission_shape = CPUParticles2D.EMISSION_SHAPE_POINTS
	p.direction = Vector2(0, -1)
	p.spread = 40.0
	p.gravity = Vector2(0, -60)
	p.initial_velocity_min = 30.0
	p.initial_velocity_max = 80.0
	var ramp := Gradient.new()
	ramp.offsets = PackedFloat32Array([0.0, 0.5, 1.0])
	ramp.colors = PackedColorArray([Color(1, 0.95, 0.6, 1), Color(1, 0.55, 0.12, 0.9), Color(1, 0.3, 0.05, 0)])
	p.color_ramp = ramp
	return p


# 劍身在角色節點座標裡的兩端（護手、劍尖）；這個姿勢沒有劍就回傳空的
func _blade_points() -> Array:
	if not blades.has(pose) or not _sprite or not _sprite.texture:
		return []
	var sz := _sprite.texture.get_size()
	return [_sprite.position + blades[pose][0] * sz * _sprite.scale, _sprite.position + blades[pose][1] * sz * _sprite.scale]


func _update_fire() -> void:
	var on := flame > 0.01
	var bp := _blade_points() if on else []
	var burning := on and not bp.is_empty()
	if burning:
		var pts := PackedVector2Array()
		for i in 10:
			pts.append(bp[0].lerp(bp[1], 0.1 + 0.9 * i / 9.0))
		_fire.emission_points = pts
		_embers.emission_points = pts
		var k := height / 200.0 * (0.55 + 0.45 * flame)
		_fire.scale_amount_min = 0.17 * k
		_fire.scale_amount_max = 0.36 * k
		_fire.initial_velocity_max = 45.0 * k
		_embers.scale_amount_min = 0.04 * k
		_embers.scale_amount_max = 0.08 * k
		_fire.modulate.a = clampf(flame * 1.3, 0.0, 1.0)
	if _fire.emitting != burning:
		_fire.emitting = burning
	var sparks := burning and flame > 0.6
	if _embers.emitting != sparks:
		_embers.emitting = sparks
	_blade_fx.visible = burning
	if burning:
		_blade_fx.queue_redraw()
	var g := glow * (0.8 + 0.2 * sin(_t * 5.0)) + flare * 0.6
	_halo.visible = g > 0.01 and _sprite.texture != null
	if _halo.visible:
		_halo.position = _sprite.position
		_halo.scale = _sprite.scale
		_halo_mat.set_shader_parameter("strength", g * fade)
		_halo.queue_redraw()


# 劍身的光：幾層越來越細、越來越亮的橘線，最裡面一條淡黃（疊加混色）
func _draw_blade() -> void:
	var bp := _blade_points()
	if bp.is_empty():
		return
	var f := (flame * (0.85 + 0.15 * sin(_t * 23.0)) + flare) * fade
	var w := height * 0.02
	for k in 4:
		_blade_fx.draw_line(bp[0], bp[1], Color(1.0, 0.42, 0.08, 0.1 * f), w * (5.0 - k) * 1.4, true)
	_blade_fx.draw_line(bp[0].lerp(bp[1], 0.04), bp[1], Color(1.0, 0.82, 0.48, 0.55 * f), w * 0.8, true)


# 火光：比圖大一圈的方塊畫同一張圖，shader 取周圍的不透明度暈開
func _draw_halo() -> void:
	var tex := _sprite.texture
	var sz := tex.get_size()
	var pad := sz.x * 0.06
	_halo_mat.set_shader_parameter("pad", Vector2(pad / sz.x, pad / sz.y))
	_halo_mat.set_shader_parameter("radius", 0.035)
	_halo_mat.set_shader_parameter("aspect", sz.x / sz.y)
	_halo.draw_texture_rect(tex, Rect2(-Vector2(pad, pad), sz + Vector2(pad, pad) * 2.0), false)
