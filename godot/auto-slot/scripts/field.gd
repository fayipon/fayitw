# 上方自走區（照設計稿的月夜森林）：遠景（月亮、亮著燈的村莊、林間小路）固定、霧氣慢慢飄、
# 近景（左右的大樹、前景地面）一直往左捲；紅葉從上面飄下來。
# 小紅帽自己往前跑，遇到大野狼就停下來擺架式；每一段連鎖的中獎變成一次衝上去的揮砍，狼倒下時從邊緣燒成灰
extends Control

const Art := preload("res://scripts/art.gd")
const Fighter := preload("res://scripts/fighter.gd")

# 每關的月光顏色：藍、紫、血月
const TINTS := [Color.WHITE, Color(0.92, 0.84, 1.0), Color(1.0, 0.78, 0.76)]
# 近景每秒捲動幾倍的區域高度
const NEAR_SPEED := 0.3
# 角色身高上限、腳踩的位置（都以區域高度為準）
const HERO_H := 0.6
const WOLF_H := 0.6
const GROUND := 0.93
# 站位與立繪寬度上限（以區域寬度為準）。小紅帽的披風往後飄、大野狼伏低，立繪都比身高寬，
# 所以身高再用寬度封頂：兩人中間留一段空隙對峙，不會貼在一起，披風和狼尾也不會被左右切掉太多
const HERO_X := 0.22
const WOLF_X := 0.78
const HERO_MAX_W := 0.46
const WOLF_MAX_W := 0.42

var scroll := 0.0
var walking := true
var tint := Color.WHITE
var hero: Node2D
var enemy: Node2D = null
var fx: Node2D
var ground := 0.0
# 疊在自走區上的標題字（區域座標）：頭上的牌子碰到它就往右讓開
var avoid := Rect2()

var _far: Texture2D
var _near: Texture2D
var _fog: Texture2D
var _actors: Node2D
var _leaves: CPUParticles2D
var _texts: Control
# 存起來的傷害：小紅帽頭上的「STORED 1,240」小牌子
var _tag: PanelContainer
var _tag_num: Label
var _tag_tw: Tween
var _rng := RandomNumberGenerator.new()
var _enemy_k := 1.0
var _t := 0.0
# 小紅帽衝出去／退回來、狼人走進場：畫面縮放時要能停掉並放回原位
var _lunge: Tween
var _enter: Tween


func _ready() -> void:
	_rng.randomize()
	clip_contents = true
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_far = Art.tex("res://art/field/far.webp")
	_near = Art.tex("res://art/field/near.webp")
	var g := Gradient.new()
	g.set_color(0, Color(0.75, 0.85, 1.0, 0.55))
	g.set_color(1, Color(0.75, 0.85, 1.0, 0.0))
	var fog := GradientTexture2D.new()
	fog.gradient = g
	fog.fill = GradientTexture2D.FILL_RADIAL
	fog.fill_from = Vector2(0.5, 0.5)
	fog.fill_to = Vector2(1.0, 0.5)
	fog.width = 128
	fog.height = 128
	_fog = fog
	# 角色在近景上面；整層墊高，才不會被背景蓋掉
	_actors = Node2D.new()
	_actors.z_index = 4
	add_child(_actors)
	hero = Fighter.new({
		"run": Art.tex("res://art/field/hero-run.webp"),
		"stance": Art.tex("res://art/field/hero-stance.webp"),
		"slash": Art.tex("res://art/field/hero-slash.webp"),
	}, "run")
	_actors.add_child(hero)
	_leaves = _make_leaves()
	_leaves.z_index = 9
	add_child(_leaves)
	fx = Node2D.new()
	fx.z_index = 11
	add_child(fx)
	_texts = Control.new()
	_texts.z_index = 12
	_texts.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_texts)
	_tag = _make_tag()
	_tag.z_index = 12
	add_child(_tag)
	hero.aura_color = Color(1.0, 0.72, 0.25)
	resized.connect(layout)


func layout() -> void:
	if not hero.is_node_ready():
		await hero.ready
	ground = size.y * GROUND
	hero.set_height(minf(size.y * HERO_H, size.x * HERO_MAX_W / hero.widest()))
	if _lunge:
		_lunge.kill()
		if hero.pose == "slash":
			hero.set_pose("run" if walking else "stance")
	hero.position = Vector2(size.x * HERO_X, ground)
	if _enter and _enter.is_running():
		_enter.custom_step(10.0)
	if enemy:
		_place_enemy()
	_leaves.position = Vector2(size.x / 2.0, -10)
	_leaves.emission_rect_extents = Vector2(size.x * 0.6, 4)
	queue_redraw()


