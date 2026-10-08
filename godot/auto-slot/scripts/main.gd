# 自走SLOT 主畫面（暗黑哥德版介面）：上方自走區（紙板人偶，之後再換）、中間荊棘木框 SLOT、
# 下方投注列（選單、BET、轉動、TOTAL BET、TURBO、AUTO）與 WIN 名牌；
# 賠率表與設定、BIG WIN、BONUS（金鑰匙）→ Free Spins
extends Control

const Rules := preload("res://scripts/rules.gd")
const Art := preload("res://scripts/art.gd")
const Field := preload("res://scripts/field.gd")
const SlotView := preload("res://scripts/slot_view.gd")
const IconButton := preload("res://scripts/icon_button.gd")
const SAVE_PATH := "user://save.cfg"
const SAVE_VERSION := 2
const TIERS := [[50, "SUPER WIN"], [25, "MEGA WIN"], [10, "BIG WIN"]]
# 介面以 430 寬設計，畫面窄或寬時整組等比縮放
const DESIGN_W := 430.0

var state := {"coins": Rules.START_COINS, "bet": 2, "level": 1, "xp": 0, "kills": 0, "turbo": false, "sound": true}
var rng := RandomNumberGenerator.new()
var started := false
var busy := false
var auto := false
var enemy := {}
var enemy_ready := false
var walk_left := 2.5
# Free Spins 進行中
var free := false
var fs_left := 0
var fs_done := 0
var fs_total := 0

var field: Control
var slot: Control
var hud: Control
var betbar: Control
var winplate: Control
var overlay: Control

var _floor: TextureRect
var _ui := 1.0
var _coins_label: Label
var _level_label: Label
var _xp_bar: Control
var _xp := 0.0
var _stage_label: Label
var _enemy_box: Control
var _hp_name: Label
var _hp_num: Label
var _hp_bar: Control
var _hp := 1.0
var _bet_label: Label
var _total_label: Label
var _win_cap: Label
var _win_label: Label
var _deco: Control
var _band := Rect2()
var _spikes: Array = []
var _badge: Control
var _badge_label: Label
var _mult := 1
var _spin_btn: BaseButton
var _auto_btn: BaseButton
var _turbo_btn: BaseButton
var _minus_btn: BaseButton
var _plus_btn: BaseButton
var _callout: Label
var _callout_sub: Label
var _toast: Label
var _bigwin: Control
var _big_title: Label
var _big_amount: Label
var _big_skip := false
var _menu: Control
var _menu_body: VBoxContainer
var _shown_coins := 0.0
var _queue: Array = []
var _working := false
var _toast_tween: Tween
var _auto_running := false
var _defeating := false
var _hp_tween: Tween


func _ready() -> void:
	rng.randomize()
	_load()
	set_anchors_preset(Control.PRESET_FULL_RECT)
	var bg := ColorRect.new()
	bg.color = Art.INK
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(bg)
	_floor = TextureRect.new()
	_floor.texture = Art.ui("floor")
	_floor.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_floor.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	_floor.modulate = Color(0.62, 0.6, 0.66)
	_floor.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_floor)
	var fade := _painter(func(c: Control):
		c.draw_polygon(PackedVector2Array([Vector2.ZERO, Vector2(c.size.x, 0), c.size, Vector2(0, c.size.y)]),
			PackedColorArray([Art.INK, Art.INK, Color(Art.INK, 0.0), Color(Art.INK, 0.0)])))
	fade.name = "FloorFade"
	_floor.add_child(fade)
	field = Field.new()
	add_child(field)
	field.tint = Field.TINTS[(_stage() - 1) % Field.TINTS.size()]
	slot = SlotView.new()
	slot.z_index = 20
	add_child(slot)
	slot.turbo = state.turbo
	_deco = _painter(_draw_deco)
	_deco.z_index = 19
	add_child(_deco)
	_badge = _build_badge()
	_badge.z_index = 22
	add_child(_badge)
	betbar = _build_betbar()
	betbar.z_index = 20
	add_child(betbar)
	winplate = _build_winplate()
	winplate.z_index = 20
	add_child(winplate)
	hud = _build_hud()
	hud.z_index = 30
	add_child(hud)
	overlay = Control.new()
	overlay.z_index = 50
	overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(overlay)
	_build_overlay()
	slot.set_board(Rules.spin_board(rng))
	Sfx.enabled = state.sound
	get_viewport().size_changed.connect(_layout)
	_layout()
	_shown_coins = state.coins
	_refresh_all()
	_set_ladder(0)
	_boot()


# ---------- 排版 ----------

# 照設計稿（430 寬）由下往上排：底部留森林地面 → WIN 名牌 → 投注底帶（轉動鍵往上突出）→
# 森林地面 → SLOT 木框 → 剩下的高度給自走區（紅寶石花飾壓在自走區下緣）
func _layout() -> void:
	var vp := get_viewport_rect().size
	var w := minf(vp.x, 480.0)
	var x0 := (vp.x - w) / 2.0
	_ui = clampf(w / DESIGN_W, 0.8, 1.1)
	var u := _ui
	var dw := w / u
	# 木框外緣離畫面左右各 6，藤蔓可以伸出畫面
	var meta: Dictionary = Art.ui_meta().frame
	var inner_w: float = meta.inner[2] - meta.inner[0]
	var wood: float = meta.wood
	var reel_w := (w - 12.0) / (1.0 + 2.0 * wood / inner_w)
	var slot_h: float = slot.layout(reel_w)
	var win_y := vp.y - (31.0 + 41.0) * u
	winplate.scale = Vector2(u, u)
	winplate.size = Vector2(178, 41)
	winplate.position = Vector2((vp.x - 178.0 * u) / 2.0, win_y)
	var band_y := win_y - (11.0 + 66.0) * u
	_band = Rect2(0, band_y, vp.x, 66.0 * u)
	betbar.scale = Vector2(u, u)
	betbar.size = Vector2(dw, 66)
	betbar.position = Vector2(x0, band_y)
	_layout_betbar(dw)
	var wood_bottom := band_y - 38.0 * u
	slot.position = Vector2((vp.x - reel_w) / 2.0, wood_bottom - (slot.wood_rect.end.y - slot_h) - slot_h)
	var field_h := maxf(slot.position.y + slot.wood_rect.position.y + 24.0 * u, 150.0)
	field.position = Vector2.ZERO
	field.size = Vector2(vp.x, field_h)
	_floor.position = Vector2(0, field_h - 40.0)
	_floor.size = Vector2(vp.x, vp.y - _floor.position.y)
	_floor.get_node("FloorFade").size = Vector2(vp.x, 80)
	# 金色尖飾：木框下緣 → 轉動鍵上緣、轉動鍵下緣 → WIN 名牌
	var cx := vp.x / 2.0
	var spin_top := band_y + (23.0 - 48.0) * u
	var spin_bottom := band_y + (23.0 + 48.0) * u
	_spikes = [[Vector2(cx, wood_bottom - 4.0 * u), Vector2(cx, spin_top + 6.0 * u)], [Vector2(cx, spin_bottom - 4.0 * u), Vector2(cx, win_y + 4.0 * u)]]
	_deco.size = vp
	_deco.queue_redraw()
	_badge.scale = Vector2(u, u)
	_badge.position = slot.position + slot.gem_point - _badge.size / 2.0
	hud.scale = Vector2(u, u)
	hud.position = Vector2(x0, 0)
	hud.size = Vector2(dw, 64)
	_layout_hud(dw)
	overlay.size = vp
	_layout_overlay()


