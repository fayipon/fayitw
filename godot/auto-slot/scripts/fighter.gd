# 自走區的角色（設計稿的動漫風立繪）：一張圖一個姿勢，動作用程式做——
# 跑步上下彈、站著呼吸、揮砍時往前衝、被打時閃紅後退、倒下時從邊緣燒成灰（溶解 shader）；
# 連段招式用的零件：轉身（turn 從 1 翻到 -1 再翻回來）、前傾（tilt）、殘影（ghost）、換面向（face）
extends Node2D

const SHADER := preload("res://scripts/fighter.gdshader")

var poses := {}            # 名稱 → Texture2D
var pose := ""
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

var _sprite: Sprite2D
var _mat: ShaderMaterial
var _t := 0.0
var _s := 1.0
var _base_x := 0.0
var _move: Tween
var _lift := 0.0
var _breath := 0.0
var _rot := 0.0


func _init(textures: Dictionary, first: String) -> void:
	poses = textures
	pose = first


func _ready() -> void:
	_sprite = Sprite2D.new()
	_sprite.centered = false
	_mat = ShaderMaterial.new()
	_mat.shader = SHADER
	_sprite.material = _mat
	add_child(_sprite)
	set_pose(pose)
	_t = randf() * 10.0


func set_pose(name: String) -> void:
	pose = name
	if not _sprite:
		return
	var tex: Texture2D = poses[name]
	_sprite.texture = tex
	_fit()


# 所有姿勢裡最寬的寬高比：用來依寬度限制身高，換姿勢時大小才不會跳
func widest() -> float:
	var k := 1.0
	for t in poses.values():
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
	_s = height / tex.get_height()
	var flip := (facing < 0.0) != flip_source
	_sprite.scale = Vector2(-_s if flip else _s, _s)
	_base_x = tex.get_width() * _s * (0.5 if flip else -0.5)
	_sprite.position = Vector2(_base_x + kick_x, -tex.get_height() * _s)
	queue_redraw()


func _process(delta: float) -> void:
	_t += delta
	if walking:
		# 跑步：一步一彈、身體微微前傾
		var step := absf(sin(_t * 9.0))
		_lift = step * height * 0.035
		_rot = sin(_t * 9.0) * 0.025
		_breath = 0.0
	else:
		_lift = move_toward(_lift, 0.0, delta * 60.0)
		_rot = move_toward(_rot, 0.0, delta)
		_breath = sin(_t * 2.4) * 0.012
	rotation = _rot + tilt
	_apply()
	queue_redraw()


func _apply() -> void:
	if _sprite and _sprite.texture:
		var sy := _s * (1.0 + _breath)
		var flip := (facing < 0.0) != flip_source
		_sprite.scale = Vector2((-_s if flip else _s) * turn, sy)
		_sprite.position = Vector2(_base_x * turn + kick_x, -_sprite.texture.get_height() * sy - _lift - hop_y)


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


# 被打：閃紅（越重閃越紅，連段的小刀只閃一點）、往後退一點再回來
func hurt(strength := 1.0) -> void:
	var f := clampf(strength * 0.7, 0.25, 1.0)
	_mat.set_shader_parameter("flash", f)
	var tw := create_tween()
	tw.tween_method(func(v: float): _mat.set_shader_parameter("flash", v), f, 0.0, 0.3)
	_restart_move()
	_move.tween_property(self, "kick_x", facing * -height * 0.08 * strength, 0.06)
	_move.tween_property(self, "kick_x", 0.0, 0.22).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)


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
