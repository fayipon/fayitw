# 自走SLOT 主畫面：上方自走區、中間 SLOT、TOTAL WIN 條、下方投注區；
# 開場 loading（合成音效、等玩家點一下才開聲音）、說明與設定、BIG WIN、BONUS（小遊戲之前先直接給獎金）
extends Control

const Rules := preload("res://scripts/rules.gd")
const Art := preload("res://scripts/art.gd")
const Field := preload("res://scripts/field.gd")
const SlotView := preload("res://scripts/slot_view.gd")
const IconButton := preload("res://scripts/icon_button.gd")
const Puppet := preload("res://scripts/puppet.gd")
const SAVE_PATH := "user://save.cfg"
const TIERS := [[50, "SUPER WIN"], [25, "MEGA WIN"], [10, "BIG WIN"]]

var state := {"coins": Rules.START_COINS, "bet": 2, "level": 1, "xp": 0, "kills": 0, "turbo": false, "sound": true}
var rng := RandomNumberGenerator.new()
var started := false
var busy := false
var auto := false
var enemy := {}
var enemy_ready := false
var walk_left := 2.5

var field: Control
var slot: Control
var hud: Control
var winbar: Control
var betbar: Control
var overlay: Control

var _coins_label: Label
var _level_label: Label
var _xp_bar: Control
var _xp := 0.0
var _stage_label: Label
var _steps: Control
var _hp_box: Control
var _hp_name: Label
var _hp_num: Label
var _hp_bar: Control
var _hp := 1.0
var _bet_label: Label
var _total_label: Label
var _win_label: Label
var _ladder: Array[Label] = []
var _ladder_on := -1
var _spin_btn: BaseButton
var _auto_btn: BaseButton
var _minus_btn: BaseButton
var _plus_btn: BaseButton
var _callout: Label
var _callout_sub: Label
var _toast: Label
var _bigwin: Control
var _big_title: Label
var _big_amount: Label
var _big_skip := false
var _info: Control
var _config: Control
var _title: Control
var _shown_coins := 0.0
var _queue: Array = []
var _working := false
var _toast_tween: Tween


func _ready() -> void:
	rng.randomize()
	_load()
	set_anchors_preset(Control.PRESET_FULL_RECT)
	var bg := ColorRect.new()
	bg.color = Art.INK
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(bg)
	field = Field.new()
	add_child(field)
	slot = SlotView.new()
	slot.z_index = 20
	add_child(slot)
	slot.turbo = state.turbo
	winbar = _build_winbar()
	winbar.z_index = 20
	add_child(winbar)
	betbar = _build_betbar()
	betbar.z_index = 20
	add_child(betbar)
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
	_title_screen()


# ---------- 排版 ----------

func _layout() -> void:
	var vp := get_viewport_rect().size
	var w := minf(vp.x, 480.0)
	var x0 := (vp.x - w) / 2.0
	var bet_h := 92.0
	var win_h := 46.0
	var slot_h: float = slot.layout(w - 12.0)
	var field_h := maxf(vp.y - bet_h - win_h - slot_h + 16.0, 150.0)
	field.position = Vector2.ZERO
	field.size = Vector2(vp.x, field_h)
	slot.position = Vector2(x0 + 6.0, field_h - 16.0)
	winbar.position = Vector2(x0, slot.position.y + slot_h + 4.0)
	winbar.size = Vector2(w, win_h)
	betbar.position = Vector2(0, vp.y - bet_h)
	betbar.size = Vector2(vp.x, bet_h)
	_layout_betbar(w, x0)
	hud.position = Vector2(x0, 0)
	hud.size = Vector2(w, 110)
	_layout_hud(w)
	overlay.size = vp
	_layout_overlay()
	_layout_winbar(w)


# ---------- 上方資訊列 ----------

func _painter(fn: Callable) -> Control:
	var c := Control.new()
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	c.draw.connect(func(): fn.call(c))
	return c


