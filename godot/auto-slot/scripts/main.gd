# HG-Fable01 -小紅帽 主畫面（照設計稿，投注區照 PG Soft）：上方自走區（標題字、大野狼血條）、中間細木框 SLOT
# （頂端是連鎖倍率條）、Feature Buy、Total Win（這一轉的總和）、餘額／押注／贏分（單次）三格、
# 控制列（TURBO、減、轉動、加、AUTO、選單）；選單鈕打開 PG 風的選單列（Quit、Sound、Paytable、Rules、History、Close，在 menu_bar.gd）；
# 押注選項、自動旋轉次數、賠率表、規則、轉動紀錄都是從下面滑上來的面板；
# BIG WIN 演出在 big_win.gd；SCATTER（金鑰匙）→ Free Spins
extends Control

const Rules := preload("res://scripts/rules.gd")
const Art := preload("res://scripts/art.gd")
const Field := preload("res://scripts/field.gd")
const SlotView := preload("res://scripts/slot_view.gd")
const IconButton := preload("res://scripts/icon_button.gd")
const BigWin := preload("res://scripts/big_win.gd")
const Encounter := preload("res://scripts/encounter.gd")
const MenuStrip := preload("res://scripts/menu_bar.gd")
const SAVE_PATH := "user://save.cfg"
# 遊戲改名前（自走SLOT）的存檔資料夾：user:// 跟著專案名稱走，改名後換了資料夾，舊存檔在同一層的這個資料夾
const LEGACY_USER_DIR := "自走SLOT"
# 3：金額改成以「分」記、押注改成每線押注（0.01 起）
const SAVE_VERSION := 3
# 介面以 430 寬設計，畫面窄或寬時整組等比縮放
const DESIGN_W := 430.0
# 自動旋轉的次數選項（跟 PG Soft 一樣）
const AUTO_COUNTS := [10, 30, 50, 80, 1000]
# History 留最近幾轉
const HISTORY_MAX := 50
# 沒派獎時 Total Win 那一條輪播的提示：[符號磚（沒有就空字串）, 文字]
const TIPS := [
	["key", "3 or more SCATTER trigger 8, 10 or 12 free spins"],
	["hood", "Gold-framed symbols turn into WILD when they win"],
	["", "Every cascade raises the multiplier ×1 ×2 ×3 ×5, doubled in free spins"],
	["wolf", "Every coin you win strikes the wolf · every 5th is the Wolf King"],
]

# charge：還沒打出去的傷害（沒有狼可以打時存起來，下一隻站定就打出去）
var state := {"coins": Rules.START_COINS, "bet": Rules.DEFAULT_BET, "level": 1, "xp": 0, "kills": 0, "charge": 0, "turbo": false, "sound": true, "history": []}
var rng := RandomNumberGenerator.new()
var started := false
var busy := false
var auto := false
var auto_left := 0
var enemy := {}
var enemy_ready := false
var walk_left := 2.5
# Free Spins 進行中
var free := false
var fs_left := 0
var fs_done := 0
# EXTRA 模式（Free Spins）的畫面強度 0～1：外框的魔法光、Feature Buy 的 EXTRA 字樣、倍率條換色，進出時淡入淡出
var _extra_k := 0.0
var _extra_fx: Control
var _extra_sparks: CPUParticles2D
var _extra_t := 0.0
# 待機多久沒轉了：超過 IDLE_TWIRL 秒，小紅帽耍一段劍花（待機 2），之後每隔一陣子再耍一次
const IDLE_TWIRL := 2.0
var _idle := 0.0
# 血條旁邊菱形頭像：[圖, 臉的中心 uv, 半徑 uv]
var _portrait: Array = []
# 左上角的場景編號（EP01）與場景名稱；_ep_stage 是正在顯示的關卡
var _ep: Control
var _ep_stage := 0
# EXTRA 模式時場景編號換成 EXTRA、底下寫 Extra Bonus Stage（紫色，不畫關卡進度：寶箱怪不算進度）
var _ep_extra := false
# 預覽（網址 ?stage=2）：關卡從第 2 關第 1 隻開始算——出什麼怪、背景、EP 與關卡進度都照「打倒數 + _kill_off」走，
# 存檔裡的打倒數照常加（之前寫死 EP 與進度，預覽時進度不會動、換關喊的名字也對不上）
var _kill_off := 0
# 預覽用（網址 ?enemy=fox）：之後出來的敵人都換成這一種，不動存檔的進度
var _force_enemy := ""
# EXTRA 模式時先收起來的敵人（EXTRA 結束放回來）；_swapping 是正在收起來或放回來（這時不叫下一隻出場）
var _stashed := {}
# 進 EXTRA 前存著的能量（EXTRA 期間的能量只在 EXTRA 裡用，兩邊分開算）
var _charge_kept := 0
var _swapping := false
var fs_total := 0

var field: Control
var slot: Control
var hud: Control
var betbar: Control
var overlay: Control

var _floor: TextureRect
var _ui := 1.0
# 敵人登場的橫幅（疊在自走區上）
var _encounter: Control
var _enemy_box: Control
var _hp_num: Label
var _hp_bar: Control
var _hp := 1.0
var _ladder: Control
var _ladder_k := 0
var _buy: Button
var _info: Control
var _coins_label: Label
var _refill: BaseButton
var _bet_label: Label
var _win_label: Label
var _total: Control
var _total_label: Label
var _ticker: Control
var _tip_row: Control
var _tip_tween: Tween
var _tip_k := 0
var _spin_btn: BaseButton
var _auto_btn: BaseButton
var _turbo_btn: BaseButton
var _minus_btn: BaseButton
var _plus_btn: BaseButton
var _callout: Label
var _callout_sub: Label
var _toast: Label
var _bigwin: Control
var _menu_layer: Control
var _menubar: Control
var _menu_tween: Tween
var _paytable: Control
var _rules: Control
var _history: Control
var _bet_sheet: Control
var _auto_sheet: Control
var _shown_coins := 0.0
var _shown_win := 0.0
var _shown_total := 0.0
# 每轉加一：飛到一半的中獎跳字換轉了就不再更新 Total Win
var _fly_id := 0
# Total Win 的「TOTAL WIN」字樣和金額中間留多寬
const TOTAL_GAP := 22.0
var _glow: GradientTexture2D
var _queue: Array = []
var _working := false
# 這次打開遊戲後玩家轉過了沒：還沒轉的話，存檔留下來的能量不會在狼站定時自己打出去（開場不會自己出手）
var _spun := false
var _toast_tween: Tween
var _auto_running := false
var _defeating := false
var _hp_tween: Tween
var _touched := false


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
	_floor.modulate = Color(0.9, 0.88, 0.84)
	_floor.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_floor)
	var fade := _painter(func(c: Control):
		c.draw_polygon(PackedVector2Array([Vector2.ZERO, Vector2(c.size.x, 0), c.size, Vector2(0, c.size.y)]),
			PackedColorArray([Art.INK, Art.INK, Color(Art.INK, 0.0), Color(Art.INK, 0.0)])))
	fade.name = "FloorFade"
	_floor.add_child(fade)
	field = Field.new()
	add_child(field)
	field.set_backdrop(_stage())
	field.set_charge(state.charge, 0, _charge_power(), _charge_cap())
	slot = SlotView.new()
	slot.z_index = 20
	add_child(slot)
	slot.turbo = state.turbo
	field.turbo = state.turbo
	field.quake.connect(_shake)
	# SCATTER 差一個：吊胃口時自走區壓暗；湊滿 3 個時畫面震一下
	slot.tension.connect(func(on: bool):
		create_tween().tween_property(field, "modulate", Color(0.46, 0.42, 0.38) if on else Color.WHITE, 0.3))
	# SCATTER 落下時小紅帽的劍點火（Free Spins 中一直是最旺的烈焰）
	slot.scatter_landed.connect(func(count: int):
		field.scatter_fire(maxi(count, 3) if free else count)
		if count >= 3:
			_shake(10.0))
	_ladder = _build_ladder()
	_ladder.z_index = 22
	add_child(_ladder)
	_extra_fx = _build_extra_fx()
	_extra_fx.z_index = 19
	add_child(_extra_fx)
	_buy = _build_buy()
	_buy.z_index = 21
	add_child(_buy)
	_total = _build_total()
	_total.z_index = 20
	add_child(_total)
	_info = _build_info()
	_info.z_index = 20
	add_child(_info)
	betbar = _build_betbar()
	betbar.z_index = 20
	add_child(betbar)
	hud = _build_hud()
	hud.z_index = 30
	add_child(hud)
	_encounter = Encounter.new()
	_encounter.z_index = 31
	_encounter.shake.connect(_shake)
	add_child(_encounter)
	_menu_layer = _build_menu_layer()
	_menu_layer.z_index = 40
	add_child(_menu_layer)
	overlay = Control.new()
	overlay.z_index = 50
	overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(overlay)
	_build_overlay()
	slot.set_board(Rules.spin_board(rng))
	Sfx.enabled = state.sound
	Music.enabled = state.sound
	get_viewport().size_changed.connect(_layout)
	_layout()
	_shown_coins = state.coins
	_refresh_all()
	_set_win(0, false)
	_set_total(0, false)
	_set_ladder(0)
	_boot()


# ---------- 排版 ----------

# 照設計稿（430 寬）由下往上排：底部留一點地面 → 控制列（轉動鍵最大，選單在最右邊）→ 餘額／押注／贏分 →
# Total Win → Feature Buy（壓在木框下緣）→ SLOT 細木框（頂端壓著連鎖倍率條）→
# 剩下的高度給自走區（標題字、大野狼血條疊在上面）
func _layout() -> void:
	var vp := get_viewport_rect().size
	var w := minf(vp.x, 480.0)
	var x0 := (vp.x - w) / 2.0
	_ui = clampf(w / DESIGN_W, 0.8, 1.1)
	var u := _ui
	var dw := w / u
	var bar_y := vp.y - (96.0 + 14.0) * u
	betbar.scale = Vector2(u, u)
	betbar.size = Vector2(dw, 96)
	betbar.position = Vector2(x0, bar_y)
	_layout_betbar(dw)
	_menubar.scale = Vector2(u, u)
	_menubar.position = Vector2(x0, bar_y)
	_menubar.layout(dw)
	_menu_layer.size = vp
	_menu_layer.get_node("Dim").size = vp
	var info_y := bar_y - (46.0 + 4.0) * u
	_info.scale = Vector2(u, u)
	_info.size = Vector2(dw, 46)
	_info.position = Vector2(x0, info_y)
	_layout_info(dw)
	var total_y := info_y - (46.0 + 5.0) * u
	_total.scale = Vector2(u, u)
	_total.size = Vector2(dw - 12.0, 46)
	_total.position = Vector2(x0 + 6.0 * u, total_y)
	_layout_total()
	var buy_y := total_y - (40.0 + 1.0) * u
	_buy.scale = Vector2(u, u)
	_buy.size = Vector2(196, 40)
	_buy.position = Vector2((vp.x - 196.0 * u) / 2.0, buy_y)
	# 木框外緣離畫面左右各 6；Feature Buy 壓在木框下緣上
	var border := 12.0 * u
	var reel_w := w - 12.0 - border * 2.0
	var slot_h: float = slot.layout(reel_w, border)
	var wood_bottom := buy_y + 17.0 * u
	slot.position = Vector2((vp.x - reel_w) / 2.0, wood_bottom - border - slot_h)
	var field_h := maxf(slot.position.y - border + 10.0 * u, 150.0)
	field.position = Vector2.ZERO
	field.size = Vector2(vp.x, field_h)
	_floor.position = Vector2(0, field_h - 40.0)
	_floor.size = Vector2(vp.x, vp.y - _floor.position.y)
	_floor.get_node("FloorFade").size = Vector2(vp.x, 80)
	_ladder.scale = Vector2(u, u)
	_ladder.position = Vector2((vp.x - _ladder.size.x * u) / 2.0, slot.position.y - border - _ladder.size.y * u * 0.5)
	_extra_fx.size = vp
	_layout_extra_sparks()
	hud.scale = Vector2(u, u)
	hud.position = Vector2(x0, 0)
	hud.size = Vector2(dw, field_h / u)
	_layout_hud(dw, field_h / u)
	_encounter.position = Vector2.ZERO
	_encounter.size = Vector2(vp.x, field_h)
	overlay.size = vp
	_layout_overlay()


