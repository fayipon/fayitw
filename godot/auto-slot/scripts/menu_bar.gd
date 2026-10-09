# 選單列（排法照 PG Soft，按鈕用我們自己的古金細圈，跟 TURBO、AUTO 同一種）：按控制列最右邊的選單鈕後，
# 控制列換成一排——QUIT（離開遊戲）、SOUND（聲音開關）、PAYTABLE（賠率表）、RULES（規則）、HISTORY（最近的轉動紀錄）、
# CLOSE（收起來）。圖示畫在 icon_button.gd；打開時一個個從下面浮上來；選了什麼由 picked 送出去，main.gd 決定要做什麼
extends Control

signal picked(id: String)

const IconButton := preload("res://scripts/icon_button.gd")
const ITEMS := [["quit", "QUIT"], ["sound", "SOUND"], ["paytable", "PAYTABLE"], ["rules", "RULES"], ["history", "HISTORY"], ["close", "CLOSE"]]
# 圈的直徑與中心高度（跟控制列的 TURBO、AUTO 一樣）
const D := 42.0
const CY := 48.0

var _items := {}


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	for it in ITEMS:
		var b := IconButton.new(it[0], it[1])
		b.pressed.connect(func(): picked.emit(it[0]))
		add_child(b)
		_items[it[0]] = b


# dw 是設計寬度（跟控制列一樣，整條再依畫面縮放）；六顆平均分開
func layout(dw: float) -> void:
	var w := dw / ITEMS.size()
	for i in ITEMS.size():
		var b: Control = _items[ITEMS[i][0]]
		b.size = Vector2(D, D + 15)
		b.position = Vector2(i * w + (w - D) / 2.0, CY - D / 2.0)


func set_muted(muted: bool) -> void:
	_items.sound.muted = muted


# 一個個往上浮、淡入
func pop_in() -> void:
	for i in ITEMS.size():
		var b: Control = _items[ITEMS[i][0]]
		b.position.y = CY - D / 2.0 + 22.0
		b.modulate.a = 0.0
		var tw := b.create_tween().set_parallel()
		tw.tween_property(b, "position:y", CY - D / 2.0, 0.24).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT).set_delay(i * 0.035)
		tw.tween_property(b, "modulate:a", 1.0, 0.16).set_delay(i * 0.035)
