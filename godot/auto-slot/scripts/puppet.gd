# 關節紙板人偶（Candy Crush 那種）：部件是一片片紙板，白色切邊、背後疊一層棕色當紙板厚度，
# 用黃銅釘的位置當轉軸。走路時腿和手繞著釘子擺、身體上下彈；出招、被打退、被打倒（釘子彈開、紙板四散）
extends Node2D

signal thrown(at: Vector2)

var who := "hero"
var parts := {}
var feet_y := 0.0
var top_y := 0.0
var walking := false
var walk_rate := 1.6

# 動作疊加量（tween 改這幾個值，_process 再跟走路／呼吸的循環加在一起）
var lean := 0.0
var arm_kick := 0.0
var head_kick := 0.0
var lunge := 0.0
var lift := 0.0

var broken := false
var base_tint := Color.WHITE
var _t := 0.0
var _rig := {}


func _init(name := "hero") -> void:
	who = name


func _ready() -> void:
	_rig = JSON.parse_string(FileAccess.get_file_as_string("res://art/puppets/%s/rig.json" % who))
	var defs: Dictionary = _rig.parts
	for name in defs:
		var d: Dictionary = defs[name]
		var tex: Texture2D = load("res://art/puppets/%s/%s.png" % [who, name])
		var sp := Sprite2D.new()
		sp.name = name
		sp.texture = tex
		sp.centered = false
		sp.offset = -Vector2(d.pivot[0], d.pivot[1])
		# 紙板厚度：同一張圖染成深棕色、往右下錯開，畫在部件後面
		var edge := Sprite2D.new()
		edge.texture = tex
		edge.centered = false
		edge.offset = sp.offset
		edge.position = Vector2(4, 5)
		edge.modulate = Color(0.42, 0.28, 0.16, 0.95)
		edge.show_behind_parent = true
		sp.add_child(edge)
		parts[name] = sp
	var root: Sprite2D = parts[_rig.root]
	add_child(root)
	for name in defs:
		if name == _rig.root:
			continue
		var d: Dictionary = defs[name]
		var sp: Sprite2D = parts[name]
		parts[d.parent].add_child(sp)
		sp.position = Vector2(d.attach[0], d.attach[1])
		sp.z_index = int(d.z)
	# 腳底與頭頂的位置（相對 root 轉軸），放到地面上用
	feet_y = 0.0
	top_y = 0.0
	for name in defs:
		var d: Dictionary = defs[name]
		var tex: Texture2D = parts[name].texture
		var y0: float = -d.pivot[1]
		var y1: float = tex.get_height() - d.pivot[1]
		if d.has("attach"):
			y0 += d.attach[1]
			y1 += d.attach[1]
		feet_y = maxf(feet_y, y1)
		top_y = minf(top_y, y0)


func height() -> float:
	return feet_y - top_y


func _draw() -> void:
	if broken:
		return
	# 地上的影子
	var w := 120.0
	for k in 4:
		draw_set_transform(Vector2(0, feet_y - 4), 0.0, Vector2(1.0, 0.22))
		draw_circle(Vector2.ZERO, w * (1.0 - k * 0.18), Color(0, 0, 0, 0.12))
	draw_set_transform(Vector2.ZERO)


func _process(delta: float) -> void:
	_t += delta
	var torso: Sprite2D = parts.torso
	var ph := _t * TAU * walk_rate
	var swing := sin(ph) if walking else 0.0
	var bob := absf(sin(ph)) if walking else 0.0
	var breathe := sin(_t * 2.6)
	torso.position = Vector2(lunge, -bob * 10.0 - lift + breathe * (0.0 if walking else 1.5))
	torso.rotation = lean + (sin(ph * 2.0) * 0.03 if walking else breathe * 0.01)
	if parts.has("head"):
		parts.head.rotation = head_kick + (sin(ph + 0.8) * 0.06 if walking else sin(_t * 1.7) * 0.04)
	if parts.has("leg_front"):
		parts.leg_front.rotation = swing * 0.45
		parts.leg_back.rotation = -swing * 0.45
	if parts.has("arm_front"):
		parts.arm_front.rotation = -swing * 0.32 + arm_kick + (0.0 if walking else sin(_t * 2.1) * 0.05)
		parts.arm_back.rotation = swing * 0.38 + (0.0 if walking else -sin(_t * 2.1) * 0.05)
	if parts.has("tail"):
		parts.tail.rotation = sin(_t * 5.0) * 0.18