func _painter(fn: Callable) -> Control:
	var c := Control.new()
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	c.draw.connect(func(): fn.call(c))
	return c


# 深藍底、古金細邊的面板（選單裡的按鈕、提示）
func _plate_box(radius := 8, alpha := 0.92) -> StyleBoxFlat:
	var sb := Art.box(Color(Art.PANEL, alpha), radius, 1, Art.PANEL_EDGE)
	sb.shadow_color = Color(0, 0, 0, 0.5)
	sb.shadow_size = 4
	sb.shadow_offset = Vector2(0, 2)
	return sb


# 橫向三段的底圖（資訊面板、Feature Buy）：整張依高度等比縮，左右兩端（金花角）不變形、中段橫向拉長
func _three_slice(c: CanvasItem, tex: Texture2D, r: Rect2, cap: float, mod := Color.WHITE) -> void:
	var k := r.size.y / tex.get_height()
	var w := minf(cap * k, r.size.x / 2.0)
	var tw := float(tex.get_width())
	var src_cap := w / k
	c.draw_texture_rect_region(tex, Rect2(r.position, Vector2(w, r.size.y)), Rect2(0, 0, src_cap, tex.get_height()), mod)
	c.draw_texture_rect_region(tex, Rect2(r.position.x + w, r.position.y, r.size.x - w * 2.0, r.size.y), Rect2(src_cap, 0, tw - src_cap * 2.0, tex.get_height()), mod)
	c.draw_texture_rect_region(tex, Rect2(r.end.x - w, r.position.y, w, r.size.y), Rect2(tw - src_cap, 0, src_cap, tex.get_height()), mod)


# 菱形頭像（血條右邊的敵人）：敵人站姿圖的臉部（_portrait）裁成菱形，外圈古金框
func _diamond() -> Control:
	return _painter(func(c: Control):
		if _portrait.is_empty():
			return
		var tex: Texture2D = _portrait[0]
		var center_uv: Vector2 = _portrait[1]
		var radius_uv: Vector2 = _portrait[2]
		var r := c.size.x / 2.0
		var o := Vector2(r, r)
		var corners := [Vector2(0, -1), Vector2(1, 0), Vector2(0, 1), Vector2(-1, 0)]
		var outer := PackedVector2Array()
		var mid := PackedVector2Array()
		var pts := PackedVector2Array()
		var uvs := PackedVector2Array()
		for d in corners:
			outer.append(o + d * r)
			mid.append(o + d * r * 0.86)
			pts.append(o + d * r * 0.76)
			uvs.append(center_uv + d * radius_uv)
		var shadow := PackedVector2Array()
		for p in outer:
			shadow.append(p + Vector2(0, 2))
		c.draw_colored_polygon(shadow, Color(0, 0, 0, 0.55))
		c.draw_colored_polygon(outer, Art.GOLD_DEEP)
		c.draw_colored_polygon(mid, Color("1a0f08"))
		c.draw_colored_polygon(pts, Color.WHITE, uvs, tex)
		outer.append(outer[0])
		pts.append(pts[0])
		c.draw_polyline(outer, Art.GOLD, 1.4, true)
		c.draw_polyline(pts, Color(Art.GOLD_LIGHT, 0.9), 1.0, true))


# ---------- 上方：場景編號（左上，EP01 ＋ 場景名稱）、敵人血條與菱形頭像（右上，有敵人時才出現） ----------

func _build_hud() -> Control:
	var h := Control.new()
	h.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_enemy_box = Control.new()
	_enemy_box.name = "Enemy"
	_enemy_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_enemy_box.modulate.a = 0.0
	h.add_child(_enemy_box)
	_hp_bar = _painter(func(c: Control):
		var r := Rect2(Vector2.ZERO, c.size)
		c.draw_style_box(Art.box(Color(0, 0, 0, 0.6), 4), r.grow(2))
		c.draw_style_box(Art.box(Color("1a0506"), 3, 1, Color(Art.GOLD_DEEP, 0.9)), r)
		if _hp > 0.0:
			var fill := Rect2(Vector2(1.5, 1.5), Vector2((c.size.x - 3) * _hp, c.size.y - 3))
			c.draw_style_box(Art.box(Color("8e0d14"), 2), fill)
			c.draw_style_box(Art.box(Color("e0262c"), 2), Rect2(fill.position, Vector2(fill.size.x, fill.size.y * 0.5))))
	_enemy_box.add_child(_hp_bar)
	_hp_num = Art.label("", Art.label_settings(10, Color.WHITE, "num", 3, Art.INK))
	_hp_bar.add_child(_hp_num)
	var face := _diamond()
	face.name = "Portrait"
	_enemy_box.add_child(face)
	_ep = _painter(_draw_ep)
	h.add_child(_ep)
	return h


# 場景編號：金色大字 EP01，底下一條往右淡掉的金線，再一行場景名稱，再一排關卡進度；後面墊一片往右淡掉的暗色，亮背景上也看得清楚。
# EXTRA 模式時大字是 EXTRA、線和字換成紫色，底下寫 Extra Bonus Stage
func _draw_ep(c: Control) -> void:
	if _ep_stage <= 0:
		return
	var f := Art.font()
	var ep := "EXTRA" if _ep_extra else "EP%02d" % _ep_stage
	var title := "Extra Bonus Stage" if _ep_extra else Rules.stage_name(_ep_stage)
	var fill := Color("ead2ff") if _ep_extra else Art.GOLD_LIGHT
	var ink := Art.EXTRA_DEEP if _ep_extra else Art.GOLD_INK
	var line := Art.EXTRA if _ep_extra else Art.GOLD
	var nw := Art.font("light").get_string_size(title, HORIZONTAL_ALIGNMENT_LEFT, -1, 12).x
	var w := maxf(nw, 90.0) + 40.0
	var dark := Color(Art.INK, 0.42)
	var clear := Color(Art.INK, 0.0)
	c.draw_polygon(PackedVector2Array([Vector2(-14, -4), Vector2(w, -4), Vector2(w, 68), Vector2(-14, 68)]),
		PackedColorArray([dark, clear, clear, dark]))
	var base := Vector2(0, 24)
	c.draw_string_outline(f, base + Vector2(0, 2), ep, HORIZONTAL_ALIGNMENT_LEFT, -1, 24, 7, Color(0, 0, 0, 0.5))
	c.draw_string_outline(f, base, ep, HORIZONTAL_ALIGNMENT_LEFT, -1, 24, 6, ink)
	c.draw_string(f, base, ep, HORIZONTAL_ALIGNMENT_LEFT, -1, 24, fill)
	c.draw_polygon(PackedVector2Array([Vector2(0, 30), Vector2(nw + 24, 30), Vector2(nw + 24, 31.5), Vector2(0, 31.5)]),
		PackedColorArray([line, Color(line, 0.0), Color(line, 0.0), line]))
	var lf := Art.font("light")
	c.draw_string_outline(lf, Vector2(0, 45), title, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, 4, Art.INK)
	c.draw_string(lf, Vector2(0, 45), title, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color("e6d4ff") if _ep_extra else Art.CREAM)
	if not _ep_extra:
		_draw_progress(c, Vector2(5, 58))


# 關卡進度：6 顆小菱形是小動物（打倒的填金、正在打的那顆一閃一閃），最後一顆大一點的皇冠是 BOSS
func _draw_progress(c: Control, at: Vector2) -> void:
	var done: int = _kills() % Rules.BOSS_EVERY
	var gap := 13.0
	for i in Rules.BOSS_EVERY:
		var p := at + Vector2(i * gap + (4.0 if i == Rules.BOSS_EVERY - 1 else 0.0), 0)
		var current := i == done
		var lit := i < done
		var pulse := 0.5 + 0.5 * sin(Time.get_ticks_msec() / 160.0)
		if i < Rules.BOSS_EVERY - 1:
			var r := 4.2
			var pts := PackedVector2Array([p + Vector2(0, -r), p + Vector2(r, 0), p + Vector2(0, r), p + Vector2(-r, 0)])
			c.draw_colored_polygon(pts, Color(Art.INK, 0.75))
			var inner := PackedVector2Array()
			for q in pts:
				inner.append(p + (q - p) * 0.72)
			if lit:
				c.draw_colored_polygon(inner, Art.GOLD)
			elif current:
				c.draw_colored_polygon(inner, Color(Art.GOLD_LIGHT, 0.35 + 0.55 * pulse))
			pts.append(pts[0])
			c.draw_polyline(pts, Color(Art.GOLD_DEEP, 0.9), 1.0, true)
		else:
			# BOSS：小皇冠
			var w := 7.5
			var crown := PackedVector2Array([p + Vector2(-w, 4), p + Vector2(-w, -3), p + Vector2(-w * 0.5, 0.5), p + Vector2(0, -6),
				p + Vector2(w * 0.5, 0.5), p + Vector2(w, -3), p + Vector2(w, 4)])
			var col := Color("e0262c") if current else (Art.GOLD if lit else Color(Art.INK, 0.75))
			if current:
				col = col.lerp(Color(1, 0.6, 0.6), 0.4 * pulse)
			c.draw_colored_polygon(crown, col)
			crown.append(crown[0])
			c.draw_polyline(crown, Art.GOLD_LIGHT if current or lit else Color(Art.GOLD_DEEP, 0.9), 1.2, true)


# 換關：場景編號換成新的一關，animate 時放大彈回、閃一下
func _set_ep(stage: int, animate: bool) -> void:
	_ep_stage = stage
	_ep.queue_redraw()
	if animate:
		_pop_ep()


# 場景編號放大彈回、閃一下（換關、進出 EXTRA）
func _pop_ep() -> void:
	var tw := create_tween()
	_ep.scale = Vector2(1.35, 1.35)
	_ep.modulate = Color(2.0, 2.0, 2.0, _ep.modulate.a)
	tw.tween_property(_ep, "scale", Vector2.ONE, 0.35).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_property(_ep, "modulate:r", 1.0, 0.4)
	tw.parallel().tween_property(_ep, "modulate:g", 1.0, 0.4)
	tw.parallel().tween_property(_ep, "modulate:b", 1.0, 0.4)


func _layout_hud(dw: float, fh: float) -> void:
	# 遊戲裡不放標題字（網頁 loading 畫面才有），存著傷害的能量條不必讓位
	field.avoid = Rect2()
	_ep.position = Vector2(14, 12)
	_ep.size = Vector2(170, 66)
	_ep.pivot_offset = Vector2(0, 24)
	_enemy_box.position = Vector2(dw - 196, 30)
	_enemy_box.size = Vector2(186, 52)
	var portrait: Control = _enemy_box.get_node("Portrait")
	portrait.size = Vector2(48, 48)
	portrait.position = Vector2(_enemy_box.size.x - 48, 0)
	_hp_bar.position = Vector2(0, 18)
	_hp_bar.size = Vector2(_enemy_box.size.x - 40, 14)
	_hp_num.position = Vector2.ZERO
	_hp_num.size = _hp_bar.size


# ---------- 連鎖倍率條：外框頂端，×1 ×2 ×3 ×5（Free Spins 時 ×2 ×4 ×6 ×10），現在這一段亮起來 ----------