func _build_hud() -> Control:
	var h := Control.new()
	h.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var head := Art.tex("res://art/puppets/hero/head.png")
	var avatar := _painter(func(c: Control):
		var r := c.size.x / 2.0
		c.draw_circle(Vector2(r, r + 2), r, Color(0, 0, 0, 0.4))
		c.draw_circle(Vector2(r, r), r, Color("b4650f"))
		c.draw_circle(Vector2(r, r), r - 2.5, Color("ffe08a"))
		c.draw_circle(Vector2(r, r), r - 5.0, Color("c33b2a"))
		var s := (r * 2.3) / head.get_width()
		c.draw_texture_rect(head, Rect2(Vector2(r, r * 1.05) - Vector2(head.get_width(), head.get_height()) * s / 2.0, Vector2(head.get_width(), head.get_height()) * s), false))
	avatar.name = "Avatar"
	h.add_child(avatar)
	var level := Panel.new()
	level.name = "Level"
	level.add_theme_stylebox_override("panel", Art.box(Art.PANEL, 12))
	level.mouse_filter = Control.MOUSE_FILTER_IGNORE
	h.add_child(level)
	_level_label = Art.label("Lv. 1", Art.label_settings(17, Art.CREAM, "num", 0), HORIZONTAL_ALIGNMENT_LEFT)
	level.add_child(_level_label)
	_xp_bar = _painter(func(c: Control):
		c.draw_style_box(Art.box(Color(1, 1, 1, 0.14), 3), Rect2(Vector2.ZERO, c.size))
		if _xp > 0.0:
			c.draw_style_box(Art.box(Art.GOLD, 3), Rect2(Vector2.ZERO, Vector2(c.size.x * _xp, c.size.y))))
	level.add_child(_xp_bar)
	var crown := _painter(func(c: Control):
		var s := c.size
		c.draw_colored_polygon(PackedVector2Array([Vector2(0, s.y), Vector2(s.x * 0.08, s.y * 0.25), Vector2(s.x * 0.32, s.y * 0.6), Vector2(s.x * 0.5, 0), Vector2(s.x * 0.68, s.y * 0.6), Vector2(s.x * 0.92, s.y * 0.25), Vector2(s.x, s.y)]), Art.GOLD))
	crown.name = "Crown"
	level.add_child(crown)
	var wallet := Panel.new()
	wallet.name = "Wallet"
	wallet.add_theme_stylebox_override("panel", Art.box(Art.PANEL, 20))
	wallet.mouse_filter = Control.MOUSE_FILTER_IGNORE
	h.add_child(wallet)
	var coin := TextureRect.new()
	coin.name = "Coin"
	coin.texture = Art.symbol("coin")
	coin.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	coin.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	coin.mouse_filter = Control.MOUSE_FILTER_IGNORE
	wallet.add_child(coin)
	_coins_label = Art.label("10,000", Art.label_settings(18, Art.CREAM))
	wallet.add_child(_coins_label)
	var refill := IconButton.new("refill")
	refill.name = "Refill"
	refill.pressed.connect(_on_refill)
	wallet.add_child(refill)
	var gear := IconButton.new("gear")
	gear.name = "Gear"
	gear.pressed.connect(func(): _open_sheet(_config))
	h.add_child(gear)
	# 第二列：關卡與敵人血條
	var trip := Panel.new()
	trip.name = "Trip"
	trip.add_theme_stylebox_override("panel", Art.box(Art.PANEL, 14))
	trip.mouse_filter = Control.MOUSE_FILTER_IGNORE
	h.add_child(trip)
	_stage_label = Art.label("STAGE 1", Art.label_settings(13, Art.GOLD), HORIZONTAL_ALIGNMENT_LEFT)
	trip.add_child(_stage_label)
	_steps = _painter(func(c: Control):
		var done: int = state.kills % Rules.BOSS_EVERY
		for i in Rules.BOSS_EVERY:
			var boss := i == Rules.BOSS_EVERY - 1
			var r := 6.5 if boss else 4.5
			var p := Vector2(r + i * 16.0, c.size.y / 2.0)
			var col := Art.GOLD if i < done else Color("ff6a4a") if (i == done and not enemy.is_empty()) else Color(1, 1, 1, 0.0)
			c.draw_circle(p, r, col)
			c.draw_arc(p, r, 0, TAU, 20, Color("ff8a6a") if boss else Color(1, 1, 1, 0.55), 1.6))
	trip.add_child(_steps)
	_hp_box = Panel.new()
	_hp_box.name = "HP"
	_hp_box.add_theme_stylebox_override("panel", Art.box(Art.PANEL, 14))
	_hp_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_hp_box.visible = false
	h.add_child(_hp_box)
	_hp_name = Art.label("Big Bad Wolf", Art.label_settings(13, Art.CREAM), HORIZONTAL_ALIGNMENT_LEFT)
	_hp_box.add_child(_hp_name)
	_hp_num = Art.label("", Art.label_settings(11, Color("ffb4a0")), HORIZONTAL_ALIGNMENT_RIGHT)
	_hp_box.add_child(_hp_num)
	_hp_bar = _painter(func(c: Control):
		c.draw_style_box(Art.box(Color("3a1410"), 4), Rect2(Vector2.ZERO, c.size))
		if _hp > 0.0:
			c.draw_style_box(Art.box(Color("e8361f"), 4), Rect2(Vector2.ZERO, Vector2(c.size.x * _hp, c.size.y))))
	_hp_box.add_child(_hp_bar)
	return h


