# 上方自走區（照設計稿 s-ref-a 的白天森林，2026-10 繪本奇幻版）：遠景（陽光、外婆家的小屋、林間小路）固定、
# 暖白的光霧慢慢飄，近景（左右的大樹、前景草地）一直往左捲；綠葉和花瓣從上面飄下來。
# 小紅帽自己往前跑，遇到大野狼就停下來擺架式；每一段連鎖的中獎變成一次出招（連擊段數越多招式越多），狼倒下時從邊緣燒成灰；
# 第 2 段連擊起上方出現格鬥遊戲式的連擊計數
extends Control

# 重斬、落地重劈時要畫面震動（main 接到 _shake）
signal quake(amount: float)

const Art := preload("res://scripts/art.gd")
const Fighter := preload("res://scripts/fighter.gd")
const ComboCounter := preload("res://scripts/combo_counter.gd")

# 每關的天色：正午、午後金光、傍晚
const TINTS := [Color.WHITE, Color(1.0, 0.93, 0.8), Color(1.0, 0.83, 0.74)]
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
# 出招時的殘影顏色（疊加混色）
const GHOST := Color(1.0, 0.32, 0.22, 0.5)

var scroll := 0.0
var walking := true
var turbo := false
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
# 存起來的傷害：小紅帽頭上的藍色能量條（_fill 是畫出來的長度 0～1，補間追上去）
var _tag: Control
var _tag_tw: Tween
var _fill := 0.0
var _fill_tw: Tween
static var _gauge_frame: StyleBoxFlat
static var _gauge_fill: StyleBoxFlat
static var _gauge_shine: StyleBoxFlat
var _rng := RandomNumberGenerator.new()
var _enemy_k := 1.0
var _t := 0.0
# 小紅帽衝出去／退回來、狼人走進場：畫面縮放時要能停掉並放回原位
var _lunge: Tween
var _enter: Tween
# 這一招的速度倍率（turbo 0.6）、是不是大獎
var _sp := 1.0
var _crit := false
var _combo: Node2D
# 出招中（招式自己換姿勢，_process 不要插手）；歡呼的跳躍姿勢要維持到這個時間
var _striking := false
var _pose_hold := 0.0


func _ready() -> void:
	_rng.randomize()
	clip_contents = true
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_far = Art.tex("res://art/field/far.webp")
	_near = Art.tex("res://art/field/near.webp")
	var g := Gradient.new()
	g.set_color(0, Color(1.0, 0.96, 0.82, 0.5))
	g.set_color(1, Color(1.0, 0.96, 0.82, 0.0))
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
		"run": Art.tex("res://art/field/hero-run-1.webp"),
		"run2": Art.tex("res://art/field/hero-run-2.webp"),
		"run3": Art.tex("res://art/field/hero-run-3.webp"),
		"run4": Art.tex("res://art/field/hero-run-4.webp"),
		"stance": Art.tex("res://art/field/hero-stance.webp"),
		"slash": Art.tex("res://art/field/hero-slash.webp"),
		"windup": Art.tex("res://art/field/hero-windup.webp"),
		"jump": Art.tex("res://art/field/hero-jump.webp"),
	}, "run")
	# 跑步 4 格輪流播；蓄力、跳起比較寬（披風張開），身高上限只看平常的姿勢
	hero.run_frames = ["run", "run2", "run3", "run4"]
	hero.sizing = ["run", "run2", "run3", "run4", "stance", "slash"]
	# 跑步時每一步著地，腳後揚起一小團塵土
	hero.stepped.connect(func():
		if walking:
			_dust(Vector2(hero.position.x - hero.height * 0.12, ground), 3, 1.0, 0.6))
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
	_combo = ComboCounter.new()
	_combo.z_index = 13
	add_child(_combo)
	hero.aura_color = Color(1.0, 0.72, 0.25)
	# 劍的位置（量自立繪，劍根 → 劍尖）：架式劍尖朝右上，跑步時劍拿在後手、朝右下（4 格各量一次），
	# 揮砍時往右平伸（劍尖碰到圖邊），跳起時舉過頭往右上；蓄力時劍收在頭後面，不冒火
	hero.blades = {
		"stance": [Vector2(0.786, 0.533), Vector2(0.99, 0.265)],
		"run": [Vector2(0.346, 0.621), Vector2(0.538, 0.824)],
		"run2": [Vector2(0.338, 0.59), Vector2(0.526, 0.794)],
		"run3": [Vector2(0.328, 0.636), Vector2(0.526, 0.827)],
		"run4": [Vector2(0.338, 0.606), Vector2(0.526, 0.818)],
		"slash": [Vector2(0.742, 0.452), Vector2(1.0, 0.348)],
		"jump": [Vector2(0.447, 0.217), Vector2(0.771, 0.01)],
	}
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
	_tag.size = Vector2(clampf(hero.height * 0.5, 54.0, 96.0), clampf(hero.height * 0.07, 9.0, 13.0))
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
	var idle := not _striking and _t > _pose_hold
	if walking:
		scroll += size.y * NEAR_SPEED * delta
		if idle and not hero.running_pose() and hero.pose != "slash":
			hero.set_pose("run")
	elif idle and (hero.running_pose() or hero.pose == "jump" or hero.pose == "windup"):
		hero.set_pose("stance")
	if _tag.visible:
		_tag.queue_redraw()
		_tag.pivot_offset = _tag.size / 2.0
		_tag.position = Vector2(maxf(6.0, hero.position.x - _tag.size.x / 2.0), hero.position.y - hero.height - _tag.size.y - 6.0)
		if avoid.intersects(Rect2(_tag.position, _tag.size)):
			_tag.position.x = avoid.end.x + 6.0
	queue_redraw()