func _build_ladder() -> Control:
	var l := _painter(func(c: Control):
		var mults: Array = Rules.FS_MULTIPLIERS if free else Rules.MULTIPLIERS
		var r := Rect2(Vector2.ZERO, c.size)
		var sb := Art.box(Color(0.16, 0.09, 0.04, 0.94).lerp(Color(Art.EXTRA_DEEP, 0.96), _extra_k), int(c.size.y / 2.0), 1, Art.GOLD_DEEP.lerp(Art.EXTRA, _extra_k))
		sb.shadow_color = Color(0, 0, 0, 0.6).lerp(Color(Art.EXTRA, 0.7), _extra_k)
		sb.shadow_size = 5 + int(5 * _extra_k)
		c.draw_style_box(sb, r)
		var cw := (c.size.x - 8.0) / mults.size()
		var f := Art.font()
		for i in mults.size():
			var cell := Rect2(4.0 + i * cw, 3.0, cw, c.size.y - 6.0)
			var on := i == _ladder_k
			if on:
				var hi := Art.box(Color("8e0d14").lerp(Color("7a2bc4"), _extra_k), int(cell.size.y / 2.0), 1, Art.GOLD)
				hi.shadow_color = Color(1, 0.55, 0.2, 0.6)
				hi.shadow_size = 6
				c.draw_style_box(hi, cell.grow_individual(-2, 0, -2, 0))
			var text := "×%d" % mults[i]
			var fs := 15 if on else 13
			var base := Vector2(cell.position.x, cell.position.y + cell.size.y * 0.5 + fs * 0.36)
			c.draw_string_outline(f, base, text, HORIZONTAL_ALIGNMENT_CENTER, cell.size.x, fs, 4, Art.GOLD_INK)
			c.draw_string(f, base, text, HORIZONTAL_ALIGNMENT_CENTER, cell.size.x, fs, Art.GOLD_LIGHT if on else Color(Art.CREAM, 0.55)))
	l.size = Vector2(184, 28)
	l.pivot_offset = l.size / 2.0
	return l


func _set_ladder(k: int) -> void:
	var to := mini(k, Rules.MULTIPLIERS.size() - 1)
	if to != _ladder_k and to > 0:
		var tw := create_tween()
		tw.tween_property(_ladder, "scale", Vector2(1.12, 1.12) * _ui, 0.08)
		tw.tween_property(_ladder, "scale", Vector2(_ui, _ui), 0.2).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_ladder_k = to
	_ladder.queue_redraw()


func _refresh_fs() -> void:
	_buy.queue_redraw()
	_ladder.queue_redraw()


# ---------- Feature Buy：金框木頭底板；目前只放按鈕。Free Spins（EXTRA 模式）時改寫兩行：大大的 EXTRA、下面「FREE SPINS 第幾轉 / 共幾轉」，外圈紫光一呼一吸 ----------

# 底板原圖（art/ui/buy.webp）兩端金色捲花的寬度（原圖像素），三段式拉長時這兩段不變形
const BUY_CAP := 140.0

func _build_buy() -> Button:
	var b := Button.new()
	b.flat = true
	b.focus_mode = Control.FOCUS_NONE
	b.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	var tex := Art.ui("buy")
	b.draw.connect(func():
		var press := 0.95 if b.is_pressed() else 1.0
		var r := Rect2(Vector2.ZERO, b.size)
		var sz := r.size * press
		var plate := Rect2(r.get_center() - sz / 2.0, sz)
		var pulse := 0.5 + 0.5 * sin(_extra_t * 3.4)
		if _extra_k > 0.01:
			var glow := Art.box(Color(0, 0, 0, 0), int(plate.size.y / 2.0))
			glow.shadow_color = Color(Art.EXTRA, (0.45 + 0.35 * pulse) * _extra_k)
			glow.shadow_size = int(10 + 8 * pulse)
			b.draw_style_box(glow, plate.grow(-4))
		# 底板拉滿整個按鈕寬：兩端的金色捲花不變形、中間木板橫向拉長（原圖比例偏高，等比縮的話中間太窄、字會超出框）
		_three_slice(b, tex, plate, BUY_CAP, Color.WHITE.lerp(Color(1.0, 0.9, 1.12), _extra_k))
		var f := Art.font()
		# 字只放在中間木板裡（扣掉兩端捲花與金邊），太長就縮小
		var room := plate.size.x - 2.0 * BUY_CAP * plate.size.y / tex.get_height() - 12.0
		if free:
			_draw_extra_text(b, f, r, room, pulse)
			return
		var text := "Feature Buy"
		var fs := 18
		while fs > 9 and f.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x > room:
			fs -= 1
		var base := Vector2(0, r.size.y * 0.5 + fs * 0.36)
		b.draw_string_outline(f, base + Vector2(0, 1.5), text, HORIZONTAL_ALIGNMENT_CENTER, r.size.x, fs, 5, Color(0, 0, 0, 0.6))
		b.draw_string_outline(f, base, text, HORIZONTAL_ALIGNMENT_CENTER, r.size.x, fs, 4, Color("3a0608"))
		b.draw_string(f, base, text, HORIZONTAL_ALIGNMENT_CENTER, r.size.x, fs, Art.GOLD_LIGHT))
	b.button_down.connect(b.queue_redraw)
	b.button_up.connect(b.queue_redraw)
	b.pressed.connect(func():
		if free:
			return
		Sfx.play("click")
		toast("Feature Buy — coming soon"))
	return b


# EXTRA 模式的字樣：兩行，上面大大的金色 EXTRA（紫色描邊、一呼一吸微微變亮），下面小字照原本寫「FREE SPINS 第幾轉 / 共幾轉」
func _draw_extra_text(b: Control, f: Font, r: Rect2, room: float, pulse: float) -> void:
	var count := "FREE SPINS  %d / %d" % [fs_done, fs_done + fs_left]
	var big := 17
	var small := 10
	while big > 11 and f.get_string_size("EXTRA", HORIZONTAL_ALIGNMENT_LEFT, -1, big).x > room:
		big -= 1
	while small > 7 and f.get_string_size(count, HORIZONTAL_ALIGNMENT_LEFT, -1, small).x > room:
		small -= 1
	var ink := Color("3a0b5e")
	var top := r.size.y * 0.5 - 1.0
	var base := Vector2(0, top)
	b.draw_string_outline(f, base + Vector2(0, 1.5), "EXTRA", HORIZONTAL_ALIGNMENT_CENTER, r.size.x, big, 6, Color(0, 0, 0, 0.6))
	b.draw_string_outline(f, base, "EXTRA", HORIZONTAL_ALIGNMENT_CENTER, r.size.x, big, 5, ink)
	b.draw_string(f, base, "EXTRA", HORIZONTAL_ALIGNMENT_CENTER, r.size.x, big, Art.GOLD_LIGHT.lerp(Color.WHITE, 0.35 * pulse))
	var cb := Vector2(0, top + small + 3.0)
	b.draw_string_outline(f, cb, count, HORIZONTAL_ALIGNMENT_CENTER, r.size.x, small, 4, ink)
	b.draw_string(f, cb, count, HORIZONTAL_ALIGNMENT_CENTER, r.size.x, small, Art.CREAM)


# EXTRA 模式的外框光：不畫邊線，只讓紫光從外框底下透出來——以外框圖（含藤蔓、雕花角塊）外緣往內縮一點的圓角方塊當光源，
# 一層寬而淡、一層窄而亮的柔光（一呼一吸），木框外緣一路冒出小小的金色、紫色光點慢慢往上飄
func _build_extra_fx() -> Control:
	var c := _painter(func(c: Control):
		if _extra_k < 0.01:
			return
		var wood := Rect2(slot.position + slot.frame_rect.position, slot.frame_rect.size).grow(-10.0)
		var pulse := 0.5 + 0.5 * sin(_extra_t * 2.2)
		for layer in [[30.0, 0.42, Art.EXTRA], [12.0, 0.5, Color(0.86, 0.68, 1.0)]]:
			var sb := Art.box(Color(0, 0, 0, 0), 20)
			sb.shadow_color = Color(layer[2], layer[1] * (0.7 + 0.3 * pulse) * _extra_k)
			sb.shadow_size = int(layer[0] + 6.0 * pulse)
			c.draw_style_box(sb, wood))
	_extra_sparks = CPUParticles2D.new()
	_extra_sparks.emitting = false
	_extra_sparks.amount = 36
	_extra_sparks.lifetime = 1.4
	_extra_sparks.emission_shape = CPUParticles2D.EMISSION_SHAPE_POINTS
	_extra_sparks.direction = Vector2.UP
	_extra_sparks.spread = 25.0
	_extra_sparks.gravity = Vector2(0, -18)
	_extra_sparks.initial_velocity_min = 8.0
	_extra_sparks.initial_velocity_max = 30.0
	_extra_sparks.scale_amount_min = 1.2
	_extra_sparks.scale_amount_max = 2.6
	var ramp := Gradient.new()
	ramp.offsets = PackedFloat32Array([0.0, 0.2, 0.7, 1.0])
	ramp.colors = PackedColorArray([Color(1, 0.95, 0.7, 0), Color(1, 0.92, 0.7, 0.9), Color(0.8, 0.55, 1.0, 0.6), Color(0.7, 0.4, 1.0, 0)])
	_extra_sparks.color_ramp = ramp
	c.add_child(_extra_sparks)
	return c


# 光點冒出來的位置：外框圖外緣一圈，每隔幾個像素一點
func _layout_extra_sparks() -> void:
	var r := Rect2(slot.position + slot.frame_rect.position, slot.frame_rect.size).grow(-4.0)
	var pts := PackedVector2Array()
	var step := 14.0
	var x := r.position.x
	while x <= r.end.x:
		pts.append(Vector2(x, r.position.y))
		pts.append(Vector2(x, r.end.y))
		x += step
	var y := r.position.y
	while y <= r.end.y:
		pts.append(Vector2(r.position.x, y))
		pts.append(Vector2(r.end.x, y))
		y += step
	_extra_sparks.position = Vector2.ZERO
	_extra_sparks.emission_points = pts


# 進出 EXTRA 模式：外框光、Feature Buy、倍率條淡入淡出，自走區罩上魔法光，Total Win 的字樣改成 EXTRA WIN
func _set_extra(on: bool) -> void:
	create_tween().tween_property(self, "_extra_k", 1.0 if on else 0.0, 0.6)
	_extra_sparks.emitting = on
	field.set_extra(on)
	(_total.get_node("Cap") as Label).text = "EXTRA\nWIN" if on else "TOTAL\nWIN"
	_ep_extra = on
	_pop_ep()
	_refresh_fs()


# ---------- Total Win（照 PG Piñata Wins）：這一轉所有連鎖的總和；Free Spins 時是整輪累計。框跟下面三格一樣；
# 沒派獎（還沒中、這轉沒中）時改成跑馬燈，輪播 TIPS 的提示 ----------

