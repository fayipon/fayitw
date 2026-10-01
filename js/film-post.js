/* =========================================================
   影片後製（撮影）：2D canvas 畫好的一格丟進 WebGL 做最後處理
   動畫製作在上色之後還有一道「撮影」：光暈、柔焦擴散、光芒、色彩校正、顆粒……
   這裡把那一步做成共用模組，各支用 canvas 畫的短片都能接上
   - bloom      發光層往外暈開（1/2～1/16 四層模糊疊加，範圍大又不糊掉核心）
                有給發光層（光束、魔法陣、光點另外畫一份）就只從發光層算，白衣服不會跟著發光；
                沒給就從整張畫面的亮部算
   - diffusion  整張畫面的柔焦擴散（screen 疊一層模糊），撮影常用的「ディフュージョン」
   - rays       光芒：亮部沿著往光源的方向拉長
   - shock      衝擊波：以撞擊點為中心的一圈畫面扭曲（最多 4 個）
   - ca         色差：越靠邊紅藍越分開
   - blur       動態模糊：沿著一個方向取樣（甩鏡、高速追逐）
   - grade      色彩校正：0 夜景（暗部偏藍、對比高）→ 1 高調白天（暗部提亮、對比低）
   - vig、grain、inv  暗角、顆粒（每格換）、反相的衝擊格
   用法：
     const post = FilmPost.create(srcCanvas, glowCanvas);   // glowCanvas 選填；不支援 WebGL 時回傳 null
     post.render(params);                       // 每次 2D 畫完呼叫；座標用 1280×720 的畫布座標
   ========================================================= */
