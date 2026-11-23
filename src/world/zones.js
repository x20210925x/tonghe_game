import * as T from '../../assets/three.module.min.js';
import {
  DECK,
  GATE,
  VALVE,
  BEAM,
  TOWER,
  BRIDGE,
  HALL,
  MEZZ,
  MEZZ_STAIR,
  CATWALK,
  TRESTLE,
  ALCOVE,
  CART,
} from '../game/layout.js';

const METAL = { surface: 'metal' };

// Where a strip of walkway crosses a vertical edge line x = X: the z range covered.
function bridgeSide(off) {
  const dx = BRIDGE.endX - BRIDGE.x,
    dz = BRIDGE.endZ - BRIDGE.z,
    len = Math.hypot(dx, dz);
  const px = dz / len,
    pz = -dx / len;
  return {
    at: (X) => {
      const t = (X - (BRIDGE.x + px * off)) / dx;
      return [X, BRIDGE.z + dz * t + pz * off, t];
    },
  };
}

export function buildBooth(b) {
  const { mat } = b;
  b.box(0, -0.35, 10.2, 8, 0.7, 13.7, mat.deck, true);
  b.box(0, 2.11, 17.05, 8, 4.22, 0.4, mat.cast, true);
  b.box(-3.9, 2.11, 10.5, 0.32, 4.22, 13.5, mat.cast, true);
  b.box(3.9, 0.62, 10.5, 0.34, 1.24, 13.5, mat.cast, true);
  b.box(3.9, 3.74, 10.5, 0.34, 0.74, 13.5, mat.cast, true);
  b.collider(3.9, 2.3, 10.5, 0.3, 2.2, 13.5, { walk: false, camera: false });
  for (const z of [4, 8.4, 12.8, 16.9]) b.box(3.9, 2.2, z, 0.34, 2.1, 0.18, mat.iron, true);
  b.box(0, 4.28, 10.1, 8.4, 0.36, 14.2, mat.darkCast, true);
  for (const side of [-1, 1]) b.box(side * 2.55, 2.12, 4.06, 2.75, 4.24, 0.44, mat.cast, true);
  b.box(0, 3.37, 4.06, 2.4, 1.75, 0.44, mat.cast, true);
  for (const x of [-1.17, 1.17]) b.box(x, 1.24, 4.16, 0.11, 2.48, 0.19, mat.iron);
  b.box(0, 2.56, 4.12, 2.45, 0.14, 0.22, mat.iron);
  b.plate('泄洪廊', '01  /  SPILLWAY', 0, 2.99, 4.31, 1.76, 0.54);
  b.plate('值班室', '01-A  /  CONTROL', 0, 3, 3.79, 2.02, 0.64, Math.PI);
  b.box(1.57, 1.26, 4.4, 0.22, 0.33, 0.13, mat.iron);
  b.box(1.57, 1.31, 4.48, 0.1, 0.085, 0.04, mat.lamp);
  b.box(0, 3.78, 4.42, 1.4, 0.12, 0.28, mat.iron);
  b.box(0, 3.7, 4.49, 1.23, 0.06, 0.13, mat.whiteLight);
  // Workbench, radio, filing cabinets and surface-mounted conduits.
  b.box(-3.13, 0.96, 10.4, 1.14, 0.12, 4.85, mat.olive, true);
  for (const z of [8.22, 12.57])
    for (const x of [-3.57, -2.7]) b.box(x, 0.46, z, 0.065, 0.92, 0.065, mat.iron);
  b.collider(-3.13, 0.45, 10.4, 1.14, 0.9, 4.85, { camera: false });
  b.box(-3.18, 1.18, 9.2, 0.5, 0.34, 0.71, mat.enamel);
  b.box(-2.917, 1.19, 9.2, 0.025, 0.19, 0.48, mat.black);
  for (let i = 0; i < 5; i++) b.box(-2.902, 1.19, 9.05 + i * 0.055, 0.024, 0.095, 0.014, mat.edge);
  b.rod([-3.28, 1.35, 9.37], [-3.39, 1.92, 9.37], 0.013, mat.edge);
  for (let i = 0; i < 4; i++)
    b.box(-3.05, 1.045 + i * 0.029, 12.1, 0.4, 0.027, 0.53, i % 2 ? mat.pale : mat.olive);
  for (let i = 0; i < 3; i++) {
    const z = 11.2 + i * 1.13;
    b.box(3.31, 0.89, z, 0.88, 1.78, 1.06, mat.enamel, true);
    b.box(2.85, 0.92, z, 0.017, 1.53, 0.93, i === 1 ? mat.electricPanel : mat.doorPanel);
    b.box(2.835, 0.98, z + 0.29, 0.05, 0.21, 0.045, mat.iron);
    for (let j = 0; j < 5; j++) b.box(2.859, 0.34 + j * 0.065, z, 0.013, 0.018, 0.6, mat.iron);
  }
  for (const x of [-2.91, -2.59]) {
    b.rod([x, 3.8, 4.4], [x, 3.8, 16.6], 0.073, mat.steel);
    for (let i = 5; i < 17; i += 2) b.box(x, 3.87, i, 0.21, 0.18, 0.06, mat.iron);
  }
  for (const z of [7.3, 13.3]) {
    b.box(0.1, 4.0, z, 0.4, 0.12, 1.9, mat.iron);
    b.box(0.1, 3.93, z, 0.28, 0.04, 1.74, mat.whiteLight);
  }
  b.box(0.1, 3.68, 3.72, 1.22, 0.16, 0.26, mat.iron);
  b.box(0.1, 3.66, 3.56, 0.98, 0.09, 0.04, mat.lamp);
  const room = new T.PointLight(0xf7e6cd, 28, 19, 2);
  room.position.set(0.5, 3.47, 8.2);
  const door = new T.PointLight(0xffffcf, 9, 7, 2);
  door.position.set(0.2, 3.24, 14.2);
  b.scene.add(room, door);
}