func _layout_hud(w: float) -> void:
	var avatar: Control = hud.get_node("Avatar")
	avatar.position = Vector2(8, 8)
	avatar.size = Vector2(50, 50)
	var gear: Control = hud.get_node("Gear")
	gear.size = Vector2(42, 42)
	gear.position = Vector2(w - 50, 12)
	var level: Control = hud.get_node("Level")
	level.position = Vector2(64, 13)
	level.size = Vector2(minf(118, w * 0.27), 40)
	hud.get_node("Level/Crown").position = Vector2(9, 9)
	hud.get_node("Level/Crown").size = Vector2(15, 11)
	_level_label.position = Vector2(28, 2)
	_level_label.size = Vector2(level.size.x - 32, 22)
	_xp_bar.position = Vector2(9, 27)
	_xp_bar.size = Vector2(level.size.x - 18, 6)
	var wallet: Control = hud.get_node("Wallet")
	wallet.position = Vector2(level.position.x + level.size.x + 6, 13)
	wallet.size = Vector2(gear.position.x - 6 - wallet.position.x, 40)
	hud.get_node("Wallet/Coin").position = Vector2(4, 4)
	hud.get_node("Wallet/Coin").size = Vector2(32, 32)
	_coins_label.position = Vector2(36, 0)
	_coins_label.size = Vector2(wallet.size.x - 76, 40)
	var refill: Control = hud.get_node("Wallet/Refill")
	refill.size = Vector2(32, 32)
	refill.position = Vector2(wallet.size.x - 36, 4)
	var trip: Control = hud.get_node("Trip")
	trip.position = Vector2(8, 64)
	trip.size = Vector2(156, 28)
	_stage_label.position = Vector2(10, 0)
	_stage_label.size = Vector2(70, 28)
	_steps.position = Vector2(76, 0)
	_steps.size = Vector2(80, 28)
	_hp_box.size = Vector2(minf(170, w * 0.4), 40)
	_hp_box.position = Vector2(w - _hp_box.size.x - 8, 64)
	_hp_name.position = Vector2(10, 1)
	_hp_name.size = Vector2(_hp_box.size.x - 20, 18)
	_hp_num.position = Vector2(10, 1)
	_hp_num.size = Vector2(_hp_box.size.x - 20, 18)
	_hp_bar.position = Vector2(10, 23)
	_hp_bar.size = Vector2(_hp_box.size.x - 20, 8)


# ---------- TOTAL WIN 條 ----------

func _build_winbar() -> Control:
	var bar := _painter(func(c: Control):
		var r := Rect2(Vector2.ZERO, c.size)
		c.draw_style_box(Art.box(Color("3a1f0a"), 14, 2, Color(Art.GOLD, 0.8)), r)
		c.draw_rect(Rect2(10, 3, c.size.x - 20, 3), Color(1, 1, 1, 0.12)))
	for m in Rules.MULTIPLIERS:
		var l := Art.label("×%d" % m, Art.label_settings(16, Color(1, 1, 1, 0.45)))
		_ladder.append(l)
		bar.add_child(l)
	var cap := Art.label("TOTAL WIN", Art.label_settings(12, Art.MUTED), HORIZONTAL_ALIGNMENT_RIGHT)
	cap.name = "Cap"
	bar.add_child(cap)
	_win_label = Art.label("0", Art.label_settings(26, Art.GOLD, "num", 6, Color("4a2400")), HORIZONTAL_ALIGNMENT_RIGHT)
	bar.add_child(_win_label)
	return bar


func _layout_winbar(w: float) -> void:
	for i in _ladder.size():
		_ladder[i].position = Vector2(10 + i * 38, 7)
		_ladder[i].size = Vector2(34, 32)
	var cap: Label = winbar.get_node("Cap")
	cap.position = Vector2(170, 0)
	cap.size = Vector2(w - 170 - 12, 18)
	_win_label.position = Vector2(170, 12)
	_win_label.size = Vector2(w - 170 - 14, 34)


func _set_ladder(k: int) -> void:
	_ladder_on = k
	for i in _ladder.size():
		var on := i == mini(k, Rules.MULTIPLIERS.size() - 1)
		_ladder[i].label_settings = Art.label_settings(19 if on else 16, Art.GOLD if on else Color(1, 1, 1, 0.4), "num", 5 if on else 0, Color("4a2400"))
		if on and k > 0:
			_ladder[i].pivot_offset = _ladder[i].size / 2.0
			_ladder[i].scale = Vector2(1.5, 1.5)
			create_tween().tween_property(_ladder[i], "scale", Vector2.ONE, 0.3).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)


func _set_win(value: int, animate: bool) -> void:
	if not animate:
		_win_label.text = Art.fmt(value)
		return
	var from := float(_win_label.text.replace(",", ""))
	var tw := create_tween()
	tw.tween_method(func(v: float): _win_label.text = Art.fmt(v), from, float(value), 0.45)
	_win_label.pivot_offset = _win_label.size * Vector2(1, 0.5)
	_win_label.scale = Vector2(1.25, 1.25)
	tw.parallel().tween_property(_win_label, "scale", Vector2.ONE, 0.35).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)


# ---------- 投注區 ----------

func _build_betbar() -> Control:
	var bar := _painter(func(c: Control):
		c.draw_rect(Rect2(Vector2.ZERO, c.size), Color("1d140e"))
		c.draw_rect(Rect2(0, 0, c.size.x, 2), Color(Art.GOLD, 0.25)))
	var menu := IconButton.new("menu")
	menu.name = "Menu"
	menu.pressed.connect(func(): _open_sheet(_info))
	bar.add_child(menu)
	var bet := _box("BET")
	bet.name = "Bet"
	bar.add_child(bet)
	_bet_label = Art.label("5", Art.label_settings(20, Art.CREAM))
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
	_total_label = Art.label("100", Art.label_settings(20, Art.CREAM))
	total.add_child(_total_label)
	var coin := TextureRect.new()
	coin.name = "Coin"
	coin.texture = Art.symbol("coin")
	coin.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	coin.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	coin.mouse_filter = Control.MOUSE_FILTER_IGNORE
	total.add_child(coin)
	_spin_btn = IconButton.new("spin")
	_spin_btn.name = "Spin"
	_spin_btn.pressed.connect(_on_spin)
	bar.add_child(_spin_btn)
	_auto_btn = IconButton.new("auto")
	_auto_btn.name = "Auto"
	_auto_btn.toggle_mode = true
	_auto_btn.toggled.connect(_on_auto)
	bar.add_child(_auto_btn)
	return bar