(() => {
  const VS = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
  const HEAD = 'precision highp float;varying vec2 v;uniform sampler2D t;uniform vec2 px;';
  const FS = {
    // 縮小一半：四個角取平均
    down: HEAD + 'void main(){vec3 c=texture2D(t,v+px*vec2(-1.,-1.)).rgb+texture2D(t,v+px*vec2(1.,-1.)).rgb+texture2D(t,v+px*vec2(-1.,1.)).rgb+texture2D(t,v+px*vec2(1.,1.)).rgb;gl_FragColor=vec4(c*.25,1.);}',
    // 縮小並只留亮部（軟門檻）
    bright: HEAD + 'uniform float th;void main(){vec3 c=(texture2D(t,v+px*vec2(-1.,-1.)).rgb+texture2D(t,v+px*vec2(1.,-1.)).rgb+texture2D(t,v+px*vec2(-1.,1.)).rgb+texture2D(t,v+px*vec2(1.,1.)).rgb)*.25;' +
      'float b=max(c.r,max(c.g,c.b));float k=.25;float s=clamp(b-th+k,0.,2.*k);s=s*s/(4.*k+1e-4);gl_FragColor=vec4(c*max(s,b-th)/max(b,1e-4),1.);}',
    // 9 格高斯模糊（線性取樣，5 次）
    blur: HEAD + 'uniform vec2 dir;void main(){vec3 c=texture2D(t,v).rgb*.227;c+=(texture2D(t,v+dir*1.385).rgb+texture2D(t,v-dir*1.385).rgb)*.316;c+=(texture2D(t,v+dir*3.231).rgb+texture2D(t,v-dir*3.231).rgb)*.07;gl_FragColor=vec4(c,1.);}',
    final: `${HEAD}
      uniform sampler2D b1,b2,b3,b4,dq;
      uniform vec2 res,blur;uniform vec3 rays;uniform vec4 shock[4];
      uniform float bloom,diff,ca,vig,grain,seed,inv,grade,expo;
      const vec3 W=vec3(.299,.587,.114);
      float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
      vec3 src(vec2 u){vec2 d=u-.5;float k=ca*(.35+dot(d,d)*4.);return vec3(texture2D(t,u+d*k).r,texture2D(t,u).g,texture2D(t,u-d*k).b);}
      vec3 night(vec3 c){float l=dot(c,W);c=mix(c,c*vec3(.8,.94,1.22),(1.-l)*.5);c=mix(vec3(l),c,1.12);return mix(c,c*c*(3.-2.*c),.22);}
      vec3 day(vec3 c){c=c*.97+vec3(.015,.025,.03);float l=dot(c,W);c=mix(vec3(l),c,1.08);return mix(c,c*c*(3.-2.*c),.12);}
      void main(){
        float asp=res.x/res.y;vec2 u=v;
        for(int i=0;i<4;i++){vec4 s=shock[i];if(s.w>0.){vec2 d=(u-s.xy)*vec2(asp,1.);float L=length(d);
          float ring=smoothstep(s.z-.07,s.z,L)*(1.-smoothstep(s.z,s.z+.07,L));u-=d/(L+1e-4)/vec2(asp,1.)*ring*s.w;}}
        vec3 c;
        if(dot(blur,blur)>0.){c=vec3(0.);for(int i=0;i<10;i++){c+=src(u+blur*(float(i)/9.-.5));}c*=.1;}else c=src(u);
        vec3 bl=texture2D(b1,u).rgb*.18+texture2D(b2,u).rgb*.24+texture2D(b3,u).rgb*.28+texture2D(b4,u).rgb*.3;
        if(rays.z>0.){vec3 r=vec3(0.);vec2 dir=rays.xy-u;float w=1.;for(int i=0;i<28;i++){r+=texture2D(b2,u+dir*float(i)/28.*.9).rgb*w;w*=.94;}bl+=r*rays.z*.035;}
        c=c*expo+bl*bloom;
        vec3 df=texture2D(dq,u).rgb;c=1.-(1.-c)*(1.-df*diff);
        c=mix(night(clamp(c,0.,1.)),day(clamp(c,0.,1.)),grade);
        vec2 q=(v-.5)*vec2(1.,.86);c*=1.-vig*pow(length(q)*1.45,2.6);
        c+=(hash(v*res+seed)-.5)*grain;
        c=mix(c,1.-c,inv);
        gl_FragColor=vec4(clamp(c,0.,1.),1.);
      }`,
  };

  function create(source, glow = null) {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
    if (!gl) return null;

    const shader = (type, code) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, code);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const vs = shader(gl.VERTEX_SHADER, VS);
    const P = {};
    try {
      for (const k in FS) {
        const pr = gl.createProgram();
        gl.attachShader(pr, vs);
        gl.attachShader(pr, shader(gl.FRAGMENT_SHADER, FS[k]));
        gl.bindAttribLocation(pr, 0, 'p');
        gl.linkProgram(pr);
        if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
        const u = {};
        const n = gl.getProgramParameter(pr, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < n; i++) {
          const name = gl.getActiveUniform(pr, i).name.replace(/\[0\]$/, '');
          u[name] = gl.getUniformLocation(pr, name);
        }
        P[k] = { pr, u };
      }
    } catch (e) {
      console.warn('FilmPost 無法使用，改回 2D 顯示：', e.message);
      return null;
    }

    // 一個蓋滿畫面的三角形
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const tex = () => {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    const srcTex = tex();
    const glowTex = tex();
    let W = 0, H = 0, T = {};
    const target = (w, h) => {
      const t = tex();
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      return { t, fb, w, h };
    };
    function resize(w, h) {
      if (w === W && h === H) return;
      W = w;
      H = h;
      canvas.width = w;
      canvas.height = h;
      Object.values(T).forEach(o => { gl.deleteTexture(o.t); gl.deleteFramebuffer(o.fb); });
      const s = k => [Math.max(1, Math.round(w / k)), Math.max(1, Math.round(h / k))];
      T = {
        b1: target(...s(2)), b1x: target(...s(2)),
        b2: target(...s(4)), b2x: target(...s(4)),
        b3: target(...s(8)), b3x: target(...s(8)),
        b4: target(...s(16)), b4x: target(...s(16)),
        d1: target(...s(2)), dq: target(...s(4)), dqx: target(...s(4)),
      };
    }

    const pass = (name, out, input, set) => {
      const p = P[name];
      gl.useProgram(p.pr);
      gl.bindFramebuffer(gl.FRAMEBUFFER, out ? out.fb : null);
      gl.viewport(0, 0, out ? out.w : W, out ? out.h : H);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, input.t);
      gl.uniform1i(p.u.t, 0);
      if (p.u.px) gl.uniform2f(p.u.px, 1 / input.w, 1 / input.h);
      if (set) set(p.u);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const blur = (a, tmp, n = 1) => {
      for (let i = 0; i < n; i++) {
        pass('blur', tmp, a, u => gl.uniform2f(u.dir, (1 + i) / a.w, 0));
        pass('blur', a, tmp, u => gl.uniform2f(u.dir, 0, (1 + i) / a.h));
      }
    };

    let frame = 0;
    function render(o = {}) {
      resize(source.width, source.height);
      const src = { t: srcTex, w: W, h: H };
      gl.bindTexture(gl.TEXTURE_2D, srcTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      // 光暈：發光層（或整張畫面的亮部）→ 四層縮小，各自模糊
      let bsrc = src;
      if (glow) {
        gl.bindTexture(gl.TEXTURE_2D, glowTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, glow);
        bsrc = { t: glowTex, w: glow.width, h: glow.height };
      }
      pass('bright', T.b1, bsrc, u => gl.uniform1f(u.th, o.th ?? (glow ? 0 : 0.6)));
      pass('down', T.b2, T.b1);
      pass('down', T.b3, T.b2);
      pass('down', T.b4, T.b3);
      blur(T.b1, T.b1x);
      blur(T.b2, T.b2x);
      blur(T.b3, T.b3x, 2);
      blur(T.b4, T.b4x, 2);
      // 柔焦擴散：整張畫面縮到 1/4 再模糊
      pass('down', T.d1, src);
      pass('down', T.dq, T.d1);
      blur(T.dq, T.dqx, 2);

      const p = P.final;
      gl.useProgram(p.pr);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, W, H);
      [['t', srcTex], ['b1', T.b1.t], ['b2', T.b2.t], ['b3', T.b3.t], ['b4', T.b4.t], ['dq', T.dq.t]].forEach(([name, t], i) => {
        gl.activeTexture(gl.TEXTURE0 + i);
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.uniform1i(p.u[name], i);
      });
      // 參數用 1280×720 的畫布座標，這裡換成 WebGL 的 0～1（y 軸朝上）
      const shock = new Float32Array(16);
      (o.shock || []).slice(0, 4).forEach(([x, y, r, s], i) => shock.set([x / 1280, 1 - y / 720, r / 720, s], i * 4));
      const rays = o.rays ? [o.rays[0] / 1280, 1 - o.rays[1] / 720, o.rays[2]] : [0, 0, 0];
      const bl = o.blur || [0, 0];
      gl.uniform2f(p.u.res, W, H);
      gl.uniform2f(p.u.blur, bl[0] / 1280, -bl[1] / 720);
      gl.uniform3f(p.u.rays, ...rays);
      gl.uniform4fv(p.u.shock, shock);
      gl.uniform1f(p.u.bloom, o.bloom ?? 0.9);
      gl.uniform1f(p.u.diff, o.diff ?? 0.2);
      gl.uniform1f(p.u.ca, o.ca ?? 0.002);
      gl.uniform1f(p.u.vig, o.vig ?? 0.35);
      gl.uniform1f(p.u.grain, o.grain ?? 0.05);
      gl.uniform1f(p.u.seed, o.seed ?? (frame++ % 64) * 17.3);
      gl.uniform1f(p.u.inv, o.inv ?? 0);
      gl.uniform1f(p.u.grade, o.grade ?? 0);
      gl.uniform1f(p.u.expo, o.expo ?? 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    return { canvas, render, resize };
  }

  window.FilmPost = { create };
})();