# 小紅帽丟蘋果：手往後拉、往前甩，甩到最前面時發出 thrown（手的全域位置）
func attack() -> void:
	var tw := create_tween()
	tw.tween_property(self, "arm_kick", -1.9, 0.12).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_property(self, "lean", -0.1, 0.12)
	tw.tween_property(self, "arm_kick", 1.1, 0.09).set_ease(Tween.EASE_IN)
	tw.parallel().tween_property(self, "lean", 0.14, 0.09)
	tw.parallel().tween_property(self, "lunge", 14.0, 0.09)
	tw.tween_callback(func(): thrown.emit(hand_position()))
	tw.tween_property(self, "arm_kick", 0.0, 0.28).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_property(self, "lean", 0.0, 0.28)
	tw.parallel().tween_property(self, "lunge", 0.0, 0.28)
	await tw.finished


func hand_position() -> Vector2:
	var arm: Sprite2D = parts.arm_front
	var tex := arm.texture
	return arm.to_global(arm.offset + Vector2(tex.get_width() * 0.5, tex.get_height() * 0.85))


# 被打：往後折、頭甩一下、整隻抖
func hurt(strength := 1.0) -> void:
	var tw := create_tween()
	tw.tween_property(self, "lean", -0.28 * strength, 0.07).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_property(self, "head_kick", -0.35 * strength, 0.07)
	tw.parallel().tween_property(self, "lunge", -18.0 * strength, 0.07)
	tw.tween_property(self, "lean", 0.0, 0.45).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_property(self, "head_kick", 0.0, 0.45).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_property(self, "lunge", 0.0, 0.3)
	var flash := create_tween()
	flash.tween_property(self, "modulate", Color(1.0, 0.55, 0.5), 0.05)
	flash.tween_property(self, "modulate", base_tint, 0.2)


# 跳一下（升級、打倒敵人）
func cheer() -> void:
	var tw := create_tween()
	tw.tween_property(self, "lift", 46.0, 0.18).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_property(self, "arm_kick", -2.4, 0.18)
	tw.tween_property(self, "lift", 0.0, 0.22).set_trans(Tween.TRANS_BOUNCE).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_property(self, "arm_kick", 0.0, 0.3)


# 被打倒：釘子彈開，每片紙板各自飛出去、轉、掉下、淡出；layer 是要接住碎片的節點
func break_apart(layer: Node2D, rng: RandomNumberGenerator) -> void:
	var pieces := []
	for name in parts:
		pieces.append(parts[name])
	for sp in pieces:
		var g: Transform2D = sp.global_transform
		sp.get_parent().remove_child(sp)
		layer.add_child(sp)
		sp.global_transform = g
		sp.z_index = 3
	# 每片往上彈開再掉下去
	for name in parts:
		var sp: Sprite2D = parts[name]
		var v := Vector2(rng.randf_range(-260, 260), rng.randf_range(-520, -260))
		var spin := rng.randf_range(-9.0, 9.0)
		var start: Vector2 = sp.position
		var rot: float = sp.rotation
		var tw := sp.create_tween()
		tw.tween_method(func(t: float):
			sp.position = start + v * t + Vector2(0, 1100.0 * t * t)
			sp.rotation = rot + spin * t, 0.0, 1.1, 1.1)
		tw.parallel().tween_property(sp, "modulate:a", 0.0, 0.4).set_delay(0.7)
		tw.tween_callback(sp.queue_free)
	parts.clear()
	broken = true
	set_process(false)
	queue_redraw()
