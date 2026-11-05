/* =========================================================
   背景：GPU 粒子雕塑 + 鼠标流体（WebGL2，不依赖第三方库）
   - 粒子位置存在浮点纹理里，每帧一次全屏计算（ping-pong）：
     curl 噪声漂移 → 沿雕塑表面旋转 → 被 SDF 吸回表面 → 弹回原点
   - 鼠标 / 手指划过时写入一张 GPU 流体（curl、涡度、散度、压力、
     梯度相减、平流），流体速度把粒子推开，约 1–2 秒后回到雕塑上
   - 颜色读取 CSS 变量 --fx-*，换配色只改 CSS
   不支持 WebGL2 或浮点渲染时，<html data-field="none">，由 CSS 显示静态背景
   ========================================================= */
(() => {
  'use strict';
  const cv = document.getElementById('bg');
  const root = document.documentElement;
  const off = why => { root.dataset.field = 'none'; if (cv) cv.style.display = 'none'; console.info('[field] 背景已关闭：' + why); };
  if (!cv) return;
  const gl = cv.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
  if (!gl) return off('浏览器不支持 WebGL2');
  const extF = gl.getExtension('EXT_color_buffer_float');
  const extH = extF || gl.getExtension('EXT_color_buffer_half_float');
  if (!extH) return off('不能渲染浮点纹理');
  gl.getExtension('OES_texture_float_linear');

  const qs = new URLSearchParams(location.search);
  const mobile = matchMedia('(max-width: 760px), (pointer: coarse)').matches;
  const low = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let SIZE = mobile ? 128 : (low ? 256 : 512);          // 粒子数 = SIZE²：512² = 262,144
  const SIM = mobile ? 128 : 256, DYE = mobile ? 256 : 512;
  const POS_IF = extF ? gl.RGBA32F : gl.RGBA16F;       // 位置需要 32 位精度；只支持半浮点时退一步

  /* ---------- 着色器 ---------- */
  const H = '#version 300 es\nprecision highp float;\nprecision highp sampler2D;\n';
  const QUAD_VS = H + `in vec2 aP; out vec2 vUv;
void main() { vUv = aP * .5 + .5; gl_Position = vec4(aP, 0., 1.); }`;

  // 粒子模拟：每个像素是一个粒子的位置
  const SIM_FS = H + `in vec2 vUv; out vec4 o;
uniform sampler2D uPos, uOrigin, uVel, uDye;
uniform float uTime, uHz, uMouse, uShift, uScatter;
uniform mat4 uPV, uModel;
uniform mat3 uFlow;

vec3 pot(vec3 p) {
  return vec3(
    sin(p.y * 1.7 + 1.3) + .6 * sin(p.z * 2.3 + .7) + .3 * sin((p.x + p.y) * 3.1),
    sin(p.z * 1.9 + 2.1) + .6 * sin(p.x * 2.7 + 4.) + .3 * sin((p.y + p.z) * 2.9),
    sin(p.x * 2.1 + 3.3) + .6 * sin(p.y * 2.5 + 1.9) + .3 * sin((p.z + p.x) * 3.3));
}
vec3 curl(vec3 p) {
  const float e = .01;
  vec3 x0 = pot(p - vec3(e, 0, 0)), x1 = pot(p + vec3(e, 0, 0));
  vec3 y0 = pot(p - vec3(0, e, 0)), y1 = pot(p + vec3(0, e, 0));
  vec3 z0 = pot(p - vec3(0, 0, e)), z1 = pot(p + vec3(0, 0, e));
  vec3 c = vec3((y1.z - y0.z) - (z1.y - z0.y), (z1.x - z0.x) - (x1.z - x0.z), (x1.y - x0.y) - (y1.x - y0.x));
  return c / (length(c) + 1e-5);
}
// 雕塑：一圈弯曲、截面扭转的空心环，中间一个大开口，环身有起伏
float sdf(vec3 p) {
  float L = length(p);
  if (L > .8) return L - .7;
  float a = atan(p.y, p.x);
  float R = .27 + .035 * sin(a * 2. + .6);
  float r = .088 + .03 * sin(a * 3. + 1.1) + .018 * sin(a * 5. - .4);
  vec2 q = vec2(length(p.xy) - R, p.z - .09 * sin(a * 2. + 1.7));
  float t = a * 1.5;
  q = mat2(cos(t), -sin(t), sin(t), cos(t)) * q;
  vec2 e = vec2(1.35, .72) * r;
  return (length(q / e) - 1.) * min(e.x, e.y);
}
vec3 grad(vec3 p) {
  const float h = .001;
  return vec3(sdf(p + vec3(h, 0, 0)) - sdf(p - vec3(h, 0, 0)),
              sdf(p + vec3(0, h, 0)) - sdf(p - vec3(0, h, 0)),
              sdf(p + vec3(0, 0, h)) - sdf(p - vec3(0, 0, h))) / (2. * h);
}
void main() {
  vec3 pos = texture(uPos, vUv).xyz;
  vec3 org = texture(uOrigin, vUv).xyz;
  if (length(pos) > .7) pos /= 2.;
  pos += curl(pos * 1.2 + uTime * .05) * .0002 * uHz;
  vec3 g = grad(pos);
  float d = sdf(pos);
  pos += cross(normalize(pos + 1e-5), normalize(g + 1e-6)) * .0005 * uHz * (1. - uScatter);  // 沿表面旋转
  pos += -g * d * .5 * (1. - uScatter);                        // 吸回表面；翻页时松开，粒子溶解
  pos += (org - pos) * .0002 * uHz * (1. - uScatter);          // 弹回原点
  pos += vec3(0., uShift, 0.) * .0073 * uHz;                   // 翻页方向的位移
  pos += normalize(pos + vec3(1e-4)) * uScatter * .011 * uHz;  // 溶解：向外散开失焦
  vec4 cl = uPV * uModel * vec4(pos, 1.);
  vec2 s = cl.xy / cl.w * .5 + .5;
  if (cl.w > 0. && s.x > 0. && s.x < 1. && s.y > 0. && s.y < 1.) {
    vec2 v = texture(uVel, s).xy;
    float k = texture(uDye, s).r;
    pos += uFlow * vec3(v, 0.) * .0003 * uHz * uMouse * min(k, 1.);
  }
  o = vec4(pos, 1.);
}`;

  // 粒子绘制
  const PT_VS = H + `in vec2 aUv; in vec4 aRnd;
uniform sampler2D uPos;
uniform mat4 uP, uV, uM;
uniform float uDpr, uScale;
out vec4 vR; out float vS;
void main() {
  vec3 p = texture(uPos, aUv).xyz;
  p *= mix(1., 1.5, pow(aRnd.y, 150.));
  vec4 v = uV * uM * vec4(p, 1.);
  float dist = length(v.xyz);
  vS = mix(.5, 1., aRnd.z);
  vR = aRnd;
  gl_Position = uP * v;
  gl_PointSize = uDpr * (1.4 + 2.2 * aRnd.z) * (1.6 / dist) * uScale;
}`;
  const PT_FS = H + `in vec4 vR; in float vS; out vec4 o;
uniform float uTime, uGain;
uniform vec3 uPal[12];
void main() {
  vec2 c = gl_PointCoord * 2. - 1.;
  float r2 = dot(c, c);
  if (r2 > 1. || vS < .1) discard;
  // 调色：0–4 红系、5–9 蓝系各 8%（合计各 40%），10–11 浅灰 / 肉色各 10%
  float w = vR.w;
  int id = w < .8 ? int(w / .08) : 10 + int((w - .8) / .1);
  vec3 ink = uPal[min(id, 11)];
  float sp = .5 + (.4 + sin(uTime * 4. + vR.y * 20.)) * pow(vR.z, 10.) * 2.5;
  // 程序化 matcap：一颗柔和的小球，随时间轻微转动，给每个点一点明暗
  float ang = sin(uTime + vR.z * 20.) * .5 + 1.;
  vec2 q = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * c;
  vec3 n = vec3(q, sqrt(1. - r2));
  float m = clamp(.45 + .55 * dot(n, normalize(vec3(-.45, .55, .7))), 0., 1.);
  ink *= mix(.86, 1.06, m);
  float al = (.35 + .65 * vR.x) * sp * uGain * .5 * smoothstep(1., .5, r2);
  // 普通透明混合：叠得再密也只会趋近粒子本身的颜色，浅色不会被叠成深色
  o = vec4(min(ink, vec3(1.)), clamp(al, 0., .9));
}`;

  /* 流体：curl → 涡度 → 散度 → 压力 → 梯度相减 → 平流 */
  const F = H + `in vec2 vUv; out vec4 o; uniform vec2 uTx;\n`;
  const SPLAT_FS = F + `uniform sampler2D uT; uniform vec2 uA, uB; uniform vec3 uC; uniform float uR, uAsp;
void main() {
  vec2 p = vUv, a = uA, b = uB;
  p.x *= uAsp; a.x *= uAsp; b.x *= uAsp;
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-9), 0., 1.);
  float d = length(pa - ba * h);
  o = vec4(texture(uT, vUv).xyz + exp(-d * d / uR) * uC, 1.);
}`;
  const CURL_FS = F + `uniform sampler2D uV;
void main() {
  float L = texture(uV, vUv - vec2(uTx.x, 0)).y, R = texture(uV, vUv + vec2(uTx.x, 0)).y;
  float T = texture(uV, vUv + vec2(0, uTx.y)).x, B = texture(uV, vUv - vec2(0, uTx.y)).x;
  o = vec4(.5 * (R - L - T + B), 0, 0, 1);
}`;
  const VORT_FS = F + `uniform sampler2D uV, uC; uniform float uCurl, uDt;
void main() {
  float L = texture(uC, vUv - vec2(uTx.x, 0)).x, R = texture(uC, vUv + vec2(uTx.x, 0)).x;
  float T = texture(uC, vUv + vec2(0, uTx.y)).x, B = texture(uC, vUv - vec2(0, uTx.y)).x;
  float C = texture(uC, vUv).x;
  vec2 f = .5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  f /= length(f) + 1e-4;
  f *= uCurl * C; f.y *= -1.;
  o = vec4(texture(uV, vUv).xy + f * uDt, 0, 1);
}`;
  const DIV_FS = F + `uniform sampler2D uV;
void main() {
  vec2 c = texture(uV, vUv).xy;
  float L = texture(uV, vUv - vec2(uTx.x, 0)).x, R = texture(uV, vUv + vec2(uTx.x, 0)).x;
  float T = texture(uV, vUv + vec2(0, uTx.y)).y, B = texture(uV, vUv - vec2(0, uTx.y)).y;
  if (vUv.x - uTx.x < 0.) L = -c.x;
  if (vUv.x + uTx.x > 1.) R = -c.x;
  if (vUv.y + uTx.y > 1.) T = -c.y;
  if (vUv.y - uTx.y < 0.) B = -c.y;
  o = vec4(.5 * (R - L + T - B), 0, 0, 1);
}`;
  const SCALE_FS = F + `uniform sampler2D uT; uniform float uK;
void main() { o = uK * texture(uT, vUv); }`;
  const PRES_FS = F + `uniform sampler2D uP, uD;
void main() {
  float L = texture(uP, vUv - vec2(uTx.x, 0)).x, R = texture(uP, vUv + vec2(uTx.x, 0)).x;
  float T = texture(uP, vUv + vec2(0, uTx.y)).x, B = texture(uP, vUv - vec2(0, uTx.y)).x;
  o = vec4((L + R + B + T - texture(uD, vUv).x) * .25, 0, 0, 1);
}`;
  const GRAD_FS = F + `uniform sampler2D uP, uV;
void main() {
  float L = texture(uP, vUv - vec2(uTx.x, 0)).x, R = texture(uP, vUv + vec2(uTx.x, 0)).x;
  float T = texture(uP, vUv + vec2(0, uTx.y)).x, B = texture(uP, vUv - vec2(0, uTx.y)).x;
  o = vec4(texture(uV, vUv).xy - vec2(R - L, T - B), 0, 1);
}`;
  const ADV_FS = F + `uniform sampler2D uV, uS; uniform float uDt, uK;
void main() {
  vec2 p = vUv - uDt * texture(uV, vUv).xy * uTx;
  o = uK * texture(uS, p);
}`;

  /* ---------- WebGL 基础 ---------- */
  const compile = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const program = (vs, fs) => {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'aP');
    gl.bindAttribLocation(p, 1, 'aUv');
    gl.bindAttribLocation(p, 2, 'aRnd');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    for (let i = 0, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i < n; i++) {
      const name = gl.getActiveUniform(p, i).name;
      u[name] = gl.getUniformLocation(p, name);
    }
    return { p, u };
  };

  let P;
  try {
    P = {
      sim: program(QUAD_VS, SIM_FS), pts: program(PT_VS, PT_FS),
      splat: program(QUAD_VS, SPLAT_FS), curl: program(QUAD_VS, CURL_FS), vort: program(QUAD_VS, VORT_FS),
      div: program(QUAD_VS, DIV_FS), scale: program(QUAD_VS, SCALE_FS), pres: program(QUAD_VS, PRES_FS),
      grad: program(QUAD_VS, GRAD_FS), adv: program(QUAD_VS, ADV_FS)
    };
  } catch (e) { return off('着色器编译失败 ' + e.message); }

  const target = (w, h, ifmt, filter, data) => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fmt = ifmt === gl.RG16F ? gl.RG : (ifmt === gl.R16F ? gl.RED : gl.RGBA);
    gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, gl.FLOAT, data || null);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0);
    if (!data) gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!ok) throw new Error('帧缓冲不完整');
    return { t, fb, w, h };
  };
  const pair = (w, h, ifmt, filter, data) => {
    const o = { a: target(w, h, ifmt, filter, data), b: target(w, h, ifmt, filter, data) };
    o.swap = () => { const x = o.a; o.a = o.b; o.b = x; };
    return o;
  };

  // 全屏四边形
  const quad = gl.createVertexArray();
  gl.bindVertexArray(quad);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  /* ---------- 粒子：把点撒到雕塑表面上 ---------- */
  const sdfJS = p => {
    const L = Math.hypot(p[0], p[1], p[2]);
    if (L > .8) return L - .7;
    const a = Math.atan2(p[1], p[0]);
    const R = .27 + .035 * Math.sin(a * 2 + .6);
    const r = .088 + .03 * Math.sin(a * 3 + 1.1) + .018 * Math.sin(a * 5 - .4);
    let qx = Math.hypot(p[0], p[1]) - R, qy = p[2] - .09 * Math.sin(a * 2 + 1.7);
    const t = a * 1.5, ct = Math.cos(t), st = Math.sin(t);
    const q = [ct * qx - st * qy, st * qx + ct * qy];
    const e = [1.35 * r, .72 * r];
    return (Math.hypot(q[0] / e[0], q[1] / e[1]) - 1) * Math.min(e[0], e[1]);
  };
  const gradJS = p => {
    const h = .001, o = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      const a = p.slice(), b = p.slice(); a[i] -= h; b[i] += h;
      o[i] = (sdfJS(b) - sdfJS(a)) / (2 * h);
    }
    return o;
  };
  let posTex, orgTex, ptsVao;
  const seed = () => {
    const n = SIZE * SIZE, data = new Float32Array(n * 4);
    let placed = 0;
    for (let tries = 0; placed < n && tries < n * 40; tries++) {
      const a = Math.random() * Math.PI * 2;
      const R = .27 + .035 * Math.sin(a * 2 + .6);
      const r = .088 + .03 * Math.sin(a * 3 + 1.1) + .018 * Math.sin(a * 5 - .4);
      const th = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random());
      const ex = rr * Math.cos(th) * 1.35 * r, ey = rr * Math.sin(th) * .72 * r;
      const t = a * 1.5, ct = Math.cos(t), st = Math.sin(t);
      const qx = ct * ex + st * ey, qy = -st * ex + ct * ey + .09 * Math.sin(a * 2 + 1.7);
      const p = [Math.cos(a) * (R + qx), Math.sin(a) * (R + qx), qy];
      if (sdfJS(p) > .002) continue;
      const i = placed * 4;
      data[i] = p[0]; data[i + 1] = p[1]; data[i + 2] = p[2]; data[i + 3] = 1;
      placed++;
    }
    if (placed < n) throw new Error('撒点不足 ' + placed);
    posTex = pair(SIZE, SIZE, POS_IF, gl.NEAREST, data);
    orgTex = target(SIZE, SIZE, POS_IF, gl.NEAREST, data);   // 原点：只读，不参与 ping-pong
    const rnd = new Float32Array(n * 4);
    for (let i = 0; i < n * 4; i++) rnd[i] = Math.random();
    const uv = new Float32Array(n * 2);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 2;
      uv[i] = (x + .5) / SIZE; uv[i + 1] = (y + .5) / SIZE;
    }
    ptsVao = gl.createVertexArray();
    gl.bindVertexArray(ptsVao);
    const buf = (loc, arr, comps) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, comps, gl.FLOAT, false, 0, 0);
    };
    buf(1, uv, 2);
    buf(2, rnd, 4);
    gl.bindVertexArray(null);
  };
  try { seed(); } catch (e) { return off(e.message); }

  /* ---------- 流体纹理 ---------- */
  const LIN = gl.LINEAR;
  let vel, dye, curlT, divT, pres;
  const makeFluid = () => {
    vel = pair(SIM, SIM, gl.RG16F, LIN);
    dye = pair(DYE, DYE, gl.RGBA16F, LIN);
    curlT = target(SIM, SIM, gl.R16F, LIN);
    divT = target(SIM, SIM, gl.R16F, gl.NEAREST);
    pres = pair(SIM, SIM, gl.R16F, gl.NEAREST);
  };
  try { makeFluid(); } catch (e) { return off('流体纹理失败 ' + e.message); }

  /* ---------- 渲染 ---------- */
  const U = (prog, name, fn) => { const l = prog.u[name]; if (l) fn(l); };
  const drawQuad = prog => { gl.useProgram(prog.p); gl.bindVertexArray(quad); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); };
  const bind = (unit, tex) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); };
  const to = fb => gl.bindFramebuffer(gl.FRAMEBUFFER, fb);

  let W = 1, Hpx = 1, dpr = 1, aspect = 1;
  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    W = Math.max(2, Math.round(innerWidth * dpr));
    Hpx = Math.max(2, Math.round(innerHeight * dpr));
    cv.width = W; cv.height = Hpx;
    aspect = innerWidth / innerHeight;
  };
  addEventListener('resize', resize, { passive: true });
  resize();

  // 透视矩阵
  const persp = (fovy, a, n, f) => {
    const t = 1 / Math.tan(fovy / 2), m = new Float32Array(16);
    m[0] = t / a; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = 2 * f * n / (n - f);
    return m;
  };
  // 模型矩阵：绕 x 轴 -0.3，绕 y 轴随时间转动
  const model = ang => {
    const cx = Math.cos(-.3), sx = Math.sin(-.3), cy = Math.cos(ang), sy = Math.sin(ang);
    const m = new Float32Array(16);
    m[0] = cy; m[1] = sx * sy; m[2] = cx * sy;
    m[4] = 0; m[5] = cx; m[6] = -sx;
    m[8] = -sy; m[9] = sx * cy; m[10] = cx * cy; m[15] = 1;
    return m;
  };
  const mul = (a, b) => {
    const m = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; m[c * 4 + r] = s;
    }
    return m;
  };
  // 相机：位于 (gx, gy, 1.6)，始终看向原点；gx/gy 随鼠标缓动（gaze）
  const lookAt = (ex, ey, ez) => {
    let zx = ex, zy = ey, zz = ez; const zl = Math.hypot(zx, zy, zz); zx /= zl; zy /= zl; zz /= zl;
    let xx = zz, xy = 0, xz = -zx; const xl = Math.hypot(xx, xy, xz); xx /= xl; xy /= xl; xz /= xl;   // up(0,1,0) × z
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return new Float32Array([xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
      -(xx * ex + xy * ey + xz * ez), -(yx * ex + yy * ey + yz * ez), -(zx * ex + zy * ey + zz * ez), 1]);
  };
  const gaze = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', e => {
    gaze.tx = (e.clientX / innerWidth - .5) * .5;
    gaze.ty = -(e.clientY / innerHeight - .5) * .3;
  }, { passive: true });

  // 读取 CSS 颜色变量（#rgb / #rrggbb / rgb()），结果缓存，主题变化时清空
  const colCache = {};
  const css3 = v => {
    if (colCache[v]) return colCache[v];
    const s = getComputedStyle(root).getPropertyValue(v).trim();
    let c = [1, 1, 1];
    let h = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (h) {
      h = h[1].length === 3 ? h[1].replace(/./g, x => x + x) : h[1];
      c = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
    } else {
      const m = s.match(/[\d.]+/g);
      if (m && m.length >= 3) c = m.slice(0, 3).map(n => +n / 255);
    }
    return (colCache[v] = c);
  };
  // 粒子调色板：--fx-p0 … --fx-p11（0–4 红系，5–9 蓝系，10–11 浅灰 / 肉色）
  let palCache = null;
  const palette = () => {
    if (palCache) return palCache;
    const a = new Float32Array(36);
    for (let i = 0; i < 12; i++) a.set(css3('--fx-p' + i), i * 3);
    return (palCache = a);
  };
  new MutationObserver(() => { palCache = null; for (const k in colCache) delete colCache[k]; })
    .observe(root, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });

  // 指针：拖动时沿轨迹写入流体
  const ptr = { x: .5, y: .5, px: .5, py: .5, down: false, moved: false };
  const setPtr = e => {
    const t = e.touches ? e.touches[0] : e;
    if (!t) return;
    ptr.px = ptr.x; ptr.py = ptr.y;
    ptr.x = t.clientX / innerWidth; ptr.y = 1 - t.clientY / innerHeight;
    ptr.moved = true;
  };
  addEventListener('pointerdown', e => { ptr.down = true; setPtr(e); }, { passive: true });
  addEventListener('pointermove', e => { if (e.pointerType === 'mouse' || ptr.down) setPtr(e); }, { passive: true });
  addEventListener('pointerup', () => { ptr.down = false; }, { passive: true });
  addEventListener('touchstart', e => { ptr.down = true; setPtr(e); }, { passive: true });
  addEventListener('touchmove', e => { if (ptr.down) setPtr(e); }, { passive: true });
  addEventListener('touchend', () => { ptr.down = false; }, { passive: true });

  const splat = (prog, dst, src, radius, color, mouse) => {
    to(dst.fb); gl.viewport(0, 0, dst.w, dst.h);
    gl.useProgram(prog.p); gl.bindVertexArray(quad);
    bind(0, src.t); U(prog, 'uT', l => gl.uniform1i(l, 0));
    U(prog, 'uA', l => gl.uniform2f(l, ptr.px, ptr.py));
    U(prog, 'uB', l => gl.uniform2f(l, ptr.x, ptr.y));
    U(prog, 'uC', l => gl.uniform3fv(l, color));
    U(prog, 'uR', l => gl.uniform1f(l, radius));
    U(prog, 'uAsp', l => gl.uniform1f(l, aspect));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (mouse) { ptr.px = ptr.x; ptr.py = ptr.y; ptr.moved = false; }
  };

  let last = performance.now(), running = true, ang = 0, mouseAmt = 0;
  let hiddenSince = 0;
  const frame = now => {
    if (!running) return;
    // The memory wall uses native scrolling and stays free of the animated particle field.
    if (root.dataset.memories === 'on') {
      last = now;
      return;
    }
    // 只在第一页显示（main.js 写 <html data-cover>）；淡出完成后停掉模拟和绘制，省电
    if (root.dataset.cover === 'off') {
      if (!hiddenSince) hiddenSince = now;
      if (now - hiddenSince > 1200) { last = now; requestAnimationFrame(frame); return; }
    } else hiddenSince = 0;
    const dt = Math.min((now - last) / 1000, .033); last = now;
    const hz = dt * 60;
    ang += dt * .15;
    mouseAmt += ((ptr.moved || ptr.down ? 1 : 0) - mouseAmt) * .08;

    // 流体一步
    const tx = [1 / SIM, 1 / SIM];
    const step = (prog, dst, set) => {
      to(dst.fb); gl.viewport(0, 0, dst.w, dst.h);
      gl.useProgram(prog.p); gl.bindVertexArray(quad);
      U(prog, 'uTx', l => gl.uniform2fv(l, tx));
      set(prog);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    if (ptr.moved) {
      const dx = (ptr.x - ptr.px) * aspect, dy = ptr.y - ptr.py;
      splat(P.splat, vel.b, vel.a, .0004, [dx * 600, dy * 600, 0], false); vel.swap();
      splat(P.splat, dye.b, dye.a, .0006, [1, 1, 1], true); dye.swap();
    }
    step(P.curl, curlT, p => { bind(0, vel.a.t); U(p, 'uV', l => gl.uniform1i(l, 0)); });
    step(P.vort, vel.b, p => {
      bind(0, vel.a.t); U(p, 'uV', l => gl.uniform1i(l, 0));
      bind(1, curlT.t); U(p, 'uC', l => gl.uniform1i(l, 1));
      U(p, 'uCurl', l => gl.uniform1f(l, 30)); U(p, 'uDt', l => gl.uniform1f(l, dt));
    }); vel.swap();
    step(P.div, divT, p => { bind(0, vel.a.t); U(p, 'uV', l => gl.uniform1i(l, 0)); });
    step(P.scale, pres.b, p => { bind(0, pres.a.t); U(p, 'uT', l => gl.uniform1i(l, 0)); U(p, 'uK', l => gl.uniform1f(l, .8)); }); pres.swap();
    for (let i = 0; i < 5; i++) {
      step(P.pres, pres.b, p => {
        bind(0, pres.a.t); U(p, 'uP', l => gl.uniform1i(l, 0));
        bind(1, divT.t); U(p, 'uD', l => gl.uniform1i(l, 1));
      }); pres.swap();
    }
    step(P.grad, vel.b, p => {
      bind(0, pres.a.t); U(p, 'uP', l => gl.uniform1i(l, 0));
      bind(1, vel.a.t); U(p, 'uV', l => gl.uniform1i(l, 1));
    }); vel.swap();
    step(P.adv, vel.b, p => {
      bind(0, vel.a.t); U(p, 'uV', l => gl.uniform1i(l, 0));
      bind(1, vel.a.t); U(p, 'uS', l => gl.uniform1i(l, 1));
      U(p, 'uDt', l => gl.uniform1f(l, dt)); U(p, 'uK', l => gl.uniform1f(l, .99));
    }); vel.swap();
    const dtx = [1 / DYE, 1 / DYE];
    to(dye.b.fb); gl.viewport(0, 0, DYE, DYE);
    gl.useProgram(P.adv.p); gl.bindVertexArray(quad);
    U(P.adv, 'uTx', l => gl.uniform2fv(l, dtx));
    bind(0, vel.a.t); U(P.adv, 'uV', l => gl.uniform1i(l, 0));
    bind(1, dye.a.t); U(P.adv, 'uS', l => gl.uniform1i(l, 1));
    U(P.adv, 'uDt', l => gl.uniform1f(l, dt)); U(P.adv, 'uK', l => gl.uniform1f(l, .98));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); dye.swap();

    // 粒子一步
    gaze.x += (gaze.tx - gaze.x) * .05 * hz;
    gaze.y += (gaze.ty - gaze.y) * .05 * hz;
    // 雕塑固定在第一页，不跟翻页移动或散开
    const view = lookAt(gaze.x, gaze.y, mobile ? 2.1 : 1.6);
    const proj = persp(Math.PI / 4, aspect, .1, 10);
    const M = model(ang), PV = mul(proj, view);
    to(posTex.b.fb); gl.viewport(0, 0, SIZE, SIZE);
    gl.useProgram(P.sim.p); gl.bindVertexArray(quad);
    bind(0, posTex.a.t); U(P.sim, 'uPos', l => gl.uniform1i(l, 0));
    bind(1, orgTex.t); U(P.sim, 'uOrigin', l => gl.uniform1i(l, 1));
    bind(2, vel.a.t); U(P.sim, 'uVel', l => gl.uniform1i(l, 2));
    bind(3, dye.a.t); U(P.sim, 'uDye', l => gl.uniform1i(l, 3));
    U(P.sim, 'uTime', l => gl.uniform1f(l, now / 1000));
    U(P.sim, 'uHz', l => gl.uniform1f(l, hz));
    U(P.sim, 'uMouse', l => gl.uniform1f(l, mouseAmt));
    U(P.sim, 'uShift', l => gl.uniform1f(l, 0));
    U(P.sim, 'uScatter', l => gl.uniform1f(l, 0));
    U(P.sim, 'uPV', l => gl.uniformMatrix4fv(l, false, PV));
    U(P.sim, 'uModel', l => gl.uniformMatrix4fv(l, false, M));
    const flow = new Float32Array([M[0], M[4], M[8], M[1], M[5], M[9], M[2], M[6], M[10]]);
    U(P.sim, 'uFlow', l => gl.uniformMatrix3fv(l, false, flow));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); posTex.swap();

    // 画到屏幕
    to(null); gl.viewport(0, 0, W, Hpx);
    const bg = css3('--fx-bg');
    gl.clearColor(bg[0], bg[1], bg[2], 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(P.pts.p); gl.bindVertexArray(ptsVao);
    bind(0, posTex.a.t); U(P.pts, 'uPos', l => gl.uniform1i(l, 0));
    U(P.pts, 'uP', l => gl.uniformMatrix4fv(l, false, proj));
    U(P.pts, 'uV', l => gl.uniformMatrix4fv(l, false, view));
    U(P.pts, 'uM', l => gl.uniformMatrix4fv(l, false, M));
    U(P.pts, 'uDpr', l => gl.uniform1f(l, dpr));
    U(P.pts, 'uScale', l => gl.uniform1f(l, SIZE >= 512 ? 1 : (SIZE >= 256 ? 1.6 : 2.6)));
    U(P.pts, 'uTime', l => gl.uniform1f(l, now / 1000));
    U(P.pts, 'uGain', l => gl.uniform1f(l, 1.02));
    U(P.pts, 'uPal[0]', l => gl.uniform3fv(l, palette()));
    gl.drawArrays(gl.POINTS, 0, SIZE * SIZE);
    gl.disable(gl.BLEND);
    requestAnimationFrame(frame);
  };

  document.addEventListener('visibilitychange', () => {
    if (reduce) return;
    running = !document.hidden;
    if (running) { last = performance.now(); requestAnimationFrame(frame); }
  });
  if ('MutationObserver' in window) {
    const memoryObserver = new MutationObserver(() => {
      if (running && root.dataset.memories !== 'on') {
        last = performance.now();
        requestAnimationFrame(frame);
      }
    });
    memoryObserver.observe(root, { attributes: true, attributeFilter: ['data-memories'] });
  }
  root.dataset.field = 'on';
  if (!reduce) requestAnimationFrame(frame);
  else { running = false; root.dataset.field = 'still'; requestAnimationFrame(t => { running = true; frame(t); running = false; }); }
})();
