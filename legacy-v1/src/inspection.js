import { CART, GATE_Z } from './machines.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const pressureAt = (opening) => 1.44 - opening * 1.22;

export class Inspection {
  constructor() {
    this.restore();
  }
  restore(saved = {}, stage = 0, x = 0, z = 10) {
    // Old checkpoints past the gate keep their progress; fresh walks meet the new equipment.
    this.regulated =
      stage >= 2 ||
      (typeof saved.regulated === 'boolean' ? saved.regulated : stage === 1 && (z < GATE_Z || x > 14));
    this.opening = Number.isFinite(saved.opening)
      ? clamp(saved.opening, 0, 1)
      : this.regulated
        ? 0.64
        : 0.09;
    this.pressure = pressureAt(this.opening);
    this.hold = 0;
    this.atValve = false;
    this.gateHeight = this.regulated ? 6.8 : 0;
    this.cartZ = Number.isFinite(saved.cartZ) ? clamp(saved.cartZ, CART.end, CART.start) : CART.start;
    this.aboard = stage === 2 && saved.aboard === true && this.cartZ > CART.end + 0.01;
    this.cartSpeed = 0;
    this.stopping = false;
  }
  snapshot() {
    return { regulated: this.regulated, opening: this.opening, cartZ: this.cartZ, aboard: this.aboard };
  }
  turn(amount) {
    if (this.atValve) this.opening = clamp(this.opening + amount, 0, 1);
  }
  step(dt, drive, brake) {
    this.pressure += (pressureAt(this.opening) - this.pressure) * (1 - Math.exp(-3.3 * dt));
    if (this.atValve) {
      const safe =
        this.pressure >= 0.6 &&
        this.pressure <= 0.72 &&
        pressureAt(this.opening) >= 0.6 &&
        pressureAt(this.opening) <= 0.72;
      this.hold = safe ? this.hold + dt : 0;
      if (this.hold >= 1.0) {
        this.regulated = true;
        this.atValve = false;
        return 'release';
      }
    }
    if (this.regulated) this.gateHeight = Math.min(6.8, this.gateHeight + dt * 1.65);
    if (!this.aboard) return;
    const remaining = this.cartZ - CART.end,
      limit = Math.min(11, Math.sqrt(2 * 3.6 * remaining));
    const acceleration = this.stopping || brake ? -5.3 : drive ? 2.8 : -0.26;
    this.cartSpeed = clamp(this.cartSpeed + acceleration * dt, 0, limit);
    this.cartZ = Math.max(CART.end, this.cartZ - this.cartSpeed * dt);
    const arrived = this.cartZ <= CART.end + 0.18;
    if (arrived || (this.stopping && this.cartSpeed < 0.12)) {
      if (arrived) this.cartZ = CART.end;
      this.cartSpeed = 0;
      this.aboard = false;
      this.stopping = false;
      return arrived ? 'dock' : 'step-off';
    }
  }
}
