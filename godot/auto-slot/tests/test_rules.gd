# 規則測試：godot --headless --path godot/auto-slot --script res://tests/test_rules.gd
# 失敗時印出 FAIL 並以非 0 結束
extends SceneTree

const Rules := preload("res://scripts/rules.gd")
const Art := preload("res://scripts/art.gd")

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
	test_money()
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
	check(wild == 1 and scatter == 1, "one wild and one bonus")
	var levels: Array = Rules.BET_LEVELS
	var sorted := levels.duplicate()
	sorted.sort()
	check(levels == sorted and levels[0] == 5, "bet per line goes up from 0.05")
	check(Rules.total_bet(levels[0]) == 100, "lowest total bet is 1.00 (0.05 × 20 lines)")
	check(Rules.DEFAULT_BET >= 0 and Rules.DEFAULT_BET < levels.size(), "default bet is a valid level")


func test_ways() -> void:
	var board := board_of([["wolf", "wolf", "ten", "jack"], ["wolf", "queen", "ten", "jack"], ["wolf", "wolf", "wolf", "king"], FILL, FILL])
	var ev := Rules.evaluate(board, 20)
	var top: Dictionary = ev.wins.filter(func(w): return w.symbol == "wolf")[0]
	check(top.reels == 3, "the wolf pays three reels")
	check(top.ways == 2 * 1 * 3, "ways multiply cells per reel")
	check(top.amount == Rules.SYMBOLS.wolf.pays[0] * 6, "at bet 20 a way pays the paytable number")
	check(Rules.pay("wolf", 5, 4) == 80, "pay scales with the bet")
	check(is_equal_approx(Rules.pay("king", 3, 1), 1.25), "a way can pay a fraction of a cent at low bets")
	var low := Rules.evaluate(board, 1)
	check(low.raw == Rules.SYMBOLS.wolf.pays[0] * 6 and low.total == roundi(low.raw / 20.0), "the board total is rounded to the cent once")


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
	check(free.steps[0].mult == Rules.FS_MULTIPLIERS[0] and free.steps[0].win == roundi(free.steps[0].raw * Rules.FS_MULTIPLIERS[0] / 20.0), "free spins use the EXTRA ladder")
	# EXTRA 的倍率一路累積：從第 3 格接著爬，連完回傳爬到第幾格；爬到頂就停在最後一格
	var cont := Rules.resolve(start, rng, 4, Rules.FS_MULTIPLIERS, 3)
	check(cont.steps[0].mult == Rules.FS_MULTIPLIERS[3] and cont.level == 3 + cont.steps.size(), "EXTRA keeps climbing the ladder from where it left off")
	var top := Rules.resolve(start, rng, 4, Rules.FS_MULTIPLIERS, 99)
	check(top.steps[0].mult == Rules.FS_MULTIPLIERS[-1], "the ladder tops out at the last step")


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
		var want: Array = [2, 3, 4, 5, 6] if free else [1, 2, 3, 5, 5]
		var got := []
		var sum := 0
		for k in found.steps.size():
			var st: Dictionary = found.steps[k]
			if k < 5:
				got.append(st.mult)
			check(st.win == roundi(st.raw * st.mult / 20.0), "step win = base × multiplier, rounded to the cent")
			sum += st.win
		check(got == want, "multiplier ladder %s (free=%s), got %s" % [want, free, got])
		check(sum == found.total, "total equals the sum of the steps")


# 回傳 [主遊戲贏分, Free Spins 贏分（含 SCATTER 獎金）, 觸發次數, 免費轉次數]；盤面只跟亂數有關、跟押注無關
func simulate(bet: int, n: int, seed: int) -> Array:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed
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
		# EXTRA 的倍率整段累積：每一轉接著上一轉爬到的那一格（寶箱怪掉的 WILD 在 main 裡，這裡不算）
		var level := 0
		while left > 0:
			left -= 1
			spins += 1
			var fs := Rules.resolve(Rules.spin_board(rng), rng, bet, Rules.FS_MULTIPLIERS, level)
			level = fs.level
			free += fs.total
			if fs.triggered:
				free += Rules.scatter_pay(fs.scatter.size(), bet)
				left += Rules.free_spins(fs.scatter.size())
	return [base, free, triggers, spins]