function stairTower(b) {
  const { mat } = b;
  const { x0, x1, z0, z1, flights } = TOWER,
    xm = (x0 + x1) / 2,
    top = BEAM.top,
    r = top / flights,
    land = 1.4;
  const north = z0 + land,
    south = z1 - land;
  for (let k = 0; k < flights; k++) {
    const even = k % 2 === 0,
      cx = even ? (xm + x1) / 2 : (x0 + xm) / 2;
    b.flight({
      x0: cx,
      z0: even ? south : north,
      x1: cx,
      z1: even ? north : south,
      y0: k * r,
      y1: (k + 1) * r,
      width: xm - x0 - 0.08,
      steps: 8,
      rails: [true, false],
    });
    const h = (k + 1) * r;
    if (even) b.slab(x0, x1, z0, north, h, 0.12, mat.grate, METAL);
    else b.slab(x0, x1, south, z1, h, 0.12, mat.grate, METAL);
  }
  // Frame, bracing and enclosure fences.
  for (const x of [x0 + 0.08, x1 - 0.08])
    for (const z of [z0 + 0.08, z1 - 0.08]) b.box(x, (top + 1.1) / 2, z, 0.16, top + 1.1, 0.16, mat.steel, { camera: false });
  for (let k = 0; k < flights; k += 2) {
    const y = k * r;
    b.rod([x0, y, z1], [x0, y + 2 * r, z0], 0.05, mat.iron);
    b.rod([x1, y, z0], [x1, y + 2 * r, z1], 0.05, mat.iron);
  }
  b.barrier(x0, z0, x0, z1, 0, top + 1.8);
  b.barrier(x1, z0, x1, south, 0, top + 1.8);
  b.barrier(x1, south, x1, z1, 2 * r - 0.3, top + 2.1 - 2 * r);
  b.barrier(x0, z1, x1, z1, 2 * r - 0.3, top + 2.1 - 2 * r);
  b.barrier(x0, z0, x1, z0, 0, top - 0.3);
  b.barrier(xm, north, xm, south, 0, top + 1.8);
  b.barrier(x0, south, xm, south, 0, 1.3);
  b.barrier(x0, north, xm, north, top - 0.6, 2.4);
  b.rail(x0 + 0.05, z0, x0 + 0.05, north, top, mat.ochre, false);
  b.rail(x1 - 0.05, z0, x1 - 0.05, north, top, mat.ochre, false);
  b.plate('转运梁', 'T-01  /  23 M', x1 + 0.02, 1.9, z1 - 0.7, 1.1, 0.36, Math.PI / 2);
}