func _build_total() -> Control:
	var tex := Art.ui("panel")
	var bar := _painter(func(c: Control): _three_slice(c, tex, Rect2(Vector2.ZERO, c.size), 60.0))
	# 兩行小字：Cinzel 的行高很高，行距收緊才擠得進框裡
	var cap_ls := Art.label_settings(11, Art.GOLD, "num", 3, Art.GOLD_INK)
	cap_ls.line_spacing = -5.0
	var cap := Art.label("TOTAL
WIN", cap_ls)
	cap.name = "Cap"
	bar.add_child(cap)
	_total_label = Art.label("0", Art.label_settings(24, Art.GOLD_LIGHT, "num", 6, Art.GOLD_INK, 3), HORIZONTAL_ALIGNMENT_LEFT)
	_total_label.clip_text = true
	bar.add_child(_total_label)
	_ticker = Control.new()
	_ticker.clip_contents = true
	_ticker.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bar.add_child(_ticker)
	return bar


func _layout_total() -> void:
	var w := _total.size.x
	var cap: Label = _total.get_node("Cap")
	cap.size = Vector2(56, _total.size.y)
	_total_label.pivot_offset = Vector2(0, _total.size.y / 2.0)
	_place_total(roundi(_shown_total))
	_ticker.position = Vector2(16, 5)
	_ticker.size = Vector2(w - 32, _total.size.y - 10)


# 「TOTAL WIN」與金額當成一組置中、中間留 TOTAL_GAP（照最後的金額算，跳數字時不會左右晃）；
# 回傳（字樣中心 x、金額左邊 x、金額寬），都是 _total 的座標
func _total_slots(value: int) -> Vector3:
	var cap: Label = _total.get_node("Cap")
	var cls := cap.label_settings
	var cw := cls.font.get_string_size("TOTAL", HORIZONTAL_ALIGNMENT_LEFT, -1, cls.font_size).x
	var ls := _total_label.label_settings
	var aw := ls.font.get_string_size(Art.money(value), HORIZONTAL_ALIGNMENT_LEFT, -1, 24).x
	var x0 := maxf(14.0, (_total.size.x - cw - TOTAL_GAP - aw) / 2.0)
	return Vector3(x0 + cw / 2.0, x0 + cw + TOTAL_GAP, aw)


func _place_total(value: int) -> void:
	var x := _total_slots(value)
	var cap: Label = _total.get_node("Cap")
	cap.position = Vector2(x.x - cap.size.x / 2.0, 0)
	_total_label.position = Vector2(x.y, 0)
	_total_label.size = Vector2(_total.size.x - x.y - 14.0, _total.size.y)


func _set_total(value: int, animate: bool) -> void:
	var has_win := value > 0
	if has_win:
		_place_total(value)
	_total.get_node("Cap").visible = has_win
	_total_label.visible = has_win
	_ticker.visible = not has_win
	if not has_win:
		_shown_total = 0
		if not (_tip_tween and _tip_tween.is_valid()):
			_next_tip()
		return
	if _tip_tween:
		_tip_tween.kill()
		_tip_tween = null
	if not animate:
		_shown_total = value
		_fit(_total_label, Art.money(value), 24)
		return
	var tw := create_tween()
	tw.tween_method(func(v: float):
		_shown_total = v
		_fit(_total_label, Art.money(v), 24), _shown_total, float(value), 0.45)
	_total_label.scale = Vector2(1.18, 1.18)
	tw.parallel().tween_property(_total_label, "scale", Vector2.ONE, 0.35).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)


# 跑馬燈：一則提示（符號小圖＋文字）從右邊跑到左邊，跑完換下一則
func _next_tip() -> void:
	if _tip_row:
		_tip_row.queue_free()
	var tip: Array = TIPS[_tip_k % TIPS.size()]
	_tip_k += 1
	var row := HBoxContainer.new()
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_theme_constant_override("separation", 8)
	if tip[0] != "":
		var icon := TextureRect.new()
		icon.texture = Art.symbol(tip[0])
		icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		icon.custom_minimum_size = Vector2(28, 29)
		icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
		row.add_child(icon)
	row.add_child(Art.label(tip[1], Art.label_settings(14, Art.CREAM, "light", 3, Art.INK)))
	_ticker.add_child(row)
	_tip_row = row
	row.size = row.get_combined_minimum_size()
	row.position = Vector2(_ticker.size.x, (_ticker.size.y - row.size.y) / 2.0)
	_tip_tween = create_tween()
	_tip_tween.tween_property(row, "position:x", -row.size.x, (_ticker.size.x + row.size.x) / 70.0)
	_tip_tween.tween_callback(_next_tip)


# ---------- 餘額／押注／贏分三格（照 PG Soft：圖示＋小標＋數字；贏分是單次（這一段連鎖），
# 點押注開押注選項，餘額低時可以補幣） ----------

func _build_info() -> Control:
	var row := Control.new()
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var specs := [["Balance", "wallet", "BALANCE"], ["Bet", "coins", "BET"], ["Win", "win", "WIN"]]
	for spec in specs:
		var p := _info_panel(spec[1], spec[2])
		p.name = spec[0]
		row.add_child(p)
	_coins_label = row.get_node("Balance/Value")
	_bet_label = row.get_node("Bet/Value")
	_win_label = row.get_node("Win/Value")
	_win_label.label_settings = Art.label_settings(16, Art.GOLD_LIGHT, "num", 4, Art.GOLD_INK)
	var bet: Control = row.get_node("Bet")
	bet.mouse_filter = Control.MOUSE_FILTER_STOP
	bet.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	bet.gui_input.connect(func(e: InputEvent):
		if e is InputEventMouseButton and e.pressed and e.button_index == MOUSE_BUTTON_LEFT:
			_open_bet())
	_refill = IconButton.new("refill")
	_refill.pressed.connect(_on_refill)
	row.get_node("Balance").add_child(_refill)
	return row


func _info_panel(icon_name: String, caption: String) -> Control:
	var tex := Art.ui("panel")
	var p := _painter(func(c: Control): _three_slice(c, tex, Rect2(Vector2.ZERO, c.size), 60.0))
	var icon := TextureRect.new()
	icon.name = "Icon"
	icon.texture = Art.ui(icon_name)
	icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
	p.add_child(icon)
	var cap := Art.label(caption, Art.label_settings(9, Art.CREAM, "light", 2, Art.INK))
	cap.name = "Cap"
	p.add_child(cap)
	var value := Art.label("0", Art.label_settings(15, Color.WHITE, "num", 3, Art.INK))
	value.name = "Value"
	value.clip_text = true
	p.add_child(value)
	return p


func _layout_info(dw: float) -> void:
	var gap := 5.0
	var pw := (dw - 16.0 - gap * 2.0) / 3.0
	for i in 3:
		var p: Control = _info.get_child(i)
		p.position = Vector2(8.0 + i * (pw + gap), 0)
		p.size = Vector2(pw, 46)
		var icon: Control = p.get_node("Icon")
		icon.position = Vector2(7, 8)
		icon.size = Vector2(32, 30)
		var cap: Label = p.get_node("Cap")
		cap.position = Vector2(38, 6)
		cap.size = Vector2(pw - 44, 12)
		var value: Label = p.get_node("Value")
		value.position = Vector2(38, 17)
		value.size = Vector2(pw - 44, 22)
	_refill.size = Vector2(16, 16)
	_refill.position = Vector2(pw - 15, -5)


# 三格裡的數字太長（例如 12,345.67）就縮小字，免得被切掉
func _fit(l: Label, text: String, base := 15) -> void:
	l.text = text
	var ls := l.label_settings
	var fs := base
	while fs > 10 and ls.font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x > l.size.x - 2.0:
		fs -= 1
	if ls.font_size != fs:
		ls.font_size = fs


func _set_win(value: int, animate: bool) -> void:
	_win_label.pivot_offset = _win_label.size / 2.0
	if not animate:
		_shown_win = value
		_fit(_win_label, Art.money(value), 16)
		return
	var tw := create_tween()
	tw.tween_method(func(v: float):
		_shown_win = v
		_fit(_win_label, Art.money(v), 16), _shown_win, float(value), 0.45)
	_win_label.scale = Vector2(1.25, 1.25)
	tw.parallel().tween_property(_win_label, "scale", Vector2.ONE, 0.35).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)


# ---------- 控制列（照 PG Soft）：TURBO、減、轉動、加、AUTO、選單（貼最右邊） ----------

func _build_betbar() -> Control:
	var bar := Control.new()
	bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var menu := IconButton.new("menu")
	menu.name = "Menu"
	menu.pressed.connect(_open_menu)
	bar.add_child(menu)
	# TURBO 底下的字：關著寫 OFF、開著寫 TURBO
	_turbo_btn = IconButton.new("turbo", "TURBO")
	_turbo_btn.toggle_mode = true
	_turbo_btn.set_pressed_no_signal(state.turbo)
	_turbo_btn.toggled.connect(_on_turbo)
	bar.add_child(_turbo_btn)
	_minus_btn = IconButton.new("minus")
	_minus_btn.pressed.connect(func(): _change_bet(-1))
	bar.add_child(_minus_btn)
	_plus_btn = IconButton.new("plus")
	_plus_btn.pressed.connect(func(): _change_bet(1))
	bar.add_child(_plus_btn)
	_auto_btn = IconButton.new("auto", "AUTO")
	_auto_btn.pressed.connect(_on_auto)
	bar.add_child(_auto_btn)
	_spin_btn = IconButton.new("spin")
	_spin_btn.pressed.connect(_on_spin)
	bar.add_child(_spin_btn)
	return bar


func _layout_betbar(dw: float) -> void:
	var cx := dw / 2.0
	var cy := 48.0
	var spin_d := 90.0
	_spin_btn.size = Vector2(spin_d, spin_d)
	_spin_btn.position = Vector2(cx - spin_d / 2.0, cy - spin_d / 2.0)
	var pm := 40.0
	_minus_btn.size = Vector2(pm, pm)
	_minus_btn.position = Vector2(cx - spin_d / 2.0 - 20 - pm, cy - pm / 2.0)
	_plus_btn.size = Vector2(pm, pm)
	_plus_btn.position = Vector2(cx + spin_d / 2.0 + 20, cy - pm / 2.0)
	var d := 42.0
	_turbo_btn.size = Vector2(d, d + 15)
	_turbo_btn.position = Vector2(_minus_btn.position.x - 18 - d, cy - d / 2.0)
	_auto_btn.size = Vector2(d, d + 15)
	_auto_btn.position = Vector2(_plus_btn.position.x + pm + 18, cy - d / 2.0)
	var md := 34.0
	var menu: Control = betbar.get_node("Menu")
	menu.size = Vector2(md, md)
	menu.position = Vector2(dw - 6 - md, cy - md / 2.0)


# 選單列（照 PG Soft）：全畫面壓暗（點暗處也會收起來），控制列淡掉、同一個位置換成一排圖示
func _build_menu_layer() -> Control:
	var layer := Control.new()
	layer.visible = false
	layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var dim := ColorRect.new()
	dim.name = "Dim"
	dim.color = Color(0, 0, 0, 0.62)
	dim.gui_input.connect(func(e: InputEvent):
		if e is InputEventMouseButton and e.pressed:
			_close_menu())
	layer.add_child(dim)
	_menubar = MenuStrip.new()
	_menubar.picked.connect(_on_menu_pick)
	layer.add_child(_menubar)
	return layer


func _open_menu() -> void:
	Sfx.play("click")
	_menubar.set_muted(not state.sound)
	if _menu_tween:
		_menu_tween.kill()
	_menu_layer.visible = true
	_menu_tween = create_tween().set_parallel()
	_menu_tween.tween_property(_menu_layer, "modulate:a", 1.0, 0.15).from(0.0)
	_menu_tween.tween_property(betbar, "modulate:a", 0.0, 0.12)
	_menubar.pop_in()


func _close_menu() -> void:
	if not _menu_layer.visible:
		return
	if _menu_tween:
		_menu_tween.kill()
	_menu_tween = create_tween().set_parallel()
	_menu_tween.tween_property(_menu_layer, "modulate:a", 0.0, 0.12)
	_menu_tween.tween_property(betbar, "modulate:a", 1.0, 0.15)
	_menu_tween.chain().tween_callback(func(): _menu_layer.visible = false)


func _on_menu_pick(id: String) -> void:
	if id != "sound":
		Sfx.play("click")
	match id:
		"quit":
			_quit()
		"sound":
			_set_sound(not state.sound)
		"paytable":
			_close_menu()
			_open_sheet(_paytable)
		"rules":
			_close_menu()
			_open_sheet(_rules)
		"history":
			_close_menu()
			_open_sheet(_history)
		"close":
			_close_menu()


# Quit：存檔後回網站首頁（遊戲嵌在 auto-slot.html 的 iframe 裡，要換掉整個分頁）；
# 轉動中先不給離開，免得這一轉的贏分還沒入帳
func _quit() -> void:
	if busy:
		toast("Wait for the spin to finish")
		return
	_save(true)
	if OS.has_feature("web"):
		JavaScriptBridge.eval("window.top.location.href = '/'")
	else:
		get_tree().quit()


