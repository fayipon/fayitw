# 圖片與字型的集中載入（第一次用到才載，之後從快取拿）與共用色票
extends RefCounted

# 色票（照繪本奇幻版設計稿 s-ref-a）：亮金、羊皮紙白、紅寶石、深胡桃木
const GOLD := Color("f2c96b")
const GOLD_LIGHT := Color("ffe9a8")
const GOLD_DEEP := Color("a8761f")
const GOLD_INK := Color("2a1806")
const CREAM := Color("f1e4c6")
const MUTED := Color("c2ae8e")
const PANEL := Color(0.17, 0.1, 0.05, 0.94)
const PANEL_EDGE := Color("b8862f")
const RED := Color("c4161c")
const BLOOD := Color("6e0c10")
const GREEN := Color("3f9a2f")
const INK := Color("1e1009")
# EXTRA 模式（Free Spins）的魔法紫：外框光、倍率條、Feature Buy 的外光
const EXTRA := Color("b35cff")
const EXTRA_DEEP := Color("2c0f4a")

# 連鎖爆開的碎片顏色：跟著符號
const SYMBOL_COLORS := {
	"ten": Color("3d7bff"), "jack": Color("3fbf4a"), "queen": Color("a24cff"), "king": Color("e0a650"), "ace": Color("ff3b3b"),
	"potion": Color("ff2050"), "basket": Color("c8323a"), "lantern": Color("ffb040"), "raven": Color("7fa0d8"), "wolf": Color("ff3030"),
	"key": Color("ffd25a"), "hood": Color("e8364f"),
}

static var _cache := {}


static func tex(path: String) -> Texture2D:
	if not _cache.has(path):
		_cache[path] = load(path)
	return _cache[path]


# 轉輪上的符號磚（滿版方形圖）
static func symbol(id: String) -> Texture2D:
	return tex("res://art/tiles/%s.webp" % id)


# 介面零件：spin、ring、buy、panel、wallet、coins、win、coin、logo、frame、floor
static func ui(name: String) -> Texture2D:
	return tex("res://art/ui/%s.webp" % name)


# 零件的尺寸與量測值（轉輪外框的開口與木框厚度）
static func ui_meta() -> Dictionary:
	if not _cache.has("ui.json"):
		_cache["ui.json"] = JSON.parse_string(FileAccess.get_file_as_string("res://art/ui/ui.json"))
	return _cache["ui.json"]


# 遊戲裡的字都是英文：標題、數字、按鈕用 Cinzel（古典羅馬碑文字體，粗細可調），說明文字用 Godot 內建字型
static func font(kind := "num") -> Font:
	if kind == "body":
		return ThemeDB.fallback_font
	var key := "font:" + kind
	if not _cache.has(key):
		var fv := FontVariation.new()
		fv.base_font = load("res://fonts/cinzel.ttf")
		var wght := TextServerManager.get_primary_interface().name_to_tag("wght")
		fv.variation_opentype = {wght: 600 if kind == "light" else 900}
		_cache[key] = fv
	return _cache[key]


# 纏藤蔓的蜂蜜色木框（SLOT 外框、Feature Buy 購買框共用）：o 是外框外緣、s 是原圖（art/ui/frame.webp）的縮放。
# 四邊用無縫木板長條 frame-edge.webp 轉向貼滿（外緣朝外），四角的雕花角塊（葉子、小花、紅莓）從外框圖切下來放大 FRAME_CORNER_SCALE 倍，
# 最後畫、蓋住木板的頭尾。FRAME_CORNER 是四角從開口的角再往邊上多留的原圖像素；FRAME_EDGE_STRETCH 是木板沿木紋拉長幾倍（重複的藤蔓才不會太密）
const FRAME_CORNER := 90.0
const FRAME_CORNER_SCALE := 1.2
const FRAME_EDGE_STRETCH := 1.6