func _box(caption: String) -> Panel:
	var p := Panel.new()
	p.add_theme_stylebox_override("panel", Art.box(Color("0e0906"), 12, 1, Color(Art.GOLD, 0.25)))
	p.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var cap := Art.label(caption, Art.label_settings(11, Art.MUTED))
	cap.name = "Cap"
	p.add_child(cap)
	return p


func _layout_betbar(w: float, x0: float) -> void:
	var cx := betbar.size.x / 2.0
	var spin_d := 90.0
	_spin_btn.size = Vector2(spin_d, spin_d)
	_spin_btn.position = Vector2(cx - spin_d / 2.0, -24)
	var side := 44.0
	var menu: Control = betbar.get_node("Menu")
	menu.size = Vector2(side, side)
	menu.position = Vector2(x0 + 6, 24)
	_auto_btn.size = Vector2(side, side)
	_auto_btn.position = Vector2(x0 + w - side - 6, 24)
	var box_w := (w - side * 2 - spin_d - 12 - 4 * 6) / 2.0
	var bet: Control = betbar.get_node("Bet")
	bet.position = Vector2(menu.position.x + side + 6, 18)
	bet.size = Vector2(box_w, 56)
	var total: Control = betbar.get_node("Total")
	total.position = Vector2(_auto_btn.position.x - 6 - box_w, 18)
	total.size = Vector2(box_w, 56)
	for b in [bet, total]:
		var cap: Label = b.get_node("Cap")
		cap.position = Vector2(0, 3)
		cap.size = Vector2(box_w, 16)
	_minus_btn.size = Vector2(28, 28)
	_minus_btn.position = Vector2(5, 22)
	_plus_btn.size = Vector2(28, 28)
	_plus_btn.position = Vector2(box_w - 33, 22)
	_bet_label.position = Vector2(33, 20)
	_bet_label.size = Vector2(box_w - 66, 30)
	var coin: Control = total.get_node("Coin")
	coin.size = Vector2(22, 22)
	_total_label.size = Vector2(box_w - 34, 30)
	_total_label.position = Vector2(26, 20)
	coin.position = Vector2(8, 24)


func _change_bet(d: int) -> void:
	if busy:
		return
	state.bet = clampi(state.bet + d, 0, Rules.BET_LEVELS.size() - 1)
	Sfx.play("click")
	_save()
	_refresh_all()


# ---------- 疊在最上層：大字、提示、BIG WIN、說明、設定 ----------

func _build_overlay() -> void:
	_callout = Art.label("", Art.label_settings(40, Art.CREAM, "num", 12, Color("4a1606"), 4))
	_callout.modulate.a = 0.0
	overlay.add_child(_callout)
	_callout_sub = Art.label("", Art.label_settings(17, Color.WHITE, "num", 6, Color("2a0d04")))
	_callout_sub.modulate.a = 0.0
	overlay.add_child(_callout_sub)
	_toast = Art.label("", Art.label_settings(15, Art.CREAM, "num", 0))
	_toast.modulate.a = 0.0
	overlay.add_child(_toast)
	_bigwin = _painter(func(c: Control):
		var r := Rect2(Vector2.ZERO, c.size)
		c.draw_rect(r, Color(0.04, 0.02, 0, 0.82))
		var center := c.size / 2.0
		for k in 6:
			c.draw_circle(center, c.size.x * (0.55 - k * 0.08), Color(1, 0.6, 0.1, 0.05)))
	_bigwin.visible = false
	_bigwin.mouse_filter = Control.MOUSE_FILTER_STOP
	_bigwin.gui_input.connect(func(e: InputEvent):
		if e is InputEventMouseButton and e.pressed:
			_big_skip = true)
	overlay.add_child(_bigwin)
	_big_title = Art.label("BIG WIN", Art.label_settings(56, Art.GOLD, "num", 14, Color("6a2c00"), 5))
	_bigwin.add_child(_big_title)
	_big_amount = Art.label("0", Art.label_settings(42, Color.WHITE, "num", 10, Color("6a2c00"), 4))
	_bigwin.add_child(_big_amount)
	var rain := CPUParticles2D.new()
	rain.name = "Rain"
	rain.texture = Art.symbol("coin")
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
	rain.scale_amount_min = 0.11
	rain.scale_amount_max = 0.18
	_bigwin.add_child(rain)
	_info = _build_info()
	overlay.add_child(_info)
	_config = _build_config()
	overlay.add_child(_config)


