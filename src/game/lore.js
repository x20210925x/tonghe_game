// Field archives left along the route. a1 is the work order that frames the shift.
export const ARCHIVES = [
  {
    id: 'a1',
    code: 'WO-0417',
    title: '巡检工单',
    where: '值班室',
    text: [
      '上游来水已恢复。砼核须在汛期前完成重启。',
      '路线：值班室 → 泄洪廊 → 动力间 → 砼核主控层。旁通阀表压偏高，过闸前先泄压。动力间三处隔离开关合上后，才能合总闸。',
      '巡检员一名。注意脚下。',
    ],
    sign: '—— 调度室',
  },
  {
    id: 'a2',
    code: 'LOG-312',
    title: '值班日志 · 第三百一十二天',
    where: '泄洪廊',
    text: [
      '今天又没有人来换班。广播里只有水声。',
      '我开始习惯和墙说话。它们比我老，也比我有耐心。',
    ],
    sign: '—— 前任值班员',
  },
  {
    id: 'a3',
    code: 'POUR-071',
    title: '转运梁浇筑记录',
    where: '转运梁',
    text: [
      '转运梁一次连续浇筑，用时七十一小时。那三天没有人睡觉，搅拌车一直排到山口。',
      '混凝土会在之后的一百年里继续变硬。我们不会。',
    ],
    sign: '—— 第三施工队',
  },
  {
    id: 'a4',
    code: 'RIB-W13',
    title: '肋墙编号说明',
    where: '泄洪廊北端',
    text: [
      '肋墙从 W-01 编到 W-13。每一道的模板木纹都不一样，因为木料来自不同的山。',
      '仔细看，你能认出松木和杉木。',
    ],
    sign: '—— 测绘组',
  },
  {
    id: 'a5',
    code: 'PWR-ISO',
    title: '配电操作须知',
    where: '动力间夹层',
    text: [
      '三处隔离开关逐一合上，最后才是总闸。顺序错了，整条栈桥的灯会同时熄灭。',
      '别问我是怎么知道的。',
    ],
    sign: '—— 电工班',
  },
  {
    id: 'a6',
    code: 'M-04',
    title: '轨车交接单',
    where: '轨道栈桥侧台',
    text: [
      'M-04 是最后一辆还能跑的轨车。刹车有点软，过了半程就要开始减速。',
      '我给它起了个名字，但不告诉你。',
    ],
    sign: '—— 机务',
  },
  {
    id: 'a7',
    code: 'CORE-L1',
    title: '中段设计备忘',
    where: '砼核 · 中段',
    text: [
      '最初的图纸上，砼核的中心并不是空的。后来他们决定留出这口井，让光能落到底层。',
      '总工说：一座建筑要有能呼吸的地方。',
    ],
    sign: '—— 设计院',
  },
  {
    id: 'a8',
    code: 'CROWN',
    title: '冠顶留言',
    where: '砼核 · 冠顶',
    text: [
      '从冠顶往下看，泄洪廊只是一条细线。我们修了三十年，才让它看起来这么小。',
      '如果你读到这里——谢谢你来巡检。它一直在等人。',
    ],
    sign: '—— 无署名',
  },
  // ---------- Chapter two: 汛期 ----------
  {
    id: 'a9',
    chapter: 2,
    code: 'FLD-001',
    title: '汛期调度令',
    where: '砼核 · 主控层',
    text: [
      '上游连降暴雨，水库水位将在今夜逼近坝顶。砼核既已重启，北坝三孔泄洪闸须在漫顶前全部开启。',
      '北门通往坝顶的栈桥已经两年没人走过。走之前把头灯打开。',
    ],
    sign: '—— 调度室',
  },
  {
    id: 'a10',
    chapter: 2,
    code: 'BRG-N02',
    title: '栈桥维修申请（未批）',
    where: '风雨栈桥 · 2 号避风处',
    text: [
      '东侧护栏两处锈断，申请更换。另：横风很有规律，大约十来秒一阵，起风前桥上会先呜呜地响。',
      '听见了就躲到挡风墙后面，或者顶着风跑。这条写进交接班，别等批复。',
    ],
    sign: '—— 桥梁巡检',
  },
  {
    id: 'a11',
    chapter: 2,
    code: 'GAL-084',
    title: '检修廊渗水记录',
    where: '检修廊 +084',
    text: [
      '廊道东段又渗水了。每次漫到接线箱，2 号闸的电就跳。',
      '箱子在最里头。复位手柄往下扳到底，绿灯亮了再走。',
    ],
    sign: '—— 坝体观测组',
  },
  {
    id: 'a12',
    chapter: 2,
    code: 'HYD-G03',
    title: '3 号闸液压说明',
    where: '启闭机房 · 3 号闸',
    text: [
      '蓄能器坏了以后，3 号闸只能靠手压泵。压力过了表盘上那道白线，闸门才会动。',
      '人一离开，阀就关上，闸门停在原处。别停手，一口气压到全开。',
    ],
    sign: '—— 机电班',
  },
];

export const archiveById = (id) => ARCHIVES.find((a) => a.id === id);
// Each chapter keeps its own set of archives; entries without a chapter belong to the first.
export const chapterOf = (id) => archiveById(id)?.chapter ?? 1;
export const archivesOf = (chapter) => ARCHIVES.filter((a) => (a.chapter ?? 1) === chapter);