# 聲音總開關（照 PG Soft 只有一個）：音效與音樂一起開關
func _set_sound(on: bool) -> void:
	state.sound = on
	Sfx.enabled = on
	Music.enabled = on
	_menubar.set_muted(not on)
	Sfx.play("click")
	toast("Sound on" if on else "Sound off")
	_save()


func _change_bet(d: int) -> void:
	if busy:
		return
	_set_bet(clampi(state.bet + d, 0, Rules.BET_LEVELS.size() - 1))


func _set_bet(k: int) -> void:
	state.bet = k
	Sfx.play("click")
	_save()
	_refresh_all()
	field.set_charge(state.charge, 0, _charge_power(), _charge_cap())


func _on_turbo(on: bool) -> void:
	state.turbo = on
	slot.turbo = on
	field.turbo = on
	Sfx.play("click")
	toast("Turbo spin on" if on else "Turbo spin off")
	_save()


# ---------- 疊在最上層：大字、提示、BIG WIN、面板（押注選項、自動旋轉、選單） ----------

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
	_bigwin = BigWin.new()
	_bigwin.upgraded.connect(func(_level: int): _shake(8.0))
	overlay.add_child(_bigwin)
	_bet_sheet = _make_sheet("BET OPTIONS")
	overlay.add_child(_bet_sheet)
	_auto_sheet = _make_sheet("AUTO SPIN")
	overlay.add_child(_auto_sheet)
	_paytable = _make_sheet("PAYTABLE", true)
	overlay.add_child(_paytable)
	_rules = _make_sheet("RULES", true)
	overlay.add_child(_rules)
	_history = _make_sheet("HISTORY", true)
	overlay.add_child(_history)


func _layout_overlay() -> void:
	var vp := get_viewport_rect().size
	_callout.size = Vector2(vp.x, 60)
	_callout.position = Vector2(0, field.size.y * 0.45 - 30)
	_callout.pivot_offset = _callout.size / 2.0
	_callout_sub.size = Vector2(vp.x, 26)
	_callout_sub.position = Vector2(0, field.size.y * 0.45 + 24)
	_toast.size = Vector2(vp.x, 30)
	_toast.position = Vector2(0, slot.position.y + slot.size.y * 0.45)
	_bigwin.position = Vector2.ZERO
	_bigwin.size = vp
	for sheet in [_bet_sheet, _auto_sheet, _paytable, _rules, _history]:
		_layout_sheet(sheet)