func _layout_overlay() -> void:
	var vp := get_viewport_rect().size
	_callout.size = Vector2(vp.x, 60)
	_callout.position = Vector2(0, field.size.y * 0.42 - 30)
	_callout.pivot_offset = _callout.size / 2.0
	_callout_sub.size = Vector2(vp.x, 26)
	_callout_sub.position = Vector2(0, field.size.y * 0.42 + 24)
	_toast.size = Vector2(vp.x, 30)
	_toast.position = Vector2(0, slot.position.y + slot.size.y * 0.45)
	_bigwin.position = Vector2(0, slot.position.y - 10)
	_bigwin.size = Vector2(vp.x, slot.size.y + 20)
	_big_title.size = Vector2(vp.x, 80)
	_big_title.position = Vector2(0, _bigwin.size.y * 0.5 - 70)
	_big_title.pivot_offset = _big_title.size / 2.0
	_big_amount.size = Vector2(vp.x, 60)
	_big_amount.position = Vector2(0, _bigwin.size.y * 0.5 + 6)
	var rain: CPUParticles2D = _bigwin.get_node("Rain")
	rain.position = Vector2(vp.x / 2.0, -20)
	rain.emission_rect_extents = Vector2(vp.x / 2.0, 10)
	for sheet in [_info, _config]:
		sheet.size = vp
		var panel: Control = sheet.get_node("Panel")
		var w := minf(vp.x, 480.0)
		panel.size = Vector2(w, minf(vp.y * 0.84, panel.get_combined_minimum_size().y + 40.0) if sheet == _config else vp.y * 0.84)
		panel.position = Vector2((vp.x - w) / 2.0, vp.y - panel.size.y)
	if _title:
		_layout_title()


func callout(big: String, small := "", gold := false, hold := 1.2) -> void:
	_callout.text = big
	_callout.label_settings = Art.label_settings(42, Art.GOLD if gold else Art.CREAM, "num", 12, Color("4a1606"), 4)
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
	if auto and not busy:
		_auto_loop()


func _auto_loop() -> void:
	while auto and started:
		if not await _spin():
			break
		await get_tree().create_timer(0.3).timeout


func _spin() -> bool:
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
	slot.clear_marks()
	_set_win(0, false)
	_set_ladder(0)
	field.mult_sign.set_value(1, false)
	var res := Rules.play(rng, bet)
	Sfx.play("spin")
	await slot.spin(res.start)
	var total := 0
	var base := Rules.base_attack(bet)
	for k in res.steps.size():
		var st: Dictionary = res.steps[k]
		_set_ladder(k)
		field.mult_sign.set_value(st.mult, k > 0)
		slot.mark(st.cells)
		Sfx.play("win", 1.0 + k * 0.12)
		total += st.win
		_set_win(total, true)
		_step_popup(st)
		_queue_attack(st.win + (base if k == 0 else 0), st.win >= 5 * tb)
		await get_tree().create_timer(0.36 if state.turbo else 0.62).timeout
		await slot.cascade(st, k)
	if res.steps.is_empty():
		_queue_attack(base, false)
	if total > 0:
		state.coins += total
		var tier := ""
		for t in TIERS:
			if total >= t[0] * tb:
				tier = t[1]
				break
		if tier != "":
			await _big_win(total, tb)
		_coins_to(state.coins)
		Sfx.play("coin")
	if res.triggered:
		slot.bonus_glow(res.bonus)
		await _bonus_game(res.bonus.size(), bet, total)
	while _working:
		await get_tree().process_frame
	_save()
	busy = false
	_refresh_controls()
	return true


# 每一段中獎上方跳出「+120 ×2」
func _step_popup(st: Dictionary) -> void:
	var at := Vector2.ZERO
	for i in st.cells:
		at += slot.tile_center(i)
	at = slot.position + at / st.cells.size()
	var text := "+%s" % Art.fmt(st.win) + ("  ×%d" % st.mult if st.mult > 1 else "")
	var l := Art.label(text, Art.label_settings(30 if st.mult > 1 else 26, Art.GOLD, "num", 8, Color("4a2400"), 3))
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
	var tier := -1
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
		if int(t * 12) % 2 == 0:
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


# 外婆家 BONUS：小遊戲之後接在這裡，現在先依個數直接給獎金
func _bonus_game(count: int, bet: int, line_win: int) -> void:
	Sfx.play("bonus")
	await callout("BONUS!", "%d × Grandma's House" % count, true, 1.3)
	var prize := Rules.bonus_prize(count, bet)
	state.coins += prize
	_coins_to(state.coins)
	_set_win(line_win + prize, true)
	Sfx.play("coin")
	await callout("+%s" % Art.fmt(prize), "Grandma's reward", true, 1.2)


# ---------- 自走與打怪 ----------

func _process(delta: float) -> void:
	if not started:
		return
	if enemy.is_empty():
		field.walking = true
		walk_left -= delta
		if walk_left <= 0.0:
			_meet()
	else:
		field.walking = not enemy_ready


