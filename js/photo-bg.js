/* 背景照片墙：小红书首页式的多列瀑布流，大小、高低错落，整体模糊，固定在视口里不随页面滚动。
   照片在 assets/bg/，只在列数变化时重排。 */
(() => {
  'use strict';
  const mount = document.getElementById('photoBg');
  if (!mount) return;

  const PHOTOS = [
    ['assets/bg/bg-01.jpg', 693 / 520],
    ['assets/bg/bg-02.jpg', 693 / 520],
    ['assets/bg/bg-03.jpg', 693 / 520],
    ['assets/bg/bg-04.jpg', 694 / 520],
    ['assets/bg/bg-05.jpg', 693 / 520],
    ['assets/bg/bg-06.jpg', 693 / 520],
    ['assets/bg/bg-07.jpg', 345 / 520]
  ];
  // 每张卡片在原比例上再乘一个系数，让同一张照片出现时高矮也不一样
  const STRETCH = [1, .78, 1.12, .9, 1.22, .7, 1.05, .84];
  // 每列起始高低不同：负值表示从视口上方露出半截
  const OFFSET = [-.18, -.04, -.26, -.1, -.32, -.06, -.22];

  const columnsFor = w => (w >= 1400 ? 6 : w >= 1100 ? 5 : w >= 760 ? 4 : 3);
  let built = 0;

  const build = () => {
    const w = innerWidth;
    const h = innerHeight;
    const cols = columnsFor(w);
    if (cols === built && mount.childElementCount) return;
    built = cols;
    const gap = w < 760 ? 10 : 16;
    const colW = (w - gap * (cols + 1)) / cols;
    let n = 0;
    let html = '';
    for (let c = 0; c < cols; c++) {
      // 每列从不同的照片开始，相邻两列不会并排出现同一张
      let k = (c * 3) % PHOTOS.length;
      let y = OFFSET[c % OFFSET.length] * h;
      let cards = '';
      while (y < h * 1.15) {
        const [src, ratio] = PHOTOS[k % PHOTOS.length];
        const cardH = Math.round(colW * ratio * STRETCH[n % STRETCH.length]);
        cards += `<span class="photo-bg__card" style="height:${cardH}px"><img src="${src}" alt="" decoding="async"></span>`;
        y += cardH + gap;
        k += 1;
        n += 1;
      }
      html += `<div class="photo-bg__col" style="margin-top:${Math.round(OFFSET[c % OFFSET.length] * h)}px">${cards}</div>`;
    }
    mount.style.setProperty('--bg-gap', gap + 'px');
    mount.innerHTML = html;
  };

  let timer = 0;
  addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(build, 150); }, { passive: true });
  build();
})();
