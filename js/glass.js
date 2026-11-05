/* Liquid glass: a separate backdrop lens, spring-following highlights and a small lift.
   Text/photos remain on an unfiltered foreground. Pointer listeners are delegated,
   so new masonry cards, playlist items and refreshed dates work without rebinding. */
(() => {
  'use strict';
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const find = target => target instanceof Element ? target.closest('.glass') : null;

  // Backdrop-filter URL support is an enhancement. The CSS blur layer remains
  // usable on Safari/mobile and whenever the browser cannot render this lens.
  const svgNS = 'http://www.w3.org/2000/svg';
  const defs = document.createElementNS(svgNS, 'svg');
  defs.setAttribute('width', '0');
  defs.setAttribute('height', '0');
  defs.setAttribute('aria-hidden', 'true');
  defs.style.cssText = 'position:fixed;left:0;top:0;pointer-events:none;overflow:hidden';
  defs.innerHTML = `<defs>
    <filter id="liquid-glass-refraction" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency=".018 .024" numOctaves="2" seed="17" result="noise" />
      <feGaussianBlur in="noise" stdDeviation="2" result="softNoise" />
      <feDisplacementMap in="SourceGraphic" in2="softNoise" scale="12" xChannelSelector="R" yChannelSelector="G" />
    </filter>
  </defs>`;
  document.body.appendChild(defs);
  const noise = defs.querySelector('feTurbulence');
  const canRefract = !!window.CSS && CSS.supports('backdrop-filter', 'url("#liquid-glass-refraction") blur(10px)')
    && /Chrome|Chromium|Edg\//.test(navigator.userAgent);
  const syncSupport = () => {
    document.documentElement.dataset.glassRefraction = canRefract && fine.matches && !reduced.matches ? 'on' : 'off';
  };
  syncSupport();

  let hot = null;
  let raf = 0;
  let lastTime = 0;
  let x = .5, y = .15, aimX = .5, aimY = .15;
  let lastNoiseFrame = 0;
  let pressed = null;
  let pressTimer = 0;

  const reset = el => {
    if (!el) return;
    el.classList.remove('is-hot');
    ['--gx', '--gy', '--rx', '--ry', '--gangle'].forEach(k => el.style.removeProperty(k));
  };
  const clear = () => {
    reset(hot);
    hot = null;
    cancelAnimationFrame(raf);
    raf = 0;
    lastTime = 0;
  };

  const tick = time => {
    raf = 0;
    if (!hot || !hot.isConnected || document.hidden) { clear(); return; }
    const dt = clamp((time - (lastTime || time - 16)) / 1000, .001, .05);
    lastTime = time;
    const ease = 1 - Math.exp(-dt / .085);
    x += (aimX - x) * ease;
    y += (aimY - y) * ease;
    hot.style.setProperty('--gx', `${(x * 100).toFixed(2)}%`);
    hot.style.setProperty('--gy', `${(y * 100).toFixed(2)}%`);
    hot.style.setProperty('--gangle', `${(135 + x * 36 + Math.sin(time * .0013) * 7).toFixed(2)}deg`);
    if (hot.classList.contains('glass--tilt') && !reduced.matches) {
      hot.style.setProperty('--ry', `${((x - .5) * 3).toFixed(2)}deg`);
      hot.style.setProperty('--rx', `${((.5 - y) * 2.4).toFixed(2)}deg`);
    }
    // One visible lens; update its slow displacement at 20 Hz, not all cards.
    if (canRefract && time - lastNoiseFrame > 50) {
      noise.setAttribute('baseFrequency', `${(.018 + Math.sin(time * .0007) * .0014).toFixed(5)} ${(.024 + Math.cos(time * .0006) * .0015).toFixed(5)}`);
      lastNoiseFrame = time;
    }
    if (!reduced.matches) raf = requestAnimationFrame(tick);
  };

  addEventListener('pointermove', e => {
    if (e.pointerType === 'touch' || !fine.matches) return;
    const el = find(e.target);
    if (el !== hot) {
      reset(hot);
      hot = el;
      x = .5; y = .15;
      if (el) el.classList.add('is-hot');
    }
    if (!el) { clear(); return; }
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    aimX = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    aimY = clamp((e.clientY - rect.top) / rect.height, 0, 1);
    if (reduced.matches) { x = aimX; y = aimY; }
    if (!raf) raf = requestAnimationFrame(tick);
  }, { passive: true });

  const release = () => {
    if (pressed) pressed.classList.remove('is-press');
    pressed = null;
    clearTimeout(pressTimer);
  };
  addEventListener('pointerdown', e => {
    release();
    pressed = find(e.target);
    if (!pressed) return;
    pressed.classList.add('is-press');
    pressTimer = setTimeout(release, 220);
  }, { passive: true });
  addEventListener('pointerup', release, { passive: true });
  addEventListener('pointercancel', release, { passive: true });
  addEventListener('blur', () => { clear(); release(); });
  document.addEventListener('pointerleave', clear);
  document.addEventListener('scroll', clear, { passive: true, capture: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { clear(); release(); } });
  const preferenceChanged = () => { clear(); syncSupport(); };
  fine.addEventListener('change', preferenceChanged);
  reduced.addEventListener('change', preferenceChanged);
})();