func _meet() -> void:
	enemy = Rules.spawn_enemy(state.kills, Rules.BET_LEVELS[state.bet])
	enemy_ready = false
	_hp = 1.0
	_hp_name.text = enemy.name
	_hp_num.text = "%s / %s" % [Art.fmt(enemy.hp), Art.fmt(enemy.max_hp)]
	_hp_box.visible = true
	_hp_bar.queue_redraw()
	_steps.queue_redraw()
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
	await field.throw_apples(clampi(1 + damage / maxi(tb, 1), 1, 5))
	if enemy.is_empty():
		return
	var killed := Rules.hit(enemy, damage)
	field.impact("-%s" % Art.fmt(damage), crit)
	_shake(9.0 if crit else 4.0)
	var to: float = float(enemy.hp) / enemy.max_hp
	create_tween().tween_method(func(v: float):
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
	field.defeat_enemy()
	_hp_box.visible = false
	await get_tree().create_timer(0.45).timeout
	state.coins += e.reward
	_coins_to(state.coins)
	field.float_text("+%s" % Art.fmt(e.reward), at + Vector2(0, -40), Art.GOLD, 30, Color("4a2400"))
	Sfx.play("coin")
	state.kills += 1
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
	walk_left = rng.randf_range(2.4, 3.8)


func _stage() -> int:
	return state.kills / Rules.BOSS_EVERY + 1


# ---------- 補幣、存檔、更新畫面 ----------

func _on_refill() -> void:
	if state.coins >= 20000:
		toast("Top-ups are for balances under 20,000")
		return
	state.coins += Rules.REFILL
	_coins_to(state.coins)
	Sfx.play("coin")
	toast("+%s coins (demo)" % Art.fmt(Rules.REFILL))
	_save()


func _load() -> void:
	var cf := ConfigFile.new()
	if cf.load(SAVE_PATH) != OK:
		return
	for k in state:
		var v = cf.get_value("game", k, state[k])
		if typeof(v) == typeof(state[k]):
			state[k] = v
	state.bet = clampi(state.bet, 0, Rules.BET_LEVELS.size() - 1)


func _save() -> void:
	var cf := ConfigFile.new()
	for k in state:
		cf.set_value("game", k, state[k])
	cf.save(SAVE_PATH)


func _refresh_all() -> void:
	_coins_label.text = Art.fmt(state.coins)
	_level_label.text = "Lv. %d" % state.level
	_xp = float(state.xp) / Rules.xp_to_next(state.level)
	_xp_bar.queue_redraw()
	_stage_label.text = "STAGE %d" % _stage()
	_steps.queue_redraw()
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


# ---------- 說明與設定 ----------

func _sheet(title: String) -> Array:
	var sheet := Control.new()
	sheet.visible = false
	sheet.mouse_filter = Control.MOUSE_FILTER_STOP
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.6)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	dim.gui_input.connect(func(e: InputEvent):
		if e is InputEventMouseButton and e.pressed:
			_close_sheet(sheet))
	sheet.add_child(dim)
	var panel := PanelContainer.new()
	panel.name = "Panel"
	var sb := Art.box(Color("231710"), 22, 1, Color(Art.GOLD, 0.35))
	sb.corner_radius_bottom_left = 0
	sb.corner_radius_bottom_right = 0
	sb.content_margin_left = 18
	sb.content_margin_right = 18
	sb.content_margin_top = 14
	sb.content_margin_bottom = 20
	panel.add_theme_stylebox_override("panel", sb)
	sheet.add_child(panel)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 10)
	panel.add_child(col)
	var head := HBoxContainer.new()
	col.add_child(head)
	var t := Art.label(title, Art.label_settings(22, Art.GOLD), HORIZONTAL_ALIGNMENT_LEFT)
	t.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(t)
	var close := Button.new()
	close.text = "X"
	close.flat = true
	close.focus_mode = Control.FOCUS_NONE
	close.add_theme_font_override("font", Art.font())
	close.add_theme_font_size_override("font_size", 24)
	close.add_theme_color_override("font_color", Art.CREAM)
	close.pressed.connect(func(): _close_sheet(sheet))
	head.add_child(close)
	return [sheet, col]


func _open_sheet(sheet: Control) -> void:
	Sfx.play("click")
	sheet.visible = true
	_layout_overlay()
	var panel: Control = sheet.get_node("Panel")
	var y := panel.position.y
	panel.position.y = get_viewport_rect().size.y
	create_tween().tween_property(panel, "position:y", y, 0.28).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)


func _close_sheet(sheet: Control) -> void:
	sheet.visible = false


func _body(text: String) -> Label:
	var l := Label.new()
	l.text = text
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.add_theme_color_override("font_color", Color("e6d6b8"))
	l.add_theme_font_size_override("font_size", 14)
	l.custom_minimum_size = Vector2(200, 0)
	return l