func _draw() -> void:
	# 遠景：蓋滿整個區域、置中（外婆家的小屋在中間），固定不動
	var s := maxf(size.y / _far.get_height(), size.x / _far.get_width())
	var fw := _far.get_width() * s
	var fh := _far.get_height() * s
	draw_texture_rect(_far, Rect2((size.x - fw) / 2.0, size.y - fh, fw, fh), false, tint)
	# 光霧：幾團暖白的光霧慢慢往左飄
	for k in 5:
		var speed := 8.0 + k * 5.0
		var w := size.x * (0.7 + 0.15 * (k % 3))
		var x := fposmod(size.x - _t * speed + k * size.x * 0.41, size.x + w) - w * 0.5
		var y := size.y * (0.55 + 0.08 * (k % 3))
		draw_texture_rect(_fog, Rect2(x - w / 2.0, y - w * 0.18, w, w * 0.36), false, Color(1, 1, 1, 0.16))
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


# 落葉：小小的白色橢圓葉片，每片隨機染成嫩綠、黃綠或白色花瓣，一邊轉一邊往左下飄
func _make_leaves() -> CPUParticles2D:
	var img := Image.create(14, 8, false, Image.FORMAT_RGBA8)
	for x in 14:
		for y in 8:
			var d := Vector2((x - 6.5) / 7.0, (y - 3.5) / 4.0).length()
			if d < 1.0:
				img.set_pixel(x, y, Color(1, 1, 1, clampf((1.0 - d) * 3.0, 0.0, 1.0)))
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
	var hues := Gradient.new()
	hues.offsets = PackedFloat32Array([0.0, 0.45, 0.8, 1.0])
	hues.colors = PackedColorArray([Color(0.36, 0.62, 0.18), Color(0.62, 0.78, 0.26), Color(0.86, 0.84, 0.36), Color(1.0, 0.95, 0.97)])
	hues.interpolation_mode = Gradient.GRADIENT_INTERPOLATE_CONSTANT
	p.color_initial_ramp = hues
	return p


# ---------- 存起來的傷害 ----------

func _make_tag() -> Control:
	var c := Control.new()
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	c.size = Vector2(72, 10)
	c.draw.connect(func(): _draw_gauge(c))
	c.visible = false
	return c


