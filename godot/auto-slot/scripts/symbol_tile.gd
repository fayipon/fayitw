# 盤面上的一格：深色底板、符號圖、金框、WILD／BONUS 大字標籤；中獎時外框發光
extends Control

const Rules := preload("res://scripts/rules.gd")
const Art := preload("res://scripts/art.gd")

var id := "ten"
var gold := false
var glow := 0.0:
	set(v):
		glow = v
		queue_redraw()
var dim := false:
	set(v):
		dim = v
		modulate = Color(0.4, 0.4, 0.42) if v else Color.WHITE

static var _styles := {}


func setup(cell: Dictionary) -> void:
	id = cell.id
	gold = cell.get("gold", false)
	queue_redraw()


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	resized.connect(func(): pivot_offset = size / 2.0)


static func _style(kind: String) -> StyleBoxFlat:
	if not _styles.has(kind):
		var sb: StyleBoxFlat
		match kind:
			"plain":
				sb = Art.box(Color("252a2f"), 9, 1, Color(1, 1, 1, 0.08))
			"wild":
				sb = Art.box(Color("5c3c12"), 9, 2, Art.GOLD)
			"bonus":
				sb = Art.box(Color("5c1a10"), 9, 2, Color("ff6a50"))
			"gold":
				sb = Art.box(Color("3a2c18"), 9, 3, Color("f5c13a"))
			"glow":
				sb = Art.box(Color.TRANSPARENT, 10, 3, Art.GOLD)
				sb.draw_center = false
				sb.shadow_color = Color(1, 0.82, 0.3, 0.75)
				sb.shadow_size = 12
		_styles[kind] = sb
	return _styles[kind]


func _draw() -> void:
	var r := Rect2(Vector2.ZERO, size)
	var wild := Rules.is_wild(id)
	var bonus := Rules.is_bonus(id)
	var kind := "wild" if wild else "bonus" if bonus else "gold" if gold else "plain"
	draw_style_box(_style(kind), r)
	# 上緣一道亮邊，底板看起來有厚度
	draw_rect(Rect2(6, 2, size.x - 12, 2), Color(1, 1, 1, 0.06))
	if gold:
		# 金框符號：內圈再描一道淺金，四角加小寶石
		var inner := r.grow(-5)
		draw_rect(inner, Color("fff0a0", 0.55), false, 1.5)
		for p in [inner.position, Vector2(inner.end.x, inner.position.y), Vector2(inner.position.x, inner.end.y), inner.end]:
			draw_circle(p, 3.2, Color("ffe27a"))
			draw_circle(p, 1.6, Color("e8364f"))
	var tex := Art.symbol(id)
	var pad := 0.15 if Rules.ROYALS.has(id) else 0.07
	var icon := r.grow(-size.x * pad)
	if wild or bonus:
		icon = Rect2(size.x * 0.12, size.y * 0.04, size.x * 0.76, size.y * 0.66)
	draw_texture_rect(tex, _fit(tex, icon), false)
	if wild or bonus:
		_draw_tag("WILD" if wild else "BONUS", Art.GOLD if wild else Color("ff4a32"), Color("6a3200") if wild else Color("4e0600"))
	if glow > 0.01:
		var sb := _style("glow")
		sb.border_color = Color(Art.GOLD, glow)
		sb.shadow_color = Color(1, 0.82, 0.3, 0.75 * glow)
		draw_style_box(sb, r.grow(1))


# 底部一條大字標籤：WILD 金色、BONUS 紅色
func _draw_tag(text: String, color: Color, ink: Color) -> void:
	var h := size.y * 0.27
	var rect := Rect2(size.x * 0.03, size.y - h - size.y * 0.05, size.x * 0.94, h)
	var sb := Art.box(color, 6, 2, color.lightened(0.45))
	draw_style_box(sb, rect)
	draw_rect(Rect2(rect.position + Vector2(4, 2), Vector2(rect.size.x - 8, rect.size.y * 0.35)), Color(1, 1, 1, 0.25))
	var font := Art.font()
	var fs := int(h * (0.78 if text == "WILD" else 0.68))
	var base := Vector2(rect.position.x, rect.position.y + rect.size.y * 0.5 + fs * 0.36)
	draw_string_outline(font, base, text, HORIZONTAL_ALIGNMENT_CENTER, rect.size.x, fs, 5, ink)
	draw_string(font, base, text, HORIZONTAL_ALIGNMENT_CENTER, rect.size.x, fs, Color.WHITE)


func _fit(tex: Texture2D, box: Rect2) -> Rect2:
	var s := minf(box.size.x / tex.get_width(), box.size.y / tex.get_height())
	var sz := Vector2(tex.get_width(), tex.get_height()) * s
	return Rect2(box.position + (box.size - sz) / 2.0, sz)