func _painter(fn: Callable) -> Control:
	var c := Control.new()
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	c.draw.connect(func(): fn.call(c))
	return c


# 投注底帶（橫跨整個畫面的深色帶，上下金線）與金色尖飾
func _draw_deco(c: Control) -> void:
	var r := _band
	c.draw_rect(r, Color(0.02, 0.015, 0.02, 0.88))
	c.draw_rect(Rect2(r.position.x, r.position.y, r.size.x, 6.0 * _ui), Color(0, 0, 0, 0.5))
	c.draw_line(r.position, Vector2(r.end.x, r.position.y), Color(Art.GOLD_DEEP, 0.7), 1.0)
	c.draw_line(Vector2(r.position.x, r.end.y), r.end, Color(Art.GOLD_DEEP, 0.5), 1.0)
	for sp in _spikes:
		var a: Vector2 = sp[0]
		var b: Vector2 = sp[1]
		var m := (a + b) / 2.0
		var k := 4.0 * _ui
		c.draw_line(a, b, Art.GOLD_DEEP, 2.0 * _ui)
		c.draw_line(a, b, Art.GOLD, 0.8 * _ui)
		c.draw_colored_polygon(PackedVector2Array([m + Vector2(0, -k * 1.8), m + Vector2(k, 0), m + Vector2(0, k * 1.8), m + Vector2(-k, 0)]), Art.GOLD)
		c.draw_colored_polygon(PackedVector2Array([m + Vector2(0, -k * 0.9), m + Vector2(k * 0.5, 0), m + Vector2(0, k * 0.9), m + Vector2(-k * 0.5, 0)]), Art.RED)
		for e in [a, b]:
			c.draw_circle(e, 2.2 * _ui, Art.GOLD)


# 深色底、古金細邊的面板
func _plate_box(radius := 8, alpha := 0.88) -> StyleBoxFlat:
	var sb := Art.box(Color(Art.PANEL, alpha), radius, 1, Art.PANEL_EDGE)
	sb.shadow_color = Color(0, 0, 0, 0.5)
	sb.shadow_size = 4
	sb.shadow_offset = Vector2(0, 2)
	return sb


func _plate(radius := 8) -> Panel:
	var p := Panel.new()
	p.add_theme_stylebox_override("panel", _plate_box(radius))
	p.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return p


# 名牌底圖（art/ui/plate.webp）：整張依高度等比縮，左右兩端（四角金花）不變形、中段橫向拉長
func _nameplate() -> Control:
	var tex := Art.ui("plate")
	return _painter(func(c: Control):
		var k := c.size.y / tex.get_height()
		var cap := 80.0
		var w := cap * k
		var tw := float(tex.get_width())
		c.draw_texture_rect_region(tex, Rect2(0, 0, w, c.size.y), Rect2(0, 0, cap, tex.get_height()))
		c.draw_texture_rect_region(tex, Rect2(w, 0, c.size.x - w * 2.0, c.size.y), Rect2(cap, 0, tw - cap * 2.0, tex.get_height()))
		c.draw_texture_rect_region(tex, Rect2(c.size.x - w, 0, w, c.size.y), Rect2(tw - cap, 0, cap, tex.get_height())))


# 圓形頭像：符號磚的臉部裁成圓形，外圈深紅＋古金線
func _portrait(tile: String, center_uv: Vector2, radius_uv: float) -> Control:
	var tex := Art.symbol(tile)
	return _painter(func(c: Control):
		var r := c.size.x / 2.0
		var o := Vector2(r, r)
		c.draw_circle(o + Vector2(0, 2), r, Color(0, 0, 0, 0.55))
		c.draw_circle(o, r, Art.GOLD_DEEP)
		c.draw_circle(o, r - 1.2, Color("2a0a0c"))
		c.draw_circle(o, r * 0.86, Art.BLOOD)
		var pts := PackedVector2Array()
		var uvs := PackedVector2Array()
		for k in 40:
			var d := Vector2.RIGHT.rotated(k * TAU / 40.0)
			pts.append(o + d * r * 0.8)
			uvs.append(center_uv + d * radius_uv)
		c.draw_colored_polygon(pts, Color.WHITE, uvs, tex)
		c.draw_arc(o, r * 0.8, 0, TAU, 48, Art.GOLD, 1.2, true)
		c.draw_arc(o, r - 0.6, 0, TAU, 48, Color(Art.GOLD, 0.8), 1.0, true))


# ---------- 上方資訊列：頭像＋等級、金幣、關卡、敵人（尺寸照設計稿） ----------