static func draw_vine_frame(ci: CanvasItem, o: Rect2, s: float) -> void:
	var tex := ui("frame")
	var meta: Dictionary = ui_meta().frame
	var w: float = meta.size[0]
	var h: float = meta.size[1]
	var us := [0.0, meta.inner[0] + FRAME_CORNER, meta.inner[2] - FRAME_CORNER, w]
	var vs := [0.0, meta.inner[1] + FRAME_CORNER, meta.inner[3] - FRAME_CORNER, h]
	var xs := [o.position.x, o.position.x + us[1] * s, o.end.x - (w - us[2]) * s, o.end.x]
	var ys := [o.position.y, o.position.y + vs[1] * s, o.end.y - (h - vs[2]) * s, o.end.y]
	# 上（外緣朝上）、下（轉 180 度）、左（轉 -90 度，外緣朝左）、右（轉 90 度）
	_vine_edge(ci, Vector2(xs[1], ys[0]), xs[2] - xs[1], 0.0, s)
	_vine_edge(ci, Vector2(xs[2], ys[3]), xs[2] - xs[1], PI, s)
	_vine_edge(ci, Vector2(xs[0], ys[2]), ys[2] - ys[1], -PI / 2.0, s)
	_vine_edge(ci, Vector2(xs[3], ys[1]), ys[2] - ys[1], PI / 2.0, s)
	var cs := s * FRAME_CORNER_SCALE
	for i in [0, 2]:
		for j in [0, 2]:
			var src := Rect2(us[i], vs[j], us[i + 1] - us[i], vs[j + 1] - vs[j])
			var sz := src.size * cs
			var at := Vector2(o.position.x if i == 0 else o.end.x - sz.x, o.position.y if j == 0 else o.end.y - sz.y)
			ci.draw_texture_rect_region(tex, Rect2(at, sz), src)


# 一邊的木板：從 origin 沿著轉 rot 之後的 x 方向貼 length 長；段數取整數、每段平均分（接縫剛好落在長條的頭尾，看不出來）
static func _vine_edge(ci: CanvasItem, origin: Vector2, length: float, rot: float, s: float) -> void:
	var edge := ui("frame-edge")
	var thick := edge.get_height() * s
	var n := maxi(1, roundi(length / (edge.get_width() * s * FRAME_EDGE_STRETCH)))
	var seg := length / n
	ci.draw_set_transform(origin, rot, Vector2.ONE)
	for k in n:
		ci.draw_texture_rect(edge, Rect2(k * seg, 0, seg, thick), false)
	ci.draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)


static func box(bg: Color, radius := 12, border := 0, border_color := Color.TRANSPARENT) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.set_corner_radius_all(radius)
	sb.set_border_width_all(border)
	sb.border_color = border_color
	sb.anti_aliasing = true
	return sb


static func label_settings(size: int, color := CREAM, kind := "num", outline := 0, outline_color := INK, shadow := 0) -> LabelSettings:
	var ls := LabelSettings.new()
	ls.font = font(kind)
	ls.font_size = size
	ls.font_color = color
	ls.outline_size = outline
	ls.outline_color = outline_color
	if shadow > 0:
		ls.shadow_size = 0
		ls.shadow_color = Color(0, 0, 0, 0.55)
		ls.shadow_offset = Vector2(0, shadow)
	return ls


static func label(text: String, settings: LabelSettings, align := HORIZONTAL_ALIGNMENT_CENTER) -> Label:
	var l := Label.new()
	l.text = text
	l.label_settings = settings
	l.horizontal_alignment = align
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l


# 金額（分）→「1,234.56」；小數點後多餘的 0 不寫（0.2、1、1.5）
static func money(cents: float) -> String:
	var c := roundi(cents)
	var sign := "-" if c < 0 else ""
	c = absi(c)
	var out := sign + fmt(c / 100)
	var frac := c % 100
	if frac == 0:
		return out
	if frac % 10 == 0:
		return out + ".%d" % (frac / 10)
	return out + ".%02d" % frac


static func fmt(n: float) -> String:
	var s := str(roundi(n))
	var neg := s.begins_with("-")
	if neg:
		s = s.substr(1)
	var out := ""
	while s.length() > 3:
		out = "," + s.substr(s.length() - 3) + out
		s = s.substr(0, s.length() - 3)
	return ("-" if neg else "") + s + out
