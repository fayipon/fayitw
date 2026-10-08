// 紙板立牌的白色切邊：往 12 個方向取樣 alpha，向外描一圈；silhouette 時整塊塗成 outline_color（當紙板厚度用）
shader_type canvas_item;

uniform vec4 outline_color : source_color = vec4(1.0);
uniform float width = 6.0;
uniform bool silhouette = false;

void fragment() {
	vec4 c = texture(TEXTURE, UV);
	float o = c.a;
	for (int i = 0; i < 12; i++) {
		float ang = float(i) * 0.5235988;
		o = max(o, texture(TEXTURE, UV + vec2(cos(ang), sin(ang)) * TEXTURE_PIXEL_SIZE * width).a);
	}
	vec3 rgb = silhouette ? outline_color.rgb : mix(outline_color.rgb, c.rgb, c.a);
	float a = silhouette ? o : max(c.a, o);
	COLOR = vec4(rgb, a * outline_color.a);
}
