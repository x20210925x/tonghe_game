// Collision for a walking character in a world of boxes. Boxes may turn about the vertical
// axis only, which keeps every query a 2D rectangle test plus a height interval.
// No rendering dependency: the same module runs under node --test.

export const GRAVITY = 22;
const MAX_FALL = 56;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export class Box {
  constructor(x, y, z, w, h, d, o = {}) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.hx = w / 2;
    this.hy = h / 2;
    this.hz = d / 2;
    this.yaw = o.yaw || 0;
    this.c = Math.cos(this.yaw);
    this.s = Math.sin(this.yaw);
    this.walk = o.walk ?? true;
    this.block = o.block ?? true;
    this.camera = o.camera ?? true;
    this.dynamic = !!o.dynamic;
    this.surface = o.surface || 'concrete';
    this.enabled = true;
    this.dx = this.dy = this.dz = 0;
    this.mark = 0;
  }
  get top() {
    return this.y + this.hy;
  }
  get bottom() {
    return this.y - this.hy;
  }
  moveTo(x, y, z) {
    this.dx = x - this.x;
    this.dy = y - this.y;
    this.dz = z - this.z;
    this.x = x;
    this.y = y;
    this.z = z;
  }
  spanX() {
    return Math.abs(this.hx * this.c) + Math.abs(this.hz * this.s);
  }
  spanZ() {
    return Math.abs(this.hx * this.s) + Math.abs(this.hz * this.c);
  }
  // Distance squared from a point to the rectangle footprint.
  gap2(px, pz) {
    const dx = px - this.x,
      dz = pz - this.z;
    const u = dx * this.c - dz * this.s,
      v = dx * this.s + dz * this.c;
    const du = Math.abs(u) - this.hx,
      dv = Math.abs(v) - this.hz;
    const a = du > 0 ? du : 0,
      b = dv > 0 ? dv : 0;
    return a * a + b * b;
  }
}

export class Body {
  constructor() {
    this.x = this.y = this.z = 0;
    this.vx = this.vy = this.vz = 0;
    this.radius = 0.3;
    this.height = 1.74;
    this.stepUp = 0.46;
    this.snapDown = 0.62;
    this.grounded = true;
    this.ground = null;
    this.peak = 0;
    this.flying = false;
    this.noclip = false;
  }
  place(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.vx = this.vy = this.vz = 0;
    this.grounded = true;
    this.ground = null;
    this.peak = y;
  }
  jump(speed) {
    this.vy = speed;
    this.grounded = false;
    this.ground = null;
    this.peak = this.y;
  }
}