func callout(big: String, small := "", gold := false, hold := 1.2) -> void:
	_callout.text = big
	# 字太長（敵人名字）時縮小，免得超出畫面
	var fs := 38
	while fs > 18 and Art.font().get_string_size(big, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x > _callout.size.x - 36.0:
		fs -= 1
	_callout.label_settings = Art.label_settings(fs, Art.GOLD if gold else Art.CREAM, "num", 10, Art.GOLD_INK if gold else Art.INK, 4)
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
	if auto:
		_stop_auto()
		return
	if busy:
		slot.quick_stop()
		return
	Sfx.play("click")
	_spin()


# AUTO（照 PG Soft）：沒在自動時打開次數選單；自動中再按一次就停
func _on_auto() -> void:
	Sfx.play("click")
	if auto:
		_stop_auto()
		return
	_open_sheet(_auto_sheet)


func _start_auto(count: int) -> void:
	_close_sheet(_auto_sheet)
	auto = true
	auto_left = count
	Sfx.play("click")
	toast("Auto spin × %s" % Art.fmt(count))
	_refresh_controls()
	if not _auto_running:
		_auto_loop()


func _stop_auto() -> void:
	auto = false
	auto_left = 0
	toast("Auto spin off")
	_refresh_controls()


# 同一時間只有一個自動迴圈；正在轉（或 Free Spins）時先等這一轉結束；次數用完或餘額不夠就停
func _auto_loop() -> void:
	_auto_running = true
	while auto and started and auto_left > 0:
		while busy:
			await get_tree().process_frame
		if not auto:
			break
		auto_left -= 1
		_refresh_controls()
		if not await _spin():
			break
		await get_tree().create_timer(0.3).timeout
	auto = false
	auto_left = 0
	_auto_running = false
	_refresh_controls()


func _spin() -> bool:
	if busy:
		return false
	var bet: int = Rules.BET_LEVELS[state.bet]
	var tb := Rules.total_bet(bet)
	if state.coins < tb:
		toast("Not enough coins — tap + on the balance for a free top-up")
		auto = false
		auto_left = 0
		_refresh_controls()
		return false
	busy = true
	_refresh_controls()
	state.coins -= tb
	_coins_to(state.coins)
	# 開場後第一次轉：狼已經站著、身上還存著上次留下來的能量的話，按下去就先打出去
	if not _spun:
		_spun = true
		if state.charge > 0 and enemy_ready and not enemy.is_empty():
			_queue.push_front([0, false, true, 0])
			if not _working:
				_work()
	var res := await _round(bet)
	var total: int = res.total
	if total > 0:
		state.coins += total
		if BigWin.qualifies(total, tb):
			await _big_win(total, tb)
		_coins_to(state.coins)
		Sfx.play("coin")
	if res.triggered:
		await _free_spins(res.scatter, bet)
	_log_spin(tb, total + (fs_total if res.triggered else 0), fs_done if res.triggered else 0)
	while _working:
		await get_tree().process_frame
	_save(true)
	busy = false
	_refresh_controls()
	return true


# 記進 History：[時間（unix 秒）, 總押注, 這一轉的總贏分（含觸發的 Free Spins）, 玩了幾次 Free Spins]，最新的在最前面
func _log_spin(tb: int, won: int, free_spins: int) -> void:
	state.history.push_front([int(Time.get_unix_time_from_system()), tb, won, free_spins])
	if state.history.size() > HISTORY_MAX:
		state.history.resize(HISTORY_MAX)


# 一輪：轉輪停下 → 一段段連鎖（倍率、標記、跳分、打怪、消除）；回傳 Rules 的結果
func _round(bet: int) -> Dictionary:
	slot.clear_marks()
	if not free:
		field.scatter_fire(0)
	_set_win(0, false)
	_fly_id += 1
	_set_total(fs_total if free else 0, false)
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
		_set_win(st.win, true)
		# Total Win 等跳字飛到才更新
		_step_popup(st, won)
		# 第 k + 1 段連擊：小紅帽的招式跟著段數變多，第 2 段起自走區出現連擊計數
		_queue_attack(st.win + (base if k == 0 else 0), st.win >= 5 * tb, k + 1)
		await get_tree().create_timer(0.36 if state.turbo else 0.62).timeout
		await slot.cascade(st, k)
	if res.steps.is_empty():
		_queue_attack(base, false)
	# 這一輪的招式都打完才收起連擊計數（排在佇列最後）
	_queue.append([0, false, false, -1])
	if not _working:
		_work()
	return res




# 3 個以上 SCATTER（金鑰匙）：先給 SCATTER 獎金，再連轉 Free Spins（倍率加倍，可以再觸發）
func _free_spins(cells: Array, bet: int) -> void:
	var tb := Rules.total_bet(bet)
	slot.scatter_glow(cells)
	Sfx.play("bonus")
	Music.mode("free")
	var spins := Rules.free_spins(cells.size())
	var pay := Rules.scatter_pay(cells.size(), bet)
	await callout("EXTRA!", "%d free spins · cascades ×2 ×4 ×6 ×10" % spins, true, 1.4)
	free = true
	_set_extra(true)
	await _enter_treasure()
	field.scatter_fire(3)
	fs_left = spins
	fs_done = 0
	fs_total = pay
	state.coins += pay
	_coins_to(state.coins)
	_set_total(fs_total, true)
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
			_set_total(fs_total, true)
			_refresh_fs()
			await callout("+%d EXTRA SPINS" % more, "", true, 1.1)
		await get_tree().create_timer(0.25 if state.turbo else 0.45).timeout
	await _leave_treasure()
	free = false
	_set_extra(false)
	field.scatter_fire(0)
	_refresh_fs()
	_set_ladder(0)
	if BigWin.qualifies(fs_total, tb):
		await _big_win(fs_total, tb, "base")
	else:
		Music.mode("base")
		Sfx.play("coin")
		await callout("+%s" % Art.money(fs_total), "EXTRA total", true, 1.3)
	_refresh_fs()
	_set_total(fs_total, false)


# 每一段中獎：盤面上跳出「+120」（後面一團金光），停一下後拖著金色火花飛進 Total Win；
# 到了 Total Win 才跳數字、整塊亮一下、噴一圈火花（total 是到這一段為止的總和）。換下一轉時還在飛的就不再更新
func _step_popup(st: Dictionary, total: int) -> void:
	var id := _fly_id
	var sp := 0.6 if state.turbo else 1.0
	var at := Vector2.ZERO
	for i in st.cells:
		at += slot.tile_center(i)
	at = slot.position + at / st.cells.size()
	var l := Art.label("+%s" % Art.money(st.win), Art.label_settings(30, Art.GOLD_LIGHT, "num", 8, Art.GOLD_INK, 3))
	l.size = Vector2(260, 52)
	l.position = at - l.size / 2.0
	l.pivot_offset = l.size / 2.0
	l.scale = Vector2(0.3, 0.3)
	var glow := TextureRect.new()
	glow.texture = _glow_tex()
	glow.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	glow.size = Vector2(200, 96)
	glow.position = (l.size - glow.size) / 2.0
	glow.mouse_filter = Control.MOUSE_FILTER_IGNORE
	glow.show_behind_parent = true
	l.add_child(glow)
	overlay.add_child(l)
	# 拖尾的火花另外放（世界座標），跳字到了就停，火花自己飄完
	var trail := _sparks(40, 0.4, 30.0)
	trail.local_coords = false
	trail.emitting = false
	trail.position = at
	overlay.add_child(trail)
	var start := at
	var end := _total_target(total)
	# 往旁邊彎出去再落進 Total Win
	var ctrl := Vector2(lerpf(start.x, end.x, 0.5) + (90.0 if start.x < end.x + 40.0 else -90.0), start.y - 30.0)
	var tw := create_tween()
	tw.tween_property(l, "scale", Vector2(1.3, 1.3), 0.16 * sp).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_property(l, "scale", Vector2.ONE, 0.1 * sp)
	tw.tween_interval(0.22 * sp)
	tw.tween_callback(func(): trail.emitting = true)
	tw.tween_method(func(t: float):
		var p := start.lerp(ctrl, t).lerp(ctrl.lerp(end, t), t)
		l.position = p - l.size / 2.0
		l.scale = Vector2.ONE * lerpf(1.0, 0.55, t)
		trail.position = p, 0.0, 1.0, 0.42 * sp).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	tw.tween_callback(func():
		l.queue_free()
		trail.emitting = false
		get_tree().create_timer(0.5).timeout.connect(trail.queue_free)
		if id != _fly_id:
			return
		_set_total(total, true)
		_total_flash()
		var burst := _sparks(26, 0.5, 160.0)
		burst.position = end
		burst.one_shot = true
		burst.explosiveness = 1.0
		overlay.add_child(burst)
		burst.emitting = true
		burst.finished.connect(burst.queue_free)
		Sfx.play("coin", 1.3, -6.0))


# 跳字要飛去的位置：Total Win 收到 total 之後金額的中間（overlay 座標）
func _total_target(total: int) -> Vector2:
	var x := _total_slots(total)
	return _total.get_global_transform() * Vector2(x.y + x.z / 2.0, _total.size.y / 2.0) - overlay.global_position


# Total Win 收到金額：整塊亮一下
func _total_flash() -> void:
	var tw := create_tween()
	_total.modulate = Color(1.7, 1.5, 1.1)
	tw.tween_property(_total, "modulate", Color.WHITE, 0.35)


# 金色火花（跳字拖尾、到達時炸開共用）
func _sparks(amount: int, life: float, speed: float) -> CPUParticles2D:
	var p := CPUParticles2D.new()
	p.amount = amount
	p.lifetime = life
	p.spread = 180.0
	p.gravity = Vector2.ZERO
	p.initial_velocity_min = speed * 0.4
	p.initial_velocity_max = speed
	p.scale_amount_min = 2.0
	p.scale_amount_max = 4.5
	var ramp := Gradient.new()
	ramp.offsets = PackedFloat32Array([0.0, 0.5, 1.0])
	ramp.colors = PackedColorArray([Color(1, 0.97, 0.75, 1), Color(1, 0.75, 0.25, 0.9), Color(1, 0.45, 0.1, 0)])
	p.color_ramp = ramp
	return p


# 跳字後面那團金光（放射漸層，做一次就好）
func _glow_tex() -> Texture2D:
	if not _glow:
		var g := Gradient.new()
		g.set_color(0, Color(1, 0.78, 0.3, 0.55))
		g.set_color(1, Color(1, 0.6, 0.1, 0.0))
		_glow = GradientTexture2D.new()
		_glow.gradient = g
		_glow.fill = GradientTexture2D.FILL_RADIAL
		_glow.fill_from = Vector2(0.5, 0.5)
		_glow.fill_to = Vector2(1.0, 0.5)
		_glow.width = 128
		_glow.height = 64
	return _glow


func _coins_to(value: int) -> void:
	_refill.visible = value < Rules.START_COINS
	var tw := create_tween()
	tw.tween_method(func(v: float):
		_shown_coins = v
		_fit(_coins_label, Art.money(v)), _shown_coins, float(value), 0.5)


# BIG WIN 演出期間換成 BIG WIN 曲；after 是演完要回到的音樂（Free Spins 結束時回主遊戲），空字串就回原本那首
func _big_win(total: int, tb: int, after := "") -> void:
	Music.fanfare_start()
	await _bigwin.play(total, tb, state.turbo)
	if after != "":
		Music.mode(after)
	Music.fanfare_end()

# ---------- 自走與打怪 ----------

func _process(delta: float) -> void:
	if not started:
		return
	# 場景編號：關卡變了就換（打倒王時放大彈回）；連擊計數出現在左上角時先淡出讓位
	var st := _stage()
	if st != _ep_stage:
		_set_ep(st, _ep_stage > 0)
	_ep.modulate.a = move_toward(_ep.modulate.a, 0.0 if field.combo_showing() else 1.0, delta * 5.0)
	_ep.queue_redraw()
	# 待機 2：狼站著等玩家轉、超過 IDLE_TWIRL 秒沒轉，小紅帽耍一段劍花，之後每隔約 5 秒再耍一次
	if busy or auto or free or enemy.is_empty() or not enemy_ready or _working:
		_idle = 0.0
	else:
		_idle += delta
		if _idle > IDLE_TWIRL:
			_idle = IDLE_TWIRL - 5.0
			field.twirl()
	if _extra_k > 0.0:
		_extra_t += delta
		_extra_fx.queue_redraw()
		_buy.queue_redraw()
		_ladder.queue_redraw()
	if enemy.is_empty():
		field.walking = true
		if not _defeating and not _swapping:
			walk_left -= delta
			if walk_left <= 0.0:
				_meet()
	else:
		field.walking = not enemy_ready


func _meet() -> void:
	enemy = Rules.spawn_enemy(_kills(), Rules.BET_LEVELS[state.bet])
	if _force_enemy != "":
		enemy = Rules.make_enemy(_force_enemy, Rules.BET_LEVELS[state.bet])
	# EXTRA 模式出場的都是寶箱怪
	if free:
		enemy = Rules.make_enemy("chest", Rules.BET_LEVELS[state.bet])
	enemy_ready = false
	if _hp_tween:
		_hp_tween.kill()
	_hp = 1.0
	_hp_num.text = "%s / %s" % [Art.money(enemy.hp), Art.money(enemy.max_hp)]
	_portrait = field.portrait(Field.BOSS_FIRST.get(enemy.kind, enemy.kind))
	_enemy_box.get_node("Portrait").queue_redraw()
	create_tween().tween_property(_enemy_box, "modulate:a", 1.0, 0.3)
	_hp_bar.queue_redraw()
	_refresh_all()
	# 只有 BOSS 登場時演橫幅，小動物安靜地走進來
	if enemy.boss:
		var lines := {"bear": ["HONEY BEAR!", "He won't share the forest path"], "stag": ["GRUMPY STAG!", "Lord of the flower meadow"],
			"boss": ["KNOCK KNOCK!", "“Grandma, it's me… Little Red Riding Hood!”"]}
		var l: Array = lines.get(enemy.kind, ["%s!" % enemy.name.to_upper(), ""])
		_encounter.play(l[0], l[1], _portrait, true)
	Music.wolf(true, enemy.boss)
	await field.spawn_enemy(enemy.kind, enemy.boss)
	enemy_ready = true
	# 走路時存起來的傷害：狼一站定就先打出去（開場後還沒轉過的話先留著，等第一次轉動）
	if _spun and state.charge > 0 and not enemy.is_empty():
		_queue.push_front([0, false, true, 0])
		if not _working:
			_work()


# combo 是這一輪的第幾段連擊（決定出什麼招）；佇列裡 combo = -1 是「這一輪打完了」
func _queue_attack(damage: int, crit: bool, combo := 1) -> void:
	_queue.append([damage, crit, false, combo])
	if not _working:
		_work()


func _work() -> void:
	_working = true
	while not _queue.is_empty():
		var a: Array = _queue.pop_front()
		if a[3] < 0:
			field.end_combo()
			continue
		await _attack(a[0], a[1], a[2], a[3])
	_working = false


# 打一下。沒有狼可以打（走路中、狼還在走進場、前一刀剛打倒）時傷害不浪費，先存進 state.charge；
# release 是狼站定時把存的傷害一口氣打出去（出 4 段的招）。打倒時多出來的傷害也存起來，大獎可以一路連殺好幾隻；
# combo 是第幾段連擊：段數越多招式越多，打中（或存起來）時更新連擊計數
func _attack(damage: int, crit: bool, release := false, combo := 1) -> void:
	var tb := Rules.total_bet(Rules.BET_LEVELS[state.bet])
	if release:
		if enemy.is_empty() or not enemy_ready or state.charge <= 0:
			return
		damage = state.charge
		crit = damage >= 5 * tb
		state.charge = 0
		field.release_charge()
	elif enemy.is_empty() or not enemy_ready:
		field.combo(combo)
		_store(damage)
		return
	Music.hit(4 if release else combo)
	await field.strike(4 if release else combo, crit)
	if not release:
		field.combo(combo)
	if enemy.is_empty():
		_store(damage)
		return
	var over := maxi(0, damage - int(enemy.hp))
	var killed := Rules.hit(enemy, damage)
	field.impact("-%s" % Art.money(damage), crit)
	_shake(9.0 if crit else 4.0)
	var to: float = float(enemy.hp) / enemy.max_hp
	if _hp_tween:
		_hp_tween.kill()
	_hp_tween = create_tween()
	_hp_tween.tween_method(func(v: float):
		_hp = v
		_hp_bar.queue_redraw(), _hp, to, 0.35)
	_hp_num.text = "%s / %s" % [Art.money(enemy.hp), Art.money(enemy.max_hp)]
	# 第 3 關 BOSS：血剩一半，扮成小紅帽的狼變身成外婆；剩四分之一露餡
	if not killed and enemy.kind == "boss" and enemy.hp * 2 <= enemy.max_hp and field.transform_boss():
		_portrait = field.current_portrait()
		_enemy_box.get_node("Portrait").queue_redraw()
		_encounter.play("GRANDMA?!", "What big eyes you have…", _portrait, true, true)
	elif not killed and enemy.kind == "boss" and enemy.hp * 4 <= enemy.max_hp and field.reveal_boss():
		_portrait = field.current_portrait()
		_enemy_box.get_node("Portrait").queue_redraw()
		_encounter.play("IT'S THE WOLF!", "All the better to eat you with!", _portrait, true, true)
	if killed:
		_store(over)
		await _defeat()
	else:
		await get_tree().create_timer(0.15).timeout


func _store(amount: int) -> void:
	if amount <= 0:
		return
	state.charge += amount
	field.set_charge(state.charge, amount, _charge_power(), _charge_cap())
	Sfx.play("coin", 1.5, -12.0)


# 頭上藍色能量條的上限：總押注 × 100（換押注時跟著變）
func _charge_cap() -> int:
	return 100 * Rules.total_bet(Rules.BET_LEVELS[state.bet])


# 存越多小紅帽身上的金光越亮：存到總押注 3 倍（改版前一隻大野狼的血量）就最亮
func _charge_power() -> float:
	var hp: float = 3.0 * Rules.total_bet(Rules.BET_LEVELS[state.bet])
	return clampf(0.35 + 0.65 * state.charge / hp, 0.35, 1.0)


func _defeat() -> void:
	var e := enemy
	var at: Vector2 = field.enemy_center()
	enemy = {}
	enemy_ready = false
	_defeating = true
	walk_left = rng.randf_range(0.6, 1.0) if e.treasure else rng.randf_range(2.4, 3.8)
	# 寶箱怪不算關卡進度
	if not e.treasure:
		state.kills += 1
	Music.wolf(false)
	field.defeat_enemy()
	create_tween().tween_property(_enemy_box, "modulate:a", 0.0, 0.3)
	await get_tree().create_timer(0.45).timeout
	state.coins += e.reward
	_coins_to(state.coins)
	field.float_text("+%s" % Art.money(e.reward), at + Vector2(0, -40), Art.GOLD, 30, Art.GOLD_INK)
	Sfx.play("coin")
	var ups := Rules.gain_xp(state, e.xp)
	_refresh_all()
	_save()
	if e.boss:
		field.set_stage(_stage())
		await callout(Rules.stage_name(_stage()).to_upper(), "Stage %d begins · reward +%s" % [_stage(), Art.money(e.reward)], true, 1.5)
	elif ups > 0:
		Sfx.play("level")
		field.hero.cheer()
		await callout("LEVEL UP!", "Lv. %d" % state.level, true, 1.1)
	_defeating = false


# 進 EXTRA 模式：等前一轉的招式打完、正在走進來的敵人站定，把它收起來（關卡進度不動），接著出場的都是寶箱怪
func _enter_treasure() -> void:
	_swapping = true
	while _working or _defeating or (not enemy.is_empty() and not enemy_ready):
		await get_tree().process_frame
	# EXTRA 期間的能量只在 EXTRA 裡用：原本存的能量先收起來，能量條從 0 開始
	_charge_kept = state.charge
	state.charge = 0
	field.set_charge(0, 0, _charge_power(), _charge_cap())
	_stashed = enemy
	if not enemy.is_empty():
		field.stash_enemy()
		enemy = {}
		enemy_ready = false
		Music.wolf(false)
		create_tween().tween_property(_enemy_box, "modulate:a", 0.0, 0.25)
	walk_left = 0.4
	_swapping = false


# 出 EXTRA 模式：還沒打完的寶箱照打掉的血量分賞金、打開淡掉，再把原本的敵人放回來（血量、變身到哪都跟進 EXTRA 前一樣）；
# EXTRA 期間存著還沒打出去的能量不帶出 EXTRA：照寶箱怪的賞金比例一起換成賞金（回收率不變），能量條換回進 EXTRA 前存的
func _leave_treasure() -> void:
	_swapping = true
	while _working or _defeating or (not enemy.is_empty() and not enemy_ready):
		await get_tree().process_frame
	var chest := Rules.make_enemy("chest", Rules.BET_LEVELS[state.bet])
	var pay := roundi(float(chest.reward) * state.charge / chest.max_hp)
	state.charge = _charge_kept
	_charge_kept = 0
	field.set_charge(state.charge, 0, _charge_power(), _charge_cap())
	var at: Vector2 = field.enemy_center()
	var opened: bool = not enemy.is_empty() and enemy.treasure
	if opened:
		pay += roundi(float(enemy.reward) * (enemy.max_hp - enemy.hp) / enemy.max_hp)
		field.defeat_enemy()
		enemy = {}
		enemy_ready = false
		Music.wolf(false)
		create_tween().tween_property(_enemy_box, "modulate:a", 0.0, 0.3)
	if pay > 0:
		await get_tree().create_timer(0.45).timeout
		state.coins += pay
		_coins_to(state.coins)
		field.float_text("+%s" % Art.money(pay), at + Vector2(0, -40), Art.GOLD, 30, Art.GOLD_INK)
		Sfx.play("coin")
	if opened or pay > 0:
		await get_tree().create_timer(0.5).timeout
	enemy = _stashed
	_stashed = {}
	if not enemy.is_empty() and field.unstash_enemy():
		_portrait = field.current_portrait()
		_enemy_box.get_node("Portrait").queue_redraw()
		_hp = float(enemy.hp) / enemy.max_hp
		_hp_num.text = "%s / %s" % [Art.money(enemy.hp), Art.money(enemy.max_hp)]
		_hp_bar.queue_redraw()
		create_tween().tween_property(_enemy_box, "modulate:a", 1.0, 0.3)
		Music.wolf(true, enemy.boss)
		enemy_ready = true
		# 進 EXTRA 前存著的能量：放回來的敵人一站好就打出去，跟新的敵人站定時一樣
		if _spun and state.charge > 0:
			_queue.push_front([0, false, true, 0])
			if not _working:
				_work()
	else:
		enemy = {}
		walk_left = rng.randf_range(1.2, 2.0)
	_swapping = false


func _stage() -> int:
	return _kills() / Rules.BOSS_EVERY + 1


# 關卡用的打倒數（預覽 ?stage= 時加上位移）
func _kills() -> int:
	return maxi(0, state.kills + _kill_off)


# ---------- 補幣、存檔、更新畫面 ----------

func _on_refill() -> void:
	if state.coins >= Rules.START_COINS:
		toast("Top-ups are for balances under %s" % Art.money(Rules.START_COINS))
		return
	state.coins += Rules.REFILL
	_coins_to(state.coins)
	Sfx.play("coin")
	toast("+%s (demo)" % Art.money(Rules.REFILL))
	_save()


# 舊版存檔（金額單位、押注級距不同）只保留等級與關卡，金幣與押注重新發
func _load() -> void:
	var cf := ConfigFile.new()
	var migrated := false
	if cf.load(SAVE_PATH) != OK:
		var legacy := OS.get_user_data_dir().get_base_dir().path_join(LEGACY_USER_DIR).path_join("save.cfg")
		if cf.load(legacy) != OK:
			return
		migrated = true
	for k in state:
		var v = cf.get_value("game", k, state[k])
		if typeof(v) == typeof(state[k]):
			state[k] = v
	if cf.get_value("game", "version", 1) < SAVE_VERSION:
		state.coins = Rules.START_COINS
		state.bet = Rules.DEFAULT_BET
		state.charge = 0
	state.bet = clampi(state.bet, 0, Rules.BET_LEVELS.size() - 1)
	# 從舊資料夾讀到的，馬上存一份到新位置
	if migrated:
		_save(true)


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
	_fit(_coins_label, Art.money(state.coins))
	_refill.visible = state.coins < Rules.START_COINS
	_refresh_controls()


func _refresh_controls() -> void:
	var bet: int = Rules.BET_LEVELS[state.bet]
	_fit(_bet_label, Art.money(Rules.total_bet(bet)))
	_minus_btn.disabled = busy or state.bet == 0
	_plus_btn.disabled = busy or state.bet == Rules.BET_LEVELS.size() - 1
	_minus_btn.modulate.a = 0.35 if _minus_btn.disabled else 1.0
	_plus_btn.modulate.a = 0.35 if _plus_btn.disabled else 1.0
	_spin_btn.busy = busy
	_spin_btn.count = auto_left if auto else 0
	_auto_btn.lit = auto


# ---------- 從下面滑上來的面板：押注選項、自動旋轉、選單（賠率表與設定） ----------

# 半透明遮罩＋底部面板（標題、關閉鈕、內容）；scroll 的內容可以捲（選單）。點遮罩或 X 關閉
func _make_sheet(title: String, scroll := false) -> Control:
	var sheet := Control.new()
	sheet.visible = false
	sheet.mouse_filter = Control.MOUSE_FILTER_STOP
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.65)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	dim.gui_input.connect(func(e: InputEvent):
		if e is InputEventMouseButton and e.pressed:
			_close_sheet(sheet))
	sheet.add_child(dim)
	var panel := PanelContainer.new()
	panel.name = "Panel"
	var sb := Art.box(Color("24150b"), 16, 1, Art.PANEL_EDGE)
	sb.corner_radius_bottom_left = 0
	sb.corner_radius_bottom_right = 0
	sb.border_width_top = 2
	sb.border_color = Art.GOLD_DEEP
	sb.content_margin_left = 14
	sb.content_margin_right = 14
	sb.content_margin_top = 10
	sb.content_margin_bottom = 18
	panel.add_theme_stylebox_override("panel", sb)
	sheet.add_child(panel)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 8)
	panel.add_child(col)
	var head := HBoxContainer.new()
	col.add_child(head)
	var t := Art.label(title, Art.label_settings(19, Art.GOLD, "num", 4, Art.GOLD_INK), HORIZONTAL_ALIGNMENT_LEFT)
	t.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(t)
	var close := Button.new()
	close.text = "X"
	close.flat = true
	close.focus_mode = Control.FOCUS_NONE
	close.add_theme_font_override("font", Art.font())
	close.add_theme_font_size_override("font_size", 22)
	close.add_theme_color_override("font_color", Art.CREAM)
	close.pressed.connect(func(): _close_sheet(sheet))
	head.add_child(close)
	var body := VBoxContainer.new()
	body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	body.add_theme_constant_override("separation", 10)
	if scroll:
		var sc := ScrollContainer.new()
		sc.size_flags_vertical = Control.SIZE_EXPAND_FILL
		sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
		col.add_child(sc)
		sc.add_child(body)
	else:
		col.add_child(body)
	sheet.set_meta("body", body)
	sheet.set_meta("scroll", scroll)
	return sheet


