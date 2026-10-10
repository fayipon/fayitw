# HG-Fable01 -小紅帽 的遊戲規則：純計算、不碰畫面；隨機數一律從傳進來的 RandomNumberGenerator 取，測試可以重現
# - 盤面 5 軸 × 4 列，1024 路：同一個符號從最左邊一軸起連續出現 3 軸以上就中獎，每一軸出現幾格就乘幾路
# - 連鎖消除（參考 Pinata Wins）：中獎的格子消掉、上面的往下掉、空位補新符號，一直連到沒有中獎；
#   第 1、2、3、4 段以後分別乘 MULTIPLIERS 的倍率，整串連鎖結束才一次結算
# - 中間三軸的一般符號可能帶金框：金框符號中獎時不消失，而是變成小紅帽 WILD 留在原位
# - 小紅帽是 WILD（只在第 2～4 軸，代替 SCATTER 以外的符號）；金鑰匙是 SCATTER（出現在哪都算），
#   每軸最多一個，連鎖完的盤面上 3／4／5 個依 SCATTER_PAYS 給總押注的倍數，並觸發 8／10／12 次 Free Spins
# - Free Spins（EXTRA）不扣押注，連鎖倍率換成 FS_MULTIPLIERS，而且整段 EXTRA 一路累積不歸零：每連鎖一段就往上爬一格，
#   下一轉接著上一轉爬到的那一格（resolve 的 level）；免費轉中再出 3 個以上 SCATTER 會加次數
# - 金額一律用「分」記（整數，畫面上 ÷ 100 顯示兩位小數）。押注照 PG Soft：總押注 = 每線押注 × 20 線，
#   每線押注 BET_LEVELS 從 0.05 到 10.00（總押注 1.00～200.00）
# - 賠率表 pays 是每一路在每線押注 20 時贏的金額（跟美術給的 paytable 同一組數字），
#   實際 = pays × 路數 × 每線押注 ÷ 20。押注小的時候會有不到 1 分的零頭：每一段連鎖算完（含倍率）才四捨五入到分，
#   所以最低押注的回收率跟高押注幾乎一樣（測試會比對）。
#   符號組照介面設計稿（狼、烏鴉、提燈、籃子、藥水、金鑰匙、小紅帽）；藥水用 paytable 上魔法書那一級
# - 自走打怪：每一轉贏的金幣就是傷害，再加一次基本攻擊；敵人血量與賞金是出現當下總押注的倍數。
#   傷害不浪費：沒有狼可以打時（走路中、剛打倒）打的、打倒時多出來的都存起來，下一隻站定就一次打出去
#   （存與放在 main.gd）。賞金 ÷ 血量跟押注無關，所以換押注不會多賺或少賺
# - 盤面每一格是 { id, gold }；照現在的權重模擬：主遊戲約 70%、打怪賞金約 17.5%、EXTRA 約 10%（合計約 97.5%），
#   EXTRA 大約每 400 轉一次、一次平均總押注約 37 倍（倍率累積、寶箱怪掉的 WILD 下一轉落，數字在 README）
extends RefCounted

const COLS := 5
const ROWS := 4
const CELLS := COLS * ROWS
const BASE_BET := 20
const PAY_DIV := 20
# 每線押注（分）：0.05、0.10、0.20、0.50、1.00、2.00、5.00、10.00
const BET_LEVELS := [5, 10, 20, 50, 100, 200, 500, 1000]
const DEFAULT_BET := 1
const START_COINS := 200000
const REFILL := 100000
const MULTIPLIERS := [1, 2, 3, 5]
# EXTRA 的倍率梯：每連鎖一段往上爬一格、整段 EXTRA 不歸零，爬到最後一格就停在那裡
const FS_MULTIPLIERS := [2, 3, 4, 5, 6, 8, 10]
const FS_AWARD := {3: 8, 4: 10, 5: 12}
# Feature Buy 的價錢是總押注的幾倍：照設計定 150 倍（總押注 2 時是 300）。一次購買平均拿回總押注約 39 倍（模擬見 README），所以購買本身是虧的
const BUY_COST := 150
# SCATTER 的獎金：總押注 × 這個數 ÷ 20（3 個 = 0.25 倍、4 個 = 1 倍、5 個 = 5 倍）
const SCATTER_PAYS := {3: 5, 4: 20, 5: 100}
# 金框的機率（中間三軸的一般符號）：影響很大，0.105 時整體約 97.5%，降到 0.07 會掉到 81%
const GOLD_CHANCE := 0.105
const MAX_STEPS := 40