# 能量條：深胡桃木底、古金細邊，裡面藍色（上半截亮一點像玻璃）；存滿時整條一閃一閃
func _draw_gauge(c: Control) -> void:
	if not _gauge_frame:
		_gauge_frame = Art.box(Color(0.12, 0.07, 0.03, 0.9), 6, 1, Art.GOLD_DEEP)
		_gauge_frame.shadow_color = Color(0, 0, 0, 0.35)
		_gauge_frame.shadow_size = 3
		_gauge_fill = Art.box(Color("2f7fe0"), 4)
		_gauge_shine = Art.box(Color(0.62, 0.86, 1.0, 0.75), 4)
	var r := Rect2(Vector2.ZERO, c.size)
	c.draw_style_box(_gauge_frame, r)
	var inner := r.grow(-2.0)
	var w := inner.size.x * _fill
	if w < 1.0:
		return
	var fr := Rect2(inner.position, Vector2(w, inner.size.y))
	c.draw_style_box(_gauge_fill, fr)
	c.draw_style_box(_gauge_shine, Rect2(fr.position, Vector2(w, inner.size.y * 0.45)))
	if _fill >= 0.999:
		c.draw_style_box(Art.box(Color(1, 1, 1, 0.22 + 0.22 * sin(_t * 8.0)), 4), fr)


# 沒有狼可以打時傷害先存起來：頭上的藍色能量條變長（上限 cap = 總押注 × 100，不寫數字），
# 身上的金光跟著變亮（power 0～1）；gained > 0 是剛存進來，條子彈一下
func set_charge(amount: int, gained: int, power: float, cap: int) -> void:
	# 剛打出去的能量條還在淡掉的話直接停掉
	if _tag_tw:
		_tag_tw.kill()
	if _fill_tw:
		_fill_tw.kill()
	_tag.visible = amount > 0
	_tag.modulate.a = 1.0
	_tag.scale = Vector2.ONE
	var to := clampf(float(amount) / maxf(float(cap), 1.0), 0.0, 1.0)
	create_tween().tween_property(hero, "aura", power if amount > 0 else 0.0, 0.3)
	if gained <= 0 or amount <= 0:
		_fill = to
		_tag.queue_redraw()
		return
	_fill_tw = create_tween()
	_fill_tw.tween_property(self, "_fill", to, 0.35).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	_tag_tw = create_tween()
	_tag_tw.tween_property(_tag, "scale", Vector2(1.1, 1.4), 0.08)
	_tag_tw.tween_property(_tag, "scale", Vector2.ONE, 0.2).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)


# SCATTER（金鑰匙）落下：小紅帽的劍點燃、全身泛出火光，張數越多燒越旺（1 張小火、2 張大火、3 張以上烈焰）；
# 0 是熄掉。點燃（變旺）那一下閃一道火色殘影、光再亮一點
func scatter_fire(count: int) -> void:
	var to: float = [0.0, 0.45, 0.75, 1.0][clampi(count, 0, 3)]
	if to > hero.flame + 0.01:
		hero.flare = 1.0
		create_tween().tween_property(hero, "flare", 0.0, 0.5)
		hero.ghost(Color(1.0, 0.55, 0.15, 0.55), 0.35)
	var dur := 0.25 if to > hero.flame else 0.8
	var tw := create_tween().set_parallel()
	tw.tween_property(hero, "flame", to, dur)
	tw.tween_property(hero, "glow", to, dur)


# 狼站定了：能量條放大淡掉、金光收回，接著小紅帽把存的傷害一刀打出去
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
		_fill = 0.0
		_tag.scale = Vector2.ONE
		_tag.modulate.a = 1.0)


# ---------- 敵人 ----------

# 大野狼從右邊的陰影裡走出來
func spawn_enemy(kind: String) -> void:
	enemy = Fighter.new({
		"idle": Art.tex("res://art/field/wolf.webp"),
		"hurt": Art.tex("res://art/field/wolf-hurt.webp"),
		"walk1": Art.tex("res://art/field/wolf-walk-1.webp"),
		"walk2": Art.tex("res://art/field/wolf-walk-2.webp"),
		"walk3": Art.tex("res://art/field/wolf-walk-3.webp"),
		"walk4": Art.tex("res://art/field/wolf-walk-4.webp"),
	}, "walk1")
	enemy.sizing = ["idle"]
	# 走進場時 4 格走路輪流播，站定後換回站姿
	enemy.run_frames = ["walk1", "walk2", "walk3", "walk4"]
	enemy.run_fps = 7.0
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
		enemy.set_pose("idle")
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