func _build_hud() -> Control:
	var h := Control.new()
	h.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var level := _plate(5)
	level.name = "Level"
	h.add_child(level)
	_level_label = Art.label("Lv. 1", Art.label_settings(12, Art.CREAM, "num", 3, Art.INK), HORIZONTAL_ALIGNMENT_LEFT)
	level.add_child(_level_label)
	_xp_bar = _painter(func(c: Control):
		var r := Rect2(Vector2.ZERO, c.size)
		c.draw_style_box(Art.box(Color(0, 0, 0, 0.75), 3, 1, Color(Art.GOLD_DEEP, 0.6)), r)
		if _xp > 0.0:
			var fill := Rect2(Vector2(1, 1), Vector2((c.size.x - 2) * _xp, c.size.y - 2))
			c.draw_style_box(Art.box(Art.GOLD_DEEP, 2), fill)
			c.draw_style_box(Art.box(Art.GOLD, 2), Rect2(fill.position, Vector2(fill.size.x, fill.size.y * 0.55))))
	level.add_child(_xp_bar)
	var avatar := _portrait("hood", Vector2(0.5, 0.4), 0.3)
	avatar.name = "Avatar"
	h.add_child(avatar)
	var wallet := _plate(13)
	wallet.name = "Wallet"
	h.add_child(wallet)
	var coin := TextureRect.new()
	coin.name = "Coin"
	coin.texture = Art.ui("coin")
	coin.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	coin.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	coin.mouse_filter = Control.MOUSE_FILTER_IGNORE
	wallet.add_child(coin)
	_coins_label = Art.label("50,000", Art.label_settings(14, Art.CREAM, "num", 3, Art.INK))
	wallet.add_child(_coins_label)
	var refill := IconButton.new("refill")
	refill.name = "Refill"
	refill.pressed.connect(_on_refill)
	wallet.add_child(refill)
	# 關卡小旗：兩端尖角＋金色菱形
	var stage := _painter(func(c: Control):
		var s := c.size
		var m := s.y / 2.0
		var pts := PackedVector2Array([Vector2(7, 0), Vector2(s.x - 7, 0), Vector2(s.x, m), Vector2(s.x - 7, s.y), Vector2(7, s.y), Vector2(0, m)])
		c.draw_colored_polygon(pts, Color(Art.PANEL, 0.92))
		pts.append(pts[0])
		c.draw_polyline(pts, Art.PANEL_EDGE, 1.0, true)
		for side in [-1.0, 1.0]:
			var tip := Vector2(s.x / 2.0 + side * (s.x / 2.0 + 6.0), m)
			c.draw_colored_polygon(PackedVector2Array([tip + Vector2(0, -2.5), tip + Vector2(2.5, 0), tip + Vector2(0, 2.5), tip + Vector2(-2.5, 0)]), Art.GOLD)
			c.draw_line(tip - Vector2(side * 2.5, 0), tip - Vector2(side * 7.0, 0), Art.GOLD_DEEP, 1.0))
	stage.name = "Stage"
	h.add_child(stage)
	_stage_label = Art.label("Stage 1-1", Art.label_settings(9, Art.CREAM, "light"))
	stage.add_child(_stage_label)
	# 敵人：名字、血條、狼頭像（有敵人時才出現）
	_enemy_box = Control.new()
	_enemy_box.name = "Enemy"
	_enemy_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_enemy_box.modulate.a = 0.0
	h.add_child(_enemy_box)
	var eplate := _plate(5)
	eplate.name = "Plate"
	_enemy_box.add_child(eplate)
	_hp_name = Art.label("Big Bad Wolf", Art.label_settings(10, Art.CREAM, "num", 3, Art.INK), HORIZONTAL_ALIGNMENT_RIGHT)
	eplate.add_child(_hp_name)
	_hp_bar = _painter(func(c: Control):
		var r := Rect2(Vector2.ZERO, c.size)
		c.draw_style_box(Art.box(Color("1a0506"), 3, 1, Color(Art.GOLD_DEEP, 0.8)), r)
		if _hp > 0.0:
			var fill := Rect2(Vector2(1, 1), Vector2((c.size.x - 2) * _hp, c.size.y - 2))
			c.draw_style_box(Art.box(Art.BLOOD, 2), fill)
			c.draw_style_box(Art.box(Art.RED, 2), Rect2(fill.position, Vector2(fill.size.x, fill.size.y * 0.55))))
	eplate.add_child(_hp_bar)
	_hp_num = Art.label("", Art.label_settings(7, Color.WHITE, "num", 2, Art.INK), HORIZONTAL_ALIGNMENT_RIGHT)
	_hp_bar.add_child(_hp_num)
	var wolf := _portrait("wolf", Vector2(0.42, 0.45), 0.3)
	wolf.name = "Portrait"
	_enemy_box.add_child(wolf)
	return h


func _layout_hud(dw: float) -> void:
	var avatar: Control = hud.get_node("Avatar")
	avatar.position = Vector2(10, 10)
	avatar.size = Vector2(38, 38)
	var level: Control = hud.get_node("Level")
	level.position = Vector2(40, 15)
	level.size = Vector2(97, 26)
	_level_label.position = Vector2(14, 0)
	_level_label.size = Vector2(level.size.x - 18, 15)
	_xp_bar.position = Vector2(14, 16)
	_xp_bar.size = Vector2(level.size.x - 22, 6)
	var wallet: Control = hud.get_node("Wallet")
	wallet.size = Vector2(129, 26)
	wallet.position = Vector2((dw - wallet.size.x) / 2.0, 15)
	hud.get_node("Wallet/Coin").position = Vector2(3, 3)
	hud.get_node("Wallet/Coin").size = Vector2(20, 20)
	_coins_label.position = Vector2(24, 0)
	_coins_label.size = Vector2(wallet.size.x - 48, 26)
	var refill: Control = hud.get_node("Wallet/Refill")
	refill.size = Vector2(20, 20)
	refill.position = Vector2(wallet.size.x - 23, 3)
	var stage: Control = hud.get_node("Stage")
	stage.size = Vector2(80, 14)
	stage.position = Vector2((dw - stage.size.x) / 2.0, 46)
	_stage_label.size = stage.size
	_enemy_box.position = Vector2(dw - 138, 10)
	_enemy_box.size = Vector2(128, 38)
	var portrait: Control = _enemy_box.get_node("Portrait")
	portrait.size = Vector2(38, 38)
	portrait.position = Vector2(_enemy_box.size.x - 38, 0)
	var eplate: Control = _enemy_box.get_node("Plate")
	eplate.position = Vector2(0, 5)
	eplate.size = Vector2(_enemy_box.size.x - 30, 26)
	_hp_name.position = Vector2(4, 0)
	_hp_name.size = Vector2(eplate.size.x - 12, 14)
	_hp_bar.position = Vector2(4, 15)
	_hp_bar.size = Vector2(eplate.size.x - 12, 8)
	_hp_num.position = Vector2(0, -1)
	_hp_num.size = _hp_bar.size - Vector2(3, 0)


# ---------- 倍率：頂端紅寶石上的徽章（連鎖到 ×2 以上才出現） ----------

func _build_badge() -> Control:
	var b := _painter(func(c: Control):
		var o := c.size / 2.0
		var r := c.size.x / 2.0
		for k in 4:
			c.draw_circle(o, r * (1.25 - k * 0.07), Color(1, 0.3, 0.1, 0.07))
		c.draw_circle(o, r, Art.GOLD_DEEP)
		c.draw_circle(o, r - 1.5, Art.GOLD)
		c.draw_circle(o, r - 3.0, Color("3a0608"))
		c.draw_circle(o, r - 4.5, Art.BLOOD))
	b.size = Vector2(34, 34)
	b.pivot_offset = b.size / 2.0
	b.modulate.a = 0.0
	_badge_label = Art.label("×2", Art.label_settings(13, Art.GOLD_LIGHT, "num", 3, Art.GOLD_INK))
	_badge_label.size = b.size
	b.add_child(_badge_label)
	return b


func _set_ladder(k: int) -> void:
	var mults: Array = Rules.FS_MULTIPLIERS if free else Rules.MULTIPLIERS
	var m: int = mults[mini(k, mults.size() - 1)]
	var show := m > 1
	_badge_label.text = "×%d" % m
	if show and m != _mult:
		_badge.scale = Vector2(1.8, 1.8) * _ui
		create_tween().tween_property(_badge, "scale", Vector2(_ui, _ui), 0.3).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	create_tween().tween_property(_badge, "modulate:a", 1.0 if show else 0.0, 0.15)
	_mult = m


func _refresh_fs() -> void:
	_win_cap.text = "FREE SPINS  %d / %d" % [fs_done, fs_done + fs_left] if free else "WIN"


# ---------- 投注列：選單、BET、轉動、TOTAL BET、TURBO、AUTO（尺寸照設計稿，底帶高 66） ----------

