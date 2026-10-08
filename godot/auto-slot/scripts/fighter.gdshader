// 角色立繪用：tint 染色、flash 被打時閃紅、dissolve 從雜訊邊緣燒掉（燒的邊緣發橘紅光）
shader_type canvas_item;

uniform vec4 tint : source_color = vec4(1.0);
uniform float flash : hint_range(0.0, 1.0) = 0.0;
uniform float dissolve : hint_range(0.0, 1.0) = 0.0;

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

void fragment() {
	// COLOR 已經是貼圖 × 節點的 modulate（淡入淡出要靠它）
	vec4 c = COLOR * tint;
	c.rgb = mix(c.rgb, vec3(1.0, 0.18, 0.12), flash * 0.65);
	if (dissolve > 0.0) {
		float n = noise(UV * 9.0) * 0.6 + noise(UV * 23.0) * 0.4;
		float edge = n - dissolve * 1.15;
		if (edge < 0.0) {
			c.a = 0.0;
		} else if (edge < 0.08) {
			c.rgb = mix(vec3(1.0, 0.45, 0.1), vec3(0.6, 0.05, 0.02), edge / 0.08);
		}
	}
	COLOR = c;
}