# 選單佔大半個畫面；押注、自動旋轉的面板只要內容那麼高
func _layout_sheet(sheet: Control) -> void:
	var vp := get_viewport_rect().size
	sheet.size = vp
	var panel: Control = sheet.get_node("Panel")
	var w := minf(vp.x, 480.0)
	var h: float = vp.y * 0.88 if sheet.get_meta("scroll") else panel.get_combined_minimum_size().y
	panel.size = Vector2(w, h)
	panel.position = Vector2((vp.x - w) / 2.0, vp.y - h)


func _open_sheet(sheet: Control) -> void:
	if sheet == _bet_sheet:
		_fill_bet()
	elif sheet == _auto_sheet:
		_fill_auto()
	elif sheet == _paytable:
		_fill_paytable()
	elif sheet == _rules:
		_fill_rules()
	else:
		_fill_history()
	sheet.visible = true
	# 內容剛換過，等一格讓容器算出高度再排
	await get_tree().process_frame
	_layout_sheet(sheet)
	var panel: Control = sheet.get_node("Panel")
	var y := panel.position.y
	panel.position.y = get_viewport_rect().size.y
	create_tween().tween_property(panel, "position:y", y, 0.26).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)


func _close_sheet(sheet: Control) -> void:
	sheet.visible = false


func _open_bet() -> void:
	if busy or auto:
		toast("Wait for the spin to finish")
		return
	Sfx.play("click")
	_open_sheet(_bet_sheet)


func _clear(box: Control) -> void:
	for c in box.get_children():
		box.remove_child(c)
		c.queue_free()


# 面板裡的選項按鈕：深藍底古金邊，選中的是紅底亮金邊；第二行小字
func _choice(big: String, small: String, selected: bool, on_press: Callable) -> Button:
	var b := Button.new()
	b.text = big + ("\n" + small if small != "" else "")
	b.focus_mode = Control.FOCUS_NONE
	b.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	b.custom_minimum_size = Vector2(0, 56 if small != "" else 46)
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	b.add_theme_font_override("font", Art.font())
	b.add_theme_font_size_override("font_size", 17)
	var normal := Art.box(Color("33200f"), 10, 1, Art.PANEL_EDGE)
	var on := Art.box(Color("7a0c12"), 10, 2, Art.GOLD)
	var hover := Art.box(Color("452c16"), 10, 1, Art.GOLD)
	var base := on if selected else normal
	for st in ["normal", "focus"]:
		b.add_theme_stylebox_override(st, base)
	b.add_theme_stylebox_override("hover", on if selected else hover)
	b.add_theme_stylebox_override("pressed", on)
	for c in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
		b.add_theme_color_override(c, Art.GOLD_LIGHT if selected else Art.CREAM)
	b.pressed.connect(on_press)
	return b


# 押注選項（照 PG Soft 的「投注選項」）：總押注 = 押注 × 20，挑一格就換好關掉
func _fill_bet() -> void:
	var body: VBoxContainer = _bet_sheet.get_meta("body")
	_clear(body)
	body.add_child(_body("Total bet = bet per line × %d lines. Wins, wolf HP and bounties all scale with it." % Rules.BASE_BET, 12))
	var grid := GridContainer.new()
	grid.columns = 3
	grid.add_theme_constant_override("h_separation", 8)
	grid.add_theme_constant_override("v_separation", 8)
	for i in Rules.BET_LEVELS.size():
		var bet: int = Rules.BET_LEVELS[i]
		var k := i
		grid.add_child(_choice(Art.money(Rules.total_bet(bet)), "%s × %d" % [Art.money(bet), Rules.BASE_BET], i == state.bet, func():
			_close_sheet(_bet_sheet)
			_set_bet(k)))
	body.add_child(grid)


# 自動旋轉（照 PG Soft）：挑次數就開始；轉動鍵中間顯示剩幾轉，按轉動鍵或 AUTO 停
func _fill_auto() -> void:
	var body: VBoxContainer = _auto_sheet.get_meta("body")
	_clear(body)
	body.add_child(_body("Pick how many spins. Tap SPIN or AUTO to stop; auto spin also stops when your balance runs low.", 12))
	var grid := GridContainer.new()
	grid.columns = AUTO_COUNTS.size()
	grid.add_theme_constant_override("h_separation", 6)
	for n in AUTO_COUNTS:
		var count: int = n
		grid.add_child(_choice(Art.fmt(count), "", false, func(): _start_auto(count)))
	body.add_child(grid)


# ---------- 選單裡的面板：賠率表（照美術給的 paytable 排）、規則、轉動紀錄 ----------

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
		var v := Art.label(Art.money(Rules.pay(id, n, bet)), Art.label_settings(12, Art.CREAM, "light"), HORIZONTAL_ALIGNMENT_LEFT)
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


# 賠率表：一般符號（目前押注下 5／4／3 連的贏分）、WILD、SCATTER
func _fill_paytable() -> void:
	var body: VBoxContainer = _paytable.get_meta("body")
	_clear(body)
	var bet: int = Rules.BET_LEVELS[state.bet]
	body.add_child(_body("Wins per way at your current bet (%s per line, TOTAL BET %s)." % [Art.money(bet), Art.money(Rules.total_bet(bet))], 12))
	for ids in [["wolf", "raven", "lantern", "basket", "potion"], ["ace", "king", "queen", "jack", "ten"]]:
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 4)
		for id in ids:
			row.add_child(_pay_cell(id, bet))
		body.add_child(row)
	body.add_child(_divider("SPECIAL SYMBOLS"))
	body.add_child(_special("hood", "WILD", ["Substitutes for all symbols except SCATTER.", "Appears on reels 2, 3 and 4 only.", "Gold-framed symbols (reels 2–4) don't burst when they win: they flip into WILD and stay for the next cascade."]))
	var sc := []
	for n in [5, 4, 3]:
		sc.append("%d  ×  %s" % [n, Art.money(Rules.scatter_pay(n, bet))])
	body.add_child(_special("key", "SCATTER", ["3 or more SCATTER anywhere trigger Free Spins: 3 = 8, 4 = 10, 5 = 12 spins."] + sc))