func _build_betbar() -> Control:
	var bar := Control.new()
	bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var menu := IconButton.new("menu")
	menu.name = "Menu"
	menu.pressed.connect(_open_menu)
	bar.add_child(menu)
	var bet := _box("BET")
	bet.name = "Bet"
	bar.add_child(bet)
	_bet_label = Art.label("20", Art.label_settings(14, Art.CREAM, "num", 3, Art.INK))
	bet.add_child(_bet_label)
	_minus_btn = IconButton.new("minus")
	_minus_btn.pressed.connect(func(): _change_bet(-1))
	bet.add_child(_minus_btn)
	_plus_btn = IconButton.new("plus")
	_plus_btn.pressed.connect(func(): _change_bet(1))
	bet.add_child(_plus_btn)
	var total := _box("TOTAL BET")
	total.name = "Total"
	bar.add_child(total)
	_total_label = Art.label("400", Art.label_settings(14, Art.CREAM, "num", 3, Art.INK))
	total.add_child(_total_label)
	_turbo_btn = IconButton.new("turbo", "TURBO")
	_turbo_btn.name = "Turbo"
	_turbo_btn.toggle_mode = true
	_turbo_btn.set_pressed_no_signal(state.turbo)
	_turbo_btn.toggled.connect(_on_turbo)
	bar.add_child(_turbo_btn)
	_auto_btn = IconButton.new("auto", "AUTO")
	_auto_btn.name = "Auto"
	_auto_btn.toggle_mode = true
	_auto_btn.toggled.connect(_on_auto)
	bar.add_child(_auto_btn)
	_spin_btn = IconButton.new("spin")
	_spin_btn.name = "Spin"
	_spin_btn.pressed.connect(_on_spin)
	bar.add_child(_spin_btn)
	return bar


func _box(caption: String) -> Panel:
	var p := _plate(7)
	var cap := Art.label(caption, Art.label_settings(8, Art.CREAM, "light"))
	cap.name = "Cap"
	p.add_child(cap)
	return p


func _layout_betbar(dw: float) -> void:
	var cx := dw / 2.0
	var spin_d := 96.0
	_spin_btn.size = Vector2(spin_d, spin_d)
	_spin_btn.position = Vector2(cx - spin_d / 2.0, 23 - spin_d / 2.0)
	var menu: Control = betbar.get_node("Menu")
	menu.size = Vector2(32, 32)
	menu.position = Vector2(10, 17)
	_auto_btn.size = Vector2(29, 41)
	_auto_btn.position = Vector2(dw - 41, 17)
	_turbo_btn.size = Vector2(29, 41)
	_turbo_btn.position = Vector2(_auto_btn.position.x - 38, 17)
	var bet: Control = betbar.get_node("Bet")
	bet.position = Vector2(48, 15)
	bet.size = Vector2(_spin_btn.position.x - 6 - bet.position.x, 39)
	var total: Control = betbar.get_node("Total")
	total.position = Vector2(_spin_btn.position.x + spin_d + 4, 15)
	total.size = Vector2(_turbo_btn.position.x - 6 - total.position.x, 39)
	for b in [bet, total]:
		var cap: Label = b.get_node("Cap")
		cap.position = Vector2(0, 4)
		cap.size = Vector2(b.size.x, 11)
	_minus_btn.size = Vector2(23, 23)
	_minus_btn.position = Vector2(5, 8)
	_plus_btn.size = Vector2(23, 23)
	_plus_btn.position = Vector2(bet.size.x - 28, 8)
	_bet_label.position = Vector2(28, 15)
	_bet_label.size = Vector2(bet.size.x - 56, 20)
	_total_label.position = Vector2(0, 15)
	_total_label.size = Vector2(total.size.x, 20)


# ---------- WIN 名牌（Free Spins 時改寫剩幾轉、累計贏分） ----------

func _build_winplate() -> Control:
	var np := _nameplate()
	_win_cap = Art.label("WIN", Art.label_settings(9, Art.CREAM, "light"))
	_win_cap.position = Vector2(0, 5)
	_win_cap.size = Vector2(178, 12)
	np.add_child(_win_cap)
	_win_label = Art.label("0", Art.label_settings(17, Art.GOLD_LIGHT, "num", 4, Art.GOLD_INK))
	_win_label.position = Vector2(0, 15)
	_win_label.size = Vector2(178, 22)
	np.add_child(_win_label)
	return np


func _set_win(value: int, animate: bool) -> void:
	if not animate:
		_win_label.text = Art.fmt(value)
		return
	var from := float(_win_label.text.replace(",", ""))
	var tw := create_tween()
	tw.tween_method(func(v: float): _win_label.text = Art.fmt(v), from, float(value), 0.45)
	_win_label.pivot_offset = _win_label.size / 2.0
	_win_label.scale = Vector2(1.25, 1.25)
	tw.parallel().tween_property(_win_label, "scale", Vector2.ONE, 0.35).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)


func _change_bet(d: int) -> void:
	if busy:
		return
	state.bet = clampi(state.bet + d, 0, Rules.BET_LEVELS.size() - 1)
	Sfx.play("click")
	_save()
	_refresh_all()


func _on_turbo(on: bool) -> void:
	state.turbo = on
	slot.turbo = on
	Sfx.play("click")
	toast("Turbo on" if on else "Turbo off")
	_save()


# ---------- 疊在最上層：大字、提示、BIG WIN、選單 ----------

func _build_overlay() -> void:
	_callout = Art.label("", Art.label_settings(36, Art.CREAM, "num", 10, Art.INK, 4))
	_callout.modulate.a = 0.0
	overlay.add_child(_callout)
	_callout_sub = Art.label("", Art.label_settings(15, Art.CREAM, "light", 6, Art.INK))
	_callout_sub.modulate.a = 0.0
	overlay.add_child(_callout_sub)
	_toast = Art.label("", Art.label_settings(13, Art.CREAM, "light", 5, Art.INK))
	_toast.modulate.a = 0.0
	overlay.add_child(_toast)
	_bigwin = _painter(func(c: Control):
		var r := Rect2(Vector2.ZERO, c.size)
		c.draw_rect(r, Color(0.02, 0.0, 0.01, 0.84))
		var center := c.size / 2.0
		for k in 7:
			c.draw_circle(center, c.size.x * (0.6 - k * 0.075), Color(0.75, 0.08, 0.05, 0.05))
		var crest := Art.ui("crest")
		var cw := minf(c.size.x * 0.7, 300.0)
		var ch := cw * crest.get_height() / crest.get_width()
		c.draw_texture_rect(crest, Rect2(center.x - cw / 2.0, center.y - 108 - ch, cw, ch), false))
	_bigwin.visible = false
	_bigwin.mouse_filter = Control.MOUSE_FILTER_STOP
	_bigwin.gui_input.connect(func(e: InputEvent):
		if e is InputEventMouseButton and e.pressed:
			_big_skip = true)
	overlay.add_child(_bigwin)
	_big_title = Art.label("BIG WIN", Art.label_settings(46, Art.GOLD, "num", 12, Art.GOLD_INK, 5))
	_bigwin.add_child(_big_title)
	_big_amount = Art.label("0", Art.label_settings(36, Art.GOLD_LIGHT, "num", 10, Art.BLOOD, 4))
	_bigwin.add_child(_big_amount)
	var rain := CPUParticles2D.new()
	rain.name = "Rain"
	rain.texture = Art.ui("coin")
	rain.amount = 40
	rain.lifetime = 1.6
	rain.emitting = false
	rain.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
	rain.direction = Vector2.DOWN
	rain.spread = 15.0
	rain.gravity = Vector2(0, 520)
	rain.initial_velocity_min = 60.0
	rain.initial_velocity_max = 160.0
	rain.angular_velocity_min = -200.0
	rain.angular_velocity_max = 200.0
	rain.scale_amount_min = 0.16
	rain.scale_amount_max = 0.26
	_bigwin.add_child(rain)
	_menu = _build_menu()
	overlay.add_child(_menu)


