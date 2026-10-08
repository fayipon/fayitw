# 自走SLOT 的遊戲規則：純計算、不碰畫面；隨機數一律從傳進來的 RandomNumberGenerator 取，測試可以重現
# - 盤面 5 軸 × 4 列，1024 路：同一個符號從最左邊一軸起連續出現 3 軸以上就中獎，每一軸出現幾格就乘幾路
# - 連鎖消除（參考 Pinata Wins）：中獎的格子消掉、上面的往下掉、空位補新符號，一直連到沒有中獎；
#   第 1、2、3、4 段以後分別乘 MULTIPLIERS 的倍率，整串連鎖結束才一次結算
# - 中間三軸的一般符號可能帶金框：金框符號中獎時不消失，而是變成皇冠 WILD 留在原位
# - 皇冠是 WILD（只在中間三軸）；外婆家是 BONUS，每軸最多一個，連鎖完的盤面上 3 個以上觸發小遊戲。
#   小遊戲還沒做，先依 3／4／5 個直接給總押注的 BONUS_PRIZE 倍
# - 總押注 = BET × 20；賠率表的單位是 BET（每一路）
# - 自走打怪：每一轉贏的金幣就是傷害，再加一次基本攻擊；敵人血量與賞金是出現當下總押注的倍數
# - 盤面每一格是 { id, gold }；照現在的權重模擬：連線回收約 72%、BONUS 約 12%、打怪賞金約 8%
extends RefCounted

const COLS := 5
const ROWS := 4
const CELLS := COLS * ROWS
const BASE_BET := 20
const BET_LEVELS := [1, 2, 5, 10, 20, 50]
const START_COINS := 10000
const REFILL := 5000
const MULTIPLIERS := [1, 2, 3, 5]
const GOLD_CHANCE := 0.1
const MAX_STEPS := 40

# pays：3 連／4 連／5 連，每一路的分數（單位 BET）
const SYMBOLS := {
	"ten": {"name": "10", "pays": [1, 2, 5]},
	"jack": {"name": "J", "pays": [1, 2, 5]},
	"queen": {"name": "Q", "pays": [1, 3, 6]},
	"king": {"name": "K", "pays": [1, 3, 6]},
	"ace": {"name": "A", "pays": [2, 4, 7]},
	"rabbit": {"name": "Bunny", "pays": [2, 6, 12]},
	"pie": {"name": "Cherry Pie", "pays": [3, 7, 15]},
	"basket": {"name": "Picnic Basket", "pays": [4, 9, 18]},
	"wolf": {"name": "Big Bad Wolf", "pays": [7, 18, 45]},
	"hood": {"name": "Red Hood", "pays": [12, 30, 75]},
	"cottage": {"name": "Grandma's House", "bonus": true},
	"crown": {"name": "Crown", "wild": true},
}
const SYMBOL_IDS := ["ten", "jack", "queen", "king", "ace", "rabbit", "pie", "basket", "wolf", "hood", "cottage", "crown"]
const ROYALS := ["ten", "jack", "queen", "king", "ace"]
const BONUS_PRIZE := {3: 12, 4: 30, 5: 100}

# 每一軸各符號的權重；百搭只在第 2～4 軸
const EDGE := {"ten": 13.0, "jack": 13.0, "queen": 12.0, "king": 12.0, "ace": 11.0, "rabbit": 9.0, "pie": 8.0, "basket": 8.0, "wolf": 6.0, "hood": 5.0, "cottage": 2.2, "crown": 0.0}
const MID := {"ten": 13.0, "jack": 13.0, "queen": 12.0, "king": 12.0, "ace": 11.0, "rabbit": 9.0, "pie": 8.0, "basket": 8.0, "wolf": 6.0, "hood": 5.0, "cottage": 2.2, "crown": 2.0}

const ENEMIES := {
	"wolf": {"name": "Big Bad Wolf", "hp": 3.0, "reward": 0.4, "xp": 1},
	"boss": {"name": "Wolf King", "hp": 10.0, "reward": 2.5, "xp": 4},
}
const BOSS_EVERY := 5
const BASE_ATTACK := 0.2


static func total_bet(bet: int) -> int:
	return bet * BASE_BET


static func xp_to_next(level: int) -> int:
	return 2 + level * 2


static func is_wild(id: String) -> bool:
	return SYMBOLS[id].get("wild", false)


static func is_bonus(id: String) -> bool:
	return SYMBOLS[id].get("bonus", false)


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


