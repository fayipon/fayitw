# 冒煙測試：載入主畫面 → 點開始 → 轉幾次，確認不會卡住或報錯
# godot --headless --path godot/auto-slot --script res://tests/smoke.gd
extends SceneTree

var main: Control
var frames := 0
var phase := 0


func _initialize() -> void:
	main = load("res://scenes/main.tscn").instantiate()
	root.add_child(main)
	print("smoke: main added")


func _process(_delta: float) -> bool:
	frames += 1
	match phase:
		0:
			var sfx := root.get_node_or_null("Sfx")
			if sfx and sfx.ready_count >= sfx.recipes.size():
				print("smoke: sounds ready at frame ", frames)
				var e := InputEventMouseButton.new()
				e.button_index = MOUSE_BUTTON_LEFT
				e.pressed = true
				main._on_title_input(e)
				phase = 1
		1:
			if main.started:
				print("smoke: started at frame ", frames)
				phase = 2
		2:
			if frames % 60 == 0:
				print("smoke: frame ", frames, " enemy=", main.enemy.get("kind", "-"), " busy=", main.busy, " coins=", main.state.coins)
			if not main.busy and frames > 200 and frames % 30 == 0:
				main._on_spin()
			if frames > 2400:
				print("smoke: done")
				return true
	if frames > 4000:
		print("smoke: timeout")
		return true
	return false