func _layout_overlay() -> void:
	var vp := get_viewport_rect().size
	_callout.size = Vector2(vp.x, 60)
	_callout.position = Vector2(0, field.size.y * 0.45 - 30)
	_callout.pivot_offset = _callout.size / 2.0
	_callout_sub.size = Vector2(vp.x, 26)
	_callout_sub.position = Vector2(0, field.size.y * 0.45 + 24)
	_toast.size = Vector2(vp.x, 30)
	_toast.position = Vector2(0, slot.position.y + slot.size.y * 0.45)
	_bigwin.position = Vector2(0, slot.position.y + slot.frame_rect.position.y)
	_bigwin.size = Vector2(vp.x, slot.frame_rect.size.y)
	_big_title.size = Vector2(vp.x, 70)
	_big_title.position = Vector2(0, _bigwin.size.y * 0.5 - 64)
	_big_title.pivot_offset = _big_title.size / 2.0
	_big_amount.size = Vector2(vp.x, 56)
	_big_amount.position = Vector2(0, _bigwin.size.y * 0.5 + 8)
	var rain: CPUParticles2D = _bigwin.get_node("Rain")
	rain.position = Vector2(vp.x / 2.0, -20)
	rain.emission_rect_extents = Vector2(vp.x / 2.0, 10)
	_menu.size = vp
	var panel: Control = _menu.get_node("Panel")
	var w := minf(vp.x, 480.0)
	panel.size = Vector2(w, vp.y * 0.88)
	panel.position = Vector2((vp.x - w) / 2.0, vp.y - panel.size.y)


func callout(big: String, small := "", gold := false, hold := 1.2) -> void:
	_callout.text = big
	_callout.label_settings = Art.label_settings(38, Art.GOLD if gold else Art.CREAM, "num", 10, Art.GOLD_INK if gold else Art.INK, 4)
	_callout_sub.text = small
	var tw := create_tween()
	_callout.scale = Vector2(0.5, 0.5)
	tw.tween_property(_callout, "modulate:a", 1.0, 0.12)
	tw.parallel().tween_property(_callout_sub, "modulate:a", 1.0 if small != "" else 0.0, 0.12)
	tw.parallel().tween_property(_callout, "scale", Vector2.ONE, 0.3).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_interval(hold * (0.6 if state.turbo else 1.0))
	tw.tween_property(_callout, "modulate:a", 0.0, 0.2)
	tw.parallel().tween_property(_callout_sub, "modulate:a", 0.0, 0.2)
	await tw.finished


func toast(text: String) -> void:
	_toast.text = text
	if _toast_tween:
		_toast_tween.kill()
	_toast_tween = create_tween()
	_toast_tween.tween_property(_toast, "modulate:a", 1.0, 0.15)
	_toast_tween.tween_interval(1.8)
	_toast_tween.tween_property(_toast, "modulate:a", 0.0, 0.3)


func _shake(amount: float) -> void:
	var tw := create_tween()
	for k in 6:
		tw.tween_property(self, "position", Vector2(rng.randf_range(-amount, amount), rng.randf_range(-amount, amount)) * (1.0 - k / 6.0), 0.03)
	tw.tween_property(self, "position", Vector2.ZERO, 0.04)


# ---------- 一轉 ----------

func _on_spin() -> void:
	if not started:
		return
	if busy:
		slot.quick_stop()
		return
	if auto:
		_auto_btn.button_pressed = false
		return
	Sfx.play("click")
	_spin()


func _on_auto(on: bool) -> void:
	auto = on
	Sfx.play("click")
	toast("Auto spin on" if on else "Auto spin off")
	if auto and not _auto_running:
		_auto_loop()


# 同一時間只有一個自動迴圈；正在轉（或 Free Spins）時先等這一轉結束
func _auto_loop() -> void:
	_auto_running = true
	while auto and started:
		while busy:
			await get_tree().process_frame
		if not auto:
			break
		if not await _spin():
			break
		await get_tree().create_timer(0.3).timeout
	_auto_running = false


func _spin() -> bool:
	if busy:
		return false
	var bet: int = Rules.BET_LEVELS[state.bet]
	var tb := Rules.total_bet(bet)
	if state.coins < tb:
		toast("Not enough coins — tap + for a free top-up")
		_auto_btn.set_pressed_no_signal(false)
		auto = false
		_auto_btn.queue_redraw()
		return false
	busy = true
	_refresh_controls()
	state.coins -= tb
	_coins_to(state.coins)
	var res := await _round(bet)
	var total: int = res.total
	if total > 0:
		state.coins += total
		if _tier(total, tb) != "":
			await _big_win(total, tb)
		_coins_to(state.coins)
		Sfx.play("coin")
	if res.triggered:
		await _free_spins(res.scatter, bet)
	while _working:
		await get_tree().process_frame
	_save(true)
	busy = false
	_refresh_controls()
	return true


# 一輪：轉輪停下 → 一段段連鎖（倍率、標記、跳分、打怪、消除）；回傳 Rules 的結果
func _round(bet: int) -> Dictionary:
	slot.clear_marks()
	if not free:
		_set_win(0, false)
	_set_ladder(0)
	var mults: Array = Rules.FS_MULTIPLIERS if free else Rules.MULTIPLIERS
	var res := Rules.play(rng, bet, free)
	Sfx.play("spin")
	await slot.spin(res.start)
	var won := fs_total if free else 0
	var base := Rules.base_attack(bet)
	var tb := Rules.total_bet(bet)
	for k in res.steps.size():
		var st: Dictionary = res.steps[k]
		_set_ladder(k)
		slot.mark(st.cells)
		Sfx.play("win", 1.0 + k * 0.12)
		won += st.win
		_set_win(won, true)
		_step_popup(st)
		_queue_attack(st.win + (base if k == 0 else 0), st.win >= 5 * tb)
		await get_tree().create_timer(0.36 if state.turbo else 0.62).timeout
		await slot.cascade(st, k)
	if res.steps.is_empty():
		_queue_attack(base, false)
	return res


func _tier(total: int, tb: int) -> String:
	for t in TIERS:
		if total >= t[0] * tb:
			return t[1]
	return ""


