// The route as an ordered list of steps. The current objective is the first unfinished one,
// so skipping optional reading or restoring an old save never strands the player.
import {
  BOOTH,
  DOOR,
  VALVE,
  BRIDGE,
  DECK,
  HALL,
  SWITCHES,
  BREAKER,
  CART,
  CORE_DOOR,
  LIFT,
  LIFT_PANEL,
  LEVEL,
  CONSOLE,
  RECORD,
  FLIGHTS,
  NORTH_DOOR,
  STORM_BRIDGE,
  REFUGE,
  GATES,
  ROAD,
  PANELS,
  GALLERY,
  JUNCTION,
  HOUSE,
  SHAFT_ROOM,
  GAUGE,
} from './layout.js';

const liftPanel = (site) => [LIFT.cx + LIFT_PANEL.dx, site.liftY + 1.3, LIFT.cz + LIFT_PANEL.dz];

export const STEPS = [
  {
    id: 'workorder',
    done: (s) => s.has('workorder') || s.has('door'),
    text: () => '阅读值班台上的巡检工单',
    target: () => [BOOTH.desk.x, 1.3, BOOTH.desk.z],
  },
  {
    id: 'door',
    done: (s) => s.has('door'),
    text: () => '打开检修门，进入泄洪廊',
    target: () => [DOOR.x, 1.3, DOOR.z],
  },
  {
    id: 'valve',
    done: (s) => s.has('valve'),
    text: () => '调节旁通阀，为泄压闸泄压',
    target: () => [VALVE.x, 1.4, VALVE.z + 0.4],
  },
  {
    id: 'hall',
    done: (s) => s.has('hall'),
    text: () => '穿过泄压闸，沿斜桥前往动力间',
    target: (s, p) =>
      p.x < DECK.x1 + 0.5 && p.y < 8 ? [BRIDGE.x + 1.6, 1, BRIDGE.z - 1.3] : [74, 1.4, -116],
  },
  {
    id: 'switches',
    done: (s) => s.switchesClosed === 3,
    text: (s) => `合上三处隔离开关（${s.switchesClosed}/3）`,
    target: (s, p) => {
      let best = null,
        dist = Infinity;
      for (const sw of SWITCHES) {
        if (s.has(sw.id)) continue;
        const d = Math.hypot(sw.x - p.x, sw.y - p.y, sw.z - p.z);
        if (d < dist) {
          dist = d;
          best = [sw.x, sw.y + 1.5, sw.z];
        }
      }
      return best;
    },
  },
  {
    id: 'main',
    done: (s) => s.has('main'),
    text: () => '合上动力总闸',
    target: () => [BREAKER.x, 1.6, BREAKER.z + 0.6],
  },
  {
    id: 'core',
    done: (s) => s.has('core'),
    text: (s) => (s.aboard ? '驾驶轨车前往砼核' : '前往砼核（可搭乘检修轨车）'),
    target: (s, p) =>
      !s.aboard && s.cartZ > CART.end + 1 && p.z > s.cartZ - 4 && p.z < HALL.z1
        ? [CART.x, 1.5, s.cartZ]
        : [(CORE_DOOR.x0 + CORE_DOOR.x1) / 2, 2.2, CORE_DOOR.z + 1],
  },
  {
    id: 'lift',
    done: (s) => s.has('stall'),
    text: (s) => (s.liftMoving ? '升降台上行中' : '登上升降台，启动上行'),
    target: (s) => (s.liftMoving ? null : liftPanel(s)),
  },
  {
    id: 'console',
    done: (s) => s.has('console'),
    text: (s, p) =>
      p.y < LEVEL.L2 - 2 ? '上段供电中断 · 沿北墙检修梯攀至主控层' : '在主控台重启砼核',
    target: (s, p) =>
      p.y < LEVEL.L1 + 1.5
        ? [FLIGHTS.x0 - 1.2, LEVEL.L1 + 1.2, FLIGHTS.a[0] + 2.6]
        : [CONSOLE.x, CONSOLE.y + 1.4, CONSOLE.z],
  },
  {
    id: 'crown',
    done: (s) => s.has('crown'),
    text: (s) =>
      s.liftMoving ? '升降台运行中' : s.liftY === LEVEL.L2 ? '乘升降台登顶' : '等待升降台到达主控层',
    target: (s) => (s.liftMoving ? null : liftPanel(s)),
  },
  {
    id: 'record',
    done: (s) => s.has('record'),
    text: () => '在冠顶观测台记录巡检',
    target: () => [RECORD.x, RECORD.y + 1.3, RECORD.z],
  },
];

