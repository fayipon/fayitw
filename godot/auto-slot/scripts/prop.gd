# 前景經過的紙板立牌道具（紅蘑菇、小白花、提燈）：白色切邊、背後一層棕色紙板厚度，插在小木樁上
extends Node2D

const OUTLINE := preload("res://scripts/outline.gdshader")

var tex: Texture2D
var h := 80.0


func _init(texture: Texture2D, height: float) -> void:
	tex = texture
	h = height


func _ready() -> void:
	var s := h / tex.get_height()
	var top := Vector2(-tex.get_width() * s / 2.0, -h - h * 0.16)
	for layer in [[Vector2(4, 5), true], [Vector2.ZERO, false]]:
		var sp := Sprite2D.new()
		sp.texture = tex
		sp.centered = false
		sp.scale = Vector2(s, s)
		sp.position = top + layer[0]
		var mat := ShaderMaterial.new()
		mat.shader = OUTLINE
		mat.set_shader_parameter("width", 2.6 / s)
		mat.set_shader_parameter("silhouette", layer[1])
		mat.set_shader_parameter("outline_color", Color(0.42, 0.28, 0.16) if layer[1] else Color.WHITE)
		sp.material = mat
		add_child(sp)


func _draw() -> void:
	# 木樁與底座（畫在立牌後面）
	draw_rect(Rect2(-3, -h * 0.22, 6, h * 0.22), Color("7a4e26"))
	draw_rect(Rect2(-h * 0.16, -4, h * 0.32, 6), Color("5a3416"))