# pays：3 連／4 連／5 連
const SYMBOLS := {
	"ten": {"name": "10", "pays": [20, 40, 100]},
	"jack": {"name": "J", "pays": [20, 40, 100]},
	"queen": {"name": "Q", "pays": [20, 40, 100]},
	"king": {"name": "K", "pays": [25, 60, 150]},
	"ace": {"name": "A", "pays": [25, 60, 150]},
	"potion": {"name": "Heart Potion", "pays": [30, 80, 200]},
	"basket": {"name": "Basket", "pays": [40, 100, 250]},
	"lantern": {"name": "Lantern", "pays": [50, 120, 300]},
	"raven": {"name": "Raven", "pays": [55, 140, 350]},
	"wolf": {"name": "Big Bad Wolf", "pays": [60, 160, 400]},
	"key": {"name": "Golden Key", "scatter": true},
	"hood": {"name": "Red Hood", "wild": true},
}
const SYMBOL_IDS := ["ten", "jack", "queen", "king", "ace", "potion", "basket", "lantern", "raven", "wolf", "key", "hood"]
const ROYALS := ["ten", "jack", "queen", "king", "ace"]

# 每一軸各符號的權重；百搭只在第 2～4 軸
const EDGE := {"ten": 13.0, "jack": 13.0, "queen": 12.0, "king": 12.0, "ace": 11.0, "potion": 9.0, "basket": 8.0, "lantern": 8.0, "raven": 6.0, "wolf": 5.0, "key": 1.35, "hood": 0.0}
const MID := {"ten": 13.0, "jack": 13.0, "queen": 12.0, "king": 12.0, "ace": 11.0, "potion": 9.0, "basket": 8.0, "lantern": 8.0, "raven": 6.0, "wolf": 5.0, "key": 1.35, "hood": 3.0}

# 敵人（照小紅帽劇本）：每關 7 隻，前 6 隻是被大野狼使喚的森林小動物（每關 3 種，照 STAGE_ORDER 輪流出），
# 第 7 隻是這一關的 BOSS——第 1 關大棕熊、第 2 關大雄鹿、第 3 關是大灰狼，分兩階段：先披紅斗篷學小紅帽敲門（knock），
# 打倒給一次賞金，接著原地變身成外婆（next = "boss"，血條補滿），外婆剩一半血露餡，打倒再給一次賞金才算過關。
# hp 是總押注的倍數；小動物的賞金 = hp × MINION_RATE（跟改版前大野狼 3 倍血、0.4 倍賞金一樣的比例），
# 每關 6 隻小動物的血量加起來 12 倍（跟改版前 4 隻 3 倍血的大野狼一樣），BOSS 的血量與賞金跟改版前的狼王一樣，
# 所以打怪的回收率跟改版前一樣。
# EXTRA 模式（Free Spins）出場的是寶箱怪：血量跟 BOSS 一樣（總押注 × 10）、不掉金幣，打倒時掉 WILD——
# 下一轉轉輪停下時，盤面上隨機 1～3 格落下小紅帽 WILD（drop_wilds），連鎖照落下後的盤面算；一轉落一次，打爆好幾隻就排著；寶箱怪不算關卡進度
const MINION_RATE := 0.4 / 3.0
# 寶箱怪掉的 WILD 一次落幾個（含兩端）
const WILD_DROP := [1, 3]
const ENEMIES := {
	"squirrel": {"name": "Sneaky Squirrel", "hp": 1.5, "xp": 1},
	"hedgehog": {"name": "Prickly Hedgehog", "hp": 2.0, "xp": 1},
	"raccoon": {"name": "Bandit Raccoon", "hp": 2.5, "xp": 1},
	"frog": {"name": "Cheeky Frog", "hp": 1.5, "xp": 1},
	"hare": {"name": "Cheeky Hare", "hp": 2.0, "xp": 1},
	"fox": {"name": "Sly Fox", "hp": 2.5, "xp": 1},
	"mouse": {"name": "Greedy Mouse", "hp": 1.5, "xp": 1},
	"raven": {"name": "Spy Raven", "hp": 2.0, "xp": 1},
	"boar": {"name": "Wild Boar", "hp": 2.5, "xp": 1},
	"bear": {"name": "Honey Bear", "hp": 10.0, "reward": 2.5, "xp": 4, "boss": true},
	"stag": {"name": "Grumpy Stag", "hp": 10.0, "reward": 2.5, "xp": 4, "boss": true},
	"knock": {"name": "Knocking Wolf", "hp": 10.0, "reward": 2.5, "xp": 4, "boss": true, "next": "boss"},
	"boss": {"name": "Grandma?", "hp": 10.0, "reward": 2.5, "xp": 4, "boss": true},
	"chest": {"name": "Treasure Chest", "hp": 10.0, "reward": 0.0, "xp": 1, "treasure": true},
}
# 三關輪流：林間小路、花田、外婆家門口；每關的 [小動物 ×3, BOSS]
const STAGES := [["squirrel", "hedgehog", "raccoon", "bear"], ["frog", "hare", "fox", "stag"], ["mouse", "raven", "boar", "knock"]]
const STAGE_NAMES := ["The Forest Path", "The Flower Meadow", "Grandma's House"]
const STAGE_ORDER := [0, 1, 2, 0, 1, 2]
const BOSS_EVERY := 7
# 場景編號 EP01～EP99，EP99 之後回到 EP01（99 是 3 的倍數，所以回到 EP01 時場景、怪物也剛好回到第 1 關）
const EP_MAX := 99
const BASE_ATTACK := 0.2