# 小紅帽出招：連擊段數（level）越多招式越多——
# 1 衝上去一刀；2 交叉兩刀；3 再接升龍斬（跳起往上砍）；4 亂舞五刀拖殘影、收一記重斬；
# 5 以上亂舞後穿過狼身來回各兩刀，再跳起轉身落地重劈。每一刀都先蓄力再砍出去，狼受擊（換受擊立繪、往後仰）、噴火花；
# crit（大獎）刀光更大、震得更兇；turbo 時整套快一點
func strike(level: int, crit := false) -> void:
	if not enemy:
		return
	_sp = 0.6 if turbo else 1.0
	_crit = crit
	var home := size.x * HERO_X
	# 上一招還在退回來的話直接接著衝
	if _lunge:
		_lunge.kill()
	_striking = true
	hero.set_pose("slash")
	await _dash(_reach(), 0.11, level >= 3)
	Sfx.play("throw")
	if level <= 1:
		await _cut(0)
	elif level == 2:
		await _cut(0, -0.7)
		await _cut(1, 0.7)
	elif level == 3:
		await _cut(0, -0.7)
		await _cut(1, 0.7)
		await _rising()
	elif level == 4:
		await _flurry(5)
		await _heavy()
	else:
		await _flurry(3)
		await _phantom()
		await _plunge()
	await _wait(0.08)
	_striking = false
	# 退回原位
	hero.tilt = 0.0
	hero.face(1.0)
	_lunge = create_tween()
	_lunge.tween_property(hero, "position:x", home, 0.24 * _sp).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	_lunge.tween_callback(func():
		if hero.pose == "slash":
			hero.set_pose("run" if walking else "stance"))


# 衝刺停下來砍的位置：狼身體的左緣（照站著的立繪算，受擊時往後仰不算）再往回一點，劍剛好砍到狼、人不會疊進狼身裡
func _reach() -> float:
	var wolf_left: float = enemy.position.x - enemy.height * enemy.widest() * 0.42
	return maxf(size.x * HERO_X, wolf_left - hero.height * 0.4)


func _wait(t: float) -> void:
	await get_tree().create_timer(t * _sp).timeout


# 衝到 x（往前傾、腳下揚起塵土）；trail 時一路留殘影
func _dash(x: float, t: float, trail: bool) -> void:
	var dir := signf(x - hero.position.x)
	_dust(Vector2(hero.position.x, ground), 7, dir)
	hero.tilt = 0.12 * dir
	_lunge = create_tween()
	_lunge.tween_property(hero, "position:x", x, t * _sp).set_ease(Tween.EASE_OUT)
	if trail:
		var n := 4
		for i in n:
			_lunge.parallel().tween_callback(func(): hero.ghost(GHOST, 0.28)).set_delay(t * _sp * i / n)
	await _lunge.finished
	hero.tilt = 0.0


# 一刀：先蓄力（收刀、身體往後一仰）再砍出去（往前踏一小步、身體一伸），在狼身上畫劍光，狼受擊、噴火花；
# k 決定劍光方向（沒給 angle 時隨機）
func _cut(k: int, angle := INF, big := 1.0) -> void:
	if not enemy:
		return
	hero.set_pose("windup")
	hero.tilt = -0.05
	await get_tree().create_timer(0.05 * _sp).timeout
	hero.set_pose("slash")
	hero.tilt = 0.06
	hero.bump(Vector2(1.08, 0.94), 0.04, 0.18)
	hero.position.x += 6.0
	_hit(k, angle, big, 0.45)
	await get_tree().create_timer(0.09 * _sp).timeout
	hero.tilt = 0.0