export function buildSpillway(b) {
  const { mat } = b;
  b.slab(DECK.x0, DECK.x1, DECK.z0, DECK.z1, 0, 2.5, mat.deck);
  for (let z = 0; z > -120; z -= 15) {
    b.box(-11.1, -5, z, 2.3, 9, 2.4, mat.darkCast);
    b.box(11.6, -5, z, 2.3, 9, 2.4, mat.cast);
    b.box(-12, 0.045, z, 1, 0.09, 5.4, mat.darkCast, true);
    b.box(11.9, 0.011, z, 0.1, 0.018, 3.2, mat.ochreDark);
  }
  for (const z of [-8, -31, -77, -100]) b.lamp(12.8, z, 1.23);
  // The bridge leaves the east edge; the edge rail stops exactly where its fences begin.
  const left = bridgeSide(BRIDGE.width / 2 - 0.09),
    right = bridgeSide(-(BRIDGE.width / 2 - 0.09));
  const edge = 13.65,
    za = left.at(edge)[1],
    zb = right.at(edge)[1];
  const gapHi = Math.max(za, zb),
    gapLo = Math.min(za, zb);
  b.rail(-12.72, 4.4, -12.72, -122.7);
  b.rail(edge, 4.4, edge, gapHi);
  b.rail(edge, gapLo, edge, -122.7);
  b.rail(-12.72, -122.7, edge, -122.7);
  b.rail(-12.72, 4.4, -4.1, 4.4);
  b.rail(4.1, 4.4, edge, 4.4);
  b.sign('泄洪廊', '01  /  SPILLWAY', -7, -42);
  b.sign('斜桥  →  动力间', 'P-02  /  POWER', 9.4, -60.4);
  // A bench by the west rail.
  b.box(-11.6, 0.44, -22, 0.7, 0.08, 2.2, mat.olive, true);
  for (const z of [-21.1, -22.9]) b.box(-11.6, 0.2, z, 0.6, 0.4, 0.08, mat.iron);
  b.collider(-11.6, 0.2, -22, 0.7, 0.4, 2.2, { camera: false });

  // Gate piers and the bypass valve housing.
  for (const x of [-13.4, 14.4]) {
    b.box(x, 8.3, GATE.z, 1, 16.6, 1.38, mat.darkCast, true);
    b.rod([x, 1, GATE.z + 0.79], [x, 17.4, GATE.z + 0.79], 0.18, mat.steel);
  }
  for (const x of [-9, 10]) {
    b.rod([x, 11.45, GATE.z], [x, 18.75, GATE.z], 0.49, mat.enamel);
    b.rod([x, 10.4, GATE.z], [x, 12.5, GATE.z], 0.33, mat.steel);
  }
  const { x, z } = VALVE;
  b.box(x, 0.71, z, 1.61, 1.42, 0.81, mat.enamel, true);
  b.box(x, 1.44, z, 1.71, 0.12, 0.9, mat.steel);
  for (const dx of [-0.62, 0.62]) b.rod([x + dx, 0.12, z - 0.3], [x + dx, 0.12, GATE.z], 0.086, mat.steel);
  b.plate('旁通阀', 'P–03    /    BYPASS', x, 1.84, z + 0.09, 1.37, 0.43);
  b.box(x, 1.53, z, 0.16, 0.78, 0.13, mat.iron);

  // The transfer beam spans the deck; its top is a walkway reached by the stair tower.
  for (const bx of [-20, 41]) {
    for (const bz of [-51, -59]) b.box(bx, 4.3, bz, 3.5, 28.6, 3.3, mat.darkCast, { walk: false });
    b.box(bx, 18.1, -55, 5.1, 2.95, 14, mat.cast, { walk: false });
  }
  b.box(10.5, 20.6, -55, 72, 3.5, 12.5, mat.cast, { walk: false });
  b.box(10.5, BEAM.top - 0.315, -55, BEAM.x1 - BEAM.x0, 0.63, BEAM.z1 - BEAM.z0, mat.darkCast, true);
  const lv = BEAM.top;
  b.rail(-26, -48.65, TOWER.x0, -48.65, lv);
  b.rail(TOWER.x1, -48.65, 47, -48.65, lv);
  b.rail(-26, -61.35, 47, -61.35, lv);
  b.rail(-26, -48.65, -26, -61.35, lv);
  b.rail(47, -48.65, 47, -61.35, lv);
  for (const bz of [-52.3, -56.3, -58.4]) b.rod([-25, 18.35, bz], [46, 18.35, bz], 0.25, mat.steel);
  for (let bx = -24; bx < 46; bx += 4.1) b.box(bx, 18.48, -55, 0.17, 1.0, 9.5, mat.iron);
  for (let bx = -20; bx < 46; bx += 11) b.lamp(bx, -60.6, 1.0, lv);
  stairTower(b);

  // Overhead transfer beam over the middle of the bridge.
  for (const bx of [36, 48]) {
    b.box(bx, 0, -78.2, 2.7, 21, 4.9, mat.darkCast, true);
    b.box(bx, 0, -131, 2.7, 21, 4.9, mat.darkCast, true);
    b.box(bx, 10.3, -104.6, 3.1, 2.4, 60.2, mat.cast);
  }
  b.box(42, 11.85, -104.6, 16.4, 0.82, 60.2, mat.darkCast);
  for (const bz of [-132.4, -77.2]) b.rod([35, 13.6, bz], [49, 13.6, bz], 0.32, mat.steel);
}

