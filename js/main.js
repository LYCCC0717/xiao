/* =========================================================
   《我们》· 交互脚本
   内容在 data.js，这里一般不需要改。
   ========================================================= */
(() => {
  'use strict';
  const S = window.SITE;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const isTouch = matchMedia('(hover: none)').matches;
  const isMobile = () => innerWidth <= 820;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DAY = 86400000;

  /* ---------- 工具 ---------- */
  const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const parseDate = s => { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const fmtDate = s => s ? s.replace(/-/g, '.') : '— · —';
  const today = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
  const daysBetween = (a, b) => Math.round((b - a) / DAY);

  // 根据字符串生成稳定的伪随机数，让每件展品的占位装置都不同但固定
  const seeded = str => { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296; };
  const artHTML = (key, label = '') => {
    const r = seeded(key);
    const p = n => (r() * n).toFixed(1) + '%';
    const vars = `--ax:${p(100)};--ay:${p(60)};--x1:${p(40)};--y1:${p(30)};--x2:${(30 + r() * 40).toFixed(1)}%;--y2:${(25 + r() * 40).toFixed(1)}%;--x3:${p(80)};--y3:${p(70)};--y4:${(40 + r() * 45).toFixed(1)}%;--r4:${(-20 + r() * 40).toFixed(1)}deg`;
    return `<div class="art" style="${vars}"><i class="a1"></i><i class="a2"></i><i class="a3"></i><i class="a4"></i>${label ? `<b>${esc(label)}</b>` : ''}</div>`;
  };
  const mediaHTML = (src, key, label) => src ? `<img src="${esc(src)}" alt="${esc(label)}" loading="lazy" decoding="async">` : artHTML(key, label);

  /* =========================================================
     入口 + 音乐
     ========================================================= */
  const bgm = $('#bgm');
  const musicBtn = $('#musicBtn');
  let ambient = null;      // 没有 mp3 时的柔和环境音
  let playing = false;

  $('#musicName').textContent = S.music?.title || '';

  function startAmbient() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    const master = ctx.createGain(); master.gain.value = 0;
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 900;
    filter.connect(master); master.connect(ctx.destination);
    [130.81, 196.0, 246.94, 329.63].forEach((f, i) => {   // C3 G3 B3 E4 柔和和弦
      const o = ctx.createOscillator(); o.type = i % 2 ? 'sine' : 'triangle'; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.value = .05;
      const lfo = ctx.createOscillator(); lfo.frequency.value = .05 + i * .03;
      const lg = ctx.createGain(); lg.gain.value = .03;
      lfo.connect(lg); lg.connect(g.gain);
      o.connect(g); g.connect(filter); o.start(); lfo.start();
    });
    master.gain.linearRampToValueAtTime(.5, ctx.currentTime + 3);
    return { ctx, master };
  }

  function setPlaying(on) {
    playing = on;
    musicBtn.classList.toggle('is-paused', !on);
    musicBtn.setAttribute('aria-label', on ? '暂停音乐' : '继续播放音乐');
  }

  async function playMusic() {
    if (S.music?.src) {
      bgm.src = S.music.src;
      bgm.volume = 0;
      try {
        await bgm.play();
        let v = 0; const t = setInterval(() => { v = Math.min(.7, v + .05); bgm.volume = v; if (v >= .7) clearInterval(t); }, 120);
        setPlaying(true); return;
      } catch (e) { /* 文件不存在或被拦截，改用环境音 */ }
    }
    ambient = startAmbient();
    setPlaying(!!ambient);
  }

  musicBtn.addEventListener('click', () => {
    if (ambient) {
      playing ? ambient.ctx.suspend() : ambient.ctx.resume();
      setPlaying(!playing);
    } else if (bgm.src) {
      playing ? bgm.pause() : bgm.play();
      setPlaying(!playing);
    } else playMusic();
  });

  $('#enterBtn').addEventListener('click', () => {
    playMusic();
    const intro = $('#intro');
    intro.classList.add('is-leaving');
    document.body.classList.remove('is-locked');
    setTimeout(() => {
      document.body.classList.add('is-entered');
      intro.remove();
      countUpDays();
    }, 650);
  });

  /* =========================================================
     背景粒子 + 光标光晕
     ========================================================= */
  const cv = $('#particles');
  const cx = cv.getContext('2d');
  let parts = [], dpr = 1, raf = 0;
  function sizeCanvas() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    const n = reduceMotion ? 0 : Math.round(Math.min(90, innerWidth * innerHeight / (isMobile() ? 26000 : 18000)));
    parts = Array.from({ length: n }, () => ({
      x: Math.random() * cv.width, y: Math.random() * cv.height,
      r: (Math.random() * 1.3 + .3) * dpr, s: (Math.random() * .25 + .05) * dpr,
      a: Math.random() * .5 + .15, t: Math.random() * Math.PI * 2
    }));
  }
  let pLast = 0;
  function drawParticles(t = performance.now()) {
    // 按时间推进，高刷屏上粒子速度不变
    const f = pLast ? Math.min(3, (t - pLast) / 16.67) : 1; pLast = t;
    cx.clearRect(0, 0, cv.width, cv.height);
    for (const p of parts) {
      p.y -= p.s * f; p.t += .015 * f; p.x += Math.sin(p.t) * .15 * dpr * f;
      if (p.y < -10) { p.y = cv.height + 10; p.x = Math.random() * cv.width; }
      cx.globalAlpha = p.a * (.6 + Math.sin(p.t * 1.3) * .4);
      cx.fillStyle = '#ead6ae';
      cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 6.283); cx.fill();
    }
    raf = requestAnimationFrame(drawParticles);
  }
  sizeCanvas(); if (parts.length) drawParticles();
  document.addEventListener('visibilitychange', () => { cancelAnimationFrame(raf); pLast = 0; if (!document.hidden && parts.length) drawParticles(); });

  // 光标光晕：鼠标停下、光晕追上后停掉循环
  if (!isTouch) {
    const glow = $('.cursor-glow');
    let gx = innerWidth / 2, gy = innerHeight / 2, tx = gx, ty = gy, fRaf = 0;
    const follow = () => {
      gx += (tx - gx) * .12; gy += (ty - gy) * .12;
      glow.style.transform = `translate3d(${gx.toFixed(1)}px,${gy.toFixed(1)}px,0)`;
      fRaf = Math.abs(tx - gx) + Math.abs(ty - gy) > .5 ? requestAnimationFrame(follow) : 0;
    };
    addEventListener('pointermove', e => {
      tx = e.clientX; ty = e.clientY;
      if (!document.body.classList.contains('has-pointer')) document.body.classList.add('has-pointer');
      if (!fRaf) fRaf = requestAnimationFrame(follow);
    }, { passive: true });
  }

  /* =========================================================
     导航 + 空间化滚动
     ========================================================= */
  const plates = $('#navPlates');
  const menuBtn = $('#menuBtn');
  const closeMenu = () => { plates.classList.remove('is-open'); menuBtn.setAttribute('aria-expanded', 'false'); };
  menuBtn.addEventListener('click', () => {
    const open = !plates.classList.contains('is-open');
    plates.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
  });
  plates.addEventListener('click', e => { if (e.target.closest('a')) closeMenu(); });

  const navIO = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      const id = en.target.dataset.sec === 'ending' ? 'map' : en.target.dataset.sec;
      $$('a', plates).forEach(a => a.classList.toggle('is-active', a.dataset.sec === id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('.sec').forEach(s => navIO.observe(s));

  const revealIO = new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('is-in'); revealIO.unobserve(en.target); } });
  }, { threshold: .12, rootMargin: '0px 0px -6% 0px' });
  const observeReveal = root => $$('.reveal', root).forEach(el => revealIO.observe(el));

  /* =========================================================
     大厅：一起走过的天数
     ========================================================= */
  function countUpDays() {
    const start = parseDate(S.togetherSince);
    if (!start) return;
    const target = Math.max(0, daysBetween(start, today()) + 1);
    const el = $('#daysTogether');
    const t0 = performance.now(), dur = 1400;
    (function step(t) {
      const k = Math.max(0, Math.min(1, (t - t0) / dur));
      el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3))).toLocaleString('zh-CN');
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }

  /* =========================================================
     故事展品区
     ========================================================= */
  const themeName = id => S.themes.find(t => t.id === id) || { en: '', cn: '' };
  const stories = [...S.stories].sort((a, b) => {
    const ti = S.themes.findIndex(t => t.id === a.theme) - S.themes.findIndex(t => t.id === b.theme);
    return ti || (a.date || '9').localeCompare(b.date || '9');
  });

  const tabs = $('#themeTabs');
  tabs.innerHTML = [{ id: 'all', en: 'ALL', cn: '全部展品' }, ...S.themes]
    .map((t, i) => `<button type="button" role="tab" data-theme="${t.id}" class="${i ? '' : 'is-active'}" aria-selected="${!i}"><b>${esc(t.en)}</b><span>${esc(t.cn)}</span></button>`).join('');

  const exhibits = $('#exhibits');
  exhibits.innerHTML = stories.map((s, i) => {
    const th = themeName(s.theme);
    return `<button type="button" class="exhibit glass reveal" data-i="${i}" data-theme="${esc(s.theme)}" style="transition-delay:${(i % 3) * 80}ms">
      <div class="exhibit__art">${mediaHTML(s.photos?.[0], 'story' + s.no, 'N°' + s.no)}</div>
      <div class="exhibit__meta"><span class="exhibit__no">N°${esc(s.no)}</span><span class="label">${esc(th.en)}</span></div>
      <h3 class="exhibit__title">${esc(s.title)}</h3>
      <p class="exhibit__sum">${esc(s.summary)}</p>
      <div class="exhibit__foot"><span class="num">${fmtDate(s.date)}</span><span>${esc(s.place)}</span></div>
    </button>`;
  }).join('');
  observeReveal(exhibits);

  tabs.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $$('button', tabs).forEach(x => { x.classList.toggle('is-active', x === b); x.setAttribute('aria-selected', x === b); });
    const id = b.dataset.theme;
    $$('.exhibit', exhibits).forEach(card => {
      const show = id === 'all' || card.dataset.theme === id;
      card.classList.toggle('is-hidden', !show);
      if (show) { card.classList.remove('is-in'); requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('is-in'))); }
    });
  });

  // 鼠标悬停：轻微倾斜 + 高光跟随
  if (!isTouch) {
    exhibits.addEventListener('pointermove', e => {
      const card = e.target.closest('.exhibit'); if (!card) return;
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      card.style.setProperty('--mx', x * 100 + '%'); card.style.setProperty('--my', y * 100 + '%');
      card.style.transform = `rotateX(${(.5 - y) * 7}deg) rotateY(${(x - .5) * 9}deg) translateZ(10px)`;
    });
    exhibits.addEventListener('pointerout', e => {
      const card = e.target.closest('.exhibit');
      if (card && !card.contains(e.relatedTarget)) card.style.transform = '';
    });
  }

  exhibits.addEventListener('click', e => {
    const card = e.target.closest('.exhibit'); if (!card) return;
    burst(e.clientX || innerWidth / 2, e.clientY || innerHeight / 2);
    openStory(+card.dataset.i);
  });

  function burst(x, y) {
    if (reduceMotion) return;
    for (let i = 0; i < 18; i++) {
      const p = document.createElement('i'); p.className = 'burst';
      const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 90;
      p.style.left = x + 'px'; p.style.top = y + 'px';
      p.style.setProperty('--dx', Math.cos(a) * d + 'px'); p.style.setProperty('--dy', Math.sin(a) * d + 'px');
      document.body.appendChild(p); setTimeout(() => p.remove(), 850);
    }
  }

  /* =========================================================
     详情层（故事 / 照片 共用）
     ========================================================= */
  const viewer = $('#viewer'), vBody = $('#viewerBody');
  let vList = [], vIndex = 0, vRender = null, lastFocus = null;

  function openViewer(list, index, render) {
    vList = list; vIndex = index; vRender = render; lastFocus = document.activeElement;
    vBody.innerHTML = render(list[index], index);
    viewer.hidden = false;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => viewer.classList.add('is-open'));
    $('.viewer__close', viewer).focus({ preventScroll: true });
  }
  function closeViewer() {
    viewer.classList.remove('is-open');
    document.body.style.overflow = '';
    setTimeout(() => { viewer.hidden = true; vBody.innerHTML = ''; }, 450);
    lastFocus?.focus?.({ preventScroll: true });
  }
  function stepViewer(d) {
    vIndex = (vIndex + d + vList.length) % vList.length;
    vBody.innerHTML = vRender(vList[vIndex], vIndex);
    vBody.scrollTop = 0;
  }
  viewer.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) closeViewer();
    const nav = e.target.closest('[data-step]'); if (nav) stepViewer(+nav.dataset.step);
  });
  addEventListener('keydown', e => {
    if (viewer.hidden) return;
    if (e.key === 'Escape') closeViewer();
    if (e.key === 'ArrowRight') stepViewer(1);
    if (e.key === 'ArrowLeft') stepViewer(-1);
  });
  // 手机上左右滑动切换
  let sx = 0, sy = 0;
  viewer.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  viewer.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) stepViewer(dx < 0 ? 1 : -1);
  }, { passive: true });

  const navBtns = `<div class="viewer__nav"><button type="button" class="glass" data-step="-1" aria-label="上一件">← 上一件</button><button type="button" class="glass" data-step="1" aria-label="下一件">下一件 →</button></div>`;

  function openStory(i) {
    openViewer(stories, i, s => {
      const th = themeName(s.theme);
      const media = s.photos?.length ? s.photos.map(src => `<img src="${esc(src)}" alt="${esc(s.title)}">`).join('') : artHTML('story' + s.no, 'N°' + s.no);
      return `<div class="viewer__media">${media}</div>
        <div class="viewer__text">
          <p class="label">EXHIBIT N°${esc(s.no)} · ${esc(th.en)} · ${esc(th.cn)}</p>
          <h3>${esc(s.title)}</h3>
          <div class="viewer__meta"><span class="num">${fmtDate(s.date)}</span><span>${esc(s.place)}</span></div>
          <p class="viewer__lead">${esc(s.summary)}</p>
          ${(s.text || []).map(t => `<p>${esc(t)}</p>`).join('')}
          ${navBtns}
        </div>`;
    });
  }

  function openPhoto(i) {
    openViewer(S.photos, i, (p, k) => `<div class="viewer__media">${mediaHTML(p.src, 'photo' + k, String(k + 1).padStart(2, '0'))}</div>
      <div class="viewer__text">
        <p class="label">FILM ${String(k + 1).padStart(2, '0')} / ${String(S.photos.length).padStart(2, '0')}</p>
        <h3>${esc(p.title)}</h3>
        <div class="viewer__meta"><span class="num">${fmtDate(p.date)}</span><span>${esc(p.place)}</span></div>
        <p>${esc(p.text)}</p>
        ${navBtns}
      </div>`);
  }

  /* =========================================================
     时间长廊
     ========================================================= */
  const track = $('#corridorTrack'), corridor = $('#corridor'), railFill = $('#railFill');
  track.insertAdjacentHTML('beforeend', S.timeline.map((n, i) => {
    const showChapter = i === 0 || S.timeline[i - 1].chapter !== n.chapter;
    return `<div class="node" data-i="${i}">
      <div class="node__chapter">${showChapter ? esc(n.chapter) : ''}</div>
      <p class="node__date">${fmtDate(n.date)}</p>
      <span class="node__dot" aria-hidden="true"></span>
      <div class="node__card glass">
        <span class="node__no">N°${esc(n.no)}</span>
        <span class="node__place">${esc(n.place)}</span>
        <h3 class="node__title">${esc(n.title)}</h3>
        <p class="node__line">${esc(n.line)}</p>
      </div>
    </div>`;
  }).join(''));
  const nodes = $$('.node', track);

  // 节点依次亮起：桌面看横向滚动位置，手机看纵向位置
  function updateCorridor() {
    let lit = -1;
    if (isMobile()) {
      const line = innerHeight * .62;
      nodes.forEach((n, i) => { if (n.getBoundingClientRect().top < line) lit = i; });
      const tr = track.getBoundingClientRect();
      const fill = Math.max(0, Math.min(1, (line - tr.top) / tr.height));
      railFill.parentElement.style.setProperty('--fill', fill * 100 + '%');
    } else {
      const cr = corridor.getBoundingClientRect();
      if (cr.top > innerHeight * .8 || cr.bottom < 0) return;
      const line = cr.left + cr.width * .72;
      nodes.forEach((n, i) => { if (n.getBoundingClientRect().left < line) lit = i; });
      const last = nodes[Math.max(0, lit)];
      railFill.style.width = lit < 0 ? '0' : (last.offsetLeft + 6) + 'px';
    }
    nodes.forEach((n, i) => { n.classList.toggle('is-lit', i <= lit); n.classList.toggle('is-current', i === lit); });
  }
  corridor.addEventListener('scroll', updateCorridor, { passive: true });
  addEventListener('scroll', updateCorridor, { passive: true });

  // 桌面端：鼠标拖动 + 竖向滚轮转为横向前进
  if (!isTouch) {
    let down = false, startX = 0, startL = 0;
    corridor.addEventListener('pointerdown', e => { if (isMobile()) return; down = true; startX = e.clientX; startL = corridor.scrollLeft; corridor.classList.add('is-drag'); });
    addEventListener('pointerup', () => { down = false; corridor.classList.remove('is-drag'); });
    addEventListener('pointermove', e => { if (down) corridor.scrollLeft = startL - (e.clientX - startX); });
    corridor.addEventListener('wheel', e => {
      if (isMobile() || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const max = corridor.scrollWidth - corridor.clientWidth;
      const atEnd = (e.deltaY > 0 && corridor.scrollLeft >= max - 2) || (e.deltaY < 0 && corridor.scrollLeft <= 2);
      if (atEnd) return;                // 走到尽头时让页面继续向下
      e.preventDefault();
      corridor.scrollLeft += e.deltaY;
    }, { passive: false });
  }

  /* =========================================================
     环形胶片墙
     ========================================================= */
  const ring = $('#filmRing'), stage = $('#filmStage');
  // 照片太少时重复填充，保证环形完整
  const minCount = 10;
  const filmItems = [];
  for (let k = 0; filmItems.length < Math.max(minCount, S.photos.length); k++) filmItems.push(k % S.photos.length);
  ring.innerHTML = filmItems.map((pi, k) => {
    const p = S.photos[pi];
    return `<button type="button" class="film glass" data-p="${pi}" aria-label="${esc(p.title)}">
      <div class="film__img">${mediaHTML(p.src, 'photo' + pi, String(pi + 1).padStart(2, '0'))}</div>
      <div class="film__cap"><span>${esc(p.title)}</span><span class="num">${fmtDate(p.date).slice(2)}</span></div>
    </button>`;
  }).join('');
  const films = $$('.film', ring);

  let angle = 0, speed = .09, targetSpeed = .09, radius = 0, filmVisible = false;
  const BASE = .09, SLOW = .025;            // 每帧度数；悬停时减速但不停
  function layoutFilm() {
    const fw = isMobile() ? Math.min(150, innerWidth * .36) : Math.min(240, Math.max(170, innerWidth * .13));
    stage.style.setProperty('--fw', fw + 'px');
    radius = Math.max(fw * 1.9, (fw + 26) * films.length / (2 * Math.PI));
    films.forEach((f, k) => { f.style.transform = `rotateY(${k * 360 / films.length}deg) translateZ(${radius}px)`; });
  }
  // 按时间旋转：高刷屏上不会转得更快；看不见时完全停掉循环
  let filmRaf = 0, filmLast = 0;
  function spinFilm(t) {
    const f = filmLast ? Math.min(3, (t - filmLast) / 16.67) : 1; filmLast = t;
    if (!dragging) {
      speed += (targetSpeed - speed) * Math.min(1, .06 * f);
      angle -= speed * f;
    }
    ring.style.transform = `translateZ(${-radius}px) rotateY(${angle.toFixed(2)}deg)`;
    filmRaf = filmVisible && !document.hidden ? requestAnimationFrame(spinFilm) : 0;
  }
  const kickFilm = () => { if (!filmRaf && filmVisible && !document.hidden) { filmLast = 0; filmRaf = requestAnimationFrame(spinFilm); } };
  new IntersectionObserver(([en]) => { filmVisible = en.isIntersecting; kickFilm(); }).observe(stage);
  document.addEventListener('visibilitychange', kickFilm);
  if (!isTouch) {
    stage.addEventListener('pointerenter', () => { targetSpeed = SLOW; });
    stage.addEventListener('pointerleave', () => { targetSpeed = BASE; });
  }
  // 拖动旋转（鼠标和手指都支持）
  let dragging = false, dragX = 0, dragA = 0, moved = 0;
  stage.addEventListener('pointerdown', e => {
    dragging = true; moved = 0; dragX = e.clientX; dragA = angle;
    stage.classList.add('is-drag');
  });
  addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - dragX; moved = Math.max(moved, Math.abs(dx));
    angle = dragA + dx * .22;
  }, { passive: true });
  const endDrag = () => { if (!dragging) return; dragging = false; stage.classList.remove('is-drag'); };
  addEventListener('pointerup', endDrag); addEventListener('pointercancel', endDrag);
  ring.addEventListener('click', e => {
    const f = e.target.closest('.film');
    if (!f || moved > 8) return;           // 拖动后松手不算点击
    openPhoto(+f.dataset.p);
  });

  /* =========================================================
     纪念日长廊
     ========================================================= */
  const plaquesEl = $('#plaques');
  function nextAnnual(d) {
    const t = today();
    let n = new Date(t.getFullYear(), d.getMonth(), d.getDate());
    if (n < t) n = new Date(t.getFullYear() + 1, d.getMonth(), d.getDate());
    return n;
  }
  function plaqueCount(p) {
    const d = parseDate(p.date); if (!d) return { big: '—', unit: '', sub: '日期待填写', target: null };
    const t = today();
    if (p.mode === 'since') {
      const n = daysBetween(d, t);
      return n >= 0 ? { big: n + 1, unit: '天', sub: '已经过去', target: null } : { big: -n, unit: '天后', sub: '即将到来', target: d };
    }
    const target = p.mode === 'annual' ? nextAnnual(d) : d;
    const n = daysBetween(t, target);
    if (n === 0) return { big: '今天', unit: '', sub: '就是今天', target: null };
    if (n < 0) return { big: -n, unit: '天', sub: '已经过去', target: null };
    const extra = p.mode === 'annual' ? `第 ${target.getFullYear() - d.getFullYear()} 个 · ` : '';
    return { big: n, unit: '天后', sub: extra, target };
  }
  plaquesEl.innerHTML = S.dates.map((p, i) => `<div class="plaque glass reveal" data-i="${i}" style="transition-delay:${i * 70}ms">
      <span class="plaque__no">${esc(p.no)}</span>
      <p class="plaque__en">${esc(p.en)}</p>
      <h3 class="plaque__name">${esc(p.name)}</h3>
      <p class="plaque__date">${fmtDate(p.date)}</p>
      <div class="plaque__count"><strong></strong><span></span></div>
      <p class="plaque__sub"></p>
    </div>`).join('');
  observeReveal(plaquesEl);
  const pad = n => String(n).padStart(2, '0');
  function tickPlaques() {
    $$('.plaque', plaquesEl).forEach(el => {
      const c = plaqueCount(S.dates[+el.dataset.i]);
      $('strong', el).textContent = c.big;
      $('.plaque__count span', el).textContent = c.unit;
      let sub = c.sub;
      if (c.target) {     // 精确到秒的倒计时
        const ms = Math.max(0, c.target - Date.now()) % DAY;
        sub += `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)}`;
      }
      $('.plaque__sub', el).textContent = sub;
    });
  }
  tickPlaques(); setInterval(tickPlaques, 1000);

  /* =========================================================
     发光地图
     ========================================================= */
  const svg = $('#mapSvg'), mapCard = $('#mapCard'), mapFrame = $('#mapFrame');
  const NS = 'http://www.w3.org/2000/svg';
  let mapDrawn = false;

  function drawMap() {
    const W = mapFrame.clientWidth, H = mapFrame.clientHeight;
    if (!W || !H) return;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const pl = S.places;
    const lngs = pl.map(p => p.lng), lats = pl.map(p => p.lat);
    const minX = Math.min(...lngs), maxX = Math.max(...lngs), minY = Math.min(...lats), maxY = Math.max(...lats);
    const spanX = Math.max(maxX - minX, .5), spanY = Math.max(maxY - minY, .5);
    // 手机上卡片在底部弹出，节点区域整体上移，避免被挡住
    const padX = W * .2, padT = H * (isMobile() ? .14 : .22), padB = H * (isMobile() ? .42 : .22);
    const k = Math.min((W - padX * 2) / spanX, (H - padT - padB) / spanY);
    const ox = (W - spanX * k) / 2 - (spanX - (maxX - minX)) * k / 2;
    const oy = padT + ((H - padT - padB) - spanY * k) / 2 - (spanY - (maxY - minY)) * k / 2;
    const proj = p => [ox + (p.lng - minX) * k, oy + (maxY - p.lat) * k];

    // 网格
    let grid = '';
    const step = Math.max(40, Math.round(Math.min(W, H) / 10));
    for (let x = step / 2; x < W; x += step) grid += `M${x} 0V${H}`;
    for (let y = step / 2; y < H; y += step) grid += `M0 ${y}H${W}`;

    // 一条抽象海岸线（装饰）
    const r = seeded('coast' + pl.length);
    let coast = `M${W * .62} ${-10}`;
    for (let i = 1; i <= 8; i++) coast += ` Q${W * (.55 + r() * .35)} ${H * (i - .5) / 8} ${W * (.58 + r() * .3)} ${H * i / 8}`;

    // 路线：相邻地点之间画一条弧线
    const pts = S.route.map(id => pl.find(p => p.id === id)).filter(Boolean).map(proj);
    let route = '';
    pts.forEach(([x, y], i) => {
      if (!i) { route = `M${x} ${y}`; return; }
      const [px, py] = pts[i - 1];
      const mx = (px + x) / 2, my = (py + y) / 2, dx = x - px, dy = y - py;
      route += ` Q${mx - dy * .25} ${my + dx * .25} ${x} ${y}`;
    });

    svg.innerHTML = `<defs>
        <linearGradient id="routeGrad" x1="0" x2="1"><stop offset="0" stop-color="#b8955a"/><stop offset=".5" stop-color="#fff6e2"/><stop offset="1" stop-color="#d9b779"/></linearGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <path class="map-grid" d="${grid}"/>
      <path class="map-coast" d="${coast}"/>
      <path class="map-route map-route--wide" d="${route}"/>
      <path class="map-route" id="routePath" d="${route}"/>
      ${pl.map(p => {
        const [x, y] = proj(p);
        const left = x > W * .7;
        return `<g class="map-node" data-id="${esc(p.id)}" tabindex="0" role="button" aria-label="${esc(p.name)}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">
          <circle class="hit" r="28"/><circle class="ring" r="14"/><circle class="dot" r="5"/>
          <text x="${left ? -18 : 18}" y="-2" text-anchor="${left ? 'end' : 'start'}">${esc(p.name)}</text>
          <text class="en" x="${left ? -18 : 18}" y="14" text-anchor="${left ? 'end' : 'start'}">${esc(p.en)}</text>
        </g>`;
      }).join('')}`;

    // 路线描绘动画
    const rp = $('#routePath', svg), len = rp.getTotalLength();
    [rp, rp.previousElementSibling].forEach(el => {
      el.style.strokeDasharray = len; el.style.strokeDashoffset = mapDrawn ? 0 : len;
    });
  }
  function animateRoute() {
    if (mapDrawn) return; mapDrawn = true;
    $$('.map-route', svg).forEach(el => { el.style.transition = 'stroke-dashoffset 1.4s cubic-bezier(.22,.8,.24,1)'; el.style.strokeDashoffset = 0; });
  }
  function showPlace(id) {
    const p = S.places.find(x => x.id === id); if (!p) return;
    $$('.map-node', svg).forEach(n => n.classList.toggle('is-active', n.dataset.id === id));
    mapCard.innerHTML = `<button type="button" class="map-card__close" aria-label="关闭">×</button>
      <div class="map-card__art">${mediaHTML(p.photo, 'place' + p.id, p.en)}</div>
      <p class="label">${esc(p.en)}</p><h3>${esc(p.name)}</h3><p>${esc(p.memory)}</p>
      <div class="map-card__meta"><span class="num">${fmtDate(p.date)}</span><span>N°${esc(p.no)}</span></div>`;
    mapCard.hidden = false;
    mapCard.style.animation = 'none'; void mapCard.offsetWidth; mapCard.style.animation = '';
  }
  svg.addEventListener('click', e => { const n = e.target.closest('.map-node'); if (n) showPlace(n.dataset.id); });
  svg.addEventListener('keydown', e => { const n = e.target.closest('.map-node'); if (n && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); showPlace(n.dataset.id); } });
  mapCard.addEventListener('click', e => {
    if (e.target.closest('.map-card__close')) { mapCard.hidden = true; $$('.map-node', svg).forEach(n => n.classList.remove('is-active')); }
  });
  new IntersectionObserver(([en]) => { if (en.isIntersecting) setTimeout(animateRoute, 200); }, { threshold: .35 }).observe(mapFrame);

  /* =========================================================
     结尾
     ========================================================= */
  const E = S.ending;
  $('#unfinished').innerHTML = `<div><div class="unfinished__no">${esc(E.unfinished.no)}</div>
    <p class="unfinished__t">${esc(E.unfinished.title)}</p>
    <p class="unfinished__en">${esc(E.unfinished.en)}</p><span class="unfinished__cursor"></span></div>`;
  $('#endingText').innerHTML = E.lines.map((l, i) => `<p class="reveal" style="transition-delay:${200 + i * 350}ms">${esc(l)}</p>`).join('');
  function drawEndingLines() {
    const el = $('#endingLines'), W = el.clientWidth, H = el.clientHeight;
    el.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const r = seeded('ending');
    el.innerHTML = Array.from({ length: 5 }, (_, i) => {
      const y = H * (.2 + i * .15);
      return `<path d="M-20 ${y + r() * 80} C${W * .3} ${y - 120 + r() * 240} ${W * .7} ${y - 120 + r() * 240} ${W + 20} ${y + r() * 80}" style="opacity:${.25 + r() * .5}"/>`;
    }).join('');
  }

  /* =========================================================
     视差滚动：每个元素按 data-depth 相对所在展厅移动
     展厅吸附到顶部时偏移为 0，所以停下来时版面是对齐的
     ========================================================= */
  const depthEls = reduceMotion ? [] : $$('[data-depth]').map(el => ({ el, d: +el.dataset.depth, sec: el.closest('.sec') }));
  let pxTick = false;
  function parallax() {
    pxTick = false;
    const k = isMobile() ? .5 : 1;
    for (const o of depthEls) {
      const top = o.sec.getBoundingClientRect().top;
      if (top > innerHeight * 1.5 || top < -o.sec.offsetHeight - innerHeight * .5) continue;
      const py = Math.max(-220, Math.min(220, -top * o.d * k));
      o.el.style.setProperty('--py', py.toFixed(1) + 'px');
    }
  }
  addEventListener('scroll', () => { if (!pxTick) { pxTick = true; requestAnimationFrame(parallax); } }, { passive: true });

  /* =========================================================
     滚动吸附
     桌面：滚轮一格 = 走到下一个停靠点（展厅顶部；比一屏高的展厅中间也有停靠点）
     手机：正常滑动，停下后若离某个展厅顶部很近，就贴过去
     ========================================================= */
  const secs = $$('.sec');
  const docEl = document.documentElement;
  const maxScroll = () => docEl.scrollHeight - innerHeight;
  function stops() {
    const list = [];
    for (const s of secs) {
      const top = s.offsetTop, h = s.offsetHeight;
      list.push(top);
      // 高展厅：每隔约 0.8 屏加一个停靠点，最后一个让展厅底部对齐屏幕底部
      if (h > innerHeight * 1.15) {
        const end = top + h - innerHeight;
        for (let y = top + innerHeight * .8; y < end - innerHeight * .2; y += innerHeight * .8) list.push(Math.round(y));
        list.push(end);
      }
    }
    return [...new Set(list.map(y => Math.min(Math.max(0, y), maxScroll())))].sort((a, b) => a - b);
  }
  let animating = false, lastWheel = 0, animId = 0;
  function glideTo(y, dur = 900) {
    const from = scrollY, dist = y - from, id = ++animId;
    if (Math.abs(dist) < 2) return;
    animating = true;
    const t0 = performance.now();
    const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    (function step(t) {
      if (id !== animId) return;
      const k = Math.min(1, (t - t0) / dur);
      // 旧版 Safari 不认 behavior:'instant'，改为临时关掉 CSS 平滑滚动
      docEl.style.scrollBehavior = 'auto';
      scrollTo(0, from + dist * ease(k));
      if (k < 1) requestAnimationFrame(step); else { animating = false; docEl.style.scrollBehavior = ''; }
    })(t0);
  }
  window.__glideTo = glideTo;
  const blocked = () => !viewer.hidden || plates.classList.contains('is-open') || document.body.classList.contains('is-locked');

  if (!isTouch && !reduceMotion) {
    addEventListener('wheel', e => {
      if (e.defaultPrevented || e.ctrlKey || blocked()) return;    // 时间长廊横向滚动、缩放、弹层打开时不接管
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      const now = performance.now(), gap = now - lastWheel;
      lastWheel = now;
      // 动画进行中、或触控板惯性还在持续输入时，忽略，避免一下跳两页
      if (animating || gap < 160 || Math.abs(e.deltaY) < 4) return;
      const list = stops(), cur = scrollY, dir = Math.sign(e.deltaY);
      const next = dir > 0 ? list.find(y => y > cur + 4) : [...list].reverse().find(y => y < cur - 4);
      if (next !== undefined) glideTo(next);
    }, { passive: false });

    addEventListener('keydown', e => {
      if (blocked() || /input|textarea/i.test(e.target.tagName)) return;
      const keys = { PageDown: 1, ArrowDown: 1, ' ': 1, PageUp: -1, ArrowUp: -1 };
      const dir = keys[e.key]; if (!dir || animating) return;
      e.preventDefault();
      const list = stops(), cur = scrollY;
      const next = dir > 0 ? list.find(y => y > cur + 4) : [...list].reverse().find(y => y < cur - 4);
      if (next !== undefined) glideTo(next, 800);
    });
  }

  // 手机 / 触屏：滑动停下 150ms 后检查是否贴近展厅顶部
  if (isTouch && !reduceMotion) {
    let st, touching = false;
    addEventListener('touchstart', () => { touching = true; clearTimeout(st); }, { passive: true });
    addEventListener('touchend', () => { touching = false; }, { passive: true });
    addEventListener('scroll', () => {
      clearTimeout(st);
      if (animating) return;
      st = setTimeout(() => {
        if (touching || blocked()) return;
        const cur = scrollY;
        const near = secs.map(s => s.offsetTop).find(y => Math.abs(y - cur) < innerHeight * .22 && Math.abs(y - cur) > 2);
        if (near !== undefined) glideTo(near, 550);
      }, 150);
    }, { passive: true });
  }

  // 导航和"回到大厅"也走同一套动画，速度一致
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]'); if (!a) return;
    const t = $(a.getAttribute('href')); if (!t) return;
    e.preventDefault();
    glideTo(t.offsetTop, 1000);
    history.replaceState(null, '', a.getAttribute('href'));
  });

  /* =========================================================
     液态玻璃：高光跟随鼠标
     ========================================================= */
  if (!isTouch) {
    let lit = null, gTick = false, gx = 0, gy = 0;
    const paint = () => {
      gTick = false;
      const g = document.elementFromPoint(gx, gy)?.closest('.glass');
      if (lit && lit !== g) { lit.style.removeProperty('--lx'); lit.style.removeProperty('--ly'); }
      lit = g;
      if (!g) return;
      const r = g.getBoundingClientRect();
      g.style.setProperty('--lx', (gx - r.left).toFixed(0) + 'px');
      g.style.setProperty('--ly', (gy - r.top).toFixed(0) + 'px');
    };
    addEventListener('pointermove', e => { gx = e.clientX; gy = e.clientY; if (!gTick) { gTick = true; requestAnimationFrame(paint); } }, { passive: true });
  }

  /* =========================================================
     初始化与尺寸变化
     ========================================================= */
  ['#hall .reveal', '.sec__head.reveal', '#ending .reveal'].forEach(s => $$(s).forEach(el => revealIO.observe(el)));
  function layout() { sizeCanvas(); layoutFilm(); drawMap(); drawEndingLines(); updateCorridor(); parallax(); }
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(layout, 150); });
  layout(); spinFilm();
  // 直接带锚点打开或刷新时，跳过入口
  if (location.hash && location.hash !== '#hall') $('#enterBtn').click();
})();