static func total_bet(bet: int) -> int:
	return bet * BASE_BET


static func xp_to_next(level: int) -> int:
	return 2 + level * 2


static func is_wild(id: String) -> bool:
	return SYMBOLS[id].get("wild", false)


static func is_scatter(id: String) -> bool:
	return SYMBOLS[id].get("scatter", false)


static func draw_symbol(reel: int, rng: RandomNumberGenerator) -> String:
	var weights: Dictionary = MID if reel >= 1 and reel <= 3 else EDGE
	var sum := 0.0
	for id in SYMBOL_IDS:
		sum += weights[id]
	var roll := rng.randf() * sum
	for id in SYMBOL_IDS:
		roll -= weights[id]
		if roll < 0.0:
			return id
	return SYMBOL_IDS[0]


# 抽一格；no_scatter 時 SCATTER 重抽（每一軸最多一個），金框只出現在中間三軸的一般符號
static func draw_cell(reel: int, rng: RandomNumberGenerator, no_scatter := false) -> Dictionary:
	var id := draw_symbol(reel, rng)
	while no_scatter and is_scatter(id):
		id = draw_symbol(reel, rng)
	var plain := not is_wild(id) and not is_scatter(id)
	return {"id": id, "gold": plain and reel >= 1 and reel <= 3 and rng.randf() < GOLD_CHANCE}


# 盤面依列存：board[row * COLS + col]
static func spin_board(rng: RandomNumberGenerator) -> Array:
	var board := []
	board.resize(CELLS)
	for c in COLS:
		var has_scatter := false
		for r in ROWS:
			var cell := draw_cell(c, rng, has_scatter)
			has_scatter = has_scatter or is_scatter(cell.id)
			board[r * COLS + c] = cell
	return board