# 打中：劍光、火花、狼受擊、音效（不換姿勢；跳起來砍時直接用）
func _hit(k: int, angle := INF, big := 1.0, strength := 0.45) -> void:
	if not enemy:
		return
	var a := angle if angle != INF else _rng.randf_range(-1.0, 1.0) + (k % 2) * 0.9
	var at := enemy_center() + Vector2(_rng.randf_range(-14, 14), _rng.randf_range(-30, 24))
	_slash(at, a, big * (1.25 if _crit else 1.0))
	_burst(at, Color("ffb070"), 8)
	enemy.hurt(strength)
	Sfx.play("hit", 1.1 + k * 0.06, -7.0)


# 亂舞：n 刀連砍，身體前後抖、每刀留殘影
func _flurry(n: int) -> void:
	for k in n:
		hero.ghost(GHOST, 0.22)
		hero.position.x += -10.0 if k % 2 else 6.0
		await _cut(k)


# 升龍斬：蹲一下蓄力、跳起來往上砍一刀（劍光直的、用跳起的立繪），再落地（壓扁、揚起塵土）
func _rising() -> void:
	hero.set_pose("windup")
	hero.bump(Vector2(1.1, 0.88), 0.05, 0.12)
	await _wait(0.06)
	_dust(Vector2(hero.position.x, ground), 8)
	hero.set_pose("jump")
	hero.bump(Vector2(0.92, 1.1), 0.06, 0.2)
	var up := create_tween()
	up.tween_property(hero, "hop_y", hero.height * 0.45, 0.16 * _sp).set_ease(Tween.EASE_OUT)
	for i in 3:
		up.parallel().tween_callback(func(): hero.ghost(GHOST, 0.25)).set_delay(0.05 * _sp * i)
	await get_tree().create_timer(0.06 * _sp).timeout
	_hit(2, -PI * 0.5, 1.3, 0.8)
	await get_tree().create_timer(0.09 * _sp).timeout
	# 砍完時往上跳的補間可能已經結束了（finished 已經發過），還在跑才等
	if up.is_running():
		await up.finished
	var down := create_tween()
	down.tween_property(hero, "hop_y", 0.0, 0.16 * _sp).set_ease(Tween.EASE_IN)
	await down.finished
	hero.set_pose("slash")
	hero.land(0.8)
	_dust(Vector2(hero.position.x, ground), 10)


# 重斬：往後收一下蓄力，再一記橫的大劍光，畫面震
func _heavy() -> void:
	hero.set_pose("windup")
	hero.tilt = -0.08
	var back := create_tween()
	back.tween_property(hero, "position:x", hero.position.x - 16.0, 0.1 * _sp)
	await back.finished
	hero.ghost(GHOST, 0.3)
	hero.position.x += 22.0
	await _cut(0, 0.0, 1.7)
	_burst(enemy_center(), Art.GOLD, 22)
	quake.emit(8.0 if _crit else 5.0)


# 穿身斬：拖著殘影穿過狼到另一邊（途中兩刀），轉身再穿回來（再兩刀）
func _phantom() -> void:
	var far := minf(enemy.position.x + enemy.height * 0.45, size.x * 0.95)
	await _pass(far, 1.0)
	hero.face(-1.0)
	await _wait(0.06)
	await _pass(_reach(), -1.0)
	hero.face(1.0)


func _pass(x: float, dir: float) -> void:
	hero.tilt = 0.14 * dir
	var tw := create_tween()
	tw.tween_property(hero, "position:x", x, 0.16 * _sp).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN_OUT)
	for i in 5:
		tw.parallel().tween_callback(func(): hero.ghost(GHOST, 0.3)).set_delay(0.032 * _sp * i)
	await get_tree().create_timer(0.07 * _sp).timeout
	if enemy:
		var at := enemy_center()
		_slash(at, -0.6 * dir, 1.2)
		_slash(at + Vector2(0, 10), 0.6 * dir, 1.2)
		_burst(at, Color("ffb070"), 12)
		enemy.hurt(0.8)
		Sfx.play("hit", 1.25, -5.0)
	await tw.finished
	hero.tilt = 0.0


