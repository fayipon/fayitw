// SCATTER 差一個時吊胃口那一軸的光框（疊加混色，蓋在 ColorRect 上，ColorRect 比轉輪大一圈 margin）：
// 圓角框的邊往外竄火、兩顆流星繞著框跑、框內靠邊一圈金光；
// k 從 0 漲到 1（越接近停輪越亮、火越高、流星越快），alpha 用來淡入淡出，flash 是落定時框與火閃一下（框內不閃）
shader_type canvas_item;
render_mode blend_add;

uniform vec2 rect_size = vec2(100.0, 400.0);
uniform vec2 margin = vec2(18.0, 10.0);
uniform float k = 0.0;
uniform float alpha = 1.0;
uniform float flash = 0.0;

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
	float v = 0.0;
	float a = 0.5;
	for (int i = 0; i < 4; i++) {
		v += a * noise(p);
		p = p * 2.07 + vec2(13.1, 7.7);
		a *= 0.5;
	}
	return v / 0.9375;
}

// 圓角矩形的距離：框內為負
float box(vec2 p, vec2 b, float r) {
	vec2 q = abs(p) - b + vec2(r);
	return length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0) - r;
}

// 一點對應到框上沿周長的位置（0~1，從左上角順時針）
float around(vec2 p, vec2 h) {
	float s;
	if (abs(p.x) - h.x > abs(p.y) - h.y) {
		s = p.x > 0.0 ? 2.0 * h.x + (p.y + h.y) : 4.0 * h.x + 2.0 * h.y + (h.y - p.y);
	} else {
		s = p.y < 0.0 ? p.x + h.x : 2.0 * h.x + 2.0 * h.y + (h.x - p.x);
	}
	return s / (4.0 * (h.x + h.y));
}

void fragment() {
	vec2 px = UV * rect_size;
	vec2 h = rect_size * 0.5 - margin;
	vec2 p = px - rect_size * 0.5;
	float d = box(p, h, 8.0);
	float out_d = max(d, 0.0);
	float t = TIME;
	float pulse = 0.5 + 0.5 * sin(t * mix(7.0, 16.0, k));

	// 火：從框邊往外竄，雜訊往上流；左右兩邊竄得比上下高，到 ColorRect 邊緣前一定熄掉
	float n = fbm(vec2(px.x * 0.06, px.y * 0.04 + t * (3.0 + 3.0 * k)));
	float n2 = fbm(vec2(px.x * 0.13 + 5.0, px.y * 0.09 + t * (4.5 + 3.0 * k)));
	float side = step(abs(p.y) - h.y, abs(p.x) - h.x);
	float room = mix(margin.y, margin.x, side);
	float fade = 1.0 - smoothstep(room * 0.7, room, out_d);
	float reach = room * (0.35 + 0.75 * n * n2 * 1.6) * (0.8 + 0.25 * k + 0.1 * pulse);
	float flame = pow(clamp(1.0 - out_d / max(reach, 0.001), 0.0, 1.0), 1.4) * step(0.0, d) * fade;
	// 外圈柔光
	float halo = exp(-out_d * 0.11) * step(0.0, d) * fade;

	// 框線：細亮的核心
	float line = exp(-abs(d) * 0.55);

	// 流星：兩顆繞著框跑，後面拖一條尾巴
	float a = around(p, h);
	float head = t * mix(0.5, 1.3, k);
	float comet = 0.0;
	for (int i = 0; i < 2; i++) {
		comet += exp(-fract(head + float(i) * 0.5 - a) * 14.0);
	}
	comet *= exp(-abs(d) * 0.15) * fade;

	// 框內：靠邊一圈金光、由下往上的光束、往下流的亮紋（跟著轉輪的方向）
	float inside = step(d, 0.0);
	float inner = exp(d * 0.16) * (0.07 + 0.05 * pulse + 0.08 * k);
	float beam = (0.06 + 0.06 * pulse + 0.08 * k) * UV.y;
	// 亮紋：軸寬分成 7 條直線道，一半的道上有一條細光往下滑，前端最亮、往上拖尾巴
	vec2 q = (px - margin) / (h * 2.0);
	float lane = q.x * 7.0;
	float r = hash(vec2(floor(lane), 3.7));
	float ph = fract(q.y * 1.2 - t * (1.4 + r * 1.2 + k) - r * 7.0);
	float tail = smoothstep(0.0, 0.5, ph) * (1.0 - smoothstep(0.5, 0.55, ph));
	float thin = exp(-pow(fract(lane) - 0.5, 2.0) * 90.0);
	float streak = tail * thin * step(0.5, hash(vec2(floor(lane), 9.1))) * 0.5;

	vec3 fire = mix(vec3(1.0, 0.22, 0.02), vec3(1.0, 0.7, 0.2), n2);
	vec3 gold = vec3(1.0, 0.74, 0.3);
	vec3 hot = vec3(1.0, 0.95, 0.8);
	vec3 edge = fire * flame * (1.3 + 0.9 * k)
		+ vec3(1.0, 0.42, 0.08) * halo * (0.35 + 0.2 * pulse + 0.25 * k)
		+ mix(gold, hot, 0.3 + 0.5 * pulse) * line * (0.9 + 0.8 * k)
		+ hot * comet * 1.6;
	vec3 col = edge * (1.0 + flash) + (gold * (inner + beam) + hot * streak) * inside;
	COLOR = vec4(col, alpha);
}