# 3 個以上 BONUS（金鑰匙）：先給 BONUS 獎金，再連轉 Free Spins（倍率加倍，可以再觸發）
func _free_spins(cells: Array, bet: int) -> void:
	var tb := Rules.total_bet(bet)
	slot.scatter_glow(cells)
	Sfx.play("bonus")
	var spins := Rules.free_spins(cells.size())
	var pay := Rules.scatter_pay(cells.size(), bet)
	await callout("FREE SPINS!", "%d spins · cascades ×2 ×4 ×6 ×10" % spins, true, 1.4)
	free = true
	fs_left = spins
	fs_done = 0
	fs_total = pay
	state.coins += pay
	_coins_to(state.coins)
	_set_win(fs_total, true)
	_refresh_fs()
	while fs_left > 0:
		fs_left -= 1
		fs_done += 1
		_refresh_fs()
		var res := await _round(bet)
		fs_total += res.total
		state.coins += res.total
		_coins_to(state.coins)
		if res.triggered:
			var more := Rules.free_spins(res.scatter.size())
			var extra := Rules.scatter_pay(res.scatter.size(), bet)
			slot.scatter_glow(res.scatter)
			Sfx.play("bonus")
			fs_left += more
			fs_total += extra
			state.coins += extra
			_coins_to(state.coins)
			_set_win(fs_total, true)
			_refresh_fs()
			await callout("+%d FREE SPINS" % more, "", true, 1.1)
		await get_tree().create_timer(0.25 if state.turbo else 0.45).timeout
	free = false
	_refresh_fs()
	_set_ladder(0)
	if _tier(fs_total, tb) != "":
		await _big_win(fs_total, tb)
	else:
		Sfx.play("coin")
		await callout("+%s" % Art.fmt(fs_total), "Free spins total", true, 1.3)
	_refresh_fs()
	_set_win(fs_total, false)


# 每一段中獎上方跳出「+120 ×2」
func _step_popup(st: Dictionary) -> void:
	var at := Vector2.ZERO
	for i in st.cells:
		at += slot.tile_center(i)
	at = slot.position + at / st.cells.size()
	var text := "+%s" % Art.fmt(st.win) + ("  ×%d" % st.mult if st.mult > 1 else "")
	var l := Art.label(text, Art.label_settings(26 if st.mult > 1 else 22, Art.GOLD_LIGHT, "num", 7, Art.GOLD_INK, 3))
	l.size = Vector2(260, 44)
	l.position = at - l.size / 2.0
	l.pivot_offset = l.size / 2.0
	l.scale = Vector2(0.4, 0.4)
	overlay.add_child(l)
	var tw := create_tween()
	tw.tween_property(l, "scale", Vector2(1.15, 1.15), 0.16).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_property(l, "scale", Vector2.ONE, 0.1)
	tw.tween_property(l, "position:y", l.position.y - 40, 0.6)
	tw.parallel().tween_property(l, "modulate:a", 0.0, 0.3).set_delay(0.3)
	tw.tween_callback(l.queue_free)


func _coins_to(value: int) -> void:
	var tw := create_tween()
	tw.tween_method(func(v: float):
		_shown_coins = v
		_coins_label.text = Art.fmt(v), _shown_coins, float(value), 0.5)


func _big_win(total: int, tb: int) -> void:
	_big_skip = false
	_bigwin.visible = true
	_bigwin.modulate.a = 0.0
	var rain: CPUParticles2D = _bigwin.get_node("Rain")
	rain.emitting = true
	Sfx.play("big")
	create_tween().tween_property(_bigwin, "modulate:a", 1.0, 0.2)
	var shown := 0
	var dur := 1.6 if state.turbo else 2.8
	var t := 0.0
	var tier := -2
	var tick := -1
	var tiers := TIERS.duplicate()
	tiers.reverse()
	while t < dur and not _big_skip:
		await get_tree().process_frame
		t += get_process_delta_time()
		var k := 1.0 - pow(1.0 - minf(t / dur, 1.0), 2.0)
		shown = int(total * k)
		_big_amount.text = Art.fmt(shown)
		var level := -1
		for i in tiers.size():
			if shown >= tiers[i][0] * tb:
				level = i
		if level != tier:
			tier = level
			_big_title.text = tiers[maxi(level, 0)][1]
			_big_title.scale = Vector2(1.6, 1.6)
			create_tween().tween_property(_big_title, "scale", Vector2.ONE, 0.35).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
			_shake(8.0)
			if level > 0:
				Sfx.play("mult", 1.0 + level * 0.15)
		if int(t * 6) != tick:
			tick = int(t * 6)
			Sfx.play("coin", 1.0 + k * 0.5, -8.0)
	_big_amount.text = Art.fmt(total)
	_big_skip = false
	var hold := 0.0
	while hold < 1.2 and not _big_skip:
		await get_tree().process_frame
		hold += get_process_delta_time()
	rain.emitting = false
	var tw := create_tween()
	tw.tween_property(_bigwin, "modulate:a", 0.0, 0.25)
	await tw.finished
	_bigwin.visible = false


# ---------- 自走與打怪 ----------

func _process(delta: float) -> void:
	if not started:
		return
	if enemy.is_empty():
		field.walking = true
		if not _defeating:
			walk_left -= delta
			if walk_left <= 0.0:
				_meet()
	else:
		field.walking = not enemy_ready


func _meet() -> void:
	enemy = Rules.spawn_enemy(state.kills, Rules.BET_LEVELS[state.bet])
	enemy_ready = false
	if _hp_tween:
		_hp_tween.kill()
	_hp = 1.0
	_hp_name.text = enemy.name
	_hp_num.text = "%s / %s" % [Art.fmt(enemy.hp), Art.fmt(enemy.max_hp)]
	create_tween().tween_property(_enemy_box, "modulate:a", 1.0, 0.3)
	_hp_bar.queue_redraw()
	_refresh_all()
	callout("WOLF KING!" if enemy.kind == "boss" else "WOLF AHEAD!", "Every coin you win hits him", false, 1.1)
	await field.spawn_enemy(enemy.kind)
	enemy_ready = true


func _queue_attack(damage: int, crit: bool) -> void:
	if enemy.is_empty():
		return
	_queue.append([damage, crit])
	if not _working:
		_work()


func _work() -> void:
	_working = true
	while not _queue.is_empty():
		var a: Array = _queue.pop_front()
		await _attack(a[0], a[1])
	_working = false


func _attack(damage: int, crit: bool) -> void:
	if enemy.is_empty():
		return
	while not enemy_ready:
		await get_tree().process_frame
		if enemy.is_empty():
			return
	var tb := Rules.total_bet(Rules.BET_LEVELS[state.bet])
	await field.strike(clampi(1 + damage / maxi(tb, 1), 1, 3))
	if enemy.is_empty():
		return
	var killed := Rules.hit(enemy, damage)
	field.impact("-%s" % Art.fmt(damage), crit)
	_shake(9.0 if crit else 4.0)
	var to: float = float(enemy.hp) / enemy.max_hp
	if _hp_tween:
		_hp_tween.kill()
	_hp_tween = create_tween()
	_hp_tween.tween_method(func(v: float):
		_hp = v
		_hp_bar.queue_redraw(), _hp, to, 0.35)
	_hp_num.text = "%s / %s" % [Art.fmt(enemy.hp), Art.fmt(enemy.max_hp)]
	if killed:
		await _defeat()
	else:
		await get_tree().create_timer(0.15).timeout