func set_stage(stage: int) -> void:
	var to: Color = TINTS[(stage - 1) % TINTS.size()]
	var tw := create_tween()
	tw.tween_method(func(c: Color):
		tint = c
		queue_redraw(), tint, to, 1.2)


func _process(delta: float) -> void:
	_t += delta
	hero.walking = walking
	if walking:
		scroll += size.y * NEAR_SPEED * delta
		if hero.pose != "run" and hero.pose != "slash":
			hero.set_pose("run")
	elif hero.pose == "run":
		hero.set_pose("stance")
	if _tag.visible:
		_tag.pivot_offset = _tag.size / 2.0
		_tag.position = Vector2(maxf(6.0, hero.position.x - _tag.size.x / 2.0), hero.position.y - hero.height - _tag.size.y - 6.0)
		if avoid.intersects(Rect2(_tag.position, _tag.size)):
			_tag.position.x = avoid.end.x + 6.0
	queue_redraw()


func _draw() -> void:
	# 遠景：蓋滿整個區域、置中（月亮與外婆家在中間），固定不動
	var s := maxf(size.y / _far.get_height(), size.x / _far.get_width())
	var fw := _far.get_width() * s
	var fh := _far.get_height() * s
	draw_texture_rect(_far, Rect2((size.x - fw) / 2.0, size.y - fh, fw, fh), false, tint)
	# 霧：幾團大霧慢慢往左飄
	for k in 5:
		var speed := 8.0 + k * 5.0
		var w := size.x * (0.7 + 0.15 * (k % 3))
		var x := fposmod(size.x - _t * speed + k * size.x * 0.41, size.x + w) - w * 0.5
		var y := size.y * (0.55 + 0.08 * (k % 3))
		draw_texture_rect(_fog, Rect2(x - w / 2.0, y - w * 0.18, w, w * 0.36), false, Color(1, 1, 1, 0.22))
	# 近景：縮到區域高度，左右無縫接著捲
	var nw := _near.get_width() * size.y / _near.get_height()
	var nx := -fposmod(scroll, nw)
	while nx < size.x:
		draw_texture_rect(_near, Rect2(nx, 0, nw + 1.0, size.y), false, tint)
		nx += nw
	# 底下漸暗，接到 SLOT
	var y := size.y * 0.82
	draw_polygon(PackedVector2Array([Vector2(0, y), Vector2(size.x, y), Vector2(size.x, size.y), Vector2(0, size.y)]),
		PackedColorArray([Color(Art.INK, 0.0), Color(Art.INK, 0.0), Art.INK, Art.INK]))


# 紅葉：小小的橢圓葉片，一邊轉一邊往左下飄
func _make_leaves() -> CPUParticles2D:
	var img := Image.create(14, 8, false, Image.FORMAT_RGBA8)
	for x in 14:
		for y in 8:
			var d := Vector2((x - 6.5) / 7.0, (y - 3.5) / 4.0).length()
			if d < 1.0:
				img.set_pixel(x, y, Color(0.75, 0.08, 0.1, clampf((1.0 - d) * 3.0, 0.0, 1.0)))
	var p := CPUParticles2D.new()
	p.texture = ImageTexture.create_from_image(img)
	p.amount = 14
	p.lifetime = 7.0
	p.preprocess = 7.0
	p.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
	p.direction = Vector2(-0.6, 1.0)
	p.spread = 25.0
	p.gravity = Vector2(-6, 18)
	p.initial_velocity_min = 14.0
	p.initial_velocity_max = 34.0
	p.angular_velocity_min = -120.0
	p.angular_velocity_max = 120.0
	p.scale_amount_min = 0.7
	p.scale_amount_max = 1.3
	var fade := Gradient.new()
	fade.set_color(0, Color(1, 1, 1, 0.9))
	fade.set_color(1, Color(1, 1, 1, 0.0))
	p.color_ramp = fade
	return p


# ---------- 存起來的傷害 ----------