# 規則：Free Spins、1024 路與連鎖、BIG WIN、自走打怪與目前進度；最下面是重設進度
func _fill_rules() -> void:
	var body: VBoxContainer = _rules.get_meta("body")
	_clear(body)
	body.add_child(_divider("FREE SPINS"))
	body.add_child(_body("Free spins cost nothing. Cascade multipliers are doubled: ×2, ×4, ×6, then ×10. 3 or more SCATTER during free spins add more spins."))
	body.add_child(_divider("1024 WAYS & CASCADES"))
	var ways := HBoxContainer.new()
	ways.add_theme_constant_override("separation", 12)
	ways.add_child(_ways_diagram())
	var wtxt := _body("Match a symbol on adjacent reels from the leftmost reel. Every matching cell on a reel multiplies the ways. Winning symbols burst, new ones fall in, and each cascade raises the multiplier: ×1, ×2, ×3, ×5.")
	wtxt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	ways.add_child(wtxt)
	body.add_child(ways)
	body.add_child(_divider("BIG WIN"))
	var tiers := []
	for t in BigWin.TIERS:
		tiers.append("%s from %d× total bet" % [t[2], t[0]])
	body.add_child(_body(", ".join(tiers) + "."))
	body.add_child(_divider("AUTO-RUN"))
	body.add_child(_body("Red Hood walks to Grandma's house on her own: the forest path, the flower meadow, then Grandma's front door. When one of the Big Bad Wolf's forest friends blocks the path, every coin you win is thrown at it as damage, plus a small hit each spin. No hit is wasted: damage dealt while nobody is around, and any overkill, is stored and unleashed on the next one. Defeat them for coins and XP; every 7th is the stage boss: the Honey Bear, the Grumpy Stag, then the wolf knocking at Grandma's door. During EXTRA, treasure chests pop up instead; when EXTRA ends you're back where you left off."))
	var n: int = state.kills % Rules.BOSS_EVERY + 1
	body.add_child(_body("Your progress: Lv. %d (XP %d / %d) · Stage %d-%d" % [state.level, state.xp, Rules.xp_to_next(state.level), state.kills / Rules.BOSS_EVERY + 1, n], 12))
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
			reset.text = "Tap again to reset coins, level, stage and history"
			return
		for k in ["coins", "bet", "level", "xp", "kills", "charge"]:
			state[k] = {"coins": Rules.START_COINS, "bet": Rules.DEFAULT_BET, "level": 1, "xp": 0, "kills": 0, "charge": 0}[k]
		state.history = []
		_shown_coins = state.coins
		field.set_stage(1)
		field.set_charge(0, 0, 0.0, _charge_cap())
		_refresh_all()
		_save()
		_close_sheet(_rules)
		toast("Progress reset"))
	body.add_child(reset)
	body.add_child(_body("Coins are for demo play only.", 11))


# 轉動紀錄（照 PG Soft 的 History）：最近 HISTORY_MAX 轉，一轉一行（觸發的 Free Spins 算在同一轉），最新的在最上面
func _fill_history() -> void:
	var body: VBoxContainer = _history.get_meta("body")
	_clear(body)
	var list: Array = state.history
	if list.is_empty():
		body.add_child(_body("No spins yet. Your last %d spins will show up here." % HISTORY_MAX))
		return
	var bet_sum := 0
	var win_sum := 0
	for h in list:
		bet_sum += int(h[1])
		win_sum += int(h[2])
	var count := "Last spin" if list.size() == 1 else "Last %d spins" % list.size()
	body.add_child(_body("%s · Bet %s · Win %s · Profit %s" % [count, Art.money(bet_sum), Art.money(win_sum), _signed(win_sum - bet_sum)], 12))
	body.add_child(_hist_row(["TIME", "BET", "WIN", "PROFIT"], [Art.GOLD, Art.GOLD, Art.GOLD, Art.GOLD], "", true))
	var bias: int = Time.get_time_zone_from_system().get("bias", 0)
	for h in list:
		var tb := int(h[1])
		var won := int(h[2])
		var d := Time.get_datetime_dict_from_unix_time(int(h[0]) + bias * 60)
		var when := "%02d/%02d %02d:%02d" % [d.month, d.day, d.hour, d.minute]
		var tags := []
		if BigWin.qualifies(won, tb):
			tags.append("BIG WIN")
		if int(h[3]) > 0:
			tags.append("FREE SPINS ×%d" % int(h[3]))
		var profit := won - tb
		var pc := Color("7fd36b") if profit > 0 else (Color("ff8a70") if profit < 0 else Art.MUTED)
		body.add_child(_hist_row([when, Art.money(tb), Art.money(won), _signed(profit)], [Art.CREAM, Art.CREAM, Art.GOLD_LIGHT if won > 0 else Art.MUTED, pc], " · ".join(tags)))


func _signed(v: int) -> String:
	return "+" + Art.money(v) if v > 0 else Art.money(v)


# History 的一行：時間靠左、金額靠右，有 Free Spins／BIG WIN 的在底下加一行金色小字，最下面一條細線
func _hist_row(cells: Array, colors: Array, tag := "", header := false) -> Control:
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 2)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 6)
	for i in cells.size():
		var l := Label.new()
		l.text = cells[i]
		l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		l.size_flags_stretch_ratio = 1.35 if i == 0 else 1.0
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT if i == 0 else HORIZONTAL_ALIGNMENT_RIGHT
		l.add_theme_font_override("font", Art.font("num" if header else "light"))
		l.add_theme_font_size_override("font_size", 12 if header else 14)
		l.add_theme_color_override("font_color", colors[i])
		row.add_child(l)
	col.add_child(row)
	if tag != "":
		var t := Label.new()
		t.text = tag
		t.add_theme_font_override("font", Art.font("num"))
		t.add_theme_font_size_override("font_size", 10)
		t.add_theme_color_override("font_color", Art.GOLD)
		col.add_child(t)
	var line := ColorRect.new()
	line.color = Color(Art.GOLD_DEEP, 0.35)
	line.custom_minimum_size = Vector2(0, 1)
	col.add_child(line)
	return col


# ---------- 開場：網頁的 loading 畫面一路蓋著，音效合成完直接進遊戲（不用點一下）----------

# 聲音要等玩家第一次點擊才會出來（瀏覽器規定），Godot 收到第一個輸入時會自動恢復音訊
func _boot() -> void:
	await get_tree().process_frame
	await Sfx.build_all(func(p: float): _web("asProgress", p))
	started = true
	Music.mode("base")
	_web("asReady", 1.0)
	# 預覽演出（只是畫面，不扣押注也不派獎）：網址帶 ?bigwin 演一次總押注 60 倍的 BIG WIN（網頁版等第一次點擊、有聲音了才演）；
	# ?tease 轉一次第 1、2、4 軸各有一把金鑰匙的盤面，看 SCATTER 差一個時的吊胃口；
	# ?gold 轉一次第 2～4 軸有幾格金框的盤面；
	# ?combo 等狼站定後連出第 1～6 段連擊的招式、跑一次連擊計數（每招只扣狼 0.01；?combo=5 從第 5 段開始）；
	# ?slow=0.25 整個遊戲用四分之一速度跑（檢查動作用，可以跟上面幾個一起帶）；
	# ?enemy=fox 之後出來的敵人都換成這一種（寶箱怪只在 EXTRA 出現，不能指定，看寶箱怪用 ?extra）、?stage=2 從第 2 關第 1 隻開始（背景、EP、關卡進度、出的怪都跟著，存檔的打倒數照常加）；?extra 看 EXTRA 模式的畫面；?reveal 看第 3 關 BOSS 變身、露餡
	var search := str(JavaScriptBridge.eval("location.search")) if OS.has_feature("web") else ""
	if search.contains("enemy="):
		var k := search.get_slice("enemy=", 1).get_slice("&", 0)
		if Rules.ENEMIES.has(k) and not Rules.ENEMIES[k].get("treasure", false):
			_force_enemy = k
	if search.contains("stage="):
		var st := maxi(1, search.get_slice("stage=", 1).get_slice("&", 0).to_int())
		_kill_off = (st - 1) * Rules.BOSS_EVERY - state.kills
		field.set_backdrop(st)
	if search.contains("slow="):
		Engine.time_scale = clampf(search.get_slice("slow=", 1).get_slice("&", 0).to_float(), 0.05, 1.0)
	if search.contains("bigwin"):
		while OS.has_feature("web") and not _touched:
			await get_tree().process_frame
		var tb := Rules.total_bet(Rules.BET_LEVELS[state.bet])
		busy = true
		await _big_win(60 * tb, tb)
		busy = false
	if search.contains("tease"):
		var board := Rules.spin_board(rng)
		for c in Rules.COLS:
			for r in Rules.ROWS:
				if Rules.is_scatter(board[r * Rules.COLS + c].id):
					board[r * Rules.COLS + c] = {"id": "ten", "gold": false}
		for at in [[1, 0], [2, 1], [0, 3]]:
			board[at[0] * Rules.COLS + at[1]] = {"id": "key", "gold": false}
		busy = true
		Sfx.play("spin")
		await slot.spin(board)
		busy = false
	if search.contains("gold"):
		var board := Rules.spin_board(rng)
		for at in [[0, 1], [1, 2], [2, 3], [1, 1]]:
			var cell: Dictionary = board[at[0] * Rules.COLS + at[1]]
			if not Rules.is_wild(cell.id) and not Rules.is_scatter(cell.id):
				cell.gold = true
		busy = true
		Sfx.play("spin")
		await slot.spin(board)
		busy = false
	# ?reveal：等第 3 關 BOSS 站定，先打掉一半多一點的血看變身，再打到剩四分之一看露餡（只動這隻 BOSS 的血量，不給錢、不存檔；搭配 ?enemy=boss）
	if search.contains("reveal"):
		while enemy.is_empty() or not enemy_ready:
			await get_tree().process_frame
		var mx: int = enemy.max_hp
		_queue_attack(mx / 2 + 1, true, 4)
		_queue_attack(mx / 4 + 1, true, 4)
	# ?extra：只看 EXTRA 模式的畫面 8 秒（不能轉、不動餘額）
	if search.contains("extra"):
		busy = true
		free = true
		fs_done = 3
		fs_left = 5
		_set_extra(true)
		await _enter_treasure()
		# 演一下 EXTRA 的紫色能量條（只動畫面，不動 state.charge）
		await get_tree().create_timer(1.5).timeout
		field.set_charge(_charge_cap() * 2 / 5, _charge_cap() * 2 / 5, 0.6, _charge_cap())
		await get_tree().create_timer(6.5).timeout
		await _leave_treasure()
		free = false
		_set_extra(false)
		busy = false
		_refresh_fs()
	if search.contains("combo"):
		while enemy.is_empty() or not enemy_ready:
			await get_tree().process_frame
		var from := maxi(1, search.get_slice("combo=", 1).get_slice("&", 0).to_int()) if search.contains("combo=") else 1
		for n in range(from, 7):
			_queue_attack(1, n >= 5, n)
		_queue.append([0, false, false, -1])
		if not _working:
			_work()


# 通知網頁外殼（web/shell.html）的 loading 畫面：進度、可以收起來了
func _web(fn: String, value: float) -> void:
	if OS.has_feature("web"):
		JavaScriptBridge.eval("window.%s && window.%s(%f)" % [fn, fn, value])


# 第一次點擊（瀏覽器這時才讓網頁出聲）
func _input(e: InputEvent) -> void:
	if not _touched and (e is InputEventMouseButton or e is InputEventScreenTouch or e is InputEventKey) and e.is_pressed():
		_touched = true


func _unhandled_input(e: InputEvent) -> void:
	if started and e.is_action_pressed("ui_accept"):
		_on_spin()