func test_rtp_and_multipliers() -> void:
	var n := 30000
	var bet := 20
	var tb := Rules.total_bet(bet)
	var r := simulate(bet, n, 2024)
	var base_rtp := float(r[0]) / (n * tb)
	var free_rtp := float(r[1]) / (n * tb)
	var triggers: int = r[2]
	print("base RTP %.3f, free spins RTP %.3f, free spins every %.0f spins (%.1f spins each)" % [base_rtp, free_rtp, float(n) / maxi(triggers, 1), float(r[3]) / maxi(triggers, 1)])
	check(base_rtp > 0.64 and base_rtp < 0.8, "base game return %.3f" % base_rtp)
	check(free_rtp > 0.03 and free_rtp < 0.2, "free spins return %.3f" % free_rtp)
	check(triggers > 0 and float(n) / triggers > 250 and float(n) / triggers < 650, "free spins frequency")
	# 最低押注（每線 0.05）有不到 1 分的零頭要四捨五入：同樣的盤面，回收率要跟上面差不到 1%
	var m := 10000
	var hi := simulate(bet, m, 7)
	var lo := simulate(Rules.BET_LEVELS[0], m, 7)
	var hi_rtp := float(hi[0] + hi[1]) / (m * tb)
	var lo_rtp := float(lo[0] + lo[1]) / (m * Rules.total_bet(Rules.BET_LEVELS[0]))
	print("same boards: RTP %.4f at 0.20 per line, %.4f at 0.05 per line" % [hi_rtp, lo_rtp])
	check(absf(hi_rtp - lo_rtp) < 0.01, "the lowest bet returns the same as higher bets (%.4f vs %.4f)" % [lo_rtp, hi_rtp])