func _build_info() -> Control:
	var made := _sheet("HOW TO PLAY")
	var sheet: Control = made[0]
	var col: VBoxContainer = made[1]
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	col.add_child(scroll)
	var inner := VBoxContainer.new()
	inner.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	inner.add_theme_constant_override("separation", 8)
	scroll.add_child(inner)
	for line in [
		"1024 WAYS — Match a symbol on adjacent reels from the leftmost reel: 3, 4 or 5 in a row. Every matching cell on a reel multiplies the ways.",
		"CASCADES — Winning symbols burst, the rest fall and new ones drop in. Each cascade raises the multiplier: ×1, ×2, ×3, then ×5. Everything pays when the chain ends.",
		"GOLD FRAMES — Gold-framed symbols on the middle reels turn into WILD when they win.",
		"WILD — The Crown appears on the middle reels and substitutes for every symbol except BONUS.",
		"BONUS — 3 or more Grandma's House anywhere trigger the bonus.",
		"AUTO-RUN — Red Hood walks to Grandma's house on her own. When a wolf blocks the path, every coin you win is thrown at it as damage, plus a small base hit each spin. Defeat wolves for coins and XP; every 5th is the Wolf King.",
		"TOTAL BET = BET × 20. The paytable shows points per way; a win pays points × BET × ways.",
	]:
		inner.add_child(_body(line))
	var grid := GridContainer.new()
	grid.columns = 4
	grid.add_theme_constant_override("h_separation", 10)
	grid.add_theme_constant_override("v_separation", 4)
	inner.add_child(grid)
	for h in ["SYMBOL", "3", "4", "5"]:
		var l := Art.label(h, Art.label_settings(13, Art.MUTED), HORIZONTAL_ALIGNMENT_RIGHT if h != "SYMBOL" else HORIZONTAL_ALIGNMENT_LEFT)
		if h != "SYMBOL":
			l.custom_minimum_size = Vector2(44, 0)
		grid.add_child(l)
	var order := ["hood", "wolf", "basket", "pie", "rabbit", "ace", "king", "queen", "jack", "ten", "cottage", "crown"]
	for id in order:
		var row := HBoxContainer.new()
		row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_theme_constant_override("separation", 8)
		var icon := TextureRect.new()
		icon.texture = Art.symbol(id)
		icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		icon.custom_minimum_size = Vector2(40, 40)
		row.add_child(icon)
		var name := Art.label(Rules.SYMBOLS[id].name, Art.label_settings(15, Art.CREAM), HORIZONTAL_ALIGNMENT_LEFT)
		row.add_child(name)
		if Rules.is_wild(id) or Rules.is_bonus(id):
			var tag := Art.label("WILD" if Rules.is_wild(id) else "BONUS", Art.label_settings(12, Color.WHITE, "num", 4, Color("4a1606")))
			tag.custom_minimum_size = Vector2(52, 20)
			var tag_bg := PanelContainer.new()
			tag_bg.add_theme_stylebox_override("panel", Art.box(Art.GOLD_DEEP if Rules.is_wild(id) else Art.RED, 5))
			tag_bg.add_child(tag)
			tag_bg.size_flags_vertical = Control.SIZE_SHRINK_CENTER
			row.add_child(tag_bg)
		grid.add_child(row)
		if Rules.is_wild(id) or Rules.is_bonus(id):
			for k in 3:
				var txt := ("Any symbol" if Rules.is_wild(id) else "3+ anywhere") if k == 2 else ""
				var l := Art.label(txt, Art.label_settings(12, Art.GOLD), HORIZONTAL_ALIGNMENT_RIGHT)
				grid.add_child(l)
		else:
			for p in Rules.SYMBOLS[id].pays:
				grid.add_child(Art.label(str(p), Art.label_settings(18, Art.CREAM), HORIZONTAL_ALIGNMENT_RIGHT))
	inner.add_child(_body("Coins are for demo play only."))
	return sheet


func _build_config() -> Control:
	var made := _sheet("SETTINGS")
	var sheet: Control = made[0]
	var col: VBoxContainer = made[1]
	for item in [["Turbo spin", "turbo"], ["Sound", "sound"]]:
		var check := CheckButton.new()
		check.text = item[0]
		check.focus_mode = Control.FOCUS_NONE
		check.button_pressed = state[item[1]]
		check.add_theme_font_override("font", Art.font())
		check.add_theme_font_size_override("font_size", 18)
		check.add_theme_color_override("font_color", Art.CREAM)
		check.add_theme_color_override("font_pressed_color", Art.CREAM)
		check.add_theme_color_override("font_hover_color", Art.GOLD)
		var key: String = item[1]
		check.toggled.connect(func(on: bool):
			state[key] = on
			slot.turbo = state.turbo
			Sfx.enabled = state.sound
			Sfx.play("click")
			_save())
		col.add_child(check)
	var reset := Button.new()
	reset.text = "Reset progress"
	reset.focus_mode = Control.FOCUS_NONE
	reset.alignment = HORIZONTAL_ALIGNMENT_LEFT
	reset.flat = true
	reset.add_theme_font_override("font", Art.font())
	reset.add_theme_font_size_override("font_size", 18)
	reset.add_theme_color_override("font_color", Color("ff9c80"))
	var armed := [false]
	reset.pressed.connect(func():
		if busy:
			toast("Wait for the spin to finish")
			return
		if not armed[0]:
			armed[0] = true
			reset.text = "Tap again to reset coins, level and stage"
			return
		armed[0] = false
		reset.text = "Reset progress"
		for k in ["coins", "bet", "level", "xp", "kills"]:
			state[k] = {"coins": Rules.START_COINS, "bet": 2, "level": 1, "xp": 0, "kills": 0}[k]
		_shown_coins = state.coins
		field.set_stage(1)
		_refresh_all()
		_save()
		_close_sheet(sheet)
		toast("Progress reset"))
	col.add_child(reset)
	return sheet


# ---------- 開場 loading ----------

