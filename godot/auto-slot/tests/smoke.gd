# 冒煙測試：載入主畫面 → 等音效合成完自動開始 → 轉幾次 → 直接跑一輪 Free Spins，確認不會卡住或報錯；
# 再檢查傷害不會浪費：打倒時多出來的、走路時打的都存起來，下一隻狼站定時一次打出去；
# 再連出第 1～6 段連擊的招式，確認每一招都會打完、連擊計數會收起來；最後按一次 Feature Buy，確認一定進 EXTRA
# godot --headless --path godot/auto-slot --script res://tests/smoke.gd
extends SceneTree

var main: Control
var frames := 0
var phase := 0
var fs_done := false
var end_at := 0
var buy_done := false
const Rules = preload("res://scripts/rules.gd")


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
				phase = 4
		4:
			# 狼站定、存的傷害已經打出去之後：打倒牠，多 50 點
			if _settled():
				expect(main.state.charge == 0, "stored damage is released when a wolf is ready")
				main._queue_attack(int(main.enemy.hp) + 50, false)
				phase = 5
		5:
			# 狼倒下、還在走路：多出來的 50 點存著，這時再打一下 30 點也存起來
			if main.enemy.is_empty() and not main._working:
				expect(main.state.charge == 50, "overkill is stored (charge=%d)" % main.state.charge)
				main._queue_attack(30, false)
				expect(main.state.charge == 80, "damage while walking is stored (charge=%d)" % main.state.charge)
				phase = 7
		7:
			# 下一隻站定：80 點一次打出去
			if _settled():
				expect(main.state.charge == 0 and main.enemy.max_hp - main.enemy.hp == 80, "stored damage hits the next wolf")
				for n in range(1, 7):
					main._queue_attack(1, n >= 5, n)
				# 第一個 _queue_attack 已經把佇列跑起來了，收尾記號排在最後就好
				main._queue.append([0, false, false, -1])
				phase = 9
				end_at = frames + 3000
		9:
			if not main._working:
				expect(main.enemy.max_hp - main.enemy.hp == 86, "combo moves 1-6 all finish (damage %d)" % (main.enemy.max_hp - main.enemy.hp))
				phase = 8
				end_at = frames + 120
			elif frames >= end_at:
				expect(false, "combo moves 1-6 all finish (stuck)")
		8:
			# 等刀光、跳字這些動畫跑完再結束
			if frames >= end_at:
				phase = 10
				_buy_round()
		10:
			# Feature Buy：扣的是總押注 × BUY_COST，一定玩到 EXTRA（History 記這一轉的押注與免費轉次數）
			if buy_done and not main.busy:
				var h: Array = main.state.history[0]
				var cost := Rules.buy_cost(Rules.BET_LEVELS[main.state.bet])
				expect(h[1] == cost and h[3] >= 8, "a Feature Buy costs %d and always plays EXTRA (history %s)" % [cost, h])
				print("smoke: done")
				return true
	if frames > 40000:
		print("smoke: timeout")
		return true
	return false


func _settled() -> bool:
	return not main.enemy.is_empty() and main.enemy_ready and not main._working and main._queue.is_empty() and not main.busy


func expect(ok: bool, message: String) -> void:
	print("smoke: ", "ok   " if ok else "FAIL ", message)
	if not ok:
		quit(1)


# 不等 SCATTER 自然出現，直接觸發 3 個 SCATTER 的 Free Spins
func _free_round() -> void:
	main.busy = true
	await main._free_spins([0, 6, 12], 20)
	main.busy = false
	fs_done = true


func _buy_round() -> void:
	await main._spin(true)
	buy_done = true
