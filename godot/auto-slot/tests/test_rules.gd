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
	test_scatter_anywhere()
	test_cascade_gold_turns_wild_and_drops()
	test_reel_limits()
	test_long_cascade_ladder()
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
	var scatter := 0
	for id in Rules.SYMBOL_IDS:
		if Rules.is_wild(id):
			wild += 1
		elif Rules.is_scatter(id):
			scatter += 1
		else:
			var p: Array = Rules.SYMBOLS[id].pays
			check(p[0] > 0 and p[1] > p[0] and p[2] > p[1], "%s pays grow with length" % id)
			for bet in Rules.BET_LEVELS:
				for v in p:
					check(v * bet % Rules.PAY_DIV == 0, "%s pays whole coins at bet %d" % [id, bet])
	check(wild == 1 and scatter == 1, "one wild and one bonus")


func test_ways() -> void:
	var board := board_of([["wolf", "wolf", "ten", "jack"], ["wolf", "queen", "ten", "jack"], ["wolf", "wolf", "wolf", "king"], FILL, FILL])
	var ev := Rules.evaluate(board, 20)
	var top: Dictionary = ev.wins.filter(func(w): return w.symbol == "wolf")[0]
	check(top.reels == 3, "the wolf pays three reels")
	check(top.ways == 2 * 1 * 3, "ways multiply cells per reel")
	check(top.amount == Rules.SYMBOLS.wolf.pays[0] * 6, "at bet 20 a way pays the paytable number")
	check(Rules.pay("wolf", 5, 4) == 80, "pay scales with the bet")


func test_wild_needs_first_reel() -> void:
	var board := board_of([["raven", "ten", "ten", "ten"], ["hood", "jack", "jack", "jack"], ["raven", "queen", "queen", "queen"], ["hood", "king", "king", "king"], ["raven", "ace", "ace", "ace"]])
	var raven: Dictionary = Rules.evaluate(board, 4).wins.filter(func(w): return w.symbol == "raven")[0]
	check(raven.reels == 5 and raven.ways == 1, "wild completes five of a kind")
	var no_start := board_of([FILL, ["hood", "wolf", "wolf", "wolf"], ["wolf", "wolf", "wolf", "wolf"], FILL, FILL])
	check(Rules.evaluate(no_start, 4).wins.filter(func(w): return w.symbol == "wolf").is_empty(), "a win must start on reel one")
	var no_scatter := board_of([["key", "ten", "ten", "ten"], ["hood", "jack", "jack", "jack"], ["key", "queen", "queen", "queen"], FILL, FILL])
	check(Rules.evaluate(no_scatter, 4).wins.filter(func(w): return w.symbol == "key").is_empty(), "wild does not complete bonus symbols")


func test_scatter_anywhere() -> void:
	var two := board_of([["key", "ten", "ten", "ten"], ["hood", "jack", "jack", "jack"], ["key", "queen", "queen", "queen"], FILL, FILL])
	check(not Rules.evaluate(two, 4).triggered, "two bonus symbols do not trigger")
	var three := board_of([["ten", "key", "ten", "ten"], FILL, ["queen", "queen", "queen", "key"], FILL, ["key", "ace", "ace", "ace"]])
	var ev := Rules.evaluate(three, 20)
	check(ev.triggered and ev.scatter == [4, 5, 17], "three bonus symbols anywhere trigger")
	check(Rules.scatter_pay(3, 20) == Rules.total_bet(20) / 4, "three bonus symbols pay a quarter of the total bet")
	check(Rules.scatter_pay(5, 4) == Rules.total_bet(4) * 5, "five bonus symbols pay five times the total bet")
	check(Rules.free_spins(3) == 8 and Rules.free_spins(4) == 10 and Rules.free_spins(5) == 12, "8 / 10 / 12 free spins")


