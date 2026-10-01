/* =========================================================
   水墨引擎（WebGL2）：GPU 流體模擬 + 水墨著色器 + 後製
   - 流體：stable fluids（速度場、壓力投影、渦度、平流）。顏料有兩種：
     R 是黑墨、G 是白色顏料（胡粉：水花、雲霧、月光下的霧氣），都被水流帶著走
   - 宣紙由著色器產生（纖維、斑駁、細顆粒、暖色暗角）；tint 調整紙色，wcol 是白色顏料（霧）的顏色
   - 2D 圖層（canvas 畫的背景、角色）經過水墨濾鏡：邊緣不規則的暈開、墨往紙裡滲的淡影（洇）、
     深色處被紙纖維打散的顆粒感；彩色（朱紅、金色）保留
   - 流體墨的呈現：濃度 → 淡墨到焦墨的色階、乾掉時邊緣積墨變深、紙纖維吸墨不均
   - 後製：動態模糊、放射模糊（往鏡頭衝）、反相衝擊格、墨潑轉場（墨從一點漫開蓋滿畫面，或從一點退開）、
     對比、閃白、淡出、底片顆粒
   疊圖順序：宣紙 → 背景圖層 → 黑墨 → 白色顏料 → 前景圖層 → 後製
   用法：
     const ink = InkGL.create();                       // 不支援時回傳 null
     ink.reset();                                      // 清空流體（換鏡頭時）
     ink.dye(x, y, r, black, sq, white)                // 加墨（畫布 1280×720 座標，r 是半徑 px，sq 壓扁 [x, y]）
     ink.white(x, y, r, amount, sq)                    // 加白色顏料
     ink.push(x, y, r, vx, vy, sq)                     // 推動水流（px/秒）
     ink.radial(x, y, r, s, sq) / ink.swirl(…)         // 往外推（負值往內吸）／繞圈
     ink.turb(s, x, y, r)                              // 這一步加上擾流（不給位置就是整張）
     ink.inject(canvas, amount)                        // 把一張圖的深色部分變成墨
     ink.step(dt, { curl, vd, dd, ddw, turb })         // 往前模擬一步（ddw 是白色顏料的衰減，預設同 dd）
     ink.render(back, front, { blur, zoom, inv, con, wipe, flash, fade, vig, time, tint, wcol, … })
   ========================================================= */
