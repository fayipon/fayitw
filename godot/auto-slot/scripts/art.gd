# 圖片與字型的集中載入（第一次用到才載，之後從快取拿）與共用色票
extends RefCounted

const GOLD := Color("ffd25a")
const GOLD_DEEP := Color("e8a020")
const GOLD_INK := Color("3a1d00")
const CREAM := Color("fff4dc")
const MUTED := Color("c9b28a")
const PANEL := Color(0.07, 0.043, 0.027, 0.8)
const WOOD := Color("6b4120")
const WOOD_LIGHT := Color("9a6834")
const WOOD_DARK := Color("3b220f")
const RED := Color("e2301e")
const GREEN := Color("3fae2f")
const INK := Color("140d09")

# 碎紙片的顏色：跟著符號
const SYMBOL_COLORS := {
	"ten": Color("3d7bff"), "jack": Color("3fbf4a"), "queen": Color("a24cff"), "king": Color("ff3b3b"), "ace": Color("ffc83d"),
	"rabbit": Color("f3efe8"), "pie": Color("ff6a3d"), "basket": Color("d29a52"), "wolf": Color("8a8f9a"), "hood": Color("e8364f"),
	"cottage": Color("ff9a5a"), "crown": Color("ffd25a"),
}

static var _cache := {}


static func tex(path: String) -> Texture2D:
	if not _cache.has(path):
		_cache[path] = load(path)
	return _cache[path]


static func symbol(id: String) -> Texture2D:
	return tex("res://art/symbols/%s.webp" % id)


# 遊戲裡的字都是英文：標題、數字、按鈕用 Lilita One，說明文字用 Godot 內建字型
static func font(kind := "num") -> Font:
	if kind == "body":
		return ThemeDB.fallback_font
	var path := "res://fonts/lilita_one.ttf"
	if not _cache.has(path):
		_cache[path] = load(path)
	return _cache[path]


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
