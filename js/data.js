/* =========================================================
   《我们》内容数据文件
   这里只剩「全站通用」和「去过的地方 / 结尾」；
   吃饭、好玩、时间、纪念日都有各自的 *-data.js。
   - 日期格式：'YYYY-MM-DD'
   ========================================================= */
window.SITE = {
  title: '我们',
  subtitle: 'A LIVING ARCHIVE OF TWO',

  // 大厅里“已经一起走过 X 天”从这一天开始算（恋爱纪念日）
  togetherSince: '2026-05-20',

  // 背景音乐：把《天外来物》的 mp3 放到 assets/music/ 并命名为 bgm.mp3
  // 文件不存在时会自动播放一段柔和的环境音
  music: { src: 'assets/music/bgm.mp3', title: '天外来物' },

  /* ---------- 去过的地方 ----------
     lng/lat 是经纬度，地图按 js/china-map.js 的投影直接落点。
     不再连线，只在地图上标点。                                  */
  places: [
    { id: 'hz',  name: '菏泽', en: 'HEZE',      lng: 115.48, lat: 35.23, no: '01' },
    { id: 'qd',  name: '青岛', en: 'QINGDAO',   lng: 120.38, lat: 36.07, no: '02' },
    { id: 'yt',  name: '烟台', en: 'YANTAI',    lng: 121.39, lat: 37.54, no: '03' },
    { id: 'jn',  name: '济南', en: 'JINAN',     lng: 117.00, lat: 36.65, no: '04' },
    { id: 'km',  name: '昆明', en: 'KUNMING',   lng: 102.71, lat: 25.04, no: '05' },
    { id: 'dl',  name: '大理', en: 'DALI',      lng: 100.23, lat: 25.60, no: '06' },
    { id: 'ta',  name: '泰安', en: 'TAIAN',     lng: 117.09, lat: 36.20, no: '07' },
    { id: 'xz',  name: '徐州', en: 'XUZHOU',    lng: 117.18, lat: 34.26, no: '08' }
  ],

  /* ---------- 结尾 ---------- */
  ending: {
    lines: ['故事还没有结束。', '我们正在把下一页写出来。'],
    unfinished: { no: '∞', title: '未完成的展品', en: 'WORK IN PROGRESS' }
  }
};
