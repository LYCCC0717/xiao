/* =========================================================
   《我们》内容数据文件
   以后替换内容只需要改这个文件。
   - 日期格式：'YYYY-MM-DD'
   - 照片：把图片放进 assets/photos/，然后填 'assets/photos/xxx.jpg'
     留空 '' 时会显示艺术化占位。
   - 当前所有文字、日期都是占位，请替换为真实内容。
   ========================================================= */
window.SITE = {
  title: '我们',
  subtitle: 'A LIVING ARCHIVE OF TWO',

  // 大厅里“已经一起走过 X 天”从这一天开始算（恋爱纪念日）
  togetherSince: '2024-05-20',

  // 背景音乐：把《天外来物》的 mp3 放到 assets/music/ 并命名为 bgm.mp3
  // 文件不存在时会自动播放一段柔和的环境音
  music: { src: 'assets/music/bgm.mp3', title: '天外来物' },

  /* ---------- 故事展品区 ---------- */
  themes: [
    { id: 'beginning', en: 'BEGINNING', cn: '从遇见开始' },
    { id: 'ordinary',  en: 'ORDINARY',  cn: '平凡的光' },
    { id: 'journey',   en: 'JOURNEY',   cn: '一起去远方' },
    { id: 'continue',  en: 'CONTINUE',  cn: '还在继续' }
  ],

  // 同一主题内按 date 自动排序
  stories: [
    { no: '001', theme: 'beginning', date: '2024-03-16', place: '嘉兴',
      title: '第一次见面', summary: '那天的风很轻，你比照片里更好看。',
      text: ['这里写完整的故事。可以分成几段短句。', '第二段：那天发生了什么，你记得的细节。', '第三段：当时心里的想法。'],
      photos: [] },
    { no: '002', theme: 'beginning', date: '2024-05-20', place: '杭州',
      title: '在一起的那天', summary: '一句话，把两个人的名字写在了一起。',
      text: ['这里写完整的故事。', '可以写当时说了什么。'],
      photos: [] },
    { no: '003', theme: 'ordinary', date: '2024-07-08', place: '杭州',
      title: '雨天', summary: '一把伞，两个人都淋湿了一半。',
      text: ['这里写完整的故事。'], photos: [] },
    { no: '004', theme: 'ordinary', date: '2024-09-21', place: '嘉兴',
      title: '普通的晚饭', summary: '最普通的日子，也被你照亮。',
      text: ['这里写完整的故事。'], photos: [] },
    { no: '005', theme: 'journey', date: '2024-10-03', place: '杭州 · 西湖',
      title: '西湖边', summary: '湖面很亮，你走在我左边。',
      text: ['这里写完整的故事。'], photos: [] },
    { no: '006', theme: 'journey', date: '2024-12-31', place: '上海',
      title: '城市夜景与新年', summary: '倒数结束的那一秒，我在看你。',
      text: ['这里写完整的故事。'], photos: [] },
    { no: '007', theme: 'continue', date: '2025-02-14', place: '上海',
      title: '再见与下一次见面', summary: '每一次再见，都是下一次见面的开始。',
      text: ['这里写完整的故事。'], photos: [] },
    { no: '008', theme: 'continue', date: '2025-06-01', place: '未完待续',
      title: '还在继续', summary: '这一件展品，还在创作中。',
      text: ['这里写完整的故事。'], photos: [] }
  ],

  /* ---------- 时间长廊 ---------- */
  timeline: [
    { chapter: 'BEGINNING', date: '2024-03-16', place: '嘉兴', title: '遇见', line: '第一次见面，记住了你的声音。', no: '001' },
    { chapter: 'BEGINNING', date: '2024-05-20', place: '杭州', title: '开始', line: '我们成为了“我们”。', no: '002' },
    { chapter: 'ORDINARY',  date: '2024-07-08', place: '杭州', title: '雨天', line: '雨很大，但一点都不冷。', no: '003' },
    { chapter: 'JOURNEY',   date: '2024-10-03', place: '西湖', title: '远方', line: '第一次一起旅行。', no: '005' },
    { chapter: 'JOURNEY',   date: '2024-12-31', place: '上海', title: '新年', line: '一起跨过了一年。', no: '006' },
    { chapter: 'CONTINUE',  date: '2025-02-14', place: '上海', title: '再见', line: '约好了下一次。', no: '007' },
    { chapter: 'CONTINUE',  date: '', place: '未来', title: '下一页', line: '正在书写中。', no: '∞' }
  ],

  /* ---------- 环形胶片墙 ---------- */
  photos: [
    { src: '', date: '2024-03-16', place: '嘉兴', title: '第一次见面', text: '这里写这张照片背后的回忆。' },
    { src: '', date: '2024-10-03', place: '西湖', title: '湖边的风', text: '这里写这张照片背后的回忆。' },
    { src: '', date: '2024-07-08', place: '杭州', title: '雨天', text: '这里写这张照片背后的回忆。' },
    { src: '', date: '2024-12-30', place: '上海', title: '城市夜景', text: '这里写这张照片背后的回忆。' },
    { src: '', date: '2024-12-31', place: '上海', title: '新年', text: '这里写这张照片背后的回忆。' },
    { src: '', date: '2025-02-14', place: '上海', title: '再见', text: '这里写这张照片背后的回忆。' },
    { src: '', date: '2025-03-01', place: '嘉兴', title: '下一次见面', text: '这里写这张照片背后的回忆。' }
  ],

  /* ---------- 纪念日长廊 ----------
     mode:
       'since'  从那天起已经过了多少天（如第一次见面）
       'annual' 每年重复，倒计时到下一次（如生日、恋爱纪念日）
       'until'  倒计时到某个未来日期（如下一次见面）            */
  dates: [
    { no: 'N°01', en: 'THE FIRST MEETING', name: '第一次见面', date: '2024-03-16', mode: 'since' },
    { no: 'N°02', en: 'OUR ANNIVERSARY',  name: '恋爱纪念日', date: '2024-05-20', mode: 'annual' },
    { no: 'N°03', en: 'HER BIRTHDAY',     name: '她的生日',   date: '2000-08-18', mode: 'annual' },
    { no: 'N°04', en: 'NEXT TIME',        name: '下一次见面', date: '2026-12-24', mode: 'until' },
    { no: 'N°05', en: 'SOMEDAY',          name: '一起看极光', date: '2027-12-01', mode: 'until' }
  ],

  /* ---------- 发光地图 ----------
     lng/lat 为经纬度，地图会根据所有地点自动缩放。
     route 是光线连接的顺序（填地点 id）。                     */
  places: [
    { id: 'jx', name: '嘉兴', en: 'JIAXING',  lng: 120.76, lat: 30.75, date: '2024-03-16', no: '001',
      memory: '故事开始的地方。', photo: '' },
    { id: 'hz', name: '杭州', en: 'HANGZHOU', lng: 120.16, lat: 30.27, date: '2024-05-20', no: '002',
      memory: '西湖、雨天，和很多个普通的傍晚。', photo: '' },
    { id: 'sh', name: '上海', en: 'SHANGHAI', lng: 121.47, lat: 31.23, date: '2024-12-31', no: '006',
      memory: '城市的灯，和一起跨过的新年。', photo: '' }
  ],
  route: ['jx', 'hz', 'sh'],

  /* ---------- 结尾 ---------- */
  ending: {
    lines: ['故事还没有结束。', '我们正在把下一页写出来。'],
    unfinished: { no: '∞', title: '未完成的展品', en: 'WORK IN PROGRESS' }
  }
};
