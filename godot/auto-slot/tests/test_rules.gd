# 規則測試：godot --headless --path godot/auto-slot --script res://tests/test_rules.gd
# 失敗時印出 FAIL 並以非 0 結束
extends SceneTree

const Rules := preload("res://scripts/rules.gd")

var failures := 0
var checks := 0


func _init() -> void:
	test_symbol_set()
	test_ways()
	test_wild_needs_first_reel()
	test_bonus_anywhere()
	test_cascade_gold_turns_wild_and_drops()
	test_reel_limits()
	test_rtp_and_multipliers()
	test_enemies()
	test_xp()
	print("%d checks, %d failures" % [checks, failures])
	quit(1 if failures > 0 else 0)


func check(ok: bool, message: String) -> void:
	checks += 1
	if not ok:
		failures += 1
		printerr("FAIL: ", message)


# cols[c] 是第 c 軸由上到下的 4 格；"!" 開頭代表金框
func board_of(cols: Array) -> Array:
	var board := []
	board.resize(Rules.CELLS)
	for c in cols.size():
		for r in Rules.ROWS:
			var id: String = cols[c][r]
			board[r * Rules.COLS + c] = {"id": id.trim_prefix("!"), "gold": id.begins_with("!")}
	return board


const FILL := ["ten", "jack", "queen", "king"]


func test_symbol_set() -> void:
	check(Rules.SYMBOL_IDS.size() == 12, "twelve symbols")
	var wild := 0
	var bonus := 0
	for id in Rules.SYMBOL_IDS:
		if Rules.is_wild(id):
			wild += 1
		elif Rules.is_bonus(id):
			bonus += 1
		else:
			var p: Array = Rules.SYMBOLS[id].pays
			check(p[0] > 0 and p[1] > p[0] and p[2] > p[1], "%s pays grow with length" % id)
	check(wild == 1 and bonus == 1, "one wild and one bonus")


func test_ways() -> void:
	var board := board_of([["hood", "hood", "ten", "jack"], ["hood", "queen", "ten", "jack"], ["hood", "hood", "hood", "king"], FILL, FILL])
	var ev := Rules.evaluate(board, 5)
	var hood: Dictionary = ev.wins.filter(func(w): return w.symbol == "hood")[0]
	check(hood.reels == 3, "hood pays three reels")
	check(hood.ways == 2 * 1 * 3, "ways multiply cells per reel")
	check(hood.amount == Rules.SYMBOLS.hood.pays[0] * 6 * 5, "amount = pay × ways × bet")


func test_wild_needs_first_reel() -> void:
	var board := board_of([["wolf", "ten", "ten", "ten"], ["crown", "jack", "jack", "jack"], ["wolf", "queen", "queen", "queen"], ["crown", "king", "king", "king"], ["wolf", "ace", "ace", "ace"]])
	var wolf: Dictionary = Rules.evaluate(board, 1).wins.filter(func(w): return w.symbol == "wolf")[0]
	check(wolf.reels == 5 and wolf.ways == 1, "wild completes five of a kind")
	var no_start := board_of([FILL, ["crown", "hood", "hood", "hood"], ["hood", "hood", "hood", "hood"], FILL, FILL])
	check(Rules.evaluate(no_start, 1).wins.filter(func(w): return w.symbol == "hood").is_empty(), "a win must start on reel one")


func test_bonus_anywhere() -> void:
	var two := board_of([["cottage", "ten", "ten", "ten"], ["crown", "jack", "jack", "jack"], ["cottage", "queen", "queen", "queen"], FILL, FILL])
	check(not Rules.evaluate(two, 1).triggered, "two bonus do not trigger")
	var three := board_of([["ten", "cottage", "ten", "ten"], FILL, ["queen", "queen", "queen", "cottage"], FILL, ["cottage", "ace", "ace", "ace"]])
	var ev := Rules.evaluate(three, 2)
	check(ev.triggered and ev.bonus == [4, 5, 17], "three bonus anywhere trigger")
	check(Rules.bonus_prize(3, 2) == Rules.BONUS_PRIZE[3] * Rules.total_bet(2), "bonus prize uses total bet")


