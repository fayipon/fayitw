# 上方自走區：森林背景一直往左捲、紙板道具從前景經過、小紅帽人偶走路；
# 遇到大野狼就停下來，每一段連鎖的中獎變成丟過去的蘋果；打倒時大野狼的紙板四散
extends Control

const Art := preload("res://scripts/art.gd")
const Puppet := preload("res://scripts/puppet.gd")
const MultSign := preload("res://scripts/mult_sign.gd")
const Prop := preload("res://scripts/prop.gd")

const PROPS := ["mushroom", "flower", "lantern"]
const TINTS := [Color.WHITE, Color(1.0, 0.8, 0.66), Color(0.55, 0.62, 0.95)]

var scroll := 0.0
var walking := true
var tint := Color.WHITE
var hero: Node2D
var enemy: Node2D = null
var mult_sign: Node2D
var fx: Node2D
var ground := 0.0
var unit := 0.5

var _bg: Texture2D
var _props: Node2D
var _actors: Node2D
var _texts: Control
var _prop_timer := 0.6
var _rng := RandomNumberGenerator.new()
var _enemy_k := 1.0


func _ready() -> void:
	_rng.randomize()
	clip_contents = true
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_bg = Art.tex("res://art/bg-loop.webp")
	# 人偶的後手、腿、尾巴 z 是負的（畫在身體後面），整層墊高才不會被背景蓋掉
	_actors = Node2D.new()
	_actors.z_index = 4
	add_child(_actors)
	hero = Puppet.new("hero")
	_actors.add_child(hero)
	_props = Node2D.new()
	_props.z_index = 9
	add_child(_props)
	mult_sign = MultSign.new()
	mult_sign.z_index = 10
	add_child(mult_sign)
	fx = Node2D.new()
	fx.z_index = 11
	add_child(fx)
	_texts = Control.new()
	_texts.z_index = 12
	_texts.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_texts)
	resized.connect(layout)


func layout() -> void:
	if not hero.is_node_ready():
		await hero.ready
	ground = size.y * 0.9
	unit = size.y * 0.5 / hero.height()
	hero.scale = Vector2(unit, unit)
	hero.position = Vector2(size.x * 0.24, ground - hero.feet_y * unit)
	if enemy:
		_place_enemy()
	mult_sign.position = Vector2(size.x * 0.5, 0)
	mult_sign.set_rope(clampf(size.y * 0.16, 30.0, 70.0))
	var s := clampf(size.y / 340.0, 0.7, 1.15)
	mult_sign.scale = Vector2(s, s)
	queue_redraw()


func set_stage(stage: int) -> void:
	var to: Color = TINTS[(stage - 1) % TINTS.size()]
	var tw := create_tween()
	tw.tween_method(func(c: Color):
		tint = c
		queue_redraw(), tint, to, 1.2)


func _process(delta: float) -> void:
	hero.walking = walking
	if walking:
		scroll += size.y * 0.32 * delta
		queue_redraw()
		_prop_timer -= delta
		if _prop_timer <= 0.0:
			_spawn_prop()
			_prop_timer = _rng.randf_range(1.6, 3.0)
		for p in _props.get_children():
			p.position.x -= size.y * 0.5 * delta
			if p.position.x < -120:
				p.queue_free()


func _draw() -> void:
	var s := size.y / _bg.get_height()
	var tw := _bg.get_width() * s
	var x := -fposmod(scroll, tw)
	while x < size.x:
		draw_texture_rect(_bg, Rect2(x, 0, tw + 1.0, size.y), false, tint)
		x += tw
	# 底下漸暗，接到 SLOT
	var y := size.y * 0.8
	draw_polygon(PackedVector2Array([Vector2(0, y), Vector2(size.x, y), Vector2(size.x, size.y), Vector2(0, size.y)]),
		PackedColorArray([Color(Art.INK, 0.0), Color(Art.INK, 0.0), Art.INK, Art.INK]))


func _spawn_prop() -> void:
	var id: String = PROPS[_rng.randi_range(0, PROPS.size() - 1)]
	var p := Prop.new(Art.tex("res://art/props/%s.webp" % id), size.y * _rng.randf_range(0.17, 0.24))
	p.position = Vector2(size.x + 80, size.y * 0.985)
	_props.add_child(p)


# ---------- 敵人 ----------

func spawn_enemy(kind: String) -> void:
	enemy = Puppet.new("wolf")
	_actors.add_child(enemy)
	_enemy_k = 1.25 if kind == "boss" else 1.0
	if kind == "boss":
		enemy.base_tint = Color(1.0, 0.78, 0.74)
		enemy.modulate = enemy.base_tint
	_place_enemy()
	var target := enemy.position.x
	enemy.position.x = size.x + 200
	enemy.walking = true
	enemy.walk_rate = 1.25
	var tw := create_tween()
	tw.tween_property(enemy, "position:x", target, 1.3).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	await tw.finished
	if enemy:
		enemy.walking = false


func _place_enemy() -> void:
	var k := unit * _enemy_k
	enemy.scale = Vector2(-k, k)
	enemy.position = Vector2(size.x * 0.76, ground - enemy.feet_y * k)