export function buildBridge(b) {
  const { mat } = b;
  const { x: ax, z: az, endX: bx, endZ: bz, width } = BRIDGE,
    dx = bx - ax,
    dz = bz - az,
    len = Math.hypot(dx, dz);
  const yaw = Math.atan2(dx, dz),
    rot = new T.Euler(0, yaw, 0),
    px = dz / len,
    pz = -dx / len;
  const xyz = (t, off, y) => [ax + dx * t + px * off, y, az + dz * t + pz * off];
  b.collider(ax + dx / 2, -0.06, az + dz / 2, width, 0.12, len, { yaw, surface: 'metal' });
  for (let i = 0; i < 36; i++) {
    const [gx, gy, gz] = xyz(0.5, (i / 35 - 0.5) * (width - 0.06), -0.061);
    b.instance(b.boxGeo, mat.steel, gx, gy, gz, 0.029, 0.122, len, rot);
  }
  for (let i = 0; i <= 356; i++) {
    const [gx, gy, gz] = xyz(i / 356, 0, -0.025);
    b.instance(b.boxGeo, mat.iron, gx, gy, gz, width, 0.056, 0.028, rot);
  }
  for (let i = 0; i <= 26; i++) {
    const [gx, gy, gz] = xyz(i / 26, 0, -0.23);
    b.instance(b.boxGeo, mat.steel, gx, gy, gz, width + 0.05, 0.29, 0.14, rot);
  }
  for (const side of [-1, 1]) {
    const off = side * (width / 2 - 0.09);
    for (const h of [0.57, 1.07]) b.rod(xyz(0, off, h), xyz(1, off, h), h > 0.9 ? 0.038 : 0.022, mat.ochreDark);
    for (let i = 0; i <= 26; i++) {
      const [xx, yy, zz] = xyz(i / 26, off, 0.54);
      b.box(xx, yy, zz, 0.066, 1.08, 0.066, mat.steel);
    }
    b.rod(xyz(0, off, -1.34), xyz(1, off, -1.34), 0.126, mat.iron);
    for (let i = 0; i < 13; i++) b.rod(xyz(i / 13, off, -1.34), xyz((i + 1) / 13, off, -0.23), 0.08, mat.steel);
    const s = bridgeSide(off),
      [sx, sz] = s.at(13.75),
      [ex, ez] = s.at(70.1);
    b.barrier(sx, sz, ex, ez, 0);
  }
}