func _defeat() -> void:
	var e := enemy
	var at: Vector2 = field.enemy_center()
	enemy = {}
	enemy_ready = false
	_defeating = true
	walk_left = rng.randf_range(2.4, 3.8)
	state.kills += 1
	field.defeat_enemy()
	create_tween().tween_property(_enemy_box, "modulate:a", 0.0, 0.3)
	await get_tree().create_timer(0.45).timeout
	state.coins += e.reward
	_coins_to(state.coins)
	field.float_text("+%s" % Art.fmt(e.reward), at + Vector2(0, -40), Art.GOLD, 30, Art.GOLD_INK)
	Sfx.play("coin")
	var ups := Rules.gain_xp(state, e.xp)
	_refresh_all()
	_save()
	if e.kind == "boss":
		field.set_stage(_stage())
		await callout("GRANDMA'S HOUSE!", "Stage %d begins · reward +%s" % [_stage(), Art.fmt(e.reward)], true, 1.5)
	elif ups > 0:
		Sfx.play("level")
		field.hero.cheer()
		await callout("LEVEL UP!", "Lv. %d" % state.level, true, 1.1)
	_defeating = false


func _stage() -> int:
	return state.kills / Rules.BOSS_EVERY + 1


# ---------- 補幣、存檔、更新畫面 ----------

func _on_refill() -> void:
	if state.coins >= Rules.START_COINS:
		toast("Top-ups are for balances under %s" % Art.fmt(Rules.START_COINS))
		return
	state.coins += Rules.REFILL
	_coins_to(state.coins)
	Sfx.play("coin")
	toast("+%s coins (demo)" % Art.fmt(Rules.REFILL))
	_save()


# 舊版存檔（金幣單位不同）只保留等級與關卡，金幣重新發
func _load() -> void:
	var cf := ConfigFile.new()
	if cf.load(SAVE_PATH) != OK:
		return
	for k in state:
		var v = cf.get_value("game", k, state[k])
		if typeof(v) == typeof(state[k]):
			state[k] = v
	if cf.get_value("game", "version", 1) < SAVE_VERSION:
		state.coins = Rules.START_COINS
		state.bet = 2
	state.bet = clampi(state.bet, 0, Rules.BET_LEVELS.size() - 1)


# 轉動中（含 Free Spins）不存：這一轉的輸贏還沒入帳，存了會跟扣掉的押注對不上；這一轉結束時一起存
func _save(force := false) -> void:
	if busy and not force:
		return
	var cf := ConfigFile.new()
	for k in state:
		cf.set_value("game", k, state[k])
	cf.set_value("game", "version", SAVE_VERSION)
	cf.save(SAVE_PATH)


func _refresh_all() -> void:
	_coins_label.text = Art.fmt(state.coins)
	_level_label.text = "Lv. %d" % state.level
	_xp = float(state.xp) / Rules.xp_to_next(state.level)
	_xp_bar.queue_redraw()
	var n: int = state.kills % Rules.BOSS_EVERY + 1
	_stage_label.text = "Stage %d-%d" % [_stage(), n]
	_refresh_controls()


func _refresh_controls() -> void:
	var bet: int = Rules.BET_LEVELS[state.bet]
	_bet_label.text = Art.fmt(bet)
	_total_label.text = Art.fmt(Rules.total_bet(bet))
	_minus_btn.disabled = busy or state.bet == 0
	_plus_btn.disabled = busy or state.bet == Rules.BET_LEVELS.size() - 1
	_minus_btn.modulate.a = 0.35 if _minus_btn.disabled else 1.0
	_plus_btn.modulate.a = 0.35 if _plus_btn.disabled else 1.0
	_spin_btn.busy = busy


# ---------- 選單：賠率表（照美術給的 paytable 排）與設定 ----------

func _build_menu() -> Control:
	var sheet := Control.new()
	sheet.visible = false
	sheet.mouse_filter = Control.MOUSE_FILTER_STOP
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.65)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	dim.gui_input.connect(func(e: InputEvent):
		if e is InputEventMouseButton and e.pressed:
			sheet.visible = false)
	sheet.add_child(dim)
	var panel := PanelContainer.new()
	panel.name = "Panel"
	var sb := Art.box(Color("0d0a0b"), 16, 1, Art.PANEL_EDGE)
	sb.corner_radius_bottom_left = 0
	sb.corner_radius_bottom_right = 0
	sb.content_margin_left = 14
	sb.content_margin_right = 14
	sb.content_margin_top = 10
	sb.content_margin_bottom = 16
	panel.add_theme_stylebox_override("panel", sb)
	sheet.add_child(panel)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 6)
	panel.add_child(col)
	var head := HBoxContainer.new()
	col.add_child(head)
	var t := Art.label("SYMBOLS & PAYTABLE", Art.label_settings(19, Art.GOLD, "num", 4, Art.GOLD_INK), HORIZONTAL_ALIGNMENT_LEFT)
	t.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(t)
	var close := Button.new()
	close.text = "X"
	close.flat = true
	close.focus_mode = Control.FOCUS_NONE
	close.add_theme_font_override("font", Art.font())
	close.add_theme_font_size_override("font_size", 22)
	close.add_theme_color_override("font_color", Art.CREAM)
	close.pressed.connect(func(): sheet.visible = false)
	head.add_child(close)
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	col.add_child(scroll)
	_menu_body = VBoxContainer.new()
	_menu_body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_menu_body.add_theme_constant_override("separation", 10)
	scroll.add_child(_menu_body)
	return sheet


func _open_menu() -> void:
	Sfx.play("click")
	_fill_menu()
	_menu.visible = true
	_layout_overlay()
	var panel: Control = _menu.get_node("Panel")
	var y := panel.position.y
	panel.position.y = get_viewport_rect().size.y
	create_tween().tween_property(panel, "position:y", y, 0.28).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)


func _body(text: String, size := 13) -> Label:
	var l := Label.new()
	l.text = text
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.add_theme_color_override("font_color", Color("d9cbb0"))
	l.add_theme_font_size_override("font_size", size)
	l.custom_minimum_size = Vector2(120, 0)
	return l


# 中間寫字、兩邊金線的分隔標題
func _divider(text: String) -> Control:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	for k in 3:
		if k == 1:
			row.add_child(Art.label(text, Art.label_settings(15, Art.GOLD, "num", 3, Art.GOLD_INK)))
			continue
		var line := _painter(func(c: Control):
			var y := c.size.y / 2.0
			c.draw_line(Vector2(0, y), Vector2(c.size.x, y), Color(Art.GOLD_DEEP, 0.8), 1.0)
			var tip := Vector2(c.size.x if k == 0 else 0.0, y)
			c.draw_colored_polygon(PackedVector2Array([tip + Vector2(0, -3), tip + Vector2(3, 0), tip + Vector2(0, 3), tip + Vector2(-3, 0)]), Art.GOLD))
		line.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		line.custom_minimum_size = Vector2(20, 22)
		row.add_child(line)
	return row


