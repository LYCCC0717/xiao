/* =========================================================
   纪念日 —— 五张卡
   mode:
     'since'  从那天起已经过了多少天
     'annual' 每年重复，倒计时到下一次
   日期只用年-月-日；'annual' 只看月和日，年份只用来算起点。
   ========================================================= */
window.DATES = [
  { no: 'N°01', en: 'OUR ANNIVERSARY',     name: '我们的纪念日', date: '2026-05-20', mode: 'annual' },
  { no: 'N°02', en: 'TOGETHER',            name: '我们在一起',   date: '2026-05-20', mode: 'since'  },
  { no: 'N°03', en: 'YOUR BIRTHDAY',       name: '你的生日',     date: '2026-06-30', mode: 'annual' },
  { no: 'N°04', en: 'MY BIRTHDAY',         name: '我的生日',     date: '2026-04-07', mode: 'annual' },
  { no: 'N°05', en: 'THE DAY WE MET AGAIN', name: '我们重逢的日子', date: '2026-05-06', mode: 'since' }
];
