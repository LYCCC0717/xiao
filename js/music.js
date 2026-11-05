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
  mount.className = 'turntable';
  mount.setAttribute('aria-label', '我们的唱片机');
  mount.innerHTML = `
    <button class="turntable__play glass glass--tilt" type="button" aria-label="播放音乐" aria-pressed="false">
      <svg class="turntable__play-icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5L13 8L4 13.5Z" fill="currentColor"/></svg>
      <svg class="turntable__pause-icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3H6V13H4ZM10 3H12V13H10Z" fill="currentColor"/></svg>
      <span class="turntable__play-label">播放</span>
    </button>
    <button class="turntable__list-toggle" type="button" aria-haspopup="dialog" aria-label="打开六首钢琴曲歌单">
      <span class="turntable__track-name">初见的光</span><span class="turntable__list-hint">歌单 · 01 / 06</span>
    </button>
    <span class="turntable__status sr-only" role="status" aria-live="polite"></span>
    <dialog class="turntable__playlist glass" aria-labelledby="turntableHeading">
      <header class="turntable__playlist-head"><div><p>OUR LITTLE SOUNDTRACK</p><h2 id="turntableHeading">留一点时间，听听音乐</h2></div><button type="button" class="turntable__close glass glass--pill" aria-label="关闭歌单">×</button></header>
      <p class="turntable__playlist-note">六首原创钢琴小品 · 按顺序循环播放</p>
      <ol class="turntable__tracks">${tracks.map((track,i) => `<li><button type="button" class="turntable__track glass" data-track="${i}" aria-current="${i === 0 ? 'true' : 'false'}"><span>${String(i+1).padStart(2,'0')}</span><b>${track.title}</b><small>${track.duration}</small></button></li>`).join('')}</ol>
      <footer class="turntable__playlist-foot"><button type="button" class="turntable__prev glass glass--pill" aria-label="上一首">← 上一首</button><span class="turntable__playing-text">尚未播放</span><button type="button" class="turntable__next glass glass--pill" aria-label="下一首">下一首 →</button></footer>
      <p class="turntable__error" role="alert" hidden></p>
    </dialog>`;

  const $ = selector => mount.querySelector(selector);
  const playButton = $('.turntable__play');
  const trackName = $('.turntable__track-name');
  const listHint = $('.turntable__list-hint');
  const playLabel = $('.turntable__play-label');
  const status = $('.turntable__status');
  const playingText = $('.turntable__playing-text');
  const errorText = $('.turntable__error');
  const dialog = $('.turntable__playlist');
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
  $('.turntable__list-toggle').addEventListener('click', () => dialog.showModal());
  $('.turntable__close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });
  mount.querySelectorAll('[data-track]').forEach(button => button.addEventListener('click', () => select(Number(button.dataset.track), true)));
  $('.turntable__prev').addEventListener('click', () => select(index - 1));
  $('.turntable__next').addEventListener('click', () => select(index + 1));
  // Keep the main gallery's page-turn keys / wheel handler out of the player.
  mount.addEventListener('keydown', event => { if (event.key !== 'Escape') event.stopPropagation(); });
  mount.addEventListener('wheel', event => event.stopPropagation(), {passive: true});
})();