# 一格符號＋底下 5／4／3 連的金幣（目前押注）
func _pay_cell(id: String, bet: int) -> Control:
	var box := VBoxContainer.new()
	box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	box.add_theme_constant_override("separation", 2)
	var icon := TextureRect.new()
	icon.texture = Art.symbol(id)
	icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	icon.custom_minimum_size = Vector2(54, 56)
	box.add_child(icon)
	for n in [5, 4, 3]:
		var row := HBoxContainer.new()
		row.alignment = BoxContainer.ALIGNMENT_CENTER
		row.add_theme_constant_override("separation", 6)
		row.add_child(Art.label(str(n), Art.label_settings(12, Art.GOLD, "light")))
		var v := Art.label(Art.fmt(Rules.pay(id, n, bet)), Art.label_settings(12, Art.CREAM, "light"), HORIZONTAL_ALIGNMENT_LEFT)
		v.custom_minimum_size = Vector2(34, 0)
		row.add_child(v)
		box.add_child(row)
	return box


func _special(id: String, title: String, lines: Array) -> Control:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	var icon := TextureRect.new()
	icon.texture = Art.symbol(id)
	icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	icon.custom_minimum_size = Vector2(70, 73)
	icon.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	row.add_child(icon)
	var col := VBoxContainer.new()
	col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	col.add_theme_constant_override("separation", 3)
	col.add_child(Art.label(title, Art.label_settings(15, Art.GOLD, "num", 3, Art.GOLD_INK), HORIZONTAL_ALIGNMENT_LEFT))
	for line in lines:
		col.add_child(_body(line))
	row.add_child(col)
	return row


# 1024 路示意：5 × 4 小格，第 1～3 軸各亮幾格
func _ways_diagram() -> Control:
	var lit := {0: [1], 1: [0, 2], 2: [1, 3]}
	var d := _painter(func(c: Control):
		var cw := (c.size.x - 4 * 3) / 5.0
		var ch := (c.size.y - 3 * 3) / 4.0
		for col in 5:
			for r in 4:
				var on: bool = lit.has(col) and r in lit[col]
				var rect := Rect2(col * (cw + 3), r * (ch + 3), cw, ch)
				c.draw_rect(rect, Color(Art.GOLD, 0.85) if on else Color(1, 1, 1, 0.07))
				c.draw_rect(rect, Color(Art.GOLD_DEEP, 0.6), false, 1.0))
	d.custom_minimum_size = Vector2(110, 70)
	return d


func _fill_menu() -> void:
	for c in _menu_body.get_children():
		c.queue_free()
	var bet: int = Rules.BET_LEVELS[state.bet]
	_menu_body.add_child(_body("Values are coins for your current bet (BET %s · TOTAL BET %s)." % [Art.fmt(bet), Art.fmt(Rules.total_bet(bet))], 12))
	for ids in [["wolf", "raven", "lantern", "basket", "potion"], ["ace", "king", "queen", "jack", "ten"]]:
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 4)
		for id in ids:
			row.add_child(_pay_cell(id, bet))
		_menu_body.add_child(row)
	_menu_body.add_child(_divider("SPECIAL SYMBOLS"))
	_menu_body.add_child(_special("hood", "WILD", ["Substitutes for all symbols except BONUS.", "Appears on reels 2, 3 and 4 only. Gold-framed symbols that win turn into WILD."]))
	var sc := []
	for n in [5, 4, 3]:
		sc.append("%d  ×  %s coins" % [n, Art.fmt(Rules.scatter_pay(n, bet))])
	_menu_body.add_child(_special("key", "BONUS", ["3 or more BONUS anywhere trigger Free Spins: 3 = 8, 4 = 10, 5 = 12 spins."] + sc))
	_menu_body.add_child(_divider("FREE SPINS"))
	_menu_body.add_child(_body("Free spins cost nothing. Cascade multipliers are doubled: ×2, ×4, ×6, then ×10. 3 or more BONUS during free spins add more spins."))
	_menu_body.add_child(_divider("1024 WAYS & CASCADES"))
	var ways := HBoxContainer.new()
	ways.add_theme_constant_override("separation", 12)
	ways.add_child(_ways_diagram())
	var wtxt := _body("Match a symbol on adjacent reels from the leftmost reel. Every matching cell on a reel multiplies the ways. Winning symbols burst, new ones fall in, and each cascade raises the multiplier: ×1, ×2, ×3, ×5.")
	wtxt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	ways.add_child(wtxt)
	_menu_body.add_child(ways)
	_menu_body.add_child(_divider("AUTO-RUN"))
	_menu_body.add_child(_body("Red Hood walks to Grandma's house on her own. When a wolf blocks the path, every coin you win is thrown at it as damage, plus a small hit each spin. Defeat wolves for coins and XP; every 5th is the Wolf King."))
	_menu_body.add_child(_divider("SETTINGS"))
	var check := CheckButton.new()
	check.text = "Sound"
	check.focus_mode = Control.FOCUS_NONE
	check.button_pressed = state.sound
	check.add_theme_font_override("font", Art.font("light"))
	check.add_theme_font_size_override("font_size", 16)
	check.add_theme_color_override("font_color", Art.CREAM)
	check.add_theme_color_override("font_pressed_color", Art.CREAM)
	check.add_theme_color_override("font_hover_color", Art.GOLD)
	check.toggled.connect(func(on: bool):
		state.sound = on
		Sfx.enabled = on
		Sfx.play("click")
		_save())
	_menu_body.add_child(check)
	var reset := Button.new()
	reset.text = "Reset progress"
	reset.focus_mode = Control.FOCUS_NONE
	reset.alignment = HORIZONTAL_ALIGNMENT_LEFT
	reset.flat = true
	reset.add_theme_font_override("font", Art.font("light"))
	reset.add_theme_font_size_override("font_size", 16)
	reset.add_theme_color_override("font_color", Color("ff8a70"))
	var armed := [false]
	reset.pressed.connect(func():
		if busy:
			toast("Wait for the spin to finish")
			return
		if not armed[0]:
			armed[0] = true
			reset.text = "Tap again to reset coins, level and stage"
			return
		for k in ["coins", "bet", "level", "xp", "kills"]:
			state[k] = {"coins": Rules.START_COINS, "bet": 2, "level": 1, "xp": 0, "kills": 0}[k]
		_shown_coins = state.coins
		field.set_stage(1)
		_refresh_all()
		_save()
		_menu.visible = false
		toast("Progress reset"))
	_menu_body.add_child(reset)
	_menu_body.add_child(_body("Coins are for demo play only.", 11))


# ---------- 開場：網頁的 loading 畫面一路蓋著，音效合成完直接進遊戲（不用點一下）----------

# 聲音要等玩家第一次點擊才會出來（瀏覽器規定），Godot 收到第一個輸入時會自動恢復音訊
func _boot() -> void:
	await get_tree().process_frame
	await Sfx.build_all(func(p: float): _web("asProgress", p))
	started = true
	_web("asReady", 1.0)


# 通知網頁外殼（web/shell.html）的 loading 畫面：進度、可以收起來了
func _web(fn: String, value: float) -> void:
	if OS.has_feature("web"):
		JavaScriptBridge.eval("window.%s && window.%s(%f)" % [fn, fn, value])


func _unhandled_input(e: InputEvent) -> void:
	if started and e.is_action_pressed("ui_accept"):
		_on_spin()