// Chapter two: the flood.
const refugeAhead = (p) => {
  const next = STORM_BRIDGE.piers.find((z) => z < p.z - 2);
  return next === undefined ? [GATES[0].door - 6, 97.2, ROAD.z1 - 2] : [REFUGE.x0 + 2.2, 97.2, next];
};
const panel = (spot, y = 97.3) => [spot.x + Math.sin(spot.face) * 0.5, y, spot.z + Math.cos(spot.face) * 0.5];
const pct = (v) => Math.round(v * 100) + '%';
export const STEPS2 = [
  {
    id: 'ndoor',
    done: (s) => s.has('ndoor'),
    text: () => '打开主控层北门，前往北坝',
    target: () => [(NORTH_DOOR.x0 + NORTH_DOOR.x1) / 2, 97.3, -301.6],
  },
  {
    id: 'crossing',
    done: (s) => s.has('crest'),
    text: () => '穿过风雨栈桥 · 阵风来时躲进避风处',
    target: (s, p) => refugeAhead(p),
  },
  {
    id: 'power',
    done: (s) => s.has('power'),
    text: () => '1 号闸机房 · 合上机房电源',
    target: () => panel(PANELS.power),
  },
  {
    id: 'g1',
    done: (s) => s.has('g1'),
    text: () => '开启 1 号闸泄洪',
    target: () => panel(PANELS.g1),
  },
  {
    id: 'junction',
    done: (s) => s.has('junction'),
    text: (s, p) => (p.y > 92 ? '2 号闸无电 · 经竖井下到检修廊' : '复位进水跳闸的接线箱'),
    target: (s, p) =>
      p.y > 92 && !(p.x > GALLERY.x0 && p.x < GALLERY.shaftX1 && p.z < HOUSE.z1)
        ? [SHAFT_ROOM.door, 97.3, HOUSE.z1 - 0.8]
        : [JUNCTION.x, JUNCTION.y + 1.5, JUNCTION.z + 0.4],
  },
  {
    id: 'g2',
    done: (s) => s.has('g2'),
    text: () => '回到机房，开启 2 号闸',
    target: (s, p) => (p.y < 92 ? [SHAFT_ROOM.door, 97.3, GALLERY.z1] : panel(PANELS.g2)),
  },
  {
    id: 'g3',
    done: (s) => s.has('g3'),
    text: (s) => (s.gates.g3 > 0 || s.atPump ? `3 号闸液压不足 · 手动泵压开闸 ${pct(s.gates.g3)}` : '3 号闸液压不足 · 手动泵压开闸'),
    target: (s) => (s.atPump ? null : panel(PANELS.pump)),
  },
  {
    id: 'recede',
    done: (s) => s.has('recede'),
    text: () => '三孔全开 · 等待水位回落',
    target: () => null,
  },
  {
    id: 'record',
    done: (s) => s.has('logged'),
    text: () => '到坝顶西端水尺站记录水情',
    target: () => [GAUGE.x, 97.3, GAUGE.z],
  },
];

export const stepsOf = (site) => (site.chapter === 2 ? STEPS2 : STEPS);

export function currentStep(site) {
  return stepsOf(site).find((step) => !step.done(site)) || null;
}

export function objective(site, player) {
  const step = currentStep(site);
  if (!step) return { id: 'free', text: '自由漫游 · 寻找剩余档案', target: null };
  return { id: step.id, text: step.text(site, player), target: step.target(site, player) };
}