func _make_tag() -> PanelContainer:
	var p := PanelContainer.new()
	p.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var sb := Art.box(Art.PANEL, 10, 2, Art.GOLD_DEEP)
	sb.content_margin_left = 10
	sb.content_margin_right = 10
	sb.content_margin_top = 2
	sb.content_margin_bottom = 2
	p.add_theme_stylebox_override("panel", sb)
	var row := HBoxContainer.new()
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_theme_constant_override("separation", 6)
	row.add_child(Art.label("STORED", Art.label_settings(11, Art.GOLD, "light")))
	_tag_num = Art.label("0", Art.label_settings(17, Art.GOLD_LIGHT, "num", 4, Art.GOLD_INK))
	row.add_child(_tag_num)
	p.add_child(row)
	p.visible = false
	return p


# 沒有狼可以打時傷害先存起來：頭上的牌子更新數字、跳出「+120」、身上的金光跟著變亮（power 0～1）
func set_charge(amount: int, gained: int, power: float) -> void:
	# 剛打出去的牌子還在淡掉的話直接停掉
	if _tag_tw:
		_tag_tw.kill()
	_tag.visible = amount > 0
	_tag.modulate.a = 1.0
	_tag.scale = Vector2.ONE
	_tag_num.text = Art.money(amount)
	create_tween().tween_property(hero, "aura", power if amount > 0 else 0.0, 0.3)
	if gained <= 0 or amount <= 0:
		return
	_tag_tw = create_tween()
	_tag_tw.tween_property(_tag, "scale", Vector2(1.2, 1.2), 0.08)
	_tag_tw.tween_property(_tag, "scale", Vector2.ONE, 0.18).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	var top := hero.position + Vector2(0, -hero.height - 44.0)
	float_text("+%s" % Art.money(gained), top, Art.GOLD_LIGHT, 20, Art.GOLD_INK)


# 狼站定了：牌子放大淡掉、金光收回，接著小紅帽把存的傷害一刀打出去
func release_charge() -> void:
	create_tween().tween_property(hero, "aura", 0.0, 0.4)
	if not _tag.visible:
		return
	if _tag_tw:
		_tag_tw.kill()
	_tag_tw = create_tween()
	_tag_tw.tween_property(_tag, "scale", Vector2(1.35, 1.35), 0.2).set_ease(Tween.EASE_OUT)
	_tag_tw.parallel().tween_property(_tag, "modulate:a", 0.0, 0.2)
	_tag_tw.tween_callback(func():
		_tag.visible = false
		_tag.scale = Vector2.ONE
		_tag.modulate.a = 1.0)


# ---------- 敵人 ----------

# 大野狼從右邊的陰影裡走出來
func spawn_enemy(kind: String) -> void:
	enemy = Fighter.new({"idle": Art.tex("res://art/field/wolf.webp")}, "idle")
	# 大野狼的圖本來就面向左
	enemy.facing = -1.0
	enemy.flip_source = true
	_actors.add_child(enemy)
	_enemy_k = 1.18 if kind == "boss" else 1.0
	if kind == "boss":
		enemy.aura = 1.0
		enemy.tint(Color(1.0, 0.8, 0.78))
	_place_enemy()
	var target := enemy.position.x
	enemy.position.x = size.x + size.y * 0.5
	enemy.modulate = Color(0.15, 0.15, 0.2, 0.0)
	enemy.walking = true
	_enter = create_tween()
	_enter.tween_property(enemy, "position:x", target, 1.3).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	_enter.parallel().tween_property(enemy, "modulate", Color.WHITE, 1.0)
	await _enter.finished
	if enemy:
		enemy.walking = false
		# 站定時低吼一下：身體一縮一撐
		var roar := create_tween()
		roar.tween_property(enemy, "scale", Vector2(1.06, 0.95), 0.12)
		roar.tween_property(enemy, "scale", Vector2.ONE, 0.25).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
		Sfx.play("hit", 0.55, -4.0)


func _place_enemy() -> void:
	enemy.set_height(minf(size.y * WOLF_H, size.x * WOLF_MAX_W / enemy.widest()) * _enemy_k)
	enemy.position = Vector2(size.x * WOLF_X, ground)


func enemy_center() -> Vector2:
	if not enemy:
		return Vector2(size.x * WOLF_X, ground - size.y * 0.35)
	return enemy.position + Vector2(0, -enemy.height * 0.5)


