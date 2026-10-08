# 冒煙測試：載入主畫面 → 等音效合成完自動開始 → 轉幾次 → 直接跑一輪 Free Spins，確認不會卡住或報錯
# godot --headless --path godot/auto-slot --script res://tests/smoke.gd
extends SceneTree

var main: Control
var frames := 0
var phase := 0
var fs_done := false


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
				phase = 1
		1:
			if main.started:
				print("smoke: started at frame ", frames)
				phase = 2
		2:
			if frames % 60 == 0:
				print("smoke: frame ", frames, " enemy=", main.enemy.get("kind", "-"), " busy=", main.busy, " coins=", main.state.coins)
			if not main.busy and frames > 200 and frames < 1500 and frames % 30 == 0:
				main._on_spin()
			if frames >= 1500 and not main.busy and phase == 2:
				phase = 3
				_free_round()
		3:
			if fs_done and not main.busy:
				print("smoke: free spins done, coins=", main.state.coins)
				print("smoke: done")
				return true
	if frames > 20000:
		print("smoke: timeout")
		return true
	return false


# 不等 SCATTER 自然出現，直接觸發 3 個 SCATTER 的 Free Spins
func _free_round() -> void:
	main.busy = true
	await main._free_spins([0, 6, 12], 20)
	main.busy = false
	fs_done = true
