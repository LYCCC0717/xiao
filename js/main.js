/* =========================================================
   《我们》· 翻页版
   - 一页一屏：.deck 负责原生滚动吸附，键盘 / 章节导航 / 触控都能翻
   - 视差：每页的 [data-par] / [data-parx] 按到视口中心的距离位移
   - 内容全部来自 data.js，这里只负责排版与交互
   ========================================================= */
(() => {
  'use strict';

  const S = window.SITE || {};
  const initialHash = location.hash;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const DAY = 864e5;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
  const parseDate = s => {
    if (!s) return null;
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const today = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
  const daysBetween = (a, b) => Math.round((b - a) / DAY);
  const fmt = s => (s ? s.replace(/-/g, '.') : '—');
  const pad2 = n => String(n).padStart(2, '0');

  const places = S.places || [];
  const end = S.ending || {};

  /* ══════════════ 品牌 / 天数 ══════════════ */
  $('#brandName').textContent = S.title || '我们';
  $('#brandSub').textContent = S.subtitle || '';

  const since = parseDate(S.togetherSince);
  const days = since ? Math.max(0, daysBetween(since, today())) : 0;

  const daysNum = $('#daysNum');
  const daysMini = $('#daysMini');
  const dayBtn = $('#dayBtn');
  daysNum.textContent = String(days);
  daysMini.textContent = pad2(days);
  $('#sinceLine').textContent = since ? '自 ' + fmt(S.togetherSince) + ' 起' : '日期待定';
  dayBtn.title = since ? '自 ' + fmt(S.togetherSince) + ' 起，一起走过 ' + days + ' 天' : '';
  dayBtn.addEventListener('click', () => showHome());

  let counted = false;
  let countStop = false;
  const countUp = () => {
    if (counted) return;
    counted = true;
    if (reduce) return;
    const t0 = performance.now();
    // 用 performance.now() 而不是 rAF 的时间戳：慢帧时时间戳会落后于真实时间
    const tick = () => {
      if (countStop) return;
      const k = Math.min(1, Math.max(0, (performance.now() - t0) / 1500));
      const e = 1 - Math.pow(1 - k, 3);
      daysNum.textContent = String(Math.round(days * e));
      if (k < 1) requestAnimationFrame(tick);
      else daysNum.textContent = String(days);
    };
    daysNum.textContent = '0';
    requestAnimationFrame(tick);
  };

  /* ══════════════ 04 · 时间长廊 ══════════════ */
  // 时间线走 js/time-data.js（从「时间.txt」生成）；没有就退回 data.js 里的 timeline
  const TIMELINE = window.TIMELINE || S.timeline || [];
  $('#time').innerHTML = TIMELINE.map((t, i) => `
    <li>
      <button class="time__row glass" type="button" data-time="${i}" style="--i:${i}" aria-label="打开：${esc(t.title)}">
        <span class="time__date">${esc(t.date ? fmt(t.date) : '将来')}</span>
        <span class="time__body info-block">
          <b class="time__title">${esc(t.title)}</b>
          <span class="time__line">${esc(t.line || t.text || '')}</span>
        </span>
        <span class="time__go" aria-hidden="true">→</span>
      </button>
    </li>`).join('');

  /* ══════════════ 05 · 纪念日 ══════════════ */
  // 五张卡走 js/dates-data.js；没有就退回 data.js 里的 dates
  const DATES = window.DATES || S.dates || [];
  const countdown = d => {
    const when = parseDate(d.date);
    if (!when) return { n: '—', unit: '', sub: '日期待定', near: false, isToday: false };
    const now = today();
    if (d.mode === 'since') {
      const n = Math.max(0, daysBetween(when, now));
      return { n, unit: '天', sub: 'SINCE ' + fmt(d.date), near: false, isToday: false };
    }
    let next = new Date(now.getFullYear(), when.getMonth(), when.getDate());
    if (d.mode === 'annual' && next < now) next = new Date(now.getFullYear() + 1, when.getMonth(), when.getDate());
    const left = daysBetween(now, next);
    return {
      n: left === 0 ? '今天' : Math.abs(left),
      unit: left === 0 ? '' : '天',
      sub: d.mode === 'annual'
        ? 'EVERY ' + pad2(when.getMonth() + 1) + '.' + pad2(when.getDate())
        : fmt(d.date),
      near: left > 0 && left <= 7,
      isToday: left === 0
    };
  };

  // 每次重新算一遍：跨过零点、从后台切回来、从 bfcache 恢复，数字都不会停在旧的一天
  const renderDates = () => {
    $('#dates').innerHTML = DATES.map((d, i) => {
      const c = countdown(d);
      return `<article class="dateCard glass glass--tilt${c.near ? ' is-near' : ''}${c.isToday ? ' is-today' : ''}" style="--i:${i}">
        <div class="info-block dateCard__content">
          <p class="dateCard__no">${esc(d.no || '')}</p>
          <h3 class="dateCard__name">${esc(d.name)}</h3>
          <p class="dateCard__en">${esc(d.en || '')}</p>
          <p class="dateCard__num"><b>${esc(c.n)}</b><span>${esc(c.unit)}</span></p>
          <p class="dateCard__sub">${esc(c.sub)}</p>
        </div>
      </article>`;
    }).join('');
  };
  renderDates();

  // 大厅天数 + 纪念日一起刷新（不重播开场数字动画，直接给最新值）
  const recount = () => {
    countStop = true;                       // 万一开场动画还在跑，别让它写回旧值
    const s = parseDate(S.togetherSince);
    const d = s ? Math.max(0, daysBetween(s, today())) : 0;
    daysNum.textContent = String(d);
    daysMini.textContent = pad2(d);
    $('#sinceLine').textContent = s ? '自 ' + fmt(S.togetherSince) + ' 起' : '日期待定';
    dayBtn.title = s ? '自 ' + fmt(S.togetherSince) + ' 起，一起走过 ' + d + ' 天' : '';
    $('#year').textContent = String(new Date().getFullYear());
    renderDates();
  };

  // 正好跨过本机零点时再刷一次；之后每天重排一次
  const atMidnight = () => {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 3);
    setTimeout(() => { recount(); atMidnight(); }, Math.max(2000, next - now));
  };
  atMidnight();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) recount(); });
  addEventListener('pageshow', e => { if (e.persisted) recount(); });
  window.__recount = recount;      // 调试口子

  /* ══════════════ 01 · 去过的地方（中国轮廓 + 点） ══════════════ */
  if (places.length) {
    const CM = window.CHINA_MAP;
    const r1 = n => Math.round(n * 10) / 10;
    const P = CM ? (lng, lat) => CM.project(lng, lat) : (lng, lat) => [lng, lat];
    const at = places.map(p => ({ p, xy: P(p.lng, p.lat) }));

    // 东边六个挤在一小块，点上一律不压字；名字放右边那一列，指到哪一行就点亮哪个点
    const dots = at.map(({ p, xy }) => {
      const [x, y] = xy;
      return `<g class="pin" data-pin="${esc(p.no || '')}">
        <circle class="pin__halo" cx="${r1(x)}" cy="${r1(y)}" r="15"></circle>
        <circle class="pin__dot" cx="${r1(x)}" cy="${r1(y)}" r="4"></circle>
      </g>`;
    }).join('');

    $('#map').innerHTML = CM ? `
      <svg class="mapline__svg" viewBox="0 0 ${CM.w} ${CM.h}" role="presentation">
        <g class="mapline__glow"><path d="${CM.main}"></path><path d="${CM.taiwan || ''}"></path><path d="${CM.hainan}"></path></g>
        <path class="mapline__land" d="${CM.main}"></path>
        <path class="mapline__land" d="${CM.taiwan || ''}"></path>
        <path class="mapline__land" d="${CM.hainan}"></path>
        ${dots}
      </svg>` : '';

    $('#places').innerHTML = places.map(p => `
      <div class="place" data-pin="${esc(p.no || '')}">
        <span class="place__meta info-block">
          <span class="place__no">${esc(p.no || '')}</span>
          <span class="place__name">${esc(p.name)}<em>${esc(p.en || '')}</em></span>
        </span>
      </div>`).join('');

    // 指到哪一行，地图上那个点就亮起来
    const pins = $$('.pin', $('#map'));
    $$('.place', $('#places')).forEach(row => {
      const on = () => pins.forEach(g => g.classList.toggle('is-hot', g.dataset.pin === row.dataset.pin));
      row.addEventListener('pointerenter', on);
      row.addEventListener('focusin', on);
    });
    $('#places').addEventListener('pointerleave', () => pins.forEach(g => g.classList.remove('is-hot')));
  }

  /* ══════════════ 06 · 未完 ══════════════ */
  $('#endLines').innerHTML = (end.lines || []).map(l => `<p>${esc(l)}</p>`).join('');
  $('#year').textContent = String(new Date().getFullYear());

  /* ══════════════ 02/03 · 两条横向卡片 ══════════════ */
  const FOOD = window.FOOD || [];
  const PLAY = window.PLAY || [];
  const memoryGrid = $('#memoryGrid');
  const memoryPage = $('#p-memories');
  const memoryEntries = [];
  for (let i = 0; i < Math.max(FOOD.length, PLAY.length); i++) {
    if (FOOD[i]) memoryEntries.push({ kind: 'food', index: i, item: FOOD[i] });
    if (PLAY[i]) memoryEntries.push({ kind: 'play', index: i, item: PLAY[i] });
  }
  memoryGrid.innerHTML = memoryEntries.map(({ kind, index, item }, position) => `
    <button class="memory-card glass glass--tilt" type="button" data-${kind}="${index}"
      data-memory-kind="${kind}" data-memory-card aria-label="查看${kind === 'food' ? '吃饭' : '游玩'}回忆：${esc(item.title)}"
      style="--memory-order:${position}">
      <span class="memory-card__image"><img src="${esc(item.src)}" alt="${esc(item.title)}" loading="lazy" decoding="async"></span>
      <span class="memory-card__info info-block">
        <span class="memory-card__meta"><span>${kind === 'food' ? 'AT THE TABLE' : 'OUT & ABOUT'}</span><span>${pad2(item.n || index + 1)}</span></span>
        <h3>${esc(item.title)}</h3>
        <span class="memory-card__excerpt">${esc(item.text)}</span>
      </span>
    </button>`).join('');

  const memoryCards = $$('.memory-card', memoryGrid);
  let memoryLayoutFrame = 0;
  const layoutMemories = () => {
    memoryLayoutFrame = 0;
    const style = getComputedStyle(memoryGrid);
    const row = parseFloat(style.gridAutoRows) || 8;
    const gap = parseFloat(style.getPropertyValue('--memory-gap')) || 24;
    memoryCards.forEach(card => {
      if (card.hidden) return;
      const span = Math.ceil((card.offsetHeight + gap) / row);
      if (card.style.gridRowEnd !== `span ${span}`) card.style.gridRowEnd = `span ${span}`;
    });
    if (typeof queueMeasure === 'function') queueMeasure();
  };
  const queueMemoryLayout = () => {
    if (!memoryLayoutFrame) memoryLayoutFrame = requestAnimationFrame(layoutMemories);
  };
  memoryGrid.querySelectorAll('img').forEach(img => {
    img.addEventListener('load', queueMemoryLayout, { once: true });
    img.addEventListener('error', queueMemoryLayout, { once: true });
  });
  if ('ResizeObserver' in window) {
    const memoryObserver = new ResizeObserver(queueMemoryLayout);
    memoryCards.forEach(card => memoryObserver.observe(card));
  }
  const updateMemoryCount = () => {
    const visible = memoryCards.reduce((n, card) => n + !card.hidden, 0);
    $('#memoryCount').textContent = `${visible} 个瞬间`;
    queueMemoryLayout();
  };
  $$('[data-memory-filter]').forEach(button => button.addEventListener('click', () => {
    const kind = button.dataset.memoryFilter;
    $$('[data-memory-filter]').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
    memoryCards.forEach(card => { card.hidden = kind !== 'all' && card.dataset.memoryKind !== kind; });
    updateMemoryCount();
    deck.scrollTop = pagesM.find(page => page.el === memoryPage)?.top || 0;
  }));
  updateMemoryCount();

  /* ══════════════ 翻页控制器 ══════════════ */
  const deck = $('#deck');
  const pages = $$('.page', deck);
  const pageIndexForHash = hash => pages.findIndex(p => '#' + p.id === hash);
  const initialTarget = pageIndexForHash(initialHash === '#p-food' || initialHash === '#p-play' ? '#p-memories' : initialHash);
  if (initialTarget >= 0 && pages[initialTarget].hasAttribute('data-scrollable')) {
    const filterKind = initialHash === '#p-food' ? 'food' : initialHash === '#p-play' ? 'play' : 'all';
    const initialFilter = $('[data-memory-filter="' + filterKind + '"]');
    if (initialFilter) {
      $$('[data-memory-filter]').forEach(button => button.setAttribute('aria-pressed', String(button === initialFilter)));
      memoryCards.forEach(card => { card.hidden = filterKind !== 'all' && card.dataset.memoryKind !== filterKind; });
      $('#memoryCount').textContent = memoryCards.filter(card => !card.hidden).length + ' 个瞬间';
    }
  }
  const rail = $('#rail');
  const pagerNow = $('#pagerNow');
  const pagerFill = $('#pagerFill');
  $('#pagerAll').textContent = pad2(pages.length);

  rail.innerHTML = pages.map((p, i) => `
    <button class="rail__dot glass" type="button" data-page="${i}" aria-current="${i === 0}" aria-label="${esc(p.dataset.label || '第 ' + (i + 1) + ' 页')}">
      <span>${pad2(i + 1)}</span><span class="rail__tip">${esc(p.dataset.label || '')}</span>
    </button>`).join('');

  let pagesM = [];
  let active = -1;
  let queued = 0;

  const measure = () => {
    pagesM = pages.map(el => ({
      el,
      inner: $('.page__inner', el),
      top: el.offsetTop,
      h: el.offsetHeight,
      layers: $$('[data-par],[data-parx],[data-pars]', el).map(n => ({
        n,
        y: parseFloat(n.dataset.par || 0),
        x: parseFloat(n.dataset.parx || 0),
        s: parseFloat(n.dataset.pars || 0)
      }))
    }));
  };
  const queueMeasure = () => {
    if (queued) return;
    queued = requestAnimationFrame(() => { queued = 0; measure(); render(); });
  };

  const setActive = i => {
    if (i === active) return;
    active = i;
    $$('.rail__dot', rail).forEach((b, k) => b.setAttribute('aria-current', k === i ? 'true' : 'false'));
    pagerNow.textContent = pad2(i + 1);
    if (!document.body.classList.contains('is-home')) try { history.replaceState(null, '', '#' + pages[i].id); } catch (e) { /* file:// 下忽略 */ }
  };

  const render = () => {
    const vh = deck.clientHeight || 1;
    const st = deck.scrollTop;
    const max = Math.max(1, deck.scrollHeight - vh);

    pagerFill.style.width = (clamp(st / max, 0, 1) * 100).toFixed(2) + '%';
    window.__DECK = { progress: clamp(st / max, 0, 1), dir: deckDir };

    let best = 0;
    for (let i = 0; i < pagesM.length; i++) {
      if (st + vh * 0.4 >= pagesM[i].top) best = i;
    }

    // 视差层（装饰：页码幽灵、胶片墙）
    if (!reduce) {
      for (let i = 0; i < pagesM.length; i++) {
        const p = pagesM[i];
        const d = clamp((p.top + p.h / 2 - st - vh / 2) / Math.max(p.h, vh), -1.15, 1.15);
        p.d = d;
        for (let j = 0; j < p.layers.length; j++) {
          const l = p.layers[j];
          let t = `translate3d(${(d * l.x * p.h).toFixed(1)}px,${(d * l.y * p.h).toFixed(1)}px,0)`;
          if (l.s) t += ` scale(${(1 + d * l.s).toFixed(4)})`;
          l.n.style.transform = t;
        }
      }
    }

    setActive(best);
  };

  // Smooth page movement uses the same easing for wheel, keyboard, and navigation controls.
  const easeInOut = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;

  let glideId = 0;
  let gliding = false;
  let deckDir = 0;        // 最近一次翻页方向：1 向下，-1 向上

  // Page changes keep the scroll-to-section motion and landing alignment without particle transitions.
  const pageTurn = i => {
    const to = pagesM[i];
    if (!to) return;
    const distance = Math.abs(to.top - deck.scrollTop);
    glideTo(to.top, reduce ? 240 : clamp(360 + distance * .1, 380, 620));
  };

  // Ease the scroll to a section boundary after a page change.
  const glideTo = (to, dur) => {
    const from = deck.scrollTop;
    if (Math.abs(to - from) < 2) return;
    deckDir = to > from ? 1 : -1;
    const frames = Math.max(8, Math.round(dur / (1000 / 60)));
    const stepPx = Math.max(6, Math.abs(to - from) / frames);   // 每帧至少这么多，避免被节流吞掉
    let f = 0;
    let pos = from;
    const id = ++glideId;
    gliding = true;
    const step = () => {
      if (id !== glideId) { gliding = false; return; }
      f++;
      const k = Math.min(1, f / frames);
      pos += Math.sign(to - from) * Math.max(stepPx, Math.abs(to - from) * easeInOut(k) - Math.abs(pos - from));
      deck.scrollTop = k >= 1 ? to : pos;
      render();
      if (k < 1) requestAnimationFrame(step);
      else {
        gliding = false;
      }
    };
    requestAnimationFrame(step);
  };

  // 手指一碰就把控制权交回去
  addEventListener('touchstart', () => {
    glideId = 0; gliding = false;
  }, { passive: true });

  const go = (i, smooth = true) => {
    const p = pagesM[i];
    if (!p) return;
    if (!smooth) {
      glideId = 0; gliding = false;
      deck.scrollTop = p.top;
      return;
    }
    const cur = active;
    if (i === cur) return;
    const dist = Math.abs(p.top - deck.scrollTop);
    // Larger jumps use a slightly longer scroll while keeping the same landing point.
    if (Math.abs(i - cur) !== 1 || dist > deck.clientHeight * 1.6) {
      glideTo(p.top, reduce ? 320 : clamp(420 + dist * .1, 460, 700));
    } else {
      pageTurn(i);
    }
  };
  // 翻页途中以「正在去的那一页」为准，别从旧页再算一次
  const step = dir => go(clamp((active < 0 ? 0 : active) + dir, 0, pagesM.length - 1));

  window.__deck = {
    go, step, measure, render, pages,
    get index() { return active; },
    get list() { return pagesM; }
  };

  /* ══════════════ 横向卡片轨道（吃饭 / 好玩 共用） ══════════════ */
  // 两遍首尾相接 → 无缝循环；悬停暂停并放大；滚轮拨动；拖动跟手 + 松手惯性；
  // 点开看大图。两条轨道用同一套逻辑，只有页面、数据、data-* 不一样。
  const setupStrip = ({ page, track, data, kind, speed = 26 }) => {
    const COPIES = 2;
    const SPEED = speed;                   // px/s
    track.innerHTML = Array.from({ length: COPIES }, () => data.map((f, i) => `
      <button class="food__card glass glass--tilt" type="button" data-${kind}="${i}" aria-label="打开：${esc(f.title)}">
        <span class="food__pix"><img src="${esc(f.src)}" alt="${esc(f.title)}" loading="${i < 6 ? 'eager' : 'lazy'}" decoding="async"></span>
        <span class="food__body">
          <span class="food__name">${esc(f.title)}</span>
          <span class="food__text">${esc(f.text)}</span>
        </span>
      </button>`).join('')).join('');

    const firstCard = track.querySelector('.food__card');
    const gapOf = () => parseFloat(getComputedStyle(track).columnGap || '12') || 12;
    const cardW = () => (firstCard ? firstCard.offsetWidth + gapOf() : 260);
    const loopW = () => cardW() * data.length;          // 一遍的长度
    const atRest = () => {
      const p = pagesM.find(x => x.el === page);
      return !!p && Math.abs(p.top - deck.scrollTop) < 3;
    };

    let off = 0;                 // 循环内偏移
    let vel = SPEED;             // 当前速度 px/s（正 = 往左，跟自动播放同向）
    let lastT = performance.now();
    let paused = false;          // 指到某张卡上
    let drag = null;
    let suppressUntil = 0;       // 拖完那一下不要顺手点开
    let lastSample = 0;
    const EASE_TAU = .42;        // 松手后速度回到自动速度的时间常数（秒）

    const repaint = () => {
      if (gliding) return;
    };

    const tick = now => {
      requestAnimationFrame(tick);
      const dt = Math.min(.06, Math.max(0, (now - lastT) / 1000));
      lastT = now;
      // 甩出去还在减速时不理会悬停，等它落回自动速度再算「指住就停」
      const coasting = Math.abs(vel - SPEED) > 1;
      if ((paused && !coasting) || drag || !atRest()) return;
      const vw = document.querySelector('.viewer');
      if (vw && !vw.hidden) return;
      const L = loopW();
      if (L < 4) return;
      // 甩出来的速度指数收敛回自动播放速度：先冲一段，再慢慢减回去
      vel += (SPEED - vel) * (1 - Math.exp(-dt / EASE_TAU));
      if (Math.abs(vel - SPEED) < .1) vel = SPEED;
      off += vel * dt;
      if (off >= L) off -= L;
      if (off < 0) off += L;
      track.scrollLeft = off;
      if (Math.abs(off - lastSample) > cardW()) { lastSample = off; repaint(); }
    };
    requestAnimationFrame(tick);

    // 拖：按住横向拖，速度跟手一致；松手带着惯性慢慢回到自动速度
    track.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      drag = { x: e.clientX, left: track.scrollLeft, moved: false, samples: [{ x: e.clientX, t: performance.now() }] };
      track.classList.add('is-drag');
    });
    track.addEventListener('pointermove', e => {
      if (!drag) {
        if (e.pointerType !== 'mouse') return;
        // 指到哪张就暂停哪张（放大交给 CSS）；正在惯性滑行时先让它滑完
        paused = !!e.target.closest('.food__card');
        return;
      }
      const dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) > 4) drag.moved = true;
      if (drag.moved) {
        track.scrollLeft = drag.left - dx;          // 1:1 跟手
        off = track.scrollLeft;
        // 留几个采样点算甩出去的速度
        const now = performance.now();
        drag.samples.push({ x: e.clientX, t: now });
        while (drag.samples.length > 2 && now - drag.samples[0].t > 120) drag.samples.shift();
      }
    });
    const endDrag = () => {
      if (!drag) return;
      const moved = drag.moved;
      const s = drag.samples;
      drag = null;
      track.classList.remove('is-drag');
      if (moved) {
        suppressUntil = performance.now() + 350;
        off = track.scrollLeft;
        // 最后一段的位移速度 = 甩出去的速度（往左拖 = 正速度）
        const a = s[0], b = s[s.length - 1];
        const dtms = b.t - a.t;
        let v = dtms > 8 ? -((b.x - a.x) / dtms) * 1000 : SPEED;
        if (!isFinite(v)) v = SPEED;
        vel = Math.max(-2600, Math.min(2600, v));
        // 没甩起来（比自动速度还慢）就按原速走，不要从 0 慢慢加速
        if (Math.abs(vel) < SPEED) vel = (vel < 0 ? -1 : 1) * SPEED;
        repaint();
      }
    };
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);
    track.addEventListener('pointerleave', () => {
      if (drag) endDrag();
      paused = false;
    });

    // 滚轮：鼠标在轨道上时，滚轮改拨这条轨道（前滚 / 后滚），不翻页
    track.addEventListener('wheel', e => {
      e.preventDefault();
      e.stopPropagation();
      const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (!d) return;
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? track.clientWidth : 1;
      off += d * unit * 1.5;
      off = ((off % loopW()) + loopW()) % loopW();
      vel = SPEED;
      track.scrollLeft = off;
      if (Math.abs(off - lastSample) > cardW()) { lastSample = off; repaint(); }
    }, { passive: false });

    // 拖完的 click 要吞掉，不然会突然弹出详情层（只吞 350ms 内那一下）
    track.addEventListener('click', e => {
      if (performance.now() > suppressUntil) return;
      e.stopPropagation();
      e.preventDefault();
    }, true);

    return {
      get off() { return off; },
      get vel() { return vel; },
      get dragging() { return !!drag; },
      get paused() { return paused; },
      set off(v) { off = Math.max(0, Math.min(loopW() - .01, +v || 0)); track.scrollLeft = off; },
      get loop() { return loopW(); },
      pause(v) { paused = !!v; }
    };
  };

  window.__strips = {};
  window.__food = null;

  // 不做滚动吸附：内层页面全程自由滚动。
  let autoPauseUntil = 0;
  const AUTO_RESUME = 700;   // 手动滚动 / 触摸停手后 0.7s 继续自动滚动
  let touching = false;
  // 自动滚动自己记一个小数位置：每帧只走 0.2~0.5px，直接写 scrollTop 会被浏览器取整吞掉，永远不动
  let autoPos = null;
  let autoWritten = -1;
  deck.addEventListener('touchstart', () => { touching = true; }, { passive: true });
  // 手指离开屏幕时重新计 0.7s，按住再久，松手后也要等满 0.7s 才继续
  const releaseTouch = () => { touching = false; autoPauseUntil = performance.now() + AUTO_RESUME; autoPos = null; };
  addEventListener('touchend', releaseTouch, { passive: true });
  addEventListener('touchcancel', releaseTouch, { passive: true });

  deck.addEventListener('scroll', () => {
    // 和自动滚动最后写入的位置一致 → 是自动滚动触发的；否则是用户自己在滚
    if (Math.abs(deck.scrollTop - autoWritten) > 2) {
      autoPos = null;
      autoPauseUntil = performance.now() + AUTO_RESUME;
    }
    if (queued) return;
    queued = requestAnimationFrame(() => { queued = 0; render(); });
  }, { passive: true });

  // 照片墙自动滚动：一直往下走；到底后照片淡出、回到第一张、再淡入，循环展示，不再来回倒退。
  const AUTO_SPEED = 30;            // px/s
  const LOOP_FADE = reduce ? 0 : 520;
  let looping = false;
  let autoLastTime = performance.now();
  const gridTopInDeck = () => memoryGrid.getBoundingClientRect().top - deck.getBoundingClientRect().top + deck.scrollTop;
  const setAutoScroll = top => {
    autoPos = top;
    deck.scrollTop = top;
    autoWritten = deck.scrollTop;
    render();
  };
  const loopMemories = (page, max) => {
    looping = true;
    memoryGrid.classList.add('is-looping');
    setTimeout(() => {
      const memoryIndex = pages.indexOf(memoryPage);
      // 淡出途中用户自己滚走了，就不要再把他拉回去
      if (active === memoryIndex && deck.scrollTop >= max - 40 && deck.scrollTop <= max + 2) {
        setAutoScroll(clamp(gridTopInDeck() - 24, page.top, max));
      }
      memoryGrid.classList.remove('is-looping');
      autoPauseUntil = performance.now() + LOOP_FADE + 600;   // 淡入完成、停一下再继续走
      setTimeout(() => { looping = false; }, LOOP_FADE);
    }, LOOP_FADE);
  };
  const autoScroll = now => {
    const dt = Math.min(.25, Math.max(0, (now - autoLastTime) / 1000));
    autoLastTime = now;   // 掉帧时按真实时间补足，速度不会跟着帧率变慢
    const memoryIndex = pages.indexOf(memoryPage);
    const page = pagesM[memoryIndex];
    if (page && active === memoryIndex && viewer.hidden && !looping && !gliding && !touching
        && now >= autoPauseUntil && !document.body.classList.contains('is-home') && !document.hidden) {
      const min = page.top;
      const max = page.top + Math.max(0, page.h - deck.clientHeight);
      const st = deck.scrollTop;
      // 只在照片墙范围内自动滚动；已经跳到别的页（render 还没跟上）就不动
      if (max - min > 2 && st >= min - 2 && st <= max + 2) {
        if (st >= max - 1) loopMemories(page, max);
        else {
          if (autoPos === null || Math.abs(autoPos - st) > 2) autoPos = st;
          setAutoScroll(clamp(autoPos + AUTO_SPEED * dt, min, max));
        }
      }
    }
    requestAnimationFrame(autoScroll);
  };
  requestAnimationFrame(autoScroll);
  const pauseAutoScroll = () => { autoPauseUntil = performance.now() + AUTO_RESUME; autoPos = null; };
  // 鼠标在照片上移动时暂停一会儿，停住不动就继续滚，不会一直卡住
  memoryGrid.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') pauseAutoScroll(); }, { passive: true });
  deck.addEventListener('pointerdown', pauseAutoScroll, { passive: true });
  deck.addEventListener('touchstart', pauseAutoScroll, { passive: true });
  deck.addEventListener('wheel', pauseAutoScroll, { passive: true });

  rail.addEventListener('click', e => {
    const b = e.target.closest('[data-page]');
    if (b) go(+b.dataset.page);
  });
  $('.hud__brand').addEventListener('click', e => { e.preventDefault(); showHome(); });
  $('#topBtn').addEventListener('click', () => showHome());
  $('#endBtn').addEventListener('click', () => { paintEnd(); openViewer(); });

  addEventListener('keydown', e => {
    if (!viewer.hidden) return;                 // 详情层自己处理按键
    if (document.body.classList.contains('is-home')) return;
    if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    if (e.target.closest && e.target.closest('button, a, input, textarea, select, [contenteditable]')) return;
    if (pages[active]?.hasAttribute('data-scrollable')) pauseAutoScroll();
    const scrollAmount = e.key === 'PageDown' || e.key === 'PageUp' || e.key === ' ' || e.key === 'Spacebar'
      ? deck.clientHeight * .86 : 110;
    switch (e.key) {
      case 'ArrowDown': case 'PageDown': case ' ': case 'Spacebar':
        e.preventDefault(); deck.scrollBy({ top: scrollAmount, behavior: 'smooth' });
        break;
      case 'ArrowUp': case 'PageUp':
        e.preventDefault(); deck.scrollBy({ top: -scrollAmount, behavior: 'smooth' });
        break;
      case 'ArrowRight': e.preventDefault(); step(1); break;
      case 'ArrowLeft': e.preventDefault(); step(-1); break;
      case 'Home': e.preventDefault(); go(0); break;
      case 'End': e.preventDefault(); deck.scrollTo({ top: deck.scrollHeight, behavior: 'smooth' }); break;
    }
  });

  addEventListener('resize', () => { measure(); render(); }, { passive: true });

  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(() => queueMeasure());
    pages.forEach(p => ro.observe(p));
  }

  measure();
  render();

  // 深链：#p-food 之类
  const fromHash = (hash = location.hash) => {
    if (!hash) return;
    const alias = hash === '#p-food' || hash === '#p-play';
    const i = pages.findIndex(p => '#' + p.id === (alias ? '#p-memories' : hash));
    if (i >= 0) {
      if (document.body.classList.contains('is-home')) enterStage(pages[i].id, false);
      if (alias) {
        const filter = $('[data-memory-filter="' + (hash === '#p-food' ? 'food' : 'play') + '"]');
        if (filter) filter.click();
      }
      measure();
      deck.scrollTo({ top: pagesM[i].top, behavior: 'auto' });
      render();
    }
  };
  requestAnimationFrame(() => fromHash(initialHash));
  addEventListener('hashchange', () => fromHash());
  if (document.body.classList.contains('is-home')) setTimeout(countUp, 420);
  // 兜底：后台标签页 / 慢设备上 rAF 可能停在半路
  setTimeout(() => { countStop = true; recount(); }, 2600);


  /* ══════════════ 外层首页 ⇄ 内层展厅 ══════════════ */
  // 首页是独立的一层；点「开始回忆」后首页淡出、展厅淡入，从「去过的地方」开始。
  const body = document.body;
  const home = $('#home');
  const stage = $('#stage');
  const FADE = reduce ? 0 : 560;
  let fadeTimer = 0;
  $('#homePlaces').textContent = String(places.length);
  $('#homeMoments').textContent = String(memoryEntries.length);
  const paintNext = () => {
    const next = DATES.filter(d => d.mode === 'annual').map(d => ({ d, c: countdown(d) }))
      .sort((a, b) => (a.c.isToday ? -1 : +a.c.n) - (b.c.isToday ? -1 : +b.c.n))[0];
    if (!next) return;
    $('#homeNext').textContent = String(next.c.n);
    $('#homeNextUnit').textContent = next.c.unit;
    $('#homeNextName').textContent = '距' + next.d.name;
  };
  paintNext();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) paintNext(); });

  const setInert = (el, on) => { el.inert = on; on ? el.setAttribute('aria-hidden', 'true') : el.removeAttribute('aria-hidden'); };
  setInert(stage, true);

  function enterStage(id = 'p-places', animate = true) {
    if (!body.classList.contains('is-home')) return;
    clearTimeout(fadeTimer);
    const i = Math.max(0, pages.findIndex(p => p.id === id));
    body.classList.add('is-leaving');
    fadeTimer = setTimeout(() => {
      body.classList.remove('is-home', 'is-leaving');
      setInert(home, true);
      setInert(stage, false);
      measure();
      go(i, false);
      active = -1;
      render();
      try { history.replaceState(null, '', '#' + pages[i].id); } catch (e) { /* file:// */ }
      deck.focus({ preventScroll: true });
    }, animate ? FADE : 0);
  }
  function showHome() {
    if (body.classList.contains('is-home')) return;
    clearTimeout(fadeTimer);
    closeViewer();
    body.classList.add('is-returning');
    fadeTimer = setTimeout(() => {
      body.classList.add('is-home');
      body.classList.remove('is-returning');
      setInert(stage, true);
      setInert(home, false);
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* file:// */ }
      $('#startBtn').focus({ preventScroll: true });
    }, FADE);
  }
  home.addEventListener('click', e => {
    const b = e.target.closest('[data-enter]');
    if (b) enterStage(b.dataset.enter);
  });
  window.__home = { enter: enterStage, show: showHome };

  /* ══════════════ 详情层 ══════════════ */
  const viewer = document.createElement('div');
  viewer.className = 'viewer';
  viewer.hidden = true;
  viewer.innerHTML = `
    <article class="viewer__panel glass" role="dialog" aria-modal="true" aria-labelledby="viewerTitle" tabindex="-1">
      <button class="viewer__close glass" type="button" aria-label="关闭">×</button>
      <p class="viewer__kicker" id="viewerKicker"></p>
      <h3 class="viewer__title" id="viewerTitle"></h3>
      <div class="viewer__imgs" id="viewerImgs"></div>
      <div class="viewer__text" id="viewerText"></div>
      <div class="viewer__foot">
        <span class="viewer__count" id="viewerCount"></span>
        <span class="viewer__nav">
          <button class="viewer__btn glass" type="button" data-nav="-1">← 上一件</button>
          <button class="viewer__btn glass" type="button" data-nav="1">下一件 →</button>
        </span>
      </div>
    </article>`;
  document.body.appendChild(viewer);

  const panel = $('.viewer__panel', viewer);
  const vKicker = $('#viewerKicker', viewer);
  const vTitle = $('#viewerTitle', viewer);
  const vImgs = $('#viewerImgs', viewer);
  const vText = $('#viewerText', viewer);
  const vCount = $('#viewerCount', viewer);
  const vPrev = $('[data-nav="-1"]', viewer);
  const vNext = $('[data-nav="1"]', viewer);

  let vState = { kind: 'story', index: 0 };
  let lastFocus = null;
  let hideTimer = 0;

  const paint = ({ kicker, title, images, text, count, kind, index, prev, next }) => {
    vState = { kind, index };
    panel.dataset.kind = kind || '';
    vKicker.textContent = kicker || '';
    vTitle.textContent = title || '';
    vImgs.innerHTML = (images || []).filter(Boolean).map(src => `<img src="${esc(src)}" alt="">`).join('');
    vImgs.style.display = (images || []).filter(Boolean).length ? 'grid' : 'none';
    vText.innerHTML = (text || []).filter(Boolean).map(t => `<p>${esc(t)}</p>`).join('');
    vCount.textContent = count || '';
    vPrev.disabled = !prev;
    vNext.disabled = !next;
    panel.scrollTop = 0;
  };

  const paintEnd = () => {
    const u = end.unfinished || {};
    paint({
      kicker: u.en || 'WORK IN PROGRESS',
      title: u.title || '未完成的展品',
      images: [],
      text: end.lines || [],
      count: u.no || '∞',
      kind: 'end',
      index: 0,
      prev: false,
      next: false
    });
  };

  const paintFood = i => {
    const f = FOOD[i];
    if (!f) return paintEnd();
    paint({
      kicker: 'TABLE · ' + pad2(f.n),
      title: f.title,
      images: [f.src],
      text: [f.text],
      count: pad2(i + 1) + ' / ' + pad2(FOOD.length),
      kind: 'food',
      index: i,
      prev: i > 0,
      next: i < FOOD.length - 1
    });
  };

  const paintPlay = i => {
    const f = PLAY[i];
    if (!f) return paintEnd();
    paint({
      kicker: 'MOMENT · ' + pad2(f.n),
      title: f.title,
      images: [f.src],
      text: [f.text],
      count: pad2(i + 1) + ' / ' + pad2(PLAY.length),
      kind: 'play',
      index: i,
      prev: i > 0,
      next: i < PLAY.length - 1
    });
  };

  // 时间长廊：一条日期 + 标题，点开看那天的完整一段
  const paintTime = i => {
    const t = TIMELINE[i];
    if (!t) return paintEnd();
    paint({
      kicker: t.date ? fmt(t.date) : (t.chapter || ''),
      title: t.title,
      images: [],
      text: [t.text || t.line || ''],
      count: pad2(i + 1) + ' / ' + pad2(TIMELINE.length),
      kind: 'time',
      index: i,
      prev: i > 0,
      next: i < TIMELINE.length - 1
    });
  };

  const openViewer = () => {
    clearTimeout(hideTimer);
    lastFocus = document.activeElement;
    viewer.hidden = false;
    requestAnimationFrame(() => viewer.classList.add('is-open'));
    panel.focus({ preventScroll: true });
  };

  const closeViewer = () => {
    if (viewer.hidden) return;
    viewer.classList.remove('is-open');
    hideTimer = setTimeout(() => { viewer.hidden = true; }, reduce ? 0 : 280);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  };

  const openFood = i => { paintFood(i); openViewer(); };
  const openPlay = i => { paintPlay(i); openViewer(); };
  const openTime = i => { paintTime(i); openViewer(); };

  viewer.addEventListener('click', e => {
    if (e.target === viewer || e.target.closest('.viewer__close')) { closeViewer(); return; }
    const nav = e.target.closest('[data-nav]');
    if (nav) {
      const dir = +nav.dataset.nav;
      if (vState.kind === 'food') paintFood(clamp(vState.index + dir, 0, FOOD.length - 1));
      else if (vState.kind === 'play') paintPlay(clamp(vState.index + dir, 0, PLAY.length - 1));
      else if (vState.kind === 'time') paintTime(clamp(vState.index + dir, 0, TIMELINE.length - 1));
    }
  });

  deck.addEventListener('click', e => {
    const el = e.target.closest('[data-food],[data-play],[data-time]');
    if (!el) return;
    if (el.dataset.food !== undefined) openFood(+el.dataset.food);
    else if (el.dataset.play !== undefined) openPlay(+el.dataset.play);
    else openTime(+el.dataset.time);
  });

  addEventListener('keydown', e => {
    if (viewer.hidden) return;
    if (e.key === 'Escape') { closeViewer(); return; }
    if (e.key === 'ArrowRight') { vNext.click(); return; }
    if (e.key === 'ArrowLeft') { vPrev.click(); return; }
    if (e.key === 'Tab') {                       // 简易焦点循环
      const f = $$('button:not([disabled])', panel);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ══════════════ 音乐 ══════════════ */
  const bgm = $('#bgm');
  const musicBtn = $('#musicBtn');
  const musicName = $('#musicName');
  if (!bgm || !musicBtn || !musicName) return; // 播放器由独立的留声机组件接管
  const M = S.music || {};
  musicName.textContent = M.title || '音乐';

  let ambient = null;
  let playing = false;

  const setPlaying = on => {
    playing = on;
    musicBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    musicBtn.setAttribute('aria-label', on ? '暂停音乐' : '播放音乐');
    musicBtn.classList.toggle('is-on', on);
  };

  const startAmbient = () => {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    filter.connect(master);
    master.connect(ctx.destination);
    [130.81, 196.0, 246.94, 329.63].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i % 2 ? 'sine' : 'triangle';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = .05;
      o.connect(g);
      g.connect(filter);
      o.start();
    });
    master.gain.linearRampToValueAtTime(.32, ctx.currentTime + 2);
    return { ctx, master };
  };

  const play = async () => {
    if (M.src) {
      if (!bgm.getAttribute('src')) bgm.src = M.src;
      bgm.volume = 0;
      try {
        await bgm.play();
        let v = 0;
        const t = setInterval(() => {
          v = Math.min(.7, v + .05);
          bgm.volume = v;
          if (v >= .7) clearInterval(t);
        }, 120);
        setPlaying(true);
        return;
      } catch (err) { /* 没有音频文件时退回环境音 */ }
    }
    ambient = ambient || startAmbient();
    if (ambient && ambient.ctx.state === 'suspended') await ambient.ctx.resume();
    if (ambient) ambient.master.gain.linearRampToValueAtTime(.32, ambient.ctx.currentTime + .4);
    setPlaying(!!ambient);
  };

  const pause = () => {
    if (bgm.getAttribute('src') && !bgm.paused) bgm.pause();
    if (ambient) ambient.master.gain.linearRampToValueAtTime(0, ambient.ctx.currentTime + .3);
    setPlaying(false);
  };

  musicBtn.addEventListener('click', () => { playing ? pause() : play(); });
})();
