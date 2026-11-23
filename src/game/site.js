// The state of the structure: story flags, found archives and every machine that moves.
// Pure logic, so the route can be tested without a renderer.
import { CART, LEVEL, LIFT } from './layout.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const pressureAt = (opening) => 1.44 - opening * 1.22;
export const BAND = [0.6, 0.72];
export const HOLD_TIME = 2.4;
export const FLAGS = [
  'workorder',
  'door',
  'valve',
  'hall',
  's1',
  's2',
  's3',
  'main',
  'core',
  'stall',
  'console',
  'crown',
  'record',
];

export class Site {
  constructor() {
    this.reset();
  }
  reset() {
    this.flags = {};
    this.archives = [];
    this.time = 0;
    this.opening = 0.12;
    this.pressure = pressureAt(this.opening);
    this.hold = 0;
    this.atValve = false;
    this.gate = 0;
    this.door = 0;
    this.coreDoor = 0;
    this.cartZ = CART.start;
    this.cartSpeed = 0;
    this.aboard = false;
    this.stopping = false;
    this.liftY = 0;
    this.liftFrom = 0;
    this.liftTo = 0;
    this.liftT = 0;
    this.liftDur = 1;
    this.liftMoving = false;
    this.restartAt = -1;
    this.powerAt = -1;
    this.autoLift = false;
  }
  has(flag) {
    return !!this.flags[flag];
  }
  set(flag) {
    if (this.flags[flag]) return false;
    this.flags[flag] = true;
    if (flag === 'main') this.powerAt = this.time;
    if (flag === 'console') this.restartAt = this.time;
    return true;
  }
  get switchesClosed() {
    return ['s1', 's2', 's3'].filter((s) => this.flags[s]).length;
  }
  found(id) {
    return this.archives.includes(id);
  }
  collect(id) {
    if (this.found(id)) return false;
    this.archives.push(id);
    return true;
  }
  snapshot() {
    return {
      flags: { ...this.flags },
      archives: [...this.archives],
      opening: this.opening,
      cartZ: this.cartZ,
      liftY: this.liftMoving ? this.liftFrom : this.liftY,
      time: this.time,
    };
  }
  restore(data = {}) {
    this.reset();
    for (const f of FLAGS) if (data.flags?.[f] === true) this.flags[f] = true;
    if (Array.isArray(data.archives))
      this.archives = data.archives.filter((a) => typeof a === 'string' && /^a\d$/.test(a));
    this.time = Number.isFinite(data.time) ? Math.max(0, data.time) : 0;
    if (Number.isFinite(data.opening)) this.opening = clamp(data.opening, 0, 1);
    if (this.flags.valve) this.opening = clamp(this.opening, 0.59, 0.68);
    this.pressure = pressureAt(this.opening);
    this.gate = this.flags.valve ? 6.8 : 0;
    this.door = this.flags.door ? 1 : 0;
    this.coreDoor = this.flags.core ? 1 : 0;
    if (Number.isFinite(data.cartZ)) this.cartZ = clamp(data.cartZ, CART.end, CART.start);
    const stop = LIFT.stops.includes(data.liftY) ? data.liftY : 0;
    this.liftY = stop;
    if (!this.flags.main) this.liftY = 0;
    else if (this.flags.stall && !this.flags.console && stop !== LEVEL.L1) this.liftY = LEVEL.L1;
    else if (this.flags.console && !this.flags.crown && stop < LEVEL.L2) this.liftY = LEVEL.L2;
    this.liftTo = this.liftFrom = this.liftY;
    if (this.flags.main) this.powerAt = -100;
    if (this.flags.console) {
      this.restartAt = -100;
      this.autoLift = true;
    }
  }
  turn(amount) {
    if (this.atValve) this.opening = clamp(this.opening + amount, 0, 1);
  }
  disturbance() {
    const t = this.time;
    return 0.045 * Math.sin(t * 0.8) + 0.02 * Math.sin(t * 2.1 + 1.3);
  }
  callLift(y) {
    if (this.liftMoving || !LIFT.stops.includes(y) || y === this.liftY) return false;
    this.liftFrom = this.liftY;
    this.liftTo = y;
    this.liftT = 0;
    this.liftDur = 3.2 + Math.abs(y - this.liftY) / 2.7;
    this.liftMoving = true;
    return true;
  }
  // Which stop the lift may travel to from where it stands, by story progress.
  liftDestination() {
    if (!this.flags.main || this.liftMoving) return null;
    if (!this.flags.stall) return this.liftY === 0 ? LEVEL.L1 : 0;
    if (!this.flags.console) return null;
    return this.liftY < LEVEL.CROWN ? LEVEL.CROWN : 0;
  }
  allowedStop(y) {
    if (!this.flags.main) return false;
    if (y === 0) return true;
    if (y === LEVEL.L1) return this.flags.stall;
    return this.flags.console;
  }
  // input: { drive, brake, nearCore }
  step(dt, input = {}) {
    const events = [];
    this.time += dt;
    const target = pressureAt(this.opening) + (this.atValve ? this.disturbance() : 0);
    this.pressure += (target - this.pressure) * (1 - Math.exp(-3.3 * dt));
    if (this.atValve) {
      const inside = this.pressure >= BAND[0] && this.pressure <= BAND[1];
      this.hold = inside ? this.hold + dt : Math.max(0, this.hold - dt * 0.8);
      if (this.hold >= HOLD_TIME) {
        this.atValve = false;
        this.hold = 0;
        this.set('valve');
        events.push('release');
      }
    }
    if (this.flags.valve) this.gate = Math.min(6.8, this.gate + dt * 1.65);
    if (this.flags.door) this.door = Math.min(1, this.door + dt * 0.85);
    if (this.flags.main && input.nearCore) this.coreDoor = Math.min(1, this.coreDoor + dt * 0.32);

    if (this.liftMoving) {
      this.liftT += dt;
      const k = clamp(this.liftT / this.liftDur, 0, 1),
        e = k * k * k * (k * (k * 6 - 15) + 10);
      this.liftY = this.liftFrom + (this.liftTo - this.liftFrom) * e;
      if (k >= 1) {
        this.liftY = this.liftTo;
        this.liftMoving = false;
        events.push('lift-stop');
      }
    }
    if (this.restartAt >= 0 && !this.autoLift && this.time - this.restartAt > 7.5) {
      this.autoLift = true;
      if (this.callLift(LEVEL.L2)) events.push('lift-start');
    }

    if (this.aboard) {
      const remaining = this.cartZ - CART.end,
        limit = Math.min(11, Math.sqrt(2 * 3.6 * Math.max(0, remaining)));
      const accel = this.stopping || input.brake ? -5.3 : input.drive ? 2.8 : -0.26;
      this.cartSpeed = clamp(this.cartSpeed + accel * dt, 0, limit);
      this.cartZ = Math.max(CART.end, this.cartZ - this.cartSpeed * dt);
      const arrived = this.cartZ <= CART.end + 0.18;
      if (arrived || (this.stopping && this.cartSpeed < 0.12)) {
        if (arrived) this.cartZ = CART.end;
        this.cartSpeed = 0;
        this.aboard = false;
        this.stopping = false;
        events.push(arrived ? 'dock' : 'step-off');
      }
    }
    return events;
  }
}
