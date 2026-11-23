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

export function currentStep(site) {
  return STEPS.find((step) => !step.done(site)) || null;
}

export function objective(site, player) {
  const step = currentStep(site);
  if (!step) return { id: 'free', text: '自由漫游 · 寻找剩余档案', target: null };
  return { id: step.id, text: step.text(site, player), target: step.target(site, player) };
}