func _title_screen() -> void:
	_title = Control.new()
	_title.z_index = 100
	_title.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(_title)
	var bg := TextureRect.new()
	bg.name = "Bg"
	bg.texture = Art.tex("res://art/bg-loop.webp")
	bg.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	bg.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	bg.modulate = Color(0.55, 0.5, 0.48)
	_title.add_child(bg)
	var shade := _painter(func(c: Control):
		c.draw_polygon(PackedVector2Array([Vector2(0, c.size.y * 0.45), Vector2(c.size.x, c.size.y * 0.45), Vector2(c.size.x, c.size.y), Vector2(0, c.size.y)]),
			PackedColorArray([Color(Art.INK, 0.0), Color(Art.INK, 0.0), Art.INK, Art.INK])))
	shade.name = "Shade"
	_title.add_child(shade)
	var stage := Node2D.new()
	stage.name = "Stage"
	stage.z_index = 5
	_title.add_child(stage)
	var hero := Puppet.new("hero")
	hero.name = "Hero"
	stage.add_child(hero)
	var wolf := Puppet.new("wolf")
	wolf.name = "Wolf"
	stage.add_child(wolf)
	var logo := Art.label("AUTO-RUN", Art.label_settings(30, Art.CREAM, "num", 8, Color("4a1606"), 3))
	logo.name = "Logo"
	_title.add_child(logo)
	var logo2 := Art.label("SLOT", Art.label_settings(86, Art.GOLD, "num", 16, Color("5a2a00"), 6))
	logo2.name = "Logo2"
	_title.add_child(logo2)
	var sub := Art.label("Little Red Riding Hood", Art.label_settings(18, Color.WHITE, "num", 6, Color("2a0d04")))
	sub.name = "Sub"
	_title.add_child(sub)
	var bar := _painter(func(c: Control):
		var p: float = c.get_meta("p", 0.0)
		c.draw_style_box(Art.box(Color(0, 0, 0, 0.55), 10, 2, Color(Art.GOLD, 0.6)), Rect2(Vector2.ZERO, c.size))
		if p > 0.0:
			c.draw_style_box(Art.box(Art.GOLD, 8), Rect2(Vector2(3, 3), Vector2((c.size.x - 6) * p, c.size.y - 6))))
	bar.name = "Bar"
	_title.add_child(bar)
	var hint := Art.label("Loading...", Art.label_settings(18, Art.CREAM, "num", 5, Color("2a0d04")))
	hint.name = "Hint"
	_title.add_child(hint)
	_layout_title()
	await get_tree().process_frame
	await Sfx.build_all(func(p: float):
		bar.set_meta("p", p)
		bar.queue_redraw()
		hint.text = "Loading sounds... %d%%" % int(p * 100))
	bar.visible = false
	hint.text = "TAP TO START"
	var pulse := hint.create_tween().set_loops()
	pulse.tween_property(hint, "modulate:a", 0.35, 0.6)
	pulse.tween_property(hint, "modulate:a", 1.0, 0.6)
	_title.gui_input.connect(_on_title_input)


func _layout_title() -> void:
	var vp := get_viewport_rect().size
	_title.size = vp
	var bg: Control = _title.get_node("Bg")
	bg.size = vp
	_title.get_node("Shade").size = vp
	var logo: Label = _title.get_node("Logo")
	logo.size = Vector2(vp.x, 40)
	logo.position = Vector2(0, vp.y * 0.1)
	var logo2: Label = _title.get_node("Logo2")
	logo2.size = Vector2(vp.x, 100)
	logo2.position = Vector2(0, vp.y * 0.1 + 26)
	var sub: Label = _title.get_node("Sub")
	sub.size = Vector2(vp.x, 30)
	sub.position = Vector2(0, vp.y * 0.1 + 122)
	var hero: Node2D = _title.get_node("Stage/Hero")
	var wolf: Node2D = _title.get_node("Stage/Wolf")
	if hero.is_node_ready():
		var u: float = vp.y * 0.36 / hero.height()
		var ground := vp.y * 0.74
		hero.scale = Vector2(u, u)
		hero.position = Vector2(vp.x * 0.3, ground - hero.feet_y * u)
		wolf.scale = Vector2(-u * 1.05, u * 1.05)
		wolf.position = Vector2(vp.x * 0.72, ground - wolf.feet_y * u * 1.05)
	var bar: Control = _title.get_node("Bar")
	bar.size = Vector2(minf(vp.x * 0.7, 300), 20)
	bar.position = Vector2((vp.x - bar.size.x) / 2.0, vp.y * 0.83)
	var hint: Label = _title.get_node("Hint")
	hint.size = Vector2(vp.x, 30)
	hint.position = Vector2(0, vp.y * 0.83 + 28)


func _on_title_input(e: InputEvent) -> void:
	if not (e is InputEventMouseButton and e.pressed) and not (e is InputEventScreenTouch and e.pressed):
		return
	if Sfx.ready_count < Sfx.recipes.size():
		return
	if _title.gui_input.is_connected(_on_title_input):
		_title.gui_input.disconnect(_on_title_input)
	Sfx.play("start")
	var tw := create_tween()
	tw.tween_property(_title, "modulate:a", 0.0, 0.45)
	await tw.finished
	_title.queue_free()
	_title = null
	started = true
	toast("Tap the swords to spin")


func _unhandled_input(e: InputEvent) -> void:
	if started and e.is_action_pressed("ui_accept"):
		_on_spin()