(() => {
  const VS = `#version 300 es
    in vec2 p;
    uniform vec2 tx;
    out vec2 v, vL, vR, vT, vB;
    void main() {
      v = p * .5 + .5;
      vL = v - vec2(tx.x, 0.); vR = v + vec2(tx.x, 0.); vT = v + vec2(0., tx.y); vB = v - vec2(0., tx.y);
      gl_Position = vec4(p, 0., 1.);
    }`;
  const H = `#version 300 es
    precision highp float;
    in vec2 v, vL, vR, vT, vB;
    out vec4 o;
    float hash(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
    }
    float fbm(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + 17.1; a *= .5; } return s; }
    float lum(vec3 c) { return dot(c, vec3(.299, .587, .114)); }
    const vec3 INK = vec3(.055, .052, .048);
  `;
  const FS = {
    // 加一團高斯：M=0 直接加數值、M=1 往外推、M=2 繞圈；SQ 壓扁做出地面上的橢圓
    splat: H + `
      uniform sampler2D T; uniform vec2 P, SQ; uniform float R, A; uniform vec4 V; uniform int M;
      void main() {
        vec2 d = v - P; d.x *= A;
        vec2 q = d * SQ;
        float g = exp(-dot(q, q) / (R * R));
        vec4 add;
        if (M == 0) add = V * g;
        else {
          vec2 n = q * SQ; n /= length(n) + 1e-5;
          add = vec4((M == 1 ? n : vec2(-n.y, n.x)) * V.x * g, 0., 0.);
        }
        o = texture(T, v) + add;
      }`,
    advect: H + `
      uniform sampler2D U, S; uniform vec2 st; uniform float dt; uniform vec4 D;
      void main() { o = D * texture(S, v - dt * texture(U, v).xy * st); }`,
    divergence: H + `
      uniform sampler2D U;
      void main() {
        float L = texture(U, vL).x, R = texture(U, vR).x, T = texture(U, vT).y, B = texture(U, vB).y;
        vec2 C = texture(U, v).xy;
        if (vL.x < 0.) L = -C.x; if (vR.x > 1.) R = -C.x; if (vT.y > 1.) T = -C.y; if (vB.y < 0.) B = -C.y;
        o = vec4(.5 * (R - L + T - B), 0., 0., 1.);
      }`,
    curl: H + `
      uniform sampler2D U;
      void main() { o = vec4(.5 * (texture(U, vR).y - texture(U, vL).y - texture(U, vT).x + texture(U, vB).x), 0., 0., 1.); }`,
    vorticity: H + `
      uniform sampler2D U, Cu; uniform float k, dt;
      void main() {
        float L = texture(Cu, vL).x, R = texture(Cu, vR).x, T = texture(Cu, vT).x, B = texture(Cu, vB).x, C = texture(Cu, v).x;
        vec2 f = .5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
        f = f / (length(f) + 1e-4) * k * C; f.y = -f.y;
        o = vec4(clamp(texture(U, v).xy + f * dt, -3000., 3000.), 0., 1.);
      }`,
    pressure: H + `
      uniform sampler2D Pr, Dv;
      void main() { o = vec4((texture(Pr, vL).x + texture(Pr, vR).x + texture(Pr, vT).x + texture(Pr, vB).x - texture(Dv, v).x) * .25, 0., 0., 1.); }`,
    gradient: H + `
      uniform sampler2D U, Pr;
      void main() {
        vec2 g = .5 * vec2(texture(Pr, vR).x - texture(Pr, vL).x, texture(Pr, vT).x - texture(Pr, vB).x);
        o = vec4(texture(U, v).xy - g, 0., 1.);
      }`,
    scale: H + `
      uniform sampler2D T; uniform float k;
      void main() { o = texture(T, v) * k; }`,
    // 擾流：雜訊場的旋度當作力，讓墨捲出一縷一縷的煙
    turb: H + `
      uniform sampler2D U; uniform float s, dt, time, A; uniform vec3 Rg;
      void main() {
        vec2 p = vec2(v.x * A, v.y) * 5. + vec2(time * .25, time * .17);
        float e = .02;
        vec2 f = vec2(fbm(p + vec2(0., e)) - fbm(p - vec2(0., e)), -(fbm(p + vec2(e, 0.)) - fbm(p - vec2(e, 0.)))) / (2. * e);
        float m = 1.;
        if (Rg.z > 0.) { vec2 q = v - Rg.xy; q.x *= A; m = exp(-dot(q, q) / (Rg.z * Rg.z)); }
        o = vec4(texture(U, v).xy + f * s * m * dt, 0., 1.);
      }`,
    // 圖層的深色部分加進黑墨（圖層是預乘 alpha）
    inject: H + `
      uniform sampler2D S, L; uniform float k;
      void main() { vec4 c = texture(L, v); o = texture(S, v) + vec4(max(c.a - lum(c.rgb), 0.) * k, 0., 0., 0.); }`,
    // 宣紙：底色、大片斑駁、三個方向的纖維、細顆粒、暖色暗角
    paper: H + `
      uniform vec2 res;
      void main() {
        vec2 p = vec2(v.x * res.x / res.y, v.y);
        vec3 c = vec3(.93, .905, .842);
        c += (fbm(p * 2.6) - .5) * .05 + (fbm(p * 11. + 4.) - .5) * .025;
        float fib = 0.;
        for (int i = 0; i < 3; i++) {
          float a = float(i) * 2.17 + .5;
          vec2 q = mat2(cos(a), -sin(a), sin(a), cos(a)) * p;
          fib += smoothstep(.74, .92, noise(q * vec2(220., 8.) + float(i) * 31.));
          fib -= .6 * smoothstep(.8, .95, noise(q * vec2(90., 4.) + float(i) * 7.));
        }
        c -= fib * .007;
        c += (hash(v * res) - .5) * .028;
        vec2 d = v - .5;
        c *= 1. - .26 * pow(length(d * vec2(1., .9)) * 1.38, 2.4);
        o = vec4(c, 1.);
      }`,
    // 固定的雜訊圖：RG 邊緣扭曲、B 纖維（吸墨不均）、A 大塊的雲狀雜訊（墨潑轉場的邊）
    noise: H + `
      uniform vec2 res;
      void main() {
        vec2 p = vec2(v.x * res.x / res.y, v.y);
        float a = 1.3;
        vec2 q = mat2(cos(a), -sin(a), sin(a), cos(a)) * p;
        o = vec4(fbm(p * 34.), fbm(p * 34. + 9.7), .55 * noise(q * vec2(260., 16.)) + .45 * noise(p * 420.), fbm(p * 4. + 3.3));
      }`,
    down: H + `
      uniform sampler2D T; uniform vec2 px;
      void main() { o = .25 * (texture(T, v + px * vec2(-1, -1)) + texture(T, v + px * vec2(1, -1)) + texture(T, v + px * vec2(-1, 1)) + texture(T, v + px * vec2(1, 1))); }`,
    blur: H + `
      uniform sampler2D T; uniform vec2 dir;
      void main() { o = texture(T, v) * .227 + (texture(T, v + dir * 1.385) + texture(T, v - dir * 1.385)) * .316 + (texture(T, v + dir * 3.231) + texture(T, v - dir * 3.231)) * .07; }`,
    composite: H + `
      uniform sampler2D Pa, Nz, Dy, LB, LF, LBb, LFb;
      uniform float inkK, edgeK, bleedB, bleedF, warp, granB, granF;
      uniform vec3 tint, wcol;
      vec3 sumi(vec3 col, sampler2D L, sampler2D Lb, vec2 w, float fib, float bleed, float gran) {
        vec4 c = texture(L, v + w);
        vec4 b = texture(Lb, v);
        float dark = max(b.a - lum(b.rgb), 0.);
        // 洇：深色筆觸外圍滲進紙裡的一圈淡墨
        col = mix(col, INK * 1.6, clamp(dark * bleed * (1. - c.a) * (.7 + .6 * fib), 0., .8));
        // 深色處被紙纖維打散（預乘 alpha）
        float cd = c.a > .001 ? 1. - lum(c.rgb) / c.a : 0.;
        vec3 cc = c.rgb + (fib - .5) * gran * cd * c.a;
        return col * (1. - c.a) + cc;
      }
      void main() {
        vec4 nz = texture(Nz, v);
        vec2 w = (nz.rg - .5) * warp;
        float fib = nz.b;
        vec3 col = texture(Pa, v).rgb * tint;
        col = sumi(col, LB, LBb, w * 1.6, fib, bleedB, granB);
        // 流體墨：黑墨
        vec2 dt = 1. / vec2(textureSize(Dy, 0));
        vec2 u = v + w * 1.3;
        vec4 D = texture(Dy, u);
        float d = max(D.r, 0.);
        float da = .25 * (texture(Dy, u + vec2(dt.x * 3., 0.)).r + texture(Dy, u - vec2(dt.x * 3., 0.)).r + texture(Dy, u + vec2(0., dt.y * 3.)).r + texture(Dy, u - vec2(0., dt.y * 3.)).r);
        float a = 1. - exp(-d * inkK);
        float edge = clamp((d - max(da, 0.)) * edgeK, 0., 1.) * smoothstep(.03, .25, a);
        a = clamp(a * (.78 + .44 * fib), 0., 1.);
        vec3 tone = mix(vec3(.5, .475, .43), INK, smoothstep(.12, .92, a));
        col = mix(col, tone, clamp(a * .97 + edge * .3, 0., .97));
        // 白色顏料：水花、霧
        float aw = 1. - exp(-max(D.g, 0.) * 1.6);
        col = mix(col, wcol, clamp(aw * (.94 + .08 * fib), 0., .94));
        col = sumi(col, LF, LFb, w, fib, bleedF, granF);
        o = vec4(clamp(col, 0., 1.), 1.);
      }`,
    // 後製：動態模糊、放射模糊、墨潑轉場、對比、反相、閃白、淡出、暗角、顆粒
    post: H + `
      uniform sampler2D T, Nz;
      uniform vec2 res, blur; uniform vec3 zoom; uniform vec4 wipe;
      uniform float inv, con, flash, fade, vig, grain, time;
      void main() {
        vec2 u = v;
        vec3 c;
        if (dot(blur, blur) > 0. || zoom.z > 0.) {
          c = vec3(0.);
          for (int i = 0; i < 14; i++) {
            float k = float(i) / 13.;
            c += texture(T, u + blur * (k - .5) + (zoom.xy - u) * zoom.z * k).rgb;
          }
          c /= 14.;
        } else c = texture(T, u).rgb;
        c = clamp((c - .55) * con + .55, 0., 1.);
        if (wipe.z > 0.) {
          vec2 d = (u - wipe.xy) * vec2(res.x / res.y, 1.);
          float n = texture(Nz, u).a;
          float r = length(d) + (n - .5) * .55;
          float m = smoothstep(wipe.z + .02, wipe.z - .04, r);
          if (wipe.w < 0.) m = 1. - m;
          c = mix(c, INK, m * abs(wipe.w));
        }
        vec2 q = v - .5;
        c *= 1. - vig * pow(length(q * vec2(1., .86)) * 1.42, 2.4);
        c = mix(c, 1. - c, inv);
        c = mix(c, vec3(.97, .96, .93), flash);
        c *= 1. - fade;
        c += (hash(v * res + fract(time * 7.13) * 91.) - .5) * grain;
        o = vec4(clamp(c, 0., 1.), 1.);
      }`,
  };

  function create(o = {}) {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
    if (!gl) return null;
    if (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float')) return null;
    gl.getExtension('OES_texture_float_linear');

    const SIM = o.sim || [192, 108], DYE = o.dye || [1024, 576];
    const P = {};
    try {
      const vs = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vs, VS);
      gl.compileShader(vs);
      if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(vs));
      for (const k in FS) {
        const fs = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fs, FS[k]);
        gl.compileShader(fs);
        if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) throw new Error(k + ': ' + gl.getShaderInfoLog(fs));
        const pr = gl.createProgram();
        gl.attachShader(pr, vs);
        gl.attachShader(pr, fs);
        gl.bindAttribLocation(pr, 0, 'p');
        gl.linkProgram(pr);
        if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(k + ': ' + gl.getProgramInfoLog(pr));
        const u = {};
        const n = gl.getProgramParameter(pr, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < n; i++) {
          const name = gl.getActiveUniform(pr, i).name;
          u[name] = gl.getUniformLocation(pr, name);
        }
        P[k] = { pr, u };
      }
    } catch (e) {
      console.warn('InkGL 無法使用，改回 2D 版本：', e.message);
      return null;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const tex = (w, h, half) => {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (w) {
        if (half) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
        else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      }
      return t;
    };
    const target = (w, h, half = true) => {
      const t = tex(w, h, half);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      return { t, fb, w, h };
    };
    const double = (w, h) => {
      const d = { a: target(w, h), b: target(w, h) };
      d.swap = () => { const x = d.a; d.a = d.b; d.b = x; };
      return d;
    };
    const vel = double(...SIM), dye = double(...DYE), prs = double(...SIM);
    const div = target(...SIM), crl = target(...SIM);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) return null;

    // 跑一次著色器：輸出到 out（null 是畫面），貼圖依序綁到 0、1、2…
    const run = (name, out, texs, set) => {
      const p = P[name];
      gl.useProgram(p.pr);
      gl.bindFramebuffer(gl.FRAMEBUFFER, out ? out.fb : null);
      gl.viewport(0, 0, out ? out.w : canvas.width, out ? out.h : canvas.height);
      let i = 0;
      for (const k in texs) {
        gl.activeTexture(gl.TEXTURE0 + i);
        gl.bindTexture(gl.TEXTURE_2D, texs[k]);
        gl.uniform1i(p.u[k], i++);
      }
      const w = out ? out.w : canvas.width, h = out ? out.h : canvas.height;
      if (p.u.tx) gl.uniform2f(p.u.tx, 1 / w, 1 / h);
      if (set) set(p.u);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    // 畫布座標（1280×720，y 朝下）→ 0～1（y 朝上）；速度 px/秒 → 模擬格/秒
    const A = 1280 / 720, KV = SIM[0] / 1280;
    const splat = (d, x, y, r, val, mode, sq = [1, 1]) => {
      run('splat', d.b, { T: d.a.t }, u => {
        gl.uniform2f(u.P, x / 1280, 1 - y / 720);
        gl.uniform1f(u.R, r / 720);
        gl.uniform1f(u.A, A);
        gl.uniform2f(u.SQ, sq[0], sq[1]);
        gl.uniform4f(u.V, val[0], val[1] || 0, 0, 0);
        gl.uniform1i(u.M, mode);
      });
      d.swap();
    };
    const api = {
      canvas,
      dye: (x, y, r, amount, sq, white = 0) => splat(dye, x, y, r, [amount, white], 0, sq),
      white: (x, y, r, amount, sq) => splat(dye, x, y, r, [0, amount], 0, sq),
      push: (x, y, r, vx, vy, sq) => splat(vel, x, y, r, [vx * KV, -vy * KV], 0, sq),
      radial: (x, y, r, s, sq) => splat(vel, x, y, r, [s * KV], 1, sq),
      swirl: (x, y, r, s, sq) => splat(vel, x, y, r, [-s * KV], 2, sq),
    };

    let simTime = 0, stepDt = 1 / 60;
    api.turb = (s, x, y, r) => {
      run('turb', vel.b, { U: vel.a.t }, u => {
        gl.uniform1f(u.s, s * KV);
        gl.uniform1f(u.dt, stepDt);
        gl.uniform1f(u.time, simTime);
        gl.uniform1f(u.A, A);
        gl.uniform3f(u.Rg, x == null ? 0 : x / 1280, y == null ? 0 : 1 - y / 720, r == null ? 0 : r / 720);
      });
      vel.swap();
    };
    const injTex = tex();
    api.inject = (img, k = 1) => {
      gl.bindTexture(gl.TEXTURE_2D, injTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img);
      run('inject', dye.b, { S: dye.a.t, L: injTex }, u => gl.uniform1f(u.k, k));
      dye.swap();
    };
    api.reset = () => {
      for (const d of [vel.a, vel.b, dye.a, dye.b, prs.a, prs.b]) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, d.fb);
        gl.viewport(0, 0, d.w, d.h);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      simTime = 0;
    };
    // 往前一步：渦度 → 散度 → 壓力 → 去掉散度 → 平流（速度、墨）
    api.step = (dt, o = {}) => {
      const { curl = 20, vd = 0.985, dd = 0.999, ddw = dd, turb = 0, iters = 20 } = o;
      // 慢動作時 dt 變小，衰減也要跟著按比例（以每秒 60 步為準）
      const k = dt * 60;
      stepDt = dt;
      if (turb) api.turb(turb);
      run('curl', crl, { U: vel.a.t });
      run('vorticity', vel.b, { U: vel.a.t, Cu: crl.t }, u => { gl.uniform1f(u.k, curl); gl.uniform1f(u.dt, dt); });
      vel.swap();
      run('divergence', div, { U: vel.a.t });
      run('scale', prs.b, { T: prs.a.t }, u => gl.uniform1f(u.k, 0.8));
      prs.swap();
      for (let i = 0; i < iters; i++) {
        run('pressure', prs.b, { Pr: prs.a.t, Dv: div.t });
        prs.swap();
      }
      run('gradient', vel.b, { U: vel.a.t, Pr: prs.a.t });
      vel.swap();
      const st = [1 / SIM[0], 1 / SIM[1]];
      const kv = Math.pow(vd, k);
      run('advect', vel.b, { U: vel.a.t, S: vel.a.t }, u => { gl.uniform2f(u.st, ...st); gl.uniform1f(u.dt, dt); gl.uniform4f(u.D, kv, kv, kv, kv); });
      vel.swap();
      // 黑墨與白色顏料可以用不同的速度淡掉（霧散得快、墨留在紙上）
      run('advect', dye.b, { U: vel.a.t, S: dye.a.t }, u => { gl.uniform2f(u.st, ...st); gl.uniform1f(u.dt, dt); gl.uniform4f(u.D, Math.pow(dd, k), Math.pow(ddw, k), 1, 1); });
      dye.swap();
      simTime += dt;
    };

    // 輸出大小改變時：重新產生宣紙與雜訊圖、圖層的模糊用貼圖、合成用的暫存畫面
    let W = 0, Hh = 0, paperT, noiseT, compT, layer = {};
    function resize(w, h) {
      if (w === W && h === Hh) return;
      W = w;
      Hh = h;
      canvas.width = w;
      canvas.height = h;
      [paperT, noiseT, compT, ...Object.values(layer).flatMap(l => [l.half, l.tmp])].forEach(x => { if (x) { gl.deleteTexture(x.t); gl.deleteFramebuffer(x.fb); } });
      paperT = target(w, h, false);
      noiseT = target(w, h, false);
      compT = target(w, h, false);
      run('paper', paperT, {}, u => gl.uniform2f(u.res, w, h));
      run('noise', noiseT, {}, u => gl.uniform2f(u.res, w, h));
      const hw = Math.max(1, Math.round(w / 4)), hh = Math.max(1, Math.round(h / 4));
      for (const k of ['back', 'front']) layer[k] = { src: layer[k]?.src || tex(), half: target(hw, hh, false), tmp: target(hw, hh, false) };
    }
    // 圖層：上傳（預乘 alpha）→ 縮成 1/4 → 模糊兩次，當作「洇」的來源
    const upload = (l, img) => {
      gl.bindTexture(gl.TEXTURE_2D, l.src);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img);
      run('down', l.tmp, { T: l.src }, u => gl.uniform2f(u.px, 1 / img.width, 1 / img.height));
      run('down', l.half, { T: l.tmp.t }, u => gl.uniform2f(u.px, 1 / l.tmp.w, 1 / l.tmp.h));
      for (let i = 1; i <= 2; i++) {
        run('blur', l.tmp, { T: l.half.t }, u => gl.uniform2f(u.dir, i / l.half.w, 0));
        run('blur', l.half, { T: l.tmp.t }, u => gl.uniform2f(u.dir, 0, i / l.half.h));
      }
    };
    api.render = (back, front, o = {}) => {
      resize(back.width, back.height);
      upload(layer.back, back);
      upload(layer.front, front);
      run('composite', compT, { Pa: paperT.t, Nz: noiseT.t, Dy: dye.a.t, LB: layer.back.src, LF: layer.front.src, LBb: layer.back.half.t, LFb: layer.front.half.t }, u => {
        gl.uniform1f(u.inkK, o.inkK ?? 1.5);
        gl.uniform1f(u.edgeK, o.edgeK ?? 3);
        gl.uniform1f(u.bleedB, o.bleedB ?? 0.45);
        gl.uniform1f(u.bleedF, o.bleedF ?? 0.18);
        gl.uniform1f(u.warp, (o.warp ?? 1.6) / 720);
        gl.uniform1f(u.granB, o.granB ?? 0.2);
        gl.uniform1f(u.granF, o.granF ?? 0.2);
        gl.uniform3fv(u.tint, o.tint || [1, 1, 1]);
        gl.uniform3fv(u.wcol, o.wcol || [0.95, 0.94, 0.9]);
      });
      // 後製參數用 1280×720 的畫布座標
      const bl = o.blur || [0, 0], zm = o.zoom || [640, 360, 0], wp = o.wipe || [640, 360, 0, 0];
      run('post', null, { T: compT.t, Nz: noiseT.t }, u => {
        gl.uniform2f(u.res, W, Hh);
        gl.uniform2f(u.blur, bl[0] / 1280, -bl[1] / 720);
        gl.uniform3f(u.zoom, zm[0] / 1280, 1 - zm[1] / 720, zm[2]);
        gl.uniform4f(u.wipe, wp[0] / 1280, 1 - wp[1] / 720, wp[2] / 720, wp[3]);
        gl.uniform1f(u.inv, o.inv || 0);
        gl.uniform1f(u.con, o.con ?? 1);
        gl.uniform1f(u.flash, o.flash || 0);
        gl.uniform1f(u.fade, o.fade || 0);
        gl.uniform1f(u.vig, o.vig ?? 0.2);
        gl.uniform1f(u.grain, o.grain ?? 0.045);
        gl.uniform1f(u.time, o.time || 0);
      });
    };
    api.resize = resize;
    api.reset();
    return api;
  }

  window.InkGL = { create };
})();
