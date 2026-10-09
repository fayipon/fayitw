# 盤面上的一格：每一格都畫同一塊石板底（art/tiles/bg.webp，設計稿的空白石板磚），上面放去背的符號（透明圖）；
# 一般格子不畫框，金框符號才畫一道細金線、四角鑲小顆紅寶石；偏暗的圖案（大野狼、烏鴉、提燈）後面墊一團淡淡的背景光；
# WILD、SCATTER（金鑰匙）底下壓暗、寫金色大字；中獎時外框發光，其餘變暗
# 轉動中有動態模糊：同一張圖往下錯開疊幾層（越下面越新、越清楚），模糊時字樣、金框、光框先不畫；
# SCATTER 落定後一直亮著（lit）：不用框，石板底淡入成「石板透金光」（bg-lit.webp），之後一呼一吸
extends Control

const Rules := preload("res://scripts/rules.gd")
const Art := preload("res://scripts/art.gd")

# 偏暗的圖案在暗石板上看不清楚：後面墊一團柔光（狼、烏鴉是冷色月光，提燈是暖色燈光），alpha 是最亮處的強度
const BACKLIGHT := {
	"wolf": Color(0.66, 0.76, 1.0, 0.3),
	"raven": Color(0.66, 0.78, 1.0, 0.32),
	"lantern": Color(1.0, 0.74, 0.38, 0.3),
}


var id := "ten"
var gold := false
# 中獎發光：外圈的光會溢出格子，發光時墊高一層，才不會被後畫的格子蓋掉三邊、只剩一截
var glow := 0.0:
	set(v):
		glow = v
		z_index = 1 if v > 0.01 else 0
		queue_redraw()
var dim := false:
	set(v):
		dim = v
		modulate = Color(0.38, 0.36, 0.4) if v else Color.WHITE
# 動態模糊拉長的像素（slot_view 依轉速設定，停下來是 0）
var blur := 0.0:
	set(v):
		blur = v
		queue_redraw()
# SCATTER 高亮：亮起來時金光淡入（_lit_k 0 → 1）
var lit := false:
	set(v):
		if v == lit:
			return
		lit = v
		_lt = 0.0
		_lit_k = 0.0
		set_process(v)
		queue_redraw()
var _lt := 0.0
var _lit_k := 0.0

static var _glow_box: StyleBoxFlat
static var _backlight: GradientTexture2D


func setup(cell: Dictionary) -> void:
	id = cell.id
	gold = cell.get("gold", false)
	queue_redraw()


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	resized.connect(func(): pivot_offset = size / 2.0)
	set_process(lit)


func _process(delta: float) -> void:
	_lt += delta
	_lit_k = minf(1.0, _lit_k + delta / 0.35)
	queue_redraw()


func _draw() -> void:
	var r := Rect2(Vector2.ZERO, size)
	var tex := Art.symbol(id)
	draw_texture_rect(Art.symbol("bg"), r, false)
	if lit:
		# 石板透金光：淡入後在 75%～100% 之間一呼一吸
		var p := 0.5 + 0.5 * sin(_lt * 3.2)
		draw_texture_rect(Art.symbol("bg-lit"), r, false, Color(1, 1, 1, _lit_k * (0.75 + 0.25 * p)))
	if BACKLIGHT.has(id):
		draw_texture_rect(_backlight_tex(), r, false, BACKLIGHT[id])
	if blur > 6.0:
		draw_texture_rect(tex, Rect2(r.position - Vector2(0, blur * 0.5), r.size), false)
		for k in 6:
			draw_texture_rect(tex, Rect2(r.position + Vector2(0, lerpf(-0.5, 0.5, (k + 1) / 6.0) * blur), r.size), false, Color(1, 1, 1, 0.34))
		return
	draw_texture_rect(tex, r, false)
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


# 背景光：白色放射漸層（中間偏上、往外很快淡掉，碰不到格子邊緣），畫的時候乘上 BACKLIGHT 的顏色
static func _backlight_tex() -> GradientTexture2D:
	if not _backlight:
		var g := Gradient.new()
		g.offsets = PackedFloat32Array([0.0, 0.3, 0.62, 1.0])
		g.colors = PackedColorArray([Color(1, 1, 1, 1), Color(1, 1, 1, 0.55), Color(1, 1, 1, 0.12), Color(1, 1, 1, 0)])
		_backlight = GradientTexture2D.new()
		_backlight.gradient = g
		_backlight.fill = GradientTexture2D.FILL_RADIAL
		_backlight.fill_from = Vector2(0.5, 0.46)
		_backlight.fill_to = Vector2(0.92, 0.46)
		_backlight.width = 128
		_backlight.height = 128
	return _backlight


# 金框（細緻版）：往內縮一點、落在石板圓角裡；外側墊一圈淡暗影把金線跟石板分開，
# 一道細金線、裡面再一道更細的淡亮金線；四角各一顆小菱形：金邊包紅寶石、左上一點反光
func _gold_frame(r: Rect2) -> void:
	var u := size.x / 100.0
	var f := r.grow(-3.2 * u)
	var w := maxf(1.4, 1.5 * u)
	draw_rect(f, Color(0, 0, 0, 0.45), false, w + 2.0, true)
	draw_rect(f, Art.GOLD, false, w, true)
	draw_rect(f.grow(-w - 1.8 * u), Color(Art.GOLD_LIGHT, 0.45), false, 1.0, true)
	var g := maxf(4.0, 5.2 * u)
	for c in [f.position, Vector2(f.end.x, f.position.y), Vector2(f.position.x, f.end.y), f.end]:
		draw_colored_polygon(_diamond(c, g + 1.5), Color(0, 0, 0, 0.5))
		draw_colored_polygon(_diamond(c, g), Art.GOLD)
		draw_colored_polygon(_diamond(c, g * 0.58), Art.RED)
		draw_colored_polygon(_diamond(c + Vector2(-g, -g) * 0.16, g * 0.2), Color(1, 0.86, 0.86, 0.9))


static func _diamond(c: Vector2, g: float) -> PackedVector2Array:
	return PackedVector2Array([c + Vector2(0, -g), c + Vector2(g, 0), c + Vector2(0, g), c + Vector2(-g, 0)])


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