# 抽一格；no_bonus 時 BONUS 重抽（每一軸最多一個），金框只出現在中間三軸的一般符號
static func draw_cell(reel: int, rng: RandomNumberGenerator, no_bonus := false) -> Dictionary:
	var id := draw_symbol(reel, rng)
	while no_bonus and is_bonus(id):
		id = draw_symbol(reel, rng)
	var plain := not is_wild(id) and not is_bonus(id)
	return {"id": id, "gold": plain and reel >= 1 and reel <= 3 and rng.randf() < GOLD_CHANCE}


# 盤面依列存：board[row * COLS + col]
static func spin_board(rng: RandomNumberGenerator) -> Array:
	var board := []
	board.resize(CELLS)
	for c in COLS:
		var has_bonus := false
		for r in ROWS:
			var cell := draw_cell(c, rng, has_bonus)
			has_bonus = has_bonus or is_bonus(cell.id)
			board[r * COLS + c] = cell
	return board


# 算 1024 路：wins 是每個中獎符號的 { symbol, reels, ways, amount, cells }（amount 已乘 BET），
# 另外回傳盤面上的 BONUS 格子，3 個以上 triggered 為 true
static func evaluate(board: Array, bet: int) -> Dictionary:
	var wins := []
	var total := 0
	for id in SYMBOL_IDS:
		if is_wild(id) or is_bonus(id):
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
			var amount: int = SYMBOLS[id].pays[reels - 3] * ways * bet
			wins.append({"symbol": id, "reels": reels, "ways": ways, "amount": amount, "cells": cells})
			total += amount
	wins.sort_custom(func(a, b): return a.amount > b.amount)
	var bonus := []
	for i in CELLS:
		if is_bonus(board[i].id):
			bonus.append(i)
	return {"wins": wins, "total": total, "bonus": bonus, "triggered": bonus.size() >= 3}


# 轉一次，連鎖到沒有中獎為止。每一段 step：
#   board 這段開始的盤面、wins／base 這段的中獎（未乘倍率）、mult 倍率、win = base × mult、
#   cells 中獎格子、removed 消掉的格子、to_wild 金框變百搭的格子、
#   moves 往下掉的 { col, from, to }（列）、added 補進來的 { col, row, cell }、next 掉完的盤面
static func play(rng: RandomNumberGenerator, bet: int) -> Dictionary:
	return resolve(spin_board(rng), rng, bet)


# 從指定盤面開始連鎖（測試用固定盤面）
static func resolve(start: Array, rng: RandomNumberGenerator, bet: int) -> Dictionary:
	var steps := []
	var board := start
	var total := 0
	for k in MAX_STEPS:
		var ev := evaluate(board, bet)
		if ev.wins.is_empty():
			break
		var mult: int = MULTIPLIERS[mini(k, MULTIPLIERS.size() - 1)]
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
				next[i] = {"id": "crown", "gold": false}
				to_wild.append(i)
			else:
				next[i] = null
				removed.append(i)
		for c in COLS:
			var keep := []
			for r in range(ROWS - 1, -1, -1):
				if next[r * COLS + c] != null:
					keep.append({"cell": next[r * COLS + c], "from": r})
			var has_bonus := false
			for kept in keep:
				has_bonus = has_bonus or is_bonus(kept.cell.id)
			var n := 0
			for r in range(ROWS - 1, -1, -1):
				var i := r * COLS + c
				if n < keep.size():
					next[i] = keep[n].cell
					if keep[n].from != r:
						moves.append({"col": c, "from": keep[n].from, "to": r})
				else:
					var cell := draw_cell(c, rng, has_bonus)
					has_bonus = has_bonus or is_bonus(cell.id)
					next[i] = cell
					added.append({"col": c, "row": r, "cell": cell})
				n += 1
		var win: int = ev.total * mult
		steps.append({"board": board, "wins": ev.wins, "base": ev.total, "mult": mult, "win": win,
			"cells": cells, "removed": removed, "to_wild": to_wild, "moves": moves, "added": added, "next": next})
		total += win
		board = next
	var bonus := []
	for i in CELLS:
		if is_bonus(board[i].id):
			bonus.append(i)
	return {"start": start, "steps": steps, "total": total, "final": board, "bonus": bonus, "triggered": bonus.size() >= 3}


static func bonus_prize(count: int, bet: int) -> int:
	return BONUS_PRIZE.get(count, 0) * total_bet(bet)


static func spawn_enemy(count: int, bet: int) -> Dictionary:
	var kind := "boss" if (count + 1) % BOSS_EVERY == 0 else "wolf"
	var e: Dictionary = ENEMIES[kind]
	var tb := total_bet(bet)
	var hp := roundi(e.hp * tb)
	return {"kind": kind, "name": e.name, "hp": hp, "max_hp": hp, "reward": roundi(e.reward * tb), "xp": e.xp}


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