export function buildPowerHall(b) {
  const { mat } = b;
  b.slab(HALL.x0, HALL.x1, HALL.z0, HALL.z1, 0, 3.1, mat.deck);
  // West edge: rails stop at the bridge fences and the catwalk.
  const left = bridgeSide(BRIDGE.width / 2 - 0.09),
    right = bridgeSide(-(BRIDGE.width / 2 - 0.09));
  const za = left.at(70.2)[1],
    zb = right.at(70.2)[1];
  const hi = Math.max(za, zb),
    lo = Math.min(za, zb);
  const cw = CATWALK.width / 2;
  b.rail(70.2, -104.2, 89.8, -104.2);
  b.rail(89.8, -104.2, 89.8, -136.8);
  b.rail(70.2, -104.2, 70.2, hi);
  b.rail(70.2, lo, 70.2, CATWALK.z + cw);
  b.rail(70.2, CATWALK.z - cw, 70.2, -136.8);
  b.rail(70.2, -136.8, TRESTLE.x0 + 0.1, -136.8);
  b.rail(TRESTLE.x1 - 0.1, -136.8, 89.8, -136.8);
  for (let z = -140; z >= -262; z -= 10.4) {
    b.box(78.1, -5.9, z, 1.56, 10.3, 1.7, mat.cast);
    b.box(84.1, -5.9, z, 1.56, 10.3, 1.7, mat.cast);
    b.box(81, -1.97, z, 11.0, 1, 2.1, mat.darkCast);
    b.box(77.4, 0.011, z, 0.1, 0.016, 3.7, mat.ochreDark);
  }
  // Breaker cabinet for the lift supply.
  b.box(78, 1.21, -121.85, 2.65, 2.42, 1.12, mat.enamel, true);
  b.box(78, 2.49, -121.85, 2.88, 0.14, 1.31, mat.iron);
  b.plate('动力总闸', 'P-02  /  MAIN SUPPLY', 78, 1.96, -121.276, 1.93, 0.62);
  b.box(77.45, 1.15, -121.26, 0.53, 0.67, 0.11, mat.iron);
  b.box(78.51, 1.05, -121.265, 0.91, 0.95, 0.1, mat.electricPanel);
  b.lamp(79.8, -121.8, 2.65);
  // Cable trays linking the three isolators to the main cabinet.
  b.rod([78, 2.6, -122.3], [88.6, 2.6, -122.3], 0.09, mat.iron);
  b.rod([88.6, 2.6, -122.3], [88.6, 2.6, -105.4], 0.09, mat.iron);
  b.rod([76.7, 0.08, -122.3], [70.6, 0.08, -131.4], 0.07, mat.iron);

  // Mezzanine and its stair.
  b.slab(MEZZ.x0, MEZZ.x1, MEZZ.z0, MEZZ.z1, MEZZ.top, 0.35, mat.darkCast);
  for (const x of [MEZZ.x0 + 0.25, MEZZ.x1 - 0.25])
    for (const z of [MEZZ.z0 + 0.25, MEZZ.z1 - 0.25]) b.box(x, MEZZ.top / 2 - 0.2, z, 0.36, MEZZ.top - 0.35, 0.36, mat.steel, true);
  b.flight({
    x0: (MEZZ_STAIR.x0 + MEZZ_STAIR.x1) / 2,
    z0: MEZZ_STAIR.zBottom,
    x1: (MEZZ_STAIR.x0 + MEZZ_STAIR.x1) / 2,
    z1: MEZZ_STAIR.zTop,
    y0: 0,
    y1: MEZZ.top,
    width: MEZZ_STAIR.x1 - MEZZ_STAIR.x0,
    steps: 20,
    fence: [true, true],
  });
  const t = MEZZ.top;
  b.rail(MEZZ.x0, MEZZ.z1, MEZZ.x0, MEZZ.z0, t);
  b.rail(MEZZ.x0, MEZZ.z0, MEZZ.x1, MEZZ.z0, t);
  b.rail(MEZZ.x1, MEZZ.z0, MEZZ.x1, MEZZ.z1, t);
  b.rail(MEZZ.x0, MEZZ.z1, MEZZ_STAIR.x0, MEZZ.z1, t);
  b.plate('隔离开关 · 02', 'ISO-02  /  MEZZANINE', 85.9, 1.9, MEZZ_STAIR.zBottom + 0.3, 1.4, 0.44, 0);
  b.box(85.9, 0.85, MEZZ_STAIR.zBottom + 0.26, 0.08, 1.7, 0.08, mat.iron, { camera: false });

  // A cantilevered catwalk with one span missing.
  const [g0, g1] = CATWALK.gap;
  for (const [a, c] of [
    [CATWALK.x0, g0],
    [g1, CATWALK.x1],
  ])
    b.slab(a, c, CATWALK.z - cw, CATWALK.z + cw, 0, 0.14, mat.grate, METAL);
  for (let x = CATWALK.x0 + 0.4; x < CATWALK.x1; x += 2.1) {
    if (x > g0 - 0.3 && x < g1 + 0.3) continue;
    b.rod([x, -0.1, CATWALK.z], [x + 1.4, -2.2, CATWALK.z], 0.06, mat.steel);
    b.box(x, -0.12, CATWALK.z, 0.08, 0.1, CATWALK.width, mat.iron);
  }
  b.rod([g0, -0.08, CATWALK.z - 0.5], [g0 + 0.35, -1.1, CATWALK.z - 0.7], 0.035, mat.grate);
  b.rod([g1, -0.08, CATWALK.z + 0.4], [g1 - 0.25, -0.9, CATWALK.z + 0.6], 0.035, mat.grate);
  for (const side of [-1, 1]) {
    const z = CATWALK.z + side * (cw - 0.05);
    b.rail(CATWALK.x0, z, g0, z, 0, mat.steel, false);
    b.rail(g1, z, CATWALK.x1, z, 0, mat.steel, false);
    b.barrier(CATWALK.x0, z, CATWALK.x1, z, 0);
  }
  b.rail(CATWALK.x0 + 0.05, CATWALK.z - cw, CATWALK.x0 + 0.05, CATWALK.z + cw);
  b.plate('检修道  ·  断', 'ISO-03  /  JUMP WITH CARE', 70.8, 1.5, CATWALK.z + 1.35, 1.4, 0.44, -Math.PI / 2);
  b.box(70.8, 0.75, CATWALK.z + 1.35, 0.08, 1.5, 0.08, mat.iron);
}