# 算 1024 路：wins 是每個中獎符號的 { symbol, reels, ways, amount, cells }（amount 是分，可能有零頭），
# raw 是這一盤的總贏分 × 20（整數，沒有零頭），total 是四捨五入到分；
# 另外回傳盤面上的 SCATTER 格子，3 個以上 triggered 為 true
static func evaluate(board: Array, bet: int) -> Dictionary:
	var wins := []
	var raw := 0
	for id in SYMBOL_IDS:
		if is_wild(id) or is_scatter(id):
			continue
		var cells := []
		var ways := 1
		var reels := 0
		for c in COLS:
			var hit := []
			for r in ROWS:
				var s: String = board[r * COLS + c].id
				if s == id or is_wild(s):
					hit.append(r * COLS + c)
			if hit.is_empty():
				break
			ways *= hit.size()
			reels += 1
			cells.append_array(hit)
		# 第一軸沒有百搭，所以第一軸一定是這個符號本身
		if reels >= 3:
			var r: int = SYMBOLS[id].pays[reels - 3] * bet * ways
			wins.append({"symbol": id, "reels": reels, "ways": ways, "amount": r / float(PAY_DIV), "cells": cells})
			raw += r
	wins.sort_custom(func(a, b): return a.amount > b.amount)
	var scatter := scatters(board)
	return {"wins": wins, "raw": raw, "total": roundi(raw / float(PAY_DIV)), "scatter": scatter, "triggered": scatter.size() >= 3}


# 一路 n 連在這個每線押注贏多少分（可能有零頭；賠率表上顯示的也是這個數）
static func pay(id: String, reels: int, bet: int) -> float:
	return SYMBOLS[id].pays[reels - 3] * bet / float(PAY_DIV)


static func scatters(board: Array) -> Array:
	var out := []
	for i in CELLS:
		if is_scatter(board[i].id):
			out.append(i)
	return out


# 轉一次，連鎖到沒有中獎為止。每一段 step：
#   board 這段開始的盤面、wins／base 這段的中獎（未乘倍率，raw 是 × 20 的整數）、mult 倍率、
#   win = raw × mult ÷ 20 四捨五入到分、
#   cells 中獎格子、removed 消掉的格子、to_wild 金框變百搭的格子、
#   moves 往下掉的 { col, from, to }（列）、added 補進來的 { col, row, cell }、next 掉完的盤面
# free = true 是 Free Spins：倍率用 FS_MULTIPLIERS（從第一格開始；EXTRA 裡接著爬的用 resolve 的 level）
static func play(rng: RandomNumberGenerator, bet: int, free := false) -> Dictionary:
	return resolve(spin_board(rng), rng, bet, FS_MULTIPLIERS if free else MULTIPLIERS)


# 從指定盤面開始連鎖（測試用固定盤面）
# level 是倍率梯從第幾格開始（EXTRA 裡接著上一轉爬到的那一格）；回傳的 level 是連完之後爬到第幾格
static func resolve(start: Array, rng: RandomNumberGenerator, bet: int, mults: Array = MULTIPLIERS, level := 0) -> Dictionary:
	var steps := []
	var board := start
	var total := 0
	for k in MAX_STEPS:
		var ev := evaluate(board, bet)
		if ev.wins.is_empty():
			break
		var mult: int = mults[mini(level + k, mults.size() - 1)]
		var marked := {}
		for w in ev.wins:
			for i in w.cells:
				marked[i] = true
		var cells: Array = marked.keys()
		cells.sort()
		var next := board.duplicate()
		var removed := []
		var to_wild := []
		var moves := []
		var added := []
		for i in cells:
			if board[i].gold:
				next[i] = {"id": "hood", "gold": false}
				to_wild.append(i)
			else:
				next[i] = null
				removed.append(i)
		for c in COLS:
			var keep := []
			for r in range(ROWS - 1, -1, -1):
				if next[r * COLS + c] != null:
					keep.append({"cell": next[r * COLS + c], "from": r})
			var has_scatter := false
			for kept in keep:
				has_scatter = has_scatter or is_scatter(kept.cell.id)
			var n := 0
			for r in range(ROWS - 1, -1, -1):
				var i := r * COLS + c
				if n < keep.size():
					next[i] = keep[n].cell
					if keep[n].from != r:
						moves.append({"col": c, "from": keep[n].from, "to": r})
				else:
					var cell := draw_cell(c, rng, has_scatter)
					has_scatter = has_scatter or is_scatter(cell.id)
					next[i] = cell
					added.append({"col": c, "row": r, "cell": cell})
				n += 1
		var win: int = roundi(ev.raw * mult / float(PAY_DIV))
		steps.append({"board": board, "wins": ev.wins, "base": ev.total, "raw": ev.raw, "mult": mult, "win": win,
			"cells": cells, "removed": removed, "to_wild": to_wild, "moves": moves, "added": added, "next": next})
		total += win
		board = next
	var scatter := scatters(board)
	return {"start": start, "steps": steps, "total": total, "final": board, "scatter": scatter, "triggered": scatter.size() >= 3, "level": level + steps.size()}