func test_cascade_gold_turns_wild_and_drops() -> void:
	# 小紅帽在三軸最下面一列，第二軸那格有金框
	var other := ["queen", "jack", "ten", "king"]
	var start := board_of([["ace", "rabbit", "pie", "hood"], ["king", "queen", "jack", "!hood"], ["ten", "basket", "wolf", "hood"], other, other])
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	var res := Rules.resolve(start, rng, 1)
	var step: Dictionary = res.steps[0]
	check(step.mult == Rules.MULTIPLIERS[0], "first cascade uses the first multiplier")
	check(step.to_wild == [16], "the gold hood turns into a wild")
	check(step.next[16].id == "crown" and not step.next[16].gold, "the wild stays where the gold symbol was")
	check(step.removed.has(15) and step.removed.has(17), "plain winning symbols are removed")
	var col0: Array = step.moves.filter(func(m): return m.col == 0)
	check(col0.size() == 3, "three symbols fall one row on reel one")
	check(step.wins.size() == 1, "only the hood line wins")
	check(step.next[15].id == "pie" and step.next[5].id == "ace", "symbols land one row lower")
	check(step.added.filter(func(a): return a.col == 0).size() == 1, "one new symbol drops into reel one")
	for k in res.steps.size():
		check(res.steps[k].mult == Rules.MULTIPLIERS[mini(k, Rules.MULTIPLIERS.size() - 1)], "multiplier ladder")


func test_reel_limits() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 5
	var ok_bonus := true
	var ok_wild := true
	var ok_gold := true
	for k in 3000:
		var board := Rules.spin_board(rng)
		for c in Rules.COLS:
			var n := 0
			for r in Rules.ROWS:
				var cell: Dictionary = board[r * Rules.COLS + c]
				if Rules.is_bonus(cell.id):
					n += 1
				if (c == 0 or c == 4) and (Rules.is_wild(cell.id) or cell.gold):
					ok_wild = false
				if cell.gold and (Rules.is_wild(cell.id) or Rules.is_bonus(cell.id)):
					ok_gold = false
			ok_bonus = ok_bonus and n <= 1
	check(ok_bonus, "a reel never shows more than one bonus")
	check(ok_wild, "no wild or gold frame on the outer reels")
	check(ok_gold, "gold frames only on paying symbols")


func test_rtp_and_multipliers() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 2024
	var n := 30000
	var tb := Rules.total_bet(1)
	var lines := 0
	var bonus := 0
	var triggers := 0
	for k in n:
		var res := Rules.play(rng, 1)
		lines += res.total
		if res.triggered:
			triggers += 1
			bonus += Rules.bonus_prize(res.bonus.size(), 1)
	var lines_rtp := float(lines) / (n * tb)
	var bonus_rtp := float(bonus) / (n * tb)
	print("lines RTP %.3f, bonus RTP %.3f, bonus every %.0f spins" % [lines_rtp, bonus_rtp, float(n) / maxi(triggers, 1)])
	check(lines_rtp > 0.6 and lines_rtp < 0.85, "lines return %.3f" % lines_rtp)
	check(bonus_rtp > 0.05 and bonus_rtp < 0.2, "bonus return %.3f" % bonus_rtp)
	check(triggers > 0 and float(n) / triggers > 70 and float(n) / triggers < 180, "bonus frequency")


func test_enemies() -> void:
	var bosses := []
	for k in 10:
		if Rules.spawn_enemy(k, 1).kind == "boss":
			bosses.append(k)
	check(bosses == [Rules.BOSS_EVERY - 1, 2 * Rules.BOSS_EVERY - 1], "every fifth enemy is the wolf king")
	var wolf := Rules.spawn_enemy(0, 5)
	check(wolf.max_hp == 3 * Rules.total_bet(5), "enemy hp scales with the total bet")
	check(not Rules.hit(wolf, Rules.base_attack(5)), "a base attack alone does not kill")
	check(Rules.hit(wolf, 100000) and wolf.hp == 0, "a big win defeats the enemy")


func test_xp() -> void:
	var hero := {"level": 1, "xp": 0}
	check(Rules.gain_xp(hero, Rules.xp_to_next(1) + 1) == 1, "one level up")
	check(hero.level == 2 and hero.xp == 1, "experience carries over")
