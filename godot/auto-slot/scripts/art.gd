# 圖片與字型的集中載入（第一次用到才載，之後從快取拿）與共用色票
extends RefCounted

# 暗黑哥德版色票：古金、骨白、深紅、夜黑
const GOLD := Color("f2c96b")
const GOLD_LIGHT := Color("ffe9a8")
const GOLD_DEEP := Color("a8761f")
const GOLD_INK := Color("2a1806")
const CREAM := Color("f1e4c6")
const MUTED := Color("a8967a")
const PANEL := Color(0.055, 0.045, 0.05, 0.9)
const PANEL_EDGE := Color("6e5428")
const RED := Color("c4161c")
const BLOOD := Color("6e0c10")
const GREEN := Color("3f9a2f")
const INK := Color("0b0809")

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


# 介面零件：spin-ring、ring、crest、coin、plate、frame、floor
static func ui(name: String) -> Texture2D:
	return tex("res://art/ui/%s.webp" % name)


# 零件的尺寸與量測值（轉輪外框的開口、轉動鍵的圓心）
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