export class Physics {
  constructor(cell = 8) {
    this.cell = cell;
    this.cells = new Map();
    this.dynamic = [];
    this.count = 0;
    this.stamp = 0;
    this.scratch = [];
    this.found = { h: 0, box: null };
  }
  key(i, j) {
    return (i + 8192) * 16384 + (j + 8192);
  }
  add(box) {
    this.count++;
    if (box.dynamic) {
      this.dynamic.push(box);
      return box;
    }
    const ex = box.spanX(),
      ez = box.spanZ(),
      s = this.cell;
    for (let i = Math.floor((box.x - ex) / s); i <= Math.floor((box.x + ex) / s); i++)
      for (let j = Math.floor((box.z - ez) / s); j <= Math.floor((box.z + ez) / s); j++) {
        const k = this.key(i, j);
        let list = this.cells.get(k);
        if (!list) this.cells.set(k, (list = []));
        list.push(box);
      }
    return box;
  }
  near(minX, maxX, minZ, maxZ, out = this.scratch) {
    out.length = 0;
    const s = this.cell,
      stamp = ++this.stamp;
    for (let i = Math.floor(minX / s); i <= Math.floor(maxX / s); i++)
      for (let j = Math.floor(minZ / s); j <= Math.floor(maxZ / s); j++) {
        const list = this.cells.get(this.key(i, j));
        if (!list) continue;
        for (const b of list)
          if (b.mark !== stamp) {
            b.mark = stamp;
            out.push(b);
          }
      }
    for (const b of this.dynamic) if (b.enabled) out.push(b);
    return out;
  }
  // Highest walkable top no higher than maxTop under a small disc around (x, z).
  // rise: moving boxes may also count if they climbed past maxTop during this frame.
  support(list, x, z, maxTop, r, rise = false, movingOnly = false) {
    let best = null,
      h = -Infinity;
    const r2 = r * r;
    for (const c of list) {
      if (!c.walk || !c.enabled) continue;
      if (movingOnly && !c.dynamic) continue;
      const t = c.top;
      const limit = rise && c.dynamic && c.dy > 0 ? maxTop + c.dy : maxTop;
      if (t > limit || t <= h) continue;
      if (c.gap2(x, z) <= r2) {
        h = t;
        best = c;
      }
    }
    if (!best) return null;
    this.found.h = h;
    this.found.box = best;
    return this.found;
  }
  push(c, b, r) {
    const dx = b.x - c.x,
      dz = b.z - c.z;
    const u = dx * c.c - dz * c.s,
      v = dx * c.s + dz * c.c;
    const du = u - clamp(u, -c.hx, c.hx),
      dv = v - clamp(v, -c.hz, c.hz);
    const d2 = du * du + dv * dv;
    if (d2 >= r * r) return false;
    let pu, pv;
    if (d2 > 1e-10) {
      const d = Math.sqrt(d2),
        k = (r - d) / d;
      pu = du * k;
      pv = dv * k;
    } else {
      const ex = c.hx - Math.abs(u),
        ez = c.hz - Math.abs(v);
      if (ex < ez) {
        pu = (ex + r) * (u < 0 ? -1 : 1);
        pv = 0;
      } else {
        pu = 0;
        pv = (ez + r) * (v < 0 ? -1 : 1);
      }
    }
    b.x += pu * c.c + pv * c.s;
    b.z += -pu * c.s + pv * c.c;
    return true;
  }
  // Moves the body for one frame. Returns the fall height if it landed this frame.
  move(b, dt) {
    const g = b.ground;
    if (g && g.dynamic && g.enabled) {
      b.x += g.dx;
      b.y += g.dy;
      b.z += g.dz;
    }
    const n = Math.max(1, Math.ceil(dt * 90)),
      h = dt / n;
    let landed = 0;
    for (let i = 0; i < n; i++) landed = Math.max(landed, this.step(b, h));
    return landed;
  }
  step(b, dt) {
    const r = b.radius;
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    if (b.noclip) {
      b.y += b.vy * dt;
      b.grounded = false;
      b.ground = null;
      b.peak = b.y;
      return 0;
    }
    const list = this.near(b.x - r - 0.6, b.x + r + 0.6, b.z - r - 0.6, b.z + r + 0.6);
    for (let it = 0; it < 3; it++) {
      let moved = false;
      for (const c of list) {
        if (!c.block || !c.enabled) continue;
        if (c.top <= b.y + b.stepUp || c.bottom >= b.y + b.height) continue;
        if (this.push(c, b, r)) moved = true;
      }
      if (!moved) break;
    }
    const foot = r * 0.72;
    if (b.grounded && b.vy <= 0 && !b.flying) {
      const s = this.support(list, b.x, b.z, b.y + b.stepUp, foot);
      if (s && s.h >= b.y - b.snapDown) {
        b.y = s.h;
        b.vy = 0;
        b.ground = s.box;
      } else {
        b.grounded = false;
        b.ground = null;
        b.peak = b.y;
      }
      return 0;
    }
    if (!b.flying) b.vy = Math.max(-MAX_FALL, b.vy - GRAVITY * dt);
    const ny = b.y + b.vy * dt;
    if (b.vy <= 0) {
      // Falling feet are caught by anything they have sunk into within a step: a stair nose
      // the body drifted over, a ledge, or a platform that rose under them this frame.
      const s = this.support(list, b.x, b.z, b.y + (b.flying ? 0.02 : b.stepUp), foot, true);
      if (s && ny <= s.h) return this.land(b, s);
      b.y = ny;
      if (b.flying) b.peak = b.y;
      return 0;
    }
    // Still rising, but a platform climbing faster than the body has reached the feet.
    if (!b.flying) {
      const s = this.support(list, b.x, b.z, b.y + b.stepUp, foot, true, true);
      if (s && s.h >= ny) return this.land(b, s);
    }
    let ceiling = Infinity;
    const head = b.y + b.height;
    for (const c of list) {
      if (!c.block || !c.enabled) continue;
      const bottom = c.bottom;
      if (bottom >= head - 0.02 && bottom < ny + b.height && c.gap2(b.x, b.z) < r * r * 0.6)
        ceiling = Math.min(ceiling, bottom);
    }
    if (ceiling < Infinity) {
      b.y = ceiling - b.height;
      b.vy = 0;
    } else b.y = ny;
    b.peak = Math.max(b.peak, b.y);
    return 0;
  }
  land(b, s) {
    const fall = Math.max(0.01, b.peak - s.h);
    b.y = s.h;
    b.vy = 0;
    b.grounded = true;
    b.ground = s.box;
    return fall;
  }
  // Distance along a ray to the first camera-blocking box, or max.
  raycast(ox, oy, oz, dx, dy, dz, max) {
    const ex = dx * max,
      ez = dz * max;
    const list = this.near(
      Math.min(ox, ox + ex) - 0.2,
      Math.max(ox, ox + ex) + 0.2,
      Math.min(oz, oz + ez) - 0.2,
      Math.max(oz, oz + ez) + 0.2
    );
    let best = max;
    for (const c of list) {
      if (!c.enabled || !c.camera) continue;
      const px = ox - c.x,
        pz = oz - c.z;
      const lu = px * c.c - pz * c.s,
        lv = px * c.s + pz * c.c;
      const du = dx * c.c - dz * c.s,
        dv = dx * c.s + dz * c.c;
      span[0] = 0;
      span[1] = best;
      if (slab(lu, du, c.hx) && slab(oy - c.y, dy, c.hy) && slab(lv, dv, c.hz) && span[0] < best)
        best = span[0];
    }
    return best;
  }
}

const span = [0, 0];
function slab(p, d, half) {
  if (Math.abs(d) < 1e-9) return p >= -half && p <= half;
  let a = (-half - p) / d,
    b = (half - p) / d;
  if (a > b) {
    const t = a;
    a = b;
    b = t;
  }
  if (a > span[0]) span[0] = a;
  if (b < span[1]) span[1] = b;
  return span[0] <= span[1];
}