func enemy_center() -> Vector2:
	if not enemy:
		return Vector2(size.x * 0.76, ground - size.y * 0.3)
	var k := unit * _enemy_k
	return enemy.position + Vector2(0, (enemy.top_y + enemy.feet_y) * 0.42 * k)


# 小紅帽丟蘋果：贏越多丟越多顆，第一顆打中時回傳
func throw_apples(count: int) -> void:
	var from := [Vector2.ZERO]
	hero.thrown.connect(func(at: Vector2): from[0] = get_global_transform().affine_inverse() * at, CONNECT_ONE_SHOT)
	await hero.attack()
	Sfx.play("throw")
	var target := enemy_center()
	var apple := Art.symbol("apple")
	var last: Tween
	for k in count:
		var sp := Sprite2D.new()
		sp.texture = apple
		var s := size.y * 0.13 / apple.get_height()
		sp.scale = Vector2(s, s)
		sp.position = from[0]
		fx.add_child(sp)
		var dest := target + Vector2(_rng.randf_range(-22, 22), _rng.randf_range(-30, 30))
		var start: Vector2 = from[0]
		var lift := size.y * (0.28 + k * 0.05)
		var tw := create_tween()
		tw.tween_interval(k * 0.08)
		tw.tween_method(func(t: float):
			sp.position = start.lerp(dest, t) + Vector2(0, -lift * 4.0 * t * (1.0 - t))
			sp.rotation = t * 9.0, 0.0, 1.0, 0.42)
		tw.tween_callback(sp.queue_free)
		last = tw
	await get_tree().create_timer(0.42).timeout


func impact(damage: String, crit: bool) -> void:
	var at := enemy_center()
	_burst(at, Color("ff5a3a") if crit else Art.GOLD, 26 if crit else 16)
	if enemy:
		enemy.hurt(1.3 if crit else 1.0)
	Sfx.play("hit", 0.9 if crit else 1.05)
	float_text(damage, at + Vector2(0, -size.y * 0.12), Color.WHITE if not crit else Art.GOLD, 40 if crit else 30, Color("6b0d06"))


func defeat_enemy() -> void:
	if not enemy:
		return
	var at := enemy_center()
	_burst(at, Art.GOLD, 30)
	_pins(at)
	Sfx.play("defeat")
	enemy.break_apart(fx, _rng)
	var gone := enemy
	enemy = null
	get_tree().create_timer(1.3).timeout.connect(gone.queue_free)
	hero.cheer()


func _burst(at: Vector2, color: Color, amount: int) -> void:
	var p := CPUParticles2D.new()
	p.position = at
	p.one_shot = true
	p.explosiveness = 1.0
	p.amount = amount
	p.lifetime = 0.6
	p.spread = 180.0
	p.initial_velocity_min = 120.0
	p.initial_velocity_max = 320.0
	p.gravity = Vector2(0, 500)
	p.scale_amount_min = 3.0
	p.scale_amount_max = 7.0
	p.angular_velocity_min = -400.0
	p.angular_velocity_max = 400.0
	p.color = color
	var fade := Gradient.new()
	fade.set_color(0, Color.WHITE)
	fade.set_color(1, Color(1, 1, 1, 0))
	p.color_ramp = fade
	fx.add_child(p)
	p.emitting = true
	p.finished.connect(p.queue_free)


# 黃銅釘彈出去
func _pins(at: Vector2) -> void:
	for k in 7:
		var pin := Node2D.new()
		pin.position = at + Vector2(_rng.randf_range(-30, 30), _rng.randf_range(-60, 40))
		pin.draw.connect(func():
			pin.draw_circle(Vector2.ZERO, 6.0, Color("9a6414"))
			pin.draw_circle(Vector2.ZERO, 4.5, Art.GOLD)
			pin.draw_circle(Vector2(-1.5, -1.5), 1.5, Color.WHITE))
		fx.add_child(pin)
		var v := Vector2(_rng.randf_range(-240, 240), _rng.randf_range(-420, -200))
		var start := pin.position
		var tw := pin.create_tween()
		tw.tween_method(func(t: float):
			pin.position = start + v * t + Vector2(0, 900.0 * t * t)
			pin.rotation = t * 12.0, 0.0, 1.0, 1.0)
		tw.tween_callback(pin.queue_free)


func float_text(text: String, at: Vector2, color: Color, font_size: int, ink := Art.INK) -> void:
	var l := Art.label(text, Art.label_settings(font_size, color, "num", 8, ink, 3))
	l.size = Vector2(240, font_size * 1.4)
	l.position = at - l.size / 2.0
	l.pivot_offset = l.size / 2.0
	_texts.add_child(l)
	l.scale = Vector2(0.4, 0.4)
	var tw := create_tween()
	tw.tween_property(l, "scale", Vector2(1.15, 1.15), 0.14).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_property(l, "scale", Vector2.ONE, 0.1)
	tw.tween_property(l, "position:y", l.position.y - 34, 0.7).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_property(l, "modulate:a", 0.0, 0.35).set_delay(0.35)
	tw.tween_callback(l.queue_free)