export function buildTrestle(b) {
  const { mat } = b;
  const len = TRESTLE.z1 - TRESTLE.z0;
  b.box(81, -0.85, (TRESTLE.z0 + TRESTLE.z1) / 2, 9, 1.7, len, mat.deck, true);
  b.rail(76.8, -137, 76.8, TRESTLE.z0 + 0.2);
  b.rail(85.18, -137, 85.18, ALCOVE.z1);
  b.rail(85.18, ALCOVE.z0, 85.18, TRESTLE.z0 + 0.2);
  b.slab(ALCOVE.x0, ALCOVE.x1, ALCOVE.z0, ALCOVE.z1, 0, 1.2, mat.deck);
  b.rail(ALCOVE.x0, ALCOVE.z1 - 0.2, ALCOVE.x1 - 0.2, ALCOVE.z1 - 0.2);
  b.rail(ALCOVE.x1 - 0.2, ALCOVE.z1 - 0.2, ALCOVE.x1 - 0.2, ALCOVE.z0 + 0.2);
  b.rail(ALCOVE.x1 - 0.2, ALCOVE.z0 + 0.2, ALCOVE.x0, ALCOVE.z0 + 0.2);
  b.box(89.6, 0.3, -198, 1.2, 0.6, 0.8, mat.enamel, true);
  const trackEnd = CART.end - 2.4,
    trackStart = CART.start + 2.5;
  for (const off of [-0.72, 0.72])
    b.box(CART.x + off, 0.042, (trackStart + trackEnd) / 2, 0.095, 0.084, trackStart - trackEnd, mat.edge);
  for (let z = trackStart; z > trackEnd; z -= 1.38) b.box(CART.x, 0.022, z, 1.98, 0.044, 0.14, mat.iron);
  b.box(CART.x, 0.35, trackEnd - 0.4, 2.2, 0.7, 0.5, mat.hazard, true);
  b.plate('检修轨车', 'M-04  /  CORE SHUTTLE', 78.4, 1.74, CART.start + 2, 1.64, 0.52);
  b.box(78.4, 0.88, CART.start + 1.95, 0.11, 1.76, 0.13, mat.iron, true);
  b.sign('砼核', 'C-01  /  CONCRETE CORE', 83.9, -133.2);
  // Overhead supply to the core: poles, cross-arms, insulators and two sagging conductors.
  const poles = [];
  for (let z = -150; z >= TRESTLE.z0 + 3; z -= 16) poles.push(z);
  const px = 77.1,
    top = 5.2;
  for (const z of poles) {
    b.box(px, top / 2, z, 0.16, top, 0.16, mat.iron);
    b.box(px, 0.02, z, 0.36, 0.04, 0.36, mat.iron);
    b.box(px + 0.45, top - 0.2, z, 1.2, 0.1, 0.12, mat.steel);
    b.rod([px, top - 0.9, z], [px + 0.8, top - 0.25, z], 0.03, mat.steel);
    for (const wx of [px + 0.2, px + 0.9]) b.box(wx, top - 0.08, z, 0.08, 0.16, 0.08, mat.paper);
    b.collider(px, top / 2, z, 0.22, top, 0.22, { camera: false });
  }
  for (let i = 0; i < poles.length - 1; i++)
    for (const wx of [px + 0.2, px + 0.9]) {
      const a = poles[i],
        c = poles[i + 1],
        n = 8,
        y0 = top + 0.02;
      let prev = [wx, y0, a];
      for (let k = 1; k <= n; k++) {
        const t = k / n,
          sag = 0.5 * 4 * t * (1 - t);
        const next = [wx, y0 - sag, a + (c - a) * t];
        b.rod(prev, next, 0.012, mat.black);
        prev = next;
      }
    }
}
