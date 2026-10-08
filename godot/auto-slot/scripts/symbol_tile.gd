# 盤面上的一格：滿版的符號磚圖（WILD、金鑰匙、大野狼的框已經畫在圖上）；金框符號加一圈古金框與四角紅寶石；
# WILD、SCATTER（金鑰匙）底下壓暗、寫金色大字；中獎時外框發光，其餘變暗
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
		modulate = Color(0.38, 0.36, 0.4) if v else Color.WHITE

static var _glow_box: StyleBoxFlat


func setup(cell: Dictionary) -> void:
	id = cell.id
	gold = cell.get("gold", false)
	queue_redraw()


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	resized.connect(func(): pivot_offset = size / 2.0)


func _draw() -> void:
	var r := Rect2(Vector2.ZERO, size)
	draw_texture_rect(Art.symbol(id), r, false)
	if gold:
		_gold_frame(r)
	if Rules.is_wild(id):
		_tag("WILD")
	elif Rules.is_scatter(id):
		_tag("SCATTER")
	if glow > 0.01:
		if not _glow_box:
			_glow_box = Art.box(Color.TRANSPARENT, 6, 3, Art.GOLD)
			_glow_box.draw_center = false
			_glow_box.shadow_size = 12
		_glow_box.border_color = Color(Art.GOLD_LIGHT, glow)
		_glow_box.shadow_color = Color(1, 0.75, 0.3, 0.7 * glow)
		draw_style_box(_glow_box, r.grow(1))


# 金框：外深金、內亮金兩道線，四角菱形紅寶石
func _gold_frame(r: Rect2) -> void:
	var w := maxf(2.0, size.x * 0.045)
	draw_rect(r.grow(-w * 0.5), Art.GOLD_DEEP, false, w)
	draw_rect(r.grow(-w * 1.3), Color(Art.GOLD_LIGHT, 0.85), false, maxf(1.0, w * 0.4))
	var g := size.x * 0.07
	for p in [r.position, Vector2(r.end.x, r.position.y), Vector2(r.position.x, r.end.y), r.end]:
		var c: Vector2 = p + (r.get_center() - p).sign() * w * 1.1
		var dia := PackedVector2Array([c + Vector2(0, -g), c + Vector2(g, 0), c + Vector2(0, g), c + Vector2(-g, 0)])
		draw_colored_polygon(dia, Art.GOLD)
		var inner := PackedVector2Array([c + Vector2(0, -g * 0.55), c + Vector2(g * 0.55, 0), c + Vector2(0, g * 0.55), c + Vector2(-g * 0.55, 0)])
		draw_colored_polygon(inner, Art.RED)


# 底部壓暗再寫金字（字寬超過格子時自動縮小）
func _tag(text: String) -> void:
	var h := size.y * 0.34
	var top := size.y - h
	var inset := size.x * 0.06
	draw_polygon(PackedVector2Array([Vector2(inset, top), Vector2(size.x - inset, top), Vector2(size.x - inset, size.y - inset), Vector2(inset, size.y - inset)]),
		PackedColorArray([Color(0, 0, 0, 0), Color(0, 0, 0, 0), Color(0, 0, 0, 0.8), Color(0, 0, 0, 0.8)]))
	var font := Art.font()
	var fs := int(size.y * 0.24)
	while fs > 8 and font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x > size.x * 0.9:
		fs -= 1
	var base := Vector2(0, size.y - size.y * 0.09)
	draw_string_outline(font, base + Vector2(0, 2), text, HORIZONTAL_ALIGNMENT_CENTER, size.x, fs, 5, Color(0, 0, 0, 0.7))
	draw_string_outline(font, base, text, HORIZONTAL_ALIGNMENT_CENTER, size.x, fs, 4, Art.GOLD_INK)
	draw_string(font, base, text, HORIZONTAL_ALIGNMENT_CENTER, size.x, fs, Art.GOLD)