func test_enemies() -> void:
	var bosses := []
	for k in 2 * Rules.BOSS_EVERY:
		if Rules.spawn_enemy(k, 1).boss:
			bosses.append(k)
	check(bosses == [Rules.BOSS_EVERY - 1, 2 * Rules.BOSS_EVERY - 1], "every fifth enemy is the stage boss")
	var wolf := Rules.spawn_enemy(0, 5)
	check(wolf.max_hp == roundi(Rules.ENEMIES[wolf.kind].hp * Rules.total_bet(5)), "enemy hp scales with the total bet")
	# 每關換一組怪：三關的怪都不一樣，第四關回到第一關的名單
	var kinds := []
	for k in 4 * Rules.BOSS_EVERY:
		kinds.append(Rules.spawn_enemy(k, 1).kind)
	check(kinds.slice(0, 7) == ["squirrel", "hedgehog", "raccoon", "squirrel", "hedgehog", "raccoon", "bear"], "stage 1 is the forest path crew, the bear is its boss (%s)" % [kinds.slice(0, 7)])
	check(Rules.episode(1) == 1 and Rules.episode(99) == 99 and Rules.episode(100) == 1 and Rules.episode(198) == 99 and Rules.episode(199) == 1 and Rules.stage_name(100) == Rules.stage_name(1), "EP99 is followed by EP01 with the same scene")
	check(kinds[7] == "frog" and kinds[13] == "stag" and kinds[14] == "mouse" and kinds[20] == "knock" and kinds.slice(21, 28) == kinds.slice(0, 7), "stages rotate through the story")
	# 打怪的回收率不變：每一關的總賞金 ÷ 總血量跟改版前（4 隻 3 倍血 0.4 倍賞金的大野狼 + 10 倍血 2.5 倍賞金的狼王）一樣
	for s in Rules.STAGES.size():
		var hp := 0
		var pay := 0
		for k in Rules.BOSS_EVERY:
			var e := Rules.spawn_enemy(s * Rules.BOSS_EVERY + k, 200)
			hp += e.max_hp
			pay += e.reward
		var old := (4 * 0.4 + 2.5) / (4 * 3.0 + 10.0)
		check(absf(float(pay) / hp - old) < 0.002, "stage %d pays %.4f per damage (was %.4f)" % [s + 1, float(pay) / hp, old])
	# 第 3 關 BOSS 兩階段：敲門的狼打倒後變身成外婆，兩段各一條 BOSS 血條、各給一次 BOSS 賞金
	var knock := Rules.make_enemy("knock", 200)
	var granny := Rules.make_enemy(knock.next, 200)
	var bear := Rules.make_enemy("bear", 200)
	check(knock.next == "boss" and granny.next == "" and knock.max_hp == bear.max_hp and granny.max_hp == bear.max_hp and knock.reward == bear.reward and granny.reward == bear.reward, "the knocking wolf turns into Grandma: two full boss HP bars, two boss rewards")
	# EXTRA 模式的寶箱怪：血量跟 BOSS 一樣、不掉金幣（掉 WILD），不是 BOSS
	var chest := Rules.make_enemy("chest", 200)
	var boss := Rules.make_enemy("bear", 200)
	check(chest.treasure and not chest.boss and chest.max_hp == boss.max_hp and chest.reward == 0, "the treasure chest has the boss HP and drops no coins")
	# 寶箱怪掉的 WILD：1～3 格、只落在中間三軸、不落在 WILD 或 SCATTER 上、不重複
	var wrng := RandomNumberGenerator.new()
	wrng.seed = 77
	var counts := {}
	var ok := true
	for n in 3000:
		var board := Rules.spin_board(wrng)
		var cells := Rules.drop_wilds(board, wrng)
		counts[cells.size()] = counts.get(cells.size(), 0) + 1
		var seen := {}
		for i in cells:
			var c: int = i % Rules.COLS
			ok = ok and c >= 1 and c <= 3 and not seen.has(i) and not Rules.is_wild(board[i].id) and not Rules.is_scatter(board[i].id)
			seen[i] = true
		var after := Rules.with_wilds(board, cells)
		for i in Rules.CELLS:
			ok = ok and (Rules.is_wild(after[i].id) if seen.has(i) else after[i] == board[i])
	check(ok, "dropped WILDs land only on middle-reel cells that are not WILD or SCATTER")
	check(counts.keys().all(func(k): return k >= 1 and k <= 3) and counts.size() == 3, "a chest drops 1 to 3 WILDs (%s)" % [counts])
	# Feature Buy：起手盤面一定有 3 個以上 SCATTER，連鎖完一定進 EXTRA；價錢是總押注的 BUY_COST 倍
	var brng := RandomNumberGenerator.new()
	brng.seed = 5
	var always := true
	for n in 300:
		var start := Rules.buy_board(brng)
		always = always and Rules.scatters(start).size() >= 3 and Rules.resolve(start, brng, 20).triggered
	check(always, "a Feature Buy always triggers EXTRA")
	check(Rules.buy_cost(20) == Rules.BUY_COST * Rules.total_bet(20), "the Feature Buy costs %d× the total bet" % Rules.BUY_COST)
	check(not Rules.hit(wolf, Rules.base_attack(5)), "a base attack alone does not kill")
	check(Rules.hit(wolf, 100000) and wolf.hp == 0, "a big win defeats the enemy")


func test_xp() -> void:
	var hero := {"level": 1, "xp": 0}
	check(Rules.gain_xp(hero, Rules.xp_to_next(1) + 1) == 1, "one level up")
	check(hero.level == 2 and hero.xp == 1, "experience carries over")


func test_money() -> void:
	var cases := {20: "0.2", 40: "0.4", 100: "1", 150: "1.5", 125: "1.25", 5: "0.05", 200000: "2,000", 123456: "1,234.56", 0: "0"}
	for cents in cases:
		check(Art.money(cents) == cases[cents], "money %d shows %s (got %s)" % [cents, cases[cents], Art.money(cents)])
