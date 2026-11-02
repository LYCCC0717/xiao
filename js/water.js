/* =========================================================
   背景水波：鼠标 / 手指划过时，背景像水面一样晕开
   WebGL 波动方程模拟；不支持时退回 2D 涟漪圈
   ========================================================= */
(() => {
  'use strict';
  let cv = document.getElementById('water');
  if (!cv) return;
  // 拿过 WebGL 上下文的 canvas 不能换别的上下文，需要换一块新的
  const freshCanvas = () => { const c = cv.cloneNode(); cv.replaceWith(c); cv = c; return c; };
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = () => innerWidth <= 820;

  const VERT = `attribute vec2 p; varying vec2 uv; void main(){ uv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;
  const HEAD = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 uv; uniform sampler2D tex;`;

  // 波动方程：r = 高度，g = 速度
  const UPDATE = HEAD + `uniform vec2 delta;
void main(){
  vec4 info = texture2D(tex, uv);
  vec2 dx = vec2(delta.x, 0.), dy = vec2(0., delta.y);
  float avg = (texture2D(tex, uv - dx).r + texture2D(tex, uv - dy).r + texture2D(tex, uv + dx).r + texture2D(tex, uv + dy).r) * .25;
  info.g += (avg - info.r) * 2.;
  info.g *= .968;
  info.r += info.g;
  info.r *= .985;
  gl_FragColor = info;
}`;

  const DROP = HEAD + `uniform vec2 center; uniform float radius, strength, aspect;
void main(){
  vec4 info = texture2D(tex, uv);
  vec2 d = uv - center; d.x *= aspect;
  float k = max(0., 1. - length(d) / radius);
  k = .5 - cos(k * 3.14159) * .5;
  info.r += k * strength;
  gl_FragColor = info;
}`;

  // 渲染：背景（暗色渐变 + 金色光晕 + 点阵）被水面折射，再叠加高光与金色晕光
  const RENDER = HEAD + `uniform vec2 delta, res; uniform float dpr;
vec3 bg(vec2 p){
  float m = max(res.x, res.y);
  vec3 c = vec3(.031, .027, .039);
  float d1 = length(p - vec2(.8 * res.x, 1.1 * res.y)) / (.75 * m);
  c += vec3(.85, .72, .47) * .11 * (1. - smoothstep(0., 1., d1));
  float d2 = length(p - vec2(-.1 * res.x, .6 * res.y)) / (.6 * m);
  c += vec3(.91, .76, .69) * .06 * (1. - smoothstep(0., 1., d2));
  float s = 28. * dpr;
  vec2 cell = mod(p, s) - s * .5;
  float pt = 1. - smoothstep(.5 * dpr, 1.5 * dpr, length(cell));
  c += vec3(.92, .84, .68) * pt * .085;
  return c;
}
void main(){
  float h  = texture2D(tex, uv).r;
  float hx = texture2D(tex, uv + vec2(delta.x, 0.)).r - texture2D(tex, uv - vec2(delta.x, 0.)).r;
  float hy = texture2D(tex, uv + vec2(0., delta.y)).r - texture2D(tex, uv - vec2(0., delta.y)).r;
  vec2 off = vec2(hx, hy) * 90. * dpr;
  vec3 col = bg(gl_FragCoord.xy + off);
  vec3 n = normalize(vec3(-hx * 6., -hy * 6., 1.));
  float spec = pow(max(0., dot(n, normalize(vec3(-.45, .65, 1.)))), 70.);
  col += vec3(1., .93, .78) * spec * .9;
  col += vec3(.85, .72, .47) * clamp(abs(h) * 2.2, 0., .32) + vec3(.95, .85, .65) * clamp(length(vec2(hx, hy)) * 14., 0., .25);
  gl_FragColor = vec4(col, 1.);
}`;

  /* ---------- 初始化 WebGL ---------- */
  let gl = null, isGL2 = false, texType = 0, internal = 0, filter = 0;
  function initGL() {
    const opts = { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'low-power' };
    gl = cv.getContext('webgl2', opts);
    if (gl && (gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'))) {
      isGL2 = true; texType = gl.HALF_FLOAT; internal = gl.RGBA16F; filter = gl.LINEAR;
      return true;
    }
    if (gl) freshCanvas();
    gl = cv.getContext('webgl', opts) || cv.getContext('experimental-webgl', opts);
    if (!gl) return false;
    const hf = gl.getExtension('OES_texture_half_float');
    const f = gl.getExtension('OES_texture_float');
    if (hf) { texType = hf.HALF_FLOAT_OES; filter = gl.getExtension('OES_texture_half_float_linear') ? gl.LINEAR : gl.NEAREST; }
    else if (f) { texType = gl.FLOAT; filter = gl.getExtension('OES_texture_float_linear') ? gl.LINEAR : gl.NEAREST; }
    else return false;
    internal = gl.RGBA;
    return true;
  }

  function compile(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function program(frag) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, frag));
    gl.bindAttribLocation(p, 0, 'p');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name; u[name] = gl.getUniformLocation(p, name); }
    return { p, u };
  }

  let progUpdate, progDrop, progRender, targets = [], simW = 0, simH = 0, dpr = 1;
  function makeTarget(w, h) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, gl.RGBA, texType, null);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!ok) throw new Error('framebuffer incomplete');
    return { tex, fb };
  }

  function sizeGL() {
    // 渲染像素数封顶，4K 屏也不会太吃 GPU
    const w = innerWidth, h = innerHeight;
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    const cap = 2.6e6;
    if (w * h * dpr * dpr > cap) dpr = Math.sqrt(cap / (w * h));
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    // 低配设备（CPU 核数或内存少）降低模拟精度和渲染分辨率
    const low = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
    if (low) { dpr = Math.min(dpr, 1); cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const k = (isMobile() ? 3 : 4) + (low ? 1 : 0);
    simW = Math.max(64, Math.round(w / k)); simH = Math.max(64, Math.round(h / k));
    targets.forEach(t => { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); });
    targets = [makeTarget(simW, simH), makeTarget(simW, simH)];
  }

  function pass(prog, setUniforms) {
    gl.useProgram(prog.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, targets[1].fb);
    gl.viewport(0, 0, simW, simH);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, targets[0].tex);
    gl.uniform1i(prog.u.tex, 0);
    setUniforms(prog.u);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    targets.reverse();
  }

  function render() {
    gl.useProgram(progRender.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, cv.width, cv.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, targets[0].tex);
    gl.uniform1i(progRender.u.tex, 0);
    gl.uniform2f(progRender.u.delta, 1 / simW, 1 / simH);
    gl.uniform2f(progRender.u.res, cv.width, cv.height);
    gl.uniform1f(progRender.u.dpr, dpr);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /* ---------- 输入：沿鼠标轨迹投下水滴 ---------- */
  const drops = [];
  let last = null, lastInput = 0, running = false, lastFrame = 0, acc = 0;
  const STEP = 1000 / 120;
  function addDrop(x, y, strength, radius) {
    if (drops.length < 24) drops.push({ x: x / innerWidth, y: 1 - y / innerHeight, s: strength, r: radius });
    lastInput = performance.now();
    if (!running) { running = true; requestAnimationFrame(loop); }
  }
  function trail(x, y) {
    if (!last) { last = { x, y }; return; }
    const dx = x - last.x, dy = y - last.y, dist = Math.hypot(dx, dy);
    if (dist < 4) return;
    const steps = Math.min(6, Math.ceil(dist / 14));
    const s = Math.min(.09, .02 + dist * .0012);
    for (let i = 1; i <= steps; i++) addDrop(last.x + dx * i / steps, last.y + dy * i / steps, s / steps * 2, .028);
    last = { x, y };
  }

  /* ---------- 2D 降级：金色涟漪圈 ---------- */
  let ctx2d = null; const rings = [];
  function loop2d(t) {
    const c = ctx2d, w = cv.width, h = cv.height;
    c.clearRect(0, 0, w, h);
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i], age = (t - r.t) / 800;
      if (age >= 1) { rings.splice(i, 1); continue; }
      const rad = (12 + age * 140) * dpr;
      const g = c.createRadialGradient(r.x, r.y, rad * .6, r.x, r.y, rad);
      g.addColorStop(0, 'rgba(217,183,121,0)');
      g.addColorStop(.8, `rgba(234,214,174,${.16 * (1 - age)})`);
      g.addColorStop(1, 'rgba(217,183,121,0)');
      c.fillStyle = g; c.beginPath(); c.arc(r.x, r.y, rad, 0, 6.283); c.fill();
    }
    if (rings.length) requestAnimationFrame(loop2d); else running = false;
  }

  /* ---------- 主循环 ---------- */
  function loop() {
    if (!gl) return;
    const aspect = simW / simH;
    while (drops.length) {
      const d = drops.shift();
      pass(progDrop, u => { gl.uniform2f(u.center, d.x, d.y); gl.uniform1f(u.radius, d.r); gl.uniform1f(u.strength, d.s); gl.uniform1f(u.aspect, aspect); });
    }
    // 按时间推进：固定每秒 120 步，60Hz 和 120Hz/144Hz 屏上波纹速度一致；掉帧时最多补 4 步
    const now = performance.now(), dt = Math.min(50, now - (lastFrame || now - 16.7)); lastFrame = now;
    acc += dt; let n = 0;
    while (acc >= STEP && n < 4) { pass(progUpdate, u => gl.uniform2f(u.delta, 1 / simW, 1 / simH)); acc -= STEP; n++; }
    if (n === 4) acc = 0;
    render();
    // 停止输入 2.5 秒后水面已经平静，停掉循环省电
    if (performance.now() - lastInput < 2500 && !document.hidden) requestAnimationFrame(loop);
    else { running = false; lastFrame = 0; acc = 0; }
  }

  /* ---------- 启动 ---------- */
  let mode = 'none';
  try {
    if (initGL()) {
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      progUpdate = program(UPDATE); progDrop = program(DROP); progRender = program(RENDER);
      sizeGL(); render();
      mode = isGL2 ? 'webgl2' : 'webgl';
    }
  } catch (e) { gl = null; }

  if (!gl) {
    freshCanvas();
    ctx2d = cv.getContext('2d');
    const size2d = () => { dpr = Math.min(devicePixelRatio || 1, 2); cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; };
    size2d(); addEventListener('resize', size2d);
    mode = '2d';
  }
  cv.dataset.mode = mode;
  document.documentElement.dataset.water = mode;

  if (reduceMotion) return;   // 系统设置了减少动画：只显示静态背景

  const onMove = (x, y) => {
    if (gl) trail(x, y);
    else if (ctx2d) {
      if (last && Math.hypot(x - last.x, y - last.y) < 26) return;
      last = { x, y };
      rings.push({ x: x * dpr, y: y * dpr, t: performance.now() });
      if (!running) { running = true; requestAnimationFrame(loop2d); }
    }
  };
  addEventListener('pointermove', e => { if (e.pointerType !== 'touch') onMove(e.clientX, e.clientY); }, { passive: true });
  addEventListener('pointerdown', e => { if (gl) addDrop(e.clientX, e.clientY, .16, .05); else onMove(e.clientX, e.clientY); }, { passive: true });
  addEventListener('touchmove', e => { const t = e.touches[0]; if (t) onMove(t.clientX, t.clientY); }, { passive: true });
  addEventListener('touchend', () => { last = null; }, { passive: true });
  document.addEventListener('mouseleave', () => { last = null; });

  let rt; addEventListener('resize', () => {
    if (!gl) return;
    clearTimeout(rt); rt = setTimeout(() => { sizeGL(); render(); }, 150);
  });

  // 给测试脚本用：模拟一段鼠标轨迹
  window.__waterTest = () => { for (let i = 0; i <= 20; i++) onMove(innerWidth * (.2 + i * .03), innerHeight * (.5 + Math.sin(i / 3) * .12)); };
})();