# 小紅帽衝上去揮砍：中獎越多砍越多刀
func strike(count: int) -> void:
	if not enemy:
		return
	var home := size.x * HERO_X
	var reach := lerpf(home, enemy.position.x - enemy.height * 0.3, 0.62)
	# 上一刀還在退回來的話直接接著衝
	if _lunge:
		_lunge.kill()
	hero.set_pose("slash")
	_lunge = create_tween()
	_lunge.tween_property(hero, "position:x", reach, 0.11).set_ease(Tween.EASE_OUT)
	await _lunge.finished
	Sfx.play("throw")
	for k in count:
		_slash(enemy_center() + Vector2(_rng.randf_range(-14, 14), _rng.randf_range(-30, 24)), k)
		if k < count - 1:
			await get_tree().create_timer(0.07).timeout
	await get_tree().create_timer(0.1).timeout
	_lunge = create_tween()
	_lunge.tween_property(hero, "position:x", home, 0.24).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	_lunge.tween_callback(func():
		if hero.pose == "slash":
			hero.set_pose("run" if walking else "stance"))


# 一道刀光：白芯紅邊的新月形，張開後淡掉
func _slash(at: Vector2, k: int) -> void:
	var arc := Node2D.new()
	arc.position = at
	arc.rotation = -0.5 + _rng.randf_range(-0.35, 0.35) + (k % 2) * 0.9
	var r := size.y * 0.24
	arc.set_meta("p", 0.0)
	arc.draw.connect(func():
		var p: float = arc.get_meta("p")
		var a := 1.0 - p
		for i in 3:
			var w := r * (0.16 - i * 0.05) * (1.0 - p * 0.6)
			var col: Color = [Color(0.85, 0.05, 0.08, 0.55 * a), Color(1, 0.55, 0.45, 0.8 * a), Color(1, 1, 1, a)][i]
			arc.draw_arc(Vector2.ZERO, r * (0.9 + p * 0.25), -1.2, 1.2, 24, col, maxf(1.0, w), true))
	fx.add_child(arc)
	var tw := arc.create_tween()
	tw.tween_method(func(v: float):
		arc.set_meta("p", v)
		arc.queue_redraw(), 0.0, 1.0, 0.28)
	tw.tween_callback(arc.queue_free)


func impact(damage: String, crit: bool) -> void:
	var at := enemy_center()
	_burst(at, Color("ff3a2a") if crit else Color("ffb070"), 26 if crit else 16)
	if enemy:
		enemy.hurt(1.4 if crit else 1.0)
	Sfx.play("hit", 0.9 if crit else 1.05)
	float_text(damage, at + Vector2(0, -size.y * 0.16), Art.GOLD_LIGHT if crit else Color.WHITE, 30 if crit else 24, Color("4a0306"))


# 狼人倒下：從邊緣燒成灰，餘燼往上飄
func defeat_enemy() -> void:
	if not enemy:
		return
	var at := enemy_center()
	_burst(at, Art.GOLD, 30)
	_embers(enemy.sprite_rect())
	Sfx.play("defeat")
	var gone := enemy
	enemy = null
	gone.dissolve(0.9)
	get_tree().create_timer(1.1).timeout.connect(gone.queue_free)
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
	p.initial_velocity_max = 300.0
	p.gravity = Vector2(0, 400)
	p.scale_amount_min = 2.0
	p.scale_amount_max = 5.0
	p.color = color
	var fade := Gradient.new()
	fade.set_color(0, Color.WHITE)
	fade.set_color(1, Color(1, 1, 1, 0))
	p.color_ramp = fade
	fx.add_child(p)
	p.emitting = true
	p.finished.connect(p.queue_free)


func _embers(rect: Rect2) -> void:
	var p := CPUParticles2D.new()
	p.position = rect.get_center()
	p.one_shot = true
	p.explosiveness = 0.3
	p.amount = 46
	p.lifetime = 1.4
	p.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
	p.emission_rect_extents = rect.size * Vector2(0.35, 0.45)
	p.direction = Vector2.UP
	p.spread = 30.0
	p.gravity = Vector2(0, -60)
	p.initial_velocity_min = 20.0
	p.initial_velocity_max = 80.0
	p.scale_amount_min = 1.5
	p.scale_amount_max = 3.5
	var ramp := Gradient.new()
	ramp.set_color(0, Color(1, 0.6, 0.2, 1))
	ramp.set_color(1, Color(0.5, 0.05, 0.05, 0))
	p.color_ramp = ramp
	fx.add_child(p)
	p.emitting = true
	p.finished.connect(p.queue_free)


func float_text(text: String, at: Vector2, color: Color, font_size: int, ink := Art.INK) -> void:
	var l := Art.label(text, Art.label_settings(font_size, color, "num", 7, ink, 3))
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
