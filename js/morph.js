/* =========================================================
   翻页粒子：一页离开时碎成背景里的尘埃，下一頁抵达时重新聚拢。
   - 粒子在「页面局部坐标」里采样：文字按行铺点（大标题最密），玻璃沿边撒点
   - 每帧只按「离吸附点有多远」q 算散开量，滚到哪停在哪，往回滚会倒放
   - 同时驱动页面的 filter: blur() 与 opacity：散开 → 失焦 → 对焦收拢
   - 颜色取自背景粒子（冷白 / 群青 / 一点红），叠加混合，像尘埃汇进背景
   - 性能：颜色 × 透明度预烘成 15 张柔光贴图，按桶绘制，每页只切十几次状态
   ========================================================= */
(() => {
  'use strict';
  const cv = document.getElementById('fx');
  if (!cv) return;
  const ctx = cv.getContext('2d', { alpha: true });
  if (!ctx) return;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = matchMedia('(max-width: 900px), (pointer: coarse)').matches;
  const lowPower = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  // 板块的「面」也要碎，所以预算比只碎文字时给得多一些
  const MAX_PARTS = (small ? 760 : lowPower ? 1250 : 2000) * (reduce ? .5 : 1);
  // 减少动效偏好时不去模糊，只留粒子（滚动驱动、可随时停，比自动播放温和）
  const BLUR_MAX = reduce ? 0 : small ? 3.4 : 6.6;

  let DPR = 1, W = 1, H = 1;
  const size = () => {
    DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    W = Math.max(1, Math.round(innerWidth));
    H = Math.max(1, Math.round(innerHeight));
    cv.width = Math.round(W * DPR);
    cv.height = Math.round(H * DPR);
    // canvas 是替换元素，光靠 CSS inset:0 不会被拉伸：
    // 不写死 CSS 尺寸，它就保持「视口 × DPR」那么大，DPR>1 的屏幕上尘埃会整体放大错位。
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalCompositeOperation = 'source-over';   // 浅底上叠加发光会看不见，改成普通覆盖
  };
  size();

  /* ---------- 柔光点精灵：颜色 × 透明度预烘成 15 张 ---------- */
  // 与背景粒子同一套：0–4 红系、5–9 蓝系（各 8%），10–11 浅灰 / 肉色（各 10%）
  const RGB = [
    [246, 188, 194],   // 浅粉
    [244, 164, 140],   // 珊瑚
    [236, 126, 152],   // 玫瑰
    [240, 112, 90],    // 朱红
    [226, 59, 74],     // 封面红
    [188, 202, 242],   // 浅群青
    [143, 176, 255],   // 长春花蓝
    [95, 154, 232],    // 天青
    [47, 109, 255],    // 群青
    [74, 95, 208],     // 宝蓝
    [217, 215, 211],   // 浅灰
    [239, 205, 182]    // 肉色
  ];
  const WEIGHT = [.08, .08, .08, .08, .08, .08, .08, .08, .08, .08, .1, .1];
  const LEVELS = [.32, .58, .88];
  const sprites = [];
  RGB.forEach(([r, g, b], ci) => {
    LEVELS.forEach((lv, li) => {
      const s = 28;
      const c = document.createElement('canvas');
      c.width = c.height = s;
      const x = c.getContext('2d');
      const g0 = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g0.addColorStop(0, `rgba(${r},${g},${b},${lv})`);
      g0.addColorStop(.34, `rgba(${r},${g},${b},${lv * .78})`);
      g0.addColorStop(.7, `rgba(${r},${g},${b},${lv * .2})`);
      g0.addColorStop(1, `rgba(${r},${g},${b},0)`);
      x.fillStyle = g0;
      x.fillRect(0, 0, s, s);
      sprites[ci * LEVELS.length + li] = c;
    });
  });
  const pick = () => {
    let r = Math.random(), ci = 0;
    while (ci < WEIGHT.length - 1 && r >= WEIGHT[ci]) { r -= WEIGHT[ci]; ci++; }
    return ci * LEVELS.length + (Math.random() * LEVELS.length | 0);
  };

  /* ---------- 采样 ---------- */
  const recs = new Map();
  // 「和你一起吃饭」「和你一起玩」这两条横向轨道会自己往前滚：
  // 粒子记下采样时的滚动量和所属轨道，绘制时按当前滚动量补差，尘埃才一直贴着自己的卡片。
  let curMV;                                   // 采样时的 scrollLeft
  let curMT;                                   // 所属轨道元素

  const add = (arr, x, y, big, rMul) => {
    const ang = Math.random() * Math.PI * 2;
    const dist = (14 + Math.random() * 118) * (big ? 1.3 : 1);
    arr.push({
      x, y,
      mv: curMV, mt: curMT,
      si: pick(),
      r: (2.4 + Math.random() * 3.4) * (big ? 1.28 : 1) * (rMul || 1),
      vx: Math.cos(ang) * dist,
      vy: Math.sin(ang) * dist * .8 - 34,
      sp: .5 + Math.random() * .95
    });
  };

  // 文字行：抖动网格，行有多高就铺多密（大标题最密）
  const fillText = (out, j, limit) => {
    const step = j.h > 90 ? 7 : j.h > 40 ? 8.5 : 9.5;
    const cols = Math.max(1, Math.round(j.w / step));
    const rows = Math.max(1, Math.round(j.h / step));
    const dx = j.w / cols, dy = j.h / rows;
    for (let i = 0; i < cols; i++) {
      for (let k = 0; k < rows; k++) {
        if (out.length >= limit) return;
        add(out,
          j.x + i * dx + dx * (.15 + Math.random() * .7),
          j.y + k * dy + dy * (.15 + Math.random() * .7),
          j.h > 44);
      }
    }
  };

  // 玻璃板块：整块「面」碎成一片片，而不是只掉边框
  const fillPanel = (out, j, limit) => {
    // 面：粗网格 + 抖动 → 像玻璃裂成一块块
    const step = 34;
    const cols = Math.max(2, Math.round(j.w / step));
    const rows = Math.max(2, Math.round(j.h / step));
    const dx = j.w / cols, dy = j.h / rows;
    for (let i = 0; i < cols && out.length < limit; i++) {
      for (let k = 0; k < rows && out.length < limit; k++) {
        add(out,
          j.x + (i + .5) * dx + (Math.random() - .5) * dx * .85,
          j.y + (k + .5) * dy + (Math.random() - .5) * dy * .85,
          true, 1.55);
      }
    }
    // 边：更密更细，边缘先崩
    const per = Math.max(8, Math.round((j.w + j.h) * 1.5 / 15));
    for (let i = 0; i < per && out.length < limit; i++) {
      const side = i & 3;
      if (side === 0) add(out, j.x + Math.random() * j.w, j.y + (Math.random() - .5) * 2, true, 1.1);
      else if (side === 1) add(out, j.x + Math.random() * j.w, j.y + j.h + (Math.random() - .5) * 2, true, 1.1);
      else if (side === 2) add(out, j.x + (Math.random() - .5) * 2, j.y + Math.random() * j.h, true, 1.1);
      else add(out, j.x + j.w + (Math.random() - .5) * 2, j.y + Math.random() * j.h, true, 1.1);
    }
  };

  const sample = el => {
    if (el && el.hasAttribute('data-no-particles')) return [];
    const pr = el.getBoundingClientRect();
    const texts = [];
    const panels = [];
    const skip = n => !!(n.closest && (n.closest('.ghost') || n.closest('.film__track')));

    // 横向滚动的那条轨道：只采当前看得见的那几张，并把滚动量记下来
    const track = el.querySelector('.food__track');
    const base = track ? track.scrollLeft : 0;
    const mvOf = n => (track && track.contains(n) ? base : undefined);
    // 轨道里横向跑到屏幕外的卡片不采样（41 张全采会挤爆预算）
    const visL = -40, visR = pr.width + 40;
    const offscreen = r => (r.left - pr.left) > visR || (r.right - pr.left) < visL;

    // 1) 文本行
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (!n.parentElement || skip(n.parentElement)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const range = document.createRange();
    let node;
    while ((node = walker.nextNode())) {
      range.selectNodeContents(node);
      const rects = range.getClientRects();
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        if (r.width < 3 || r.height < 2) continue;
        if (offscreen(r)) continue;
        texts.push({
          area: r.width * r.height,
          mv: mvOf(node.parentElement),
          x: r.left - pr.left, y: r.top - pr.top, w: r.width, h: r.height
        });
      }
    }

    // 2) 玻璃面板 / 地图点：整块面取样；嵌套在玻璃里的图片由外层负责，避免重复
    el.querySelectorAll('.glass, .map__node').forEach(n => {
      if (skip(n)) return;
      const outer = n.parentElement && n.parentElement.closest('.glass');
      if (outer && outer !== n) return;
      const r = n.getBoundingClientRect();
      if (r.width < 12 || r.height < 12) return;
      if (offscreen(r)) return;
      panels.push({
        area: r.width * r.height,
        mv: mvOf(n),
        x: r.left - pr.left, y: r.top - pr.top, w: r.width, h: r.height
      });
    });

    const out = [];
    texts.sort((a, b) => b.area - a.area);
    panels.sort((a, b) => b.area - a.area);

    // 文字先吃一半预算（字最需要认清），板块再吃掉剩下的
    const textLimit = Math.round(MAX_PARTS * (panels.length ? .45 : 1));
    for (let i = 0; i < texts.length && out.length < textLimit; i++) {
      curMV = texts[i].mv; curMT = texts[i].mv === undefined ? undefined : track;
      fillText(out, texts[i], textLimit);
    }
    for (let i = 0; i < panels.length && out.length < MAX_PARTS; i++) {
      curMV = panels[i].mv; curMT = panels[i].mv === undefined ? undefined : track;
      fillPanel(out, panels[i], MAX_PARTS);
    }
    curMV = curMT = undefined;

    // 按贴图分桶，绘制时少切换状态
    out.sort((a, b) => a.si - b.si);
    return out;
  };

  const ensure = el => {
    if (el && el.hasAttribute('data-no-particles')) {
      const rec = { parts: [], ready: true };
      recs.set(el, rec);
      return rec;
    }
    let rec = recs.get(el);
    if (rec && rec.ready) return rec;
    rec = rec || {};
    rec.parts = sample(el);
    rec.ready = true;
    recs.set(el, rec);
    return rec;
  };

  // 启动后主动把每一页采好，别等第一次翻页才同步采样（那一下会把动画卡掉）
  let warmList = [];
  const warm = () => {
    const el = warmList.shift();
    if (!el) return;
    ensure(el);
    setTimeout(warm, 16);
  };

  /* ---------- 每帧 ---------- */
  // 翻页阶段：0 = 聚拢对焦，1 = 完全溶解失焦。
  // 自由滚动（触控板 / 手指）时由 main.js 驱动；按页翻时走下面的 turn 编排。
  let phase = 0;
  const setPhase = v => { phase = Math.min(1, Math.max(0, v)); };

  /* ---------- 按页翻：旧页溶解 → 失焦 → 移出；新页粒子移入 → 聚焦融合 ---------- */
  const c01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const easeIn = k => k * k * k;
  const easeOut = k => 1 - Math.pow(1 - k, 3);
  const FRAME = 1000 / 60;
  let turn = null;

  const clearStyle = inner => {
    if (inner && (inner.style.filter || inner.style.opacity)) {
      inner.style.filter = '';
      inner.style.opacity = '';
    }
  };

  // from / to：main.js 里的页面记录（el, inner, top）。oldSt / newSt：翻页前后的滚动位置。
  const startTurn = (from, to, dir, oldSt, newSt, ms) => {
    if (turn) endTurn();
    turn = {
      from, to, dir,
      fromTop: from.top - oldSt,     // 两组粒子都按固定的屏幕坐标画，跟中途跳转的 scrollTop 无关
      toTop: to.top - newSt,
      out: ensure(from.el).parts,
      inn: ensure(to.el).parts,
      A: Math.max(4, Math.round(ms.dis / FRAME)),     // 溶解失焦
      B: Math.max(6, Math.round(ms.move / FRAME)),    // 旧页移出 / 新页移入
      C: Math.max(4, Math.round(ms.ref / FRAME)),     // 新页聚焦融合
      f: 0,
      last: performance.now(),
      jumped: false
    };
    if (to.inner) { to.inner.style.opacity = '0'; to.inner.style.filter = 'blur(' + BLUR_MAX + 'px)'; }
  };

  const endTurn = () => {
    if (!turn) return;
    clearStyle(turn.from.inner);
    clearStyle(turn.to.inner);
    phase = 0;
    turn = null;
  };

  // 每帧推进一格；jump = 这一帧该把 scrollTop 跳到新页（旧页已完全隐去）
  const advance = () => {
    const t = turn;
    if (!t) return { phase: 0, jump: false, done: true };
    t.f++;
    t.last = performance.now();
    const jump = !t.jumped && t.f >= t.A;
    if (jump) t.jumped = true;
    const kA = c01(t.f / t.A);
    const kC = c01((t.f - t.A - 2 * t.B) / t.C);
    phase = t.f < t.A ? kA : t.f < t.A + 2 * t.B ? 1 : 1 - kC;
    const done = t.f >= t.A + 2 * t.B + t.C;
    if (done) endTurn();
    return { phase, jump, done };
  };

  // 渐进：每颗粒子按自己在页面里的位置错开出发，前沿先走、后面陆续跟上
  const STAGGER = .4;
  const order = (pt, dir, ph) => {
    const ny = c01(pt.y / Math.max(1, ph));
    const lead = dir > 0 ? ny : 1 - ny;               // 朝移动方向的那一侧先走
    return c01(lead * .7 + ((pt.sp - .5) / .95) * .3); // 加一点随机，边缘不齐
  };

  // 一条轨道一帧只读一次 scrollLeft
  const offs = new Map();
  const offOf = t => {
    let v = offs.get(t);
    if (v === undefined) { v = t.scrollLeft; offs.set(t, v); }
    return v;
  };

  // k: { mode 'out' | 'in', p 本阶段进度, s 散开量, a 整体透明度, dir, ph 页面高度 }
  const drawSet = (parts, top, k) => {
    if (k.a < .02) return;
    const cx = W * .5, cy = H * .46;
    const travel = H * 1.15;
    const out = k.mode === 'out';
    offs.clear();
    for (let j = 0; j < parts.length; j++) {
      const pt = parts[j];
      // 向下翻：旧页上沿的粒子先离开；新页也是上沿的粒子先到（它们在队伍最前面）
      const d = order(pt, k.dir, k.ph);
      const lp = c01((k.p - d * STAGGER) / (1 - STAGGER));   // 这颗粒子自己的进度
      let dy, a, sc = k.s;
      if (out) {
        if (lp >= 1) continue;
        dy = -k.dir * travel * easeIn(lp);
        a = 1 - lp * lp;                                      // 一边走一边淡出
      } else {
        if (lp <= 0) continue;
        dy = k.dir * travel * (1 - easeOut(lp));
        a = Math.min(1, lp * 2.2);                            // 一边进一边淡入
        sc = 1 - easeOut(lp);                                 // 边走边收拢：到位时正好落在自己的位置
      }
      const hx = pt.mt ? pt.x + pt.mv - offOf(pt.mt) : pt.x;
      const hy = top + pt.y;
      const x = hx + pt.vx * sc * pt.sp + (cx - hx) * .16 * sc;
      const y = hy + pt.vy * sc * pt.sp + (cy - hy) * .16 * sc + dy;
      if (x < -40 || x > W + 40 || y < -40 || y > H + 40) continue;
      const alpha = k.a * a * LEVELS[pt.si % LEVELS.length];
      if (alpha < .01) continue;
      ctx.globalAlpha = alpha;
      const s = pt.r * (1 + Math.min(1, sc) * 2.2);
      ctx.drawImage(sprites[pt.si], x - s * .5, y - s * .5, s, s);
    }
  };

  const drawTurn = list => {
    const t = turn;
    // 不参与这次翻页的页面不留残余样式
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (p !== t.from && p !== t.to) clearStyle(p.inner);
    }
    const kA = c01(t.f / t.A);
    const kB = c01((t.f - t.A) / t.B);

    // 旧页：先碎成粒子（kA），失焦隐去，再一颗颗陆续朝翻页反方向淡出（kB）
    if (t.from.inner && !t.jumped) {
      t.from.inner.style.filter = 'blur(' + (BLUR_MAX * kA).toFixed(2) + 'px)';
      t.from.inner.style.opacity = Math.max(0, 1 - kA * 1.45).toFixed(3);
    }
    if (kB < 1) {
      drawSet(t.out, t.fromTop, {
        mode: 'out', p: kB, dir: t.dir, ph: t.from.h,
        s: kA * kA + kB * .35,
        a: Math.min(1, kA * 4)
      });
    }

    // 新页：旧页粒子完全消失后，一颗颗陆续从另一侧淡入（kIn），到位后收拢对焦（kC）
    const kIn = c01((t.f - t.A - t.B) / t.B);
    if (t.f > t.A + t.B) {
      // 融合：最后一批粒子快到位时就开始，到位那一刻内容已在对焦
      const fuse = c01((t.f - t.A - t.B * 1.75) / (t.B * .25 + t.C));
      drawSet(t.inn, t.toTop, {
        mode: 'in', p: kIn, dir: t.dir, ph: t.to.h,
        s: 0,
        a: 1 - easeOut(fuse)
      });
      if (t.to.inner) {
        t.to.inner.style.filter = 'blur(' + (BLUR_MAX * (1 - easeOut(fuse))).toFixed(2) + 'px)';
        t.to.inner.style.opacity = easeOut(fuse).toFixed(3);
      }
    }
    ctx.globalAlpha = 1;
  };

  const update = (list, st, vh) => {
    ctx.clearRect(0, 0, W, H);
    if (document.documentElement.dataset.memories === 'on') {
      if (turn) endTurn();
      list.forEach(p => {
        if (p.inner && (p.inner.style.filter || p.inner.style.opacity)) {
          p.inner.style.filter = '';
          p.inner.style.opacity = '';
        }
      });
      return;
    }
    if (turn) {
      // 兜底：编排没人推进（被别的逻辑打断）就收掉，绝不让粒子停在半空
      if (performance.now() - turn.last > 400) endTurn();
      else { drawTurn(list); return; }
    }
    if (!list.length) return;

    const cx = W * .5;
    const cy = H * .46;
    const vhh = Math.max(vh, 1);
    const e = phase * phase;
    offs.clear();

    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const inner = p.inner;

      if (p.el.hasAttribute('data-no-particles')) {
        if (inner && (inner.style.filter || inner.style.opacity)) {
          inner.style.filter = '';
          inner.style.opacity = '';
        }
        continue;
      }

      // 离当前视口超过一屏的页面不处理：静止时玻璃才保得住 backdrop-filter
      const off = Math.abs(p.top - st) / vhh;
      if (off > 1.05) {
        if (inner && inner.style.filter) { inner.style.filter = ''; inner.style.opacity = ''; }
        continue;
      }

      if (inner) {
        const b = BLUR_MAX * phase;
        if (b > .5) {
          inner.style.filter = 'blur(' + b.toFixed(2) + 'px)';
          // 溶解到七成就完全隐去，翻页途中只剩粒子
          inner.style.opacity = Math.max(0, 1 - phase * 1.45).toFixed(3);
        } else if (inner.style.filter) {
          inner.style.filter = '';
          inner.style.opacity = '';
        }
      }

      if (phase < .02) continue;
      const rec = ensure(p.el);
      if (!rec.parts.length) continue;

      const top = p.top - st;
      const fade = Math.min(1, phase * 4) * (1 - Math.max(0, phase - .82) / .18);
      if (fade < .02) continue;

      let bucket = -1;
      for (let j = 0; j < rec.parts.length; j++) {
        const pt = rec.parts[j];
        const hx = pt.mt ? pt.x + pt.mv - offOf(pt.mt) : pt.x;
        const hy = top + pt.y;
        const x = hx + pt.vx * e * pt.sp + (cx - hx) * .16 * e;
        const y = hy + pt.vy * e * pt.sp + (cy - hy) * .16 * e;
        if (x < -40 || x > W + 40 || y < -40 || y > H + 40) continue;

        if (pt.si !== bucket) {
          bucket = pt.si;
          ctx.globalAlpha = fade * LEVELS[bucket % LEVELS.length];
        }
        const s = pt.r * (1 + phase * 2.2);
        ctx.drawImage(sprites[bucket], x - s * .5, y - s * .5, s, s);
      }
    }
    ctx.globalAlpha = 1;
  };

  const measure = list => {
    recs.clear();
    warmList = list.filter(p => !p.el.hasAttribute('data-no-particles')).map(p => p.el);
    // 当前页立刻采（马上就会用到），其余每帧一页地补，尽量不占主线程
    if (warmList.length) ensure(warmList.shift());
    setTimeout(warm, 40);
  };

  addEventListener('resize', () => { size(); recs.clear(); warm(); }, { passive: true });

  window.__morph = {
    measure,
    update,
    setPhase,
    startTurn,
    advance,
    endTurn,
    // 横向轨道滚到下一张后重新采一次，看得见的那几张才有足够粒子
    resample(el) { recs.delete(el); return ensure(el); },
    get turning() { return !!turn; },
    // 新页已经到位、正在聚焦时允许被下一次翻页打断
    get canInterrupt() { return !turn || turn.f >= turn.A + 2 * turn.B; },
    get phase() { return phase; },
    get count() { return [...recs.values()].reduce((n, r) => n + (r.parts ? r.parts.length : 0), 0); }
  };
})();