# 落地重劈：蹲一下、跳很高（跳起的立繪）、空中轉一圈，從上往下劈，落地時壓扁、揚起塵土、畫面大震、噴一圈金火花
func _plunge() -> void:
	hero.set_pose("windup")
	hero.bump(Vector2(1.12, 0.86), 0.05, 0.12)
	await _wait(0.06)
	_dust(Vector2(hero.position.x, ground), 10)
	hero.set_pose("jump")
	hero.bump(Vector2(0.9, 1.12), 0.06, 0.22)
	var tw := create_tween()
	tw.tween_property(hero, "hop_y", hero.height * 0.5, 0.2 * _sp).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_property(hero, "position:x", _reach() - 10.0, 0.2 * _sp)
	tw.tween_property(hero, "turn", -1.0, 0.07 * _sp)
	tw.tween_property(hero, "turn", 1.0, 0.07 * _sp)
	tw.tween_callback(func():
		hero.set_pose("slash")
		hero.ghost(GHOST, 0.3))
	tw.tween_property(hero, "hop_y", 0.0, 0.09 * _sp).set_ease(Tween.EASE_IN)
	await tw.finished
	hero.turn = 1.0
	hero.land(1.4)
	_dust(Vector2(hero.position.x, ground), 16)
	if not enemy:
		return
	var at := enemy_center()
	_slash(at, PI * 0.5, 1.9)
	_burst(at, Art.GOLD, 30)
	_burst(Vector2(at.x, ground), Color("ffb070"), 20)
	enemy.hurt(1.2)
	Sfx.play("hit", 0.8, 0.0)
	quake.emit(12.0 if _crit else 8.0)


# 一道劍光：月牙形（中間厚、兩頭尖），從刀頭往前掃過去、尾巴跟著收掉；月牙的正中央落在打中的位置（劃過狼身）。
# 三層疊起來：外圈一層橘金柔光（白天的亮背景上才有輪廓）、中間金色的刀身、外緣一條白芯，掃出去的那一下中間閃一顆星光。
# angle 是方向、big 是大小
func _slash(at: Vector2, angle: float, big := 1.0) -> void:
	var arc := Node2D.new()
	var r := size.y * 0.24 * big
	arc.position = at - Vector2.from_angle(angle) * r * 0.95
	arc.rotation = angle
	arc.set_meta("p", 0.0)
	arc.draw.connect(func(): _draw_slash(arc, r, arc.get_meta("p")))
	fx.add_child(arc)
	var tw := arc.create_tween()
	tw.tween_method(func(v: float):
		arc.set_meta("p", v)
		arc.queue_redraw(), 0.0, 1.0, 0.32)
	tw.tween_callback(arc.queue_free)


const SLASH_SPAN := 2.5
const SLASH_SEG := 26
# 三層：[寬度倍率, 半徑偏移, 顏色]
const SLASH_LAYERS := [
	[2.0, 0.05, Color(1.0, 0.48, 0.12, 0.42)],
	[1.0, 0.0, Color(1.0, 0.84, 0.42, 0.95)],
	[0.36, -0.005, Color(1.0, 1.0, 0.96, 1.0)],
]