static func buy_cost(bet: int) -> int:
	return BUY_COST * total_bet(bet)


# Feature Buy：抽盤面直到起手就有 3 個以上 SCATTER（跟自然觸發的那一轉同一個分布），之後照一般的一轉連鎖、進 EXTRA
static func buy_board(rng: RandomNumberGenerator) -> Array:
	var board := spin_board(rng)
	while scatters(board).size() < 3:
		board = spin_board(rng)
	return board


# 寶箱怪掉的 WILD 落在哪幾格：1～3 格，只落在中間三軸（WILD 本來就只出現在第 2～4 軸，第一軸沒有百搭），
# 原本是 WILD 或 SCATTER 的格子不落；回傳格子編號（由小到大）
static func drop_wilds(board: Array, rng: RandomNumberGenerator) -> Array:
	var free_cells := []
	for i in CELLS:
		var c := i % COLS
		if c >= 1 and c <= 3 and not is_wild(board[i].id) and not is_scatter(board[i].id):
			free_cells.append(i)
	var out := []
	for k in mini(rng.randi_range(WILD_DROP[0], WILD_DROP[1]), free_cells.size()):
		out.append(free_cells.pop_at(rng.randi_range(0, free_cells.size() - 1)))
	out.sort()
	return out


# 盤面落下 WILD 之後的樣子（不動原本的盤面）
static func with_wilds(board: Array, cells: Array) -> Array:
	var out := board.duplicate()
	for i in cells:
		out[i] = {"id": "hood", "gold": false}
	return out


static func scatter_pay(count: int, bet: int) -> int:
	return SCATTER_PAYS.get(mini(count, 5), 0) * total_bet(bet) / 20


static func free_spins(count: int) -> int:
	return FS_AWARD.get(mini(count, 5), 0)


# 第 count 隻敵人（從 0 算）：每 BOSS_EVERY 隻一關，前 4 隻照 STAGE_ORDER 從這一關的名單出，第 5 隻是王
static func spawn_enemy(count: int, bet: int) -> Dictionary:
	var stage := count / BOSS_EVERY
	var slot := count % BOSS_EVERY
	var crew: Array = STAGES[stage % STAGES.size()]
	var kind: String = crew[3] if slot == BOSS_EVERY - 1 else crew[STAGE_ORDER[slot]]
	return make_enemy(kind, bet)


# 照種類做出一隻敵人（血量、賞金是總押注的倍數）
static func make_enemy(kind: String, bet: int) -> Dictionary:
	var e: Dictionary = ENEMIES[kind]
	var tb := total_bet(bet)
	var hp := roundi(e.hp * tb)
	var reward: float = e.get("reward", e.hp * MINION_RATE)
	return {"kind": kind, "name": e.name, "hp": hp, "max_hp": hp, "reward": roundi(reward * tb), "xp": e.xp, "boss": e.get("boss", false), "treasure": e.get("treasure", false), "next": e.get("next", "")}


# 第 stage 關（從 1 算）畫面上的場景編號：1～EP_MAX 一直輪
static func episode(stage: int) -> int:
	return (stage - 1) % EP_MAX + 1


# 第 stage 關（從 1 算）的地點名稱
static func stage_name(stage: int) -> String:
	return STAGE_NAMES[(stage - 1) % STAGE_NAMES.size()]


# 打一下：回傳這一下的傷害與是否打倒
static func hit(enemy: Dictionary, damage: int) -> bool:
	enemy.hp = maxi(0, enemy.hp - damage)
	return enemy.hp == 0


static func base_attack(bet: int) -> int:
	return roundi(BASE_ATTACK * total_bet(bet))


# 加經驗值，回傳升了幾級
static func gain_xp(hero: Dictionary, xp: int) -> int:
	hero.xp += xp
	var ups := 0
	while hero.xp >= xp_to_next(hero.level):
		hero.xp -= xp_to_next(hero.level)
		hero.level += 1
		ups += 1
	return ups
