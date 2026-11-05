/* A small record player. One audio element, six local original piano pieces. */
(() => {
  'use strict';
  const mount = document.getElementById('musicPlayer');
  if (!mount) return;
  const tracks = [
    ['初见的光', '01-first-light.wav', '1:00'],
    ['慢慢的午后', '02-slow-afternoon.wav', '0:50'],
    ['同一把伞', '03-under-one-umbrella.wav', '0:56'],
    ['海边的晚风', '04-evening-by-the-sea.wav', '0:49'],
    ['写给你的信', '05-a-letter-to-you.wav', '0:58'],
    ['明天也和你', '06-tomorrow-with-you.wav', '1:01']
  ].map(([title, file, duration]) => ({title, src: 'assets/music/' + file, duration}));
  mount.className = 'gramophone';
  mount.setAttribute('aria-label', '我们的留声机');
  mount.innerHTML = `
    <div class="gramophone__instrument" aria-hidden="true">
      <svg viewBox="0 0 160 168" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="g-horn" x1="46" y1="15" x2="125" y2="98" gradientUnits="userSpaceOnUse"><stop stop-color="#b48451"/><stop offset=".42" stop-color="#68462c"/><stop offset=".7" stop-color="#3d2a20"/><stop offset="1" stop-color="#bd8d57"/></linearGradient>
          <linearGradient id="g-wood" x1="36" y1="114" x2="124" y2="157" gradientUnits="userSpaceOnUse"><stop stop-color="#715039"/><stop offset="1" stop-color="#251c18"/></linearGradient>
          <radialGradient id="g-bell"><stop stop-color="#15120f"/><stop offset=".65" stop-color="#38271e"/><stop offset="1" stop-color="#8b6341"/></radialGradient>
        </defs>
        <ellipse cx="80" cy="157" rx="55" ry="7" fill="#3c2c1d" opacity=".12"/>
        <g class="gramophone__horn">
          <path d="M88 104C112 101 112 83 101 71L90 58L76 70L89 83C93 88 94 92 87 93" stroke="url(#g-horn)" stroke-width="12" stroke-linecap="round"/>
          <path d="M104 76C90 61 89 48 84 28L42 20L24 49C45 56 64 59 82 78C88 84 98 83 104 76Z" fill="url(#g-horn)" stroke="#b08b5c" stroke-width="1"/>
          <ellipse cx="52" cy="36" rx="33" ry="21" transform="rotate(-27 52 36)" fill="url(#g-bell)" stroke="#b38a59" stroke-width="3"/>
          <ellipse cx="52" cy="36" rx="25" ry="14" transform="rotate(-27 52 36)" stroke="#b38a59" stroke-opacity=".2"/>
          <path d="M33 28C43 19 58 16 68 20" stroke="#e7c995" stroke-width="2" stroke-linecap="round" opacity=".6"/>
        </g>
        <path d="M32 115L50 105H119L134 116V147L119 154H45L32 146V115Z" fill="url(#g-wood)" stroke="#2b211b"/>
        <path d="M32 115H134L119 126H45L32 115Z" fill="#8c6444"/>
        <path d="M45 126H119V154H45V126Z" fill="#372820"/>
        <path d="M50 131H113V148H50V131Z" stroke="#896442" stroke-opacity=".65"/>
        <g transform="translate(80 115) scale(1 .38)">
          <g class="gramophone__record">
            <circle r="35" fill="#171615"/>
            <circle r="29" stroke="#423b32"/><circle r="23" stroke="#302c27"/><circle r="17" stroke="#423b32"/>
            <path d="M-24-17L-4-3M24 17L4 3" stroke="#d8b37d" stroke-opacity=".26" stroke-width="7"/>
            <circle r="9" fill="#c57a42"/><circle r="2" fill="#e7c895"/>
          </g>
        </g>
        <path d="M115 104V111L97 118" stroke="#c1a16f" stroke-width="3" stroke-linecap="round"/>
        <rect x="91" y="116" width="9" height="4" rx="2" fill="#39271e"/>
        <path d="M134 132H142V141H147" stroke="#b58a59" stroke-width="3" stroke-linecap="round"/>
        <rect x="144" y="137" width="8" height="8" rx="3" fill="#36271d"/>
        <path d="M48 155V158M115 155V158" stroke="#31231c" stroke-width="6" stroke-linecap="round"/>
        <path d="M70 138H94" stroke="#c1935f" stroke-width="1"/><circle cx="81" cy="139" r="2" fill="#c1935f"/>
      </svg>
    </div>
    <button class="gramophone__play glass glass--tilt" type="button" aria-label="播放音乐" aria-pressed="false">
      <svg class="gramophone__play-icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5L13 8L4 13.5Z" fill="currentColor"/></svg>
      <svg class="gramophone__pause-icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3H6V13H4ZM10 3H12V13H10Z" fill="currentColor"/></svg>
      <span class="gramophone__play-label">播放</span>
    </button>
    <button class="gramophone__list-toggle" type="button" aria-haspopup="dialog" aria-label="打开六首钢琴曲歌单">
      <span class="gramophone__track-name">初见的光</span><span class="gramophone__list-hint">歌单 · 01 / 06</span>
    </button>
    <span class="gramophone__status sr-only" role="status" aria-live="polite"></span>
    <dialog class="gramophone__playlist glass" aria-labelledby="gramophoneHeading">
      <header class="gramophone__playlist-head"><div><p>OUR LITTLE SOUNDTRACK</p><h2 id="gramophoneHeading">留一点时间，听听音乐</h2></div><button type="button" class="gramophone__close glass glass--pill" aria-label="关闭歌单">×</button></header>
      <p class="gramophone__playlist-note">六首原创钢琴小品 · 按顺序循环播放</p>
      <ol class="gramophone__tracks">${tracks.map((track,i) => `<li><button type="button" class="gramophone__track glass" data-track="${i}" aria-current="${i === 0 ? 'true' : 'false'}"><span>${String(i+1).padStart(2,'0')}</span><b>${track.title}</b><small>${track.duration}</small></button></li>`).join('')}</ol>
      <footer class="gramophone__playlist-foot"><button type="button" class="gramophone__prev glass glass--pill" aria-label="上一首">← 上一首</button><span class="gramophone__playing-text">尚未播放</span><button type="button" class="gramophone__next glass glass--pill" aria-label="下一首">下一首 →</button></footer>
      <p class="gramophone__error" role="alert" hidden></p>
    </dialog>`;

  const $ = selector => mount.querySelector(selector);
  const playButton = $('.gramophone__play');
  const trackName = $('.gramophone__track-name');
  const listHint = $('.gramophone__list-hint');
  const playLabel = $('.gramophone__play-label');
  const status = $('.gramophone__status');
  const playingText = $('.gramophone__playing-text');
  const errorText = $('.gramophone__error');
  const dialog = $('.gramophone__playlist');
  const audio = document.createElement('audio');
  audio.id = 'galleryMusic';
  audio.preload = 'none';
  audio.volume = .42;
  audio.loop = false;
  mount.append(audio);
  let index = 0;
  let desired = false;
  let requestId = 0;

  const showError = message => {
    errorText.textContent = message;
    errorText.hidden = false;
    status.textContent = message;
  };
  const reflectState = (on, buffering = false) => {
    mount.classList.toggle('is-playing', on);
    mount.classList.toggle('is-buffering', buffering);
    playButton.setAttribute('aria-pressed', String(on));
    playButton.setAttribute('aria-label', buffering ? '取消加载音乐' : on ? '暂停音乐' : '播放音乐');
    playLabel.textContent = buffering ? '加载中' : on ? '暂停' : '播放';
    playingText.textContent = buffering ? '正在加载…' : on ? '正在播放' : '已暂停';
  };
  const setTrack = next => {
    index = (next + tracks.length) % tracks.length;
    audio.src = tracks[index].src;
    trackName.textContent = tracks[index].title;
    listHint.textContent = '歌单 · ' + String(index+1).padStart(2,'0') + ' / 06';
    mount.querySelectorAll('[data-track]').forEach(button => button.setAttribute('aria-current', String(Number(button.dataset.track) === index)));
    errorText.hidden = true;
  };
  const play = async () => {
    desired = true;
    const token = ++requestId;
    if (!audio.getAttribute('src')) setTrack(index);
    errorText.hidden = true;
    reflectState(false, true);
    try {
      await audio.play();
      if (token !== requestId || !desired) return;
      reflectState(!audio.paused);
    } catch (error) {
      if (token !== requestId || !desired || error.name === 'AbortError') return;
      desired = false;
      reflectState(false);
      showError('这首音乐暂时无法播放，请重试或选择下一首。');
    }
  };
  const pause = () => {
    desired = false;
    requestId++;
    audio.pause();
    reflectState(false);
  };
  const select = (next, shouldPlay = desired) => {
    requestId++;
    audio.pause();
    setTrack(next);
    if (shouldPlay) play();
    else { desired = false; reflectState(false); }
  };

  playButton.addEventListener('click', () => desired ? pause() : play());
  audio.addEventListener('playing', () => { if (desired) { reflectState(true); status.textContent = '正在播放：' + tracks[index].title; } });
  audio.addEventListener('waiting', () => { if (desired) reflectState(false, true); });
  audio.addEventListener('pause', () => { if (audio.paused) reflectState(false); });
  audio.addEventListener('ended', () => { if (desired) select(index + 1, true); });
  audio.addEventListener('error', () => {
    if (!desired) return;
    desired = false;
    requestId++;
    reflectState(false);
    showError('这首音乐暂时无法播放，请重试或选择下一首。');
  });
  $('.gramophone__list-toggle').addEventListener('click', () => dialog.showModal());
  $('.gramophone__close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });
  mount.querySelectorAll('[data-track]').forEach(button => button.addEventListener('click', () => select(Number(button.dataset.track), true)));
  $('.gramophone__prev').addEventListener('click', () => select(index - 1));
  $('.gramophone__next').addEventListener('click', () => select(index + 1));
  // Keep the main gallery's page-turn keys / wheel handler out of the player.
  mount.addEventListener('keydown', event => { if (event.key !== 'Escape') event.stopPropagation(); });
  mount.addEventListener('wheel', event => event.stopPropagation(), {passive: true});
})();