func _draw_slash(c: Node2D, r: float, p: float) -> void:
	# 刀頭在前 40% 的時間掃到底、尾巴從 30% 開始追上去；最後 35% 整道淡掉
	var head := 1.0 - pow(1.0 - clampf(p / 0.4, 0.0, 1.0), 3.0)
	var tail := pow(clampf((p - 0.3) / 0.7, 0.0, 1.0), 1.6)
	if head - tail < 0.01:
		return
	var fade := 1.0 - clampf((p - 0.65) / 0.35, 0.0, 1.0)
	var grow := 1.0 + 0.08 * p
	for layer in SLASH_LAYERS:
		var col: Color = layer[2]
		var outer := PackedVector2Array()
		var inner := PackedVector2Array()
		var alpha := PackedFloat32Array()
		for i in SLASH_SEG + 1:
			var u := lerpf(tail, head, float(i) / SLASH_SEG)
			var th := -SLASH_SPAN / 2.0 + SLASH_SPAN * u
			# 越靠近刀頭越厚越亮；整道照月牙的形狀中間厚、兩頭尖
			var lead := clampf((u - tail) / maxf(head - tail, 0.001), 0.0, 1.0)
			var w: float = maxf(0.8, r * 0.2 * layer[0] * sin(PI * u) * (0.3 + 0.7 * lead))
			var ro: float = r * (1.0 + layer[1]) * grow
			outer.append(Vector2.from_angle(th) * ro)
			inner.append(Vector2.from_angle(th) * (ro - w))
			alpha.append(col.a * fade * (0.1 + 0.9 * lead))
		# 一段一段畫成四邊形（外緣亮、內緣淡），不用整個多邊形三角化，兩頭尖的地方才不會出錯
		for i in SLASH_SEG:
			c.draw_polygon(PackedVector2Array([outer[i], outer[i + 1], inner[i + 1], inner[i]]),
				PackedColorArray([Color(col, alpha[i]), Color(col, alpha[i + 1]), Color(col, alpha[i + 1] * 0.25), Color(col, alpha[i] * 0.25)]))
	# 星光：掃出去的那一下，月牙中間閃一顆四角星（不跟著劍光轉，永遠正的）
	var g := sin(PI * clampf(p / 0.45, 0.0, 1.0))
	if g > 0.01:
		var at := Vector2(r * grow * 0.98, 0)
		var sz := r * 0.22 * g
		for k in 2:
			var pts := PackedVector2Array()
			for j in 8:
				var rr := sz * (1.0 if j % 2 == 0 else 0.16) * (1.0 - k * 0.45)
				pts.append(at + Vector2.from_angle(PI / 4.0 * j - c.rotation) * rr)
			c.draw_colored_polygon(pts, Color(1, 1, 1, 0.95 * g) if k == 1 else Color(1, 0.8, 0.4, 0.6 * g))


# 連擊計數：第 n 段打中（或沒有狼可打、傷害存起來時）；一輪打完收起來
func combo(n: int) -> void:
	_combo.home = _combo_home()
	_combo.hit(n)


func end_combo() -> void:
	_combo.finish()


# 計數放在 logo 右邊、兩個角色頭上的樹梢
func _combo_home() -> Vector2:
	return Vector2(maxf(avoid.end.x + 26.0, size.x * 0.22), size.y * 0.08 + ComboCounter.NUM_SIZE * 0.78)


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
	# 打倒了：舉劍跳起來歡呼（招式還沒收完的話只跳、不換姿勢）
	if not _striking:
		hero.set_pose("jump")
		_pose_hold = _t + 0.45
	hero.cheer()


# 腳下揚起的塵土：幾團淡褐色的柔光往外散、慢慢變大淡掉；dir 是往哪邊踢（0 是往兩邊）、big 是大小
func _dust(at: Vector2, amount := 10, dir := 0.0, big := 1.0) -> void:
	var p := CPUParticles2D.new()
	p.position = at
	p.one_shot = true
	p.explosiveness = 0.85
	p.amount = amount
	p.lifetime = 0.55
	p.texture = Fighter._soft_dot()
	p.direction = Vector2(-dir, -0.35) if dir != 0.0 else Vector2.UP
	p.spread = 30.0 if dir != 0.0 else 80.0
	p.initial_velocity_min = 40.0
	p.initial_velocity_max = 120.0
	p.damping_min = 120.0
	p.damping_max = 200.0
	p.gravity = Vector2(0, -30)
	var k := size.y / 300.0 * big
	p.scale_amount_min = 0.35 * k
	p.scale_amount_max = 0.65 * k
	var curve := Curve.new()
	curve.add_point(Vector2(0.0, 0.5))
	curve.add_point(Vector2(1.0, 1.0))
	p.scale_amount_curve = curve
	p.color = Color(0.86, 0.76, 0.56, 0.55)
	var ramp := Gradient.new()
	ramp.set_color(0, Color.WHITE)
	ramp.set_color(1, Color(1, 1, 1, 0))
	p.color_ramp = ramp
	fx.add_child(p)
	p.emitting = true
	p.finished.connect(p.queue_free)


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
