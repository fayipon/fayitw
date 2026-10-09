// 角色外圍的柔光（SCATTER 點燃劍時小紅帽身上泛出的火光）：畫在角色後面、比圖大一圈的方塊上，
// 取周圍兩圈、各 12 個方向的不透明度平均，得到往外暈開的輪廓光；圖的範圍外當作透明（不會被圖邊切成直線）
shader_type canvas_item;
render_mode blend_add;

uniform vec4 glow_color : source_color = vec4(1.0, 0.55, 0.15, 1.0);
uniform float strength = 0.0;
// 方塊每邊比圖多出的比例（以圖的寬、高為 1）
uniform vec2 pad = vec2(0.06, 0.06);
// 暈開的半徑（以圖寬為 1）；aspect = 寬 / 高，讓上下左右暈得一樣遠
uniform float radius = 0.035;
uniform float aspect = 1.0;

void fragment() {
	vec2 t = UV * (1.0 + 2.0 * pad) - pad;
	float acc = 0.0;
	for (int i = 0; i < 24; i++) {
		float ang = float(i % 12) * 0.5236;
		vec2 q = t + vec2(cos(ang), sin(ang) * aspect) * radius * (i < 12 ? 1.0 : 0.45);
		// 圖的範圍外當作透明
		float inside = step(0.0, q.x) * step(0.0, q.y) * step(q.x, 1.0) * step(q.y, 1.0);
		acc += texture(TEXTURE, q).a * inside;
	}
	acc /= 24.0;
	COLOR = vec4(glow_color.rgb, acc * strength);
}