func test_cascade_gold_turns_wild_and_drops() -> void:
	# 大野狼在三軸最下面一列，第二軸那格有金框
	var other := ["queen", "jack", "ten", "king"]
	var start := board_of([["ace", "basket", "potion", "wolf"], ["king", "queen", "jack", "!wolf"], ["ten", "lantern", "raven", "wolf"], other, other])
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	var res := Rules.resolve(start, rng, 4)
	var step: Dictionary = res.steps[0]
	check(step.mult == Rules.MULTIPLIERS[0], "first cascade uses the first multiplier")
	check(step.to_wild == [16], "the gold wolf turns into a wild")
	check(step.next[16].id == "hood" and not step.next[16].gold, "the wild stays where the gold symbol was")
	check(step.removed.has(15) and step.removed.has(17), "plain winning symbols are removed")
	var col0: Array = step.moves.filter(func(m): return m.col == 0)
	check(col0.size() == 3, "three symbols fall one row on reel one")
	check(step.wins.size() == 1, "only the wolf line wins")
	check(step.next[15].id == "potion" and step.next[5].id == "ace", "symbols land one row lower")
	check(step.added.filter(func(a): return a.col == 0).size() == 1, "one new symbol drops into reel one")
	for k in res.steps.size():
		check(res.steps[k].mult == Rules.MULTIPLIERS[mini(k, Rules.MULTIPLIERS.size() - 1)], "multiplier ladder")
	var free := Rules.resolve(start, rng, 4, Rules.FS_MULTIPLIERS)
	check(free.steps[0].mult == Rules.FS_MULTIPLIERS[0] and free.steps[0].win == free.steps[0].base * Rules.FS_MULTIPLIERS[0], "free spins use the doubled ladder")


# 每一張盤面（開轉時與每段連鎖補完之後）都要守規矩：每軸最多一把金鑰匙、外側兩軸沒有 WILD 與金框、金框只在一般符號
func test_reel_limits() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 5
	var ok_scatter := true
	var ok_wild := true
	var ok_gold := true
	var boards := 0
	for k in 3000:
		var res := Rules.play(rng, 20, k % 2 == 1)
		var list: Array = [res.start]
		for st in res.steps:
			list.append(st.next)
		for board in list:
			boards += 1
			for c in Rules.COLS:
				var n := 0
				for r in Rules.ROWS:
					var cell: Dictionary = board[r * Rules.COLS + c]
					if Rules.is_scatter(cell.id):
						n += 1
					if (c == 0 or c == 4) and (Rules.is_wild(cell.id) or cell.gold):
						ok_wild = false
					if cell.gold and (Rules.is_wild(cell.id) or Rules.is_scatter(cell.id)):
						ok_gold = false
				ok_scatter = ok_scatter and n <= 1
	check(boards > 3000, "cascade boards are checked too")
	check(ok_scatter, "a reel never shows more than one bonus symbol, also after cascade refills")
	check(ok_wild, "no wild or gold frame on the outer reels")
	check(ok_gold, "gold frames only on paying symbols")


# 找一轉連鎖 5 段以上的，倍率要照字面一路走到底；每段 win = base × mult，總和 = total
func test_long_cascade_ladder() -> void:
	for free in [false, true]:
		var rng := RandomNumberGenerator.new()
		rng.seed = 11
		var found := {}
		for k in 20000:
			var res := Rules.play(rng, 20, free)
			if res.steps.size() >= 5:
				found = res
				break
		check(not found.is_empty(), "a long cascade shows up (free=%s)" % free)
		if found.is_empty():
			continue
		var want: Array = [2, 4, 6, 10, 10] if free else [1, 2, 3, 5, 5]
		var got := []
		var sum := 0
		for k in found.steps.size():
			var st: Dictionary = found.steps[k]
			if k < 5:
				got.append(st.mult)
			check(st.win == st.base * st.mult, "step win = base × multiplier")
			sum += st.win
		check(got == want, "multiplier ladder %s (free=%s), got %s" % [want, free, got])
		check(sum == found.total, "total equals the sum of the steps")


func test_rtp_and_multipliers() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 2024
	var n := 30000
	var bet := 20
	var tb := Rules.total_bet(bet)
	var base := 0
	var free := 0
	var triggers := 0
	var spins := 0
	for k in n:
		var res := Rules.play(rng, bet)
		base += res.total
		if not res.triggered:
			continue
		triggers += 1
		free += Rules.scatter_pay(res.scatter.size(), bet)
		var left := Rules.free_spins(res.scatter.size())
		while left > 0:
			left -= 1
			spins += 1
			var fs := Rules.play(rng, bet, true)
			free += fs.total
			if fs.triggered:
				free += Rules.scatter_pay(fs.scatter.size(), bet)
				left += Rules.free_spins(fs.scatter.size())
	var base_rtp := float(base) / (n * tb)
	var free_rtp := float(free) / (n * tb)
	print("base RTP %.3f, free spins RTP %.3f, free spins every %.0f spins (%.1f spins each)" % [base_rtp, free_rtp, float(n) / maxi(triggers, 1), float(spins) / maxi(triggers, 1)])
	check(base_rtp > 0.64 and base_rtp < 0.8, "base game return %.3f" % base_rtp)
	check(free_rtp > 0.06 and free_rtp < 0.18, "free spins return %.3f" % free_rtp)
	check(triggers > 0 and float(n) / triggers > 70 and float(n) / triggers < 180, "free spins frequency")


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
