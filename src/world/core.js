import { CORE, SHAFT, CORE_DOOR, LIFT, LEVEL, FLIGHTS, L1, L2, CROWN_BRIDGE, NORTH_DOOR } from '../game/layout.js';

const METAL = { surface: 'metal' };
export const EAST_SLITS = [-276, -285, -294];

// A wall slab along one axis with rectangular openings cut through it.
// axis 'x': runs along x between a0..a1, thickness over z t0..t1. axis 'z' swaps the roles.
export function cutWall(b, axis, t0, t1, a0, a1, y0, y1, openings, m) {
  const cuts = [a0, a1];
  for (const o of openings) cuts.push(Math.max(a0, Math.min(a1, o.a0)), Math.max(a0, Math.min(a1, o.a1)));
  const sorted = [...new Set(cuts)].sort((p, q) => p - q);
  for (let i = 0; i < sorted.length - 1; i++) {
    const u = sorted[i],
      v = sorted[i + 1];
    if (v - u < 1e-3) continue;
    const mid = (u + v) / 2;
    const holes = openings.filter((o) => o.a0 <= mid && o.a1 >= mid).sort((p, q) => p.y0 - q.y0);
    let y = y0;
    const spans = [];
    for (const o of holes) {
      if (o.y0 > y) spans.push([y, o.y0]);
      y = Math.max(y, o.y1);
    }
    if (y < y1) spans.push([y, y1]);
    for (const [s, e] of spans) {
      if (axis === 'x') b.block(u, v, s, e, t0, t1, m);
      else b.block(t0, t1, s, e, u, v, m);
    }
  }
}

export function buildCore(b) {
  const { mat } = b;
  const { x0, x1, z0, z1, base, top } = CORE;
  const S = SHAFT;
  const wallTop = top - 0.6;
  b.block(55, 107, base, -2, -311, -259, mat.darkCast, { walk: false });
  for (const [x, z] of [
    [55, -311],
    [107, -311],
    [55, -259],
    [107, -259],
  ])
    b.box(x, -16, z, 6, 28, 6, mat.cast);

  const slit = (c, lo, hi, w = 1.4) => ({ a0: c - w / 2, a1: c + w / 2, y0: lo, y1: hi });
  // South wall with the entrance and three light slits.
  cutWall(b, 'x', S.z1, z1, x0, x1, base, wallTop, [
    { a0: CORE_DOOR.x0, a1: CORE_DOOR.x1, y0: 0, y1: CORE_DOOR.height },
    slit(70, 10, 124),
    slit(92, 10, 124),
    slit(81, 14, 124),
  ], mat.darkCast);
  // North wall: two high slits and, at +96, the door to the storm bridge (chapter two).
  cutWall(b, 'x', z0, S.z0, x0, x1, base, wallTop, [
    slit(72, 104, 126),
    slit(90, 104, 126),
    { a0: NORTH_DOOR.x0, a1: NORTH_DOOR.x1, y0: NORTH_DOOR.y, y1: NORTH_DOOR.y + NORTH_DOOR.height },
  ], mat.darkCast);
  cutWall(b, 'z', x0, S.x0, S.z0, S.z1, base, wallTop, [slit(-277, 100, 126), slit(-291, 102, 126)], mat.darkCast);
  cutWall(b, 'z', S.x1, x1, S.z0, S.z1, base, wallTop, EAST_SLITS.map((c) => slit(c, 8, 126, 3)), mat.darkCast);

  // Pilasters and string courses give the monolith a readable scale from the spillway.
  for (const x of [62.2, 74.5, 87.5, 99.8]) {
    b.box(x, 49, z1 + 0.4, 1.4, 158, 0.8, mat.cast);
    b.box(x, 49, z0 - 0.4, 1.4, 158, 0.8, mat.cast);
  }
  for (const z of [-303.8, -298, -288.5, -280.5, -271, -266.2]) {
    b.box(x0 - 0.4, 49, z, 0.8, 158, 1.4, mat.cast);
    b.box(x1 + 0.4, 49, z, 0.8, 158, 1.4, mat.cast);
  }
  for (const y of [33, 66, 99]) {
    b.box((x0 + x1) / 2, y, z1 + 0.25, x1 - x0 + 2.4, 1.2, 0.5, mat.cast);
    b.box((x0 + x1) / 2, y, z0 - 0.25, x1 - x0 + 2.4, 1.2, 0.5, mat.cast);
    b.box(x0 - 0.25, y, (z0 + z1) / 2, 0.5, 1.2, z1 - z0, mat.cast);
    b.box(x1 + 0.25, y, (z0 + z1) / 2, 0.5, 1.2, z1 - z0, mat.cast);
  }
  b.plate('砼核', 'C-01  /  CONCRETE CORE', 81, 10.6, z1 + 0.03, 4.2, 1.4);
  b.box(81, CORE_DOOR.height + 0.4, z1 + 0.25, 7.6, 0.8, 0.5, mat.darkCast);

  // Ground floor around the lift pit.
  const floor = (a, c, d, e) => b.slab(a, c, d, e, 0, 1.2, mat.deck);
  floor(S.x0, S.x1, LIFT.z1, S.z1);
  floor(S.x0, S.x1, S.z0, LIFT.z0);
  floor(S.x0, LIFT.x0, LIFT.z0, LIFT.z1);
  floor(LIFT.x1, S.x1, LIFT.z0, LIFT.z1);
  b.slab(LIFT.x0, LIFT.x1, LIFT.z0, LIFT.z1, -0.7, 0.5, mat.darkCast);
  for (let x = S.x0 + 2; x < S.x1; x += 4) b.box(x, 0.01, S.z1 - 1.2, 1.8, 0.02, 0.2, mat.hazard);
  // Winch room, cabinets and the conduit risers on the ground floor.
  b.block(90.5, 97.6, 0, 3.6, -301.6, -296, mat.enamel);
  b.box(94, 4.6, -298.8, 6.4, 2, 4.2, mat.darkCast);
  for (const z of [-299.5, -297.4]) b.rod([91, 4.6, z], [97, 4.6, z], 1.1, mat.steel);
  for (let i = 0; i < 4; i++) b.box(S.x0 + 0.5, 1.0, -272 - i * 1.4, 0.9, 2, 1.2, mat.enamel, true);
  for (const [x, z] of [
    [S.x0 + 0.35, -270.2],
    [S.x0 + 0.35, -271.4],
    [S.x1 - 0.35, -270.2],
  ])
    b.rod([x, 0, z], [x, wallTop, z], 0.16, mat.steel);
  b.plate('升降井', 'L-01  /  LIFT SHAFT', 81, 3.2, S.z1 - 0.05, 2.4, 0.78, Math.PI);

  // Lift guides on the east and south-west of the car.
  for (const [gx, gz] of [
    [LIFT.x1 + 0.7, LIFT.z0 + 0.5],
    [LIFT.x1 + 0.7, LIFT.z1 - 0.5],
    [LIFT.x0 - 0.5, LIFT.z1 - 0.5],
  ]) {
    b.box(gx, 70, gz, 0.5, 141.4, 0.5, mat.steel, { camera: false });
    b.box(gx + (gx > LIFT.cx ? -0.3 : 0.3), 70, gz, 0.1, 141.4, 0.16, mat.edge);
    const wallX = gx > LIFT.cx ? S.x1 : S.x0;
    for (let y = 6; y < 136; y += 6) {
      b.box(gx, y, gz, 0.8, 0.3, 0.8, mat.iron);
      b.box((gx + wallX) / 2, y, gz, Math.abs(wallX - gx), 0.24, 0.16, mat.steel);
      b.box(wallX + (gx > LIFT.cx ? -0.06 : 0.06), y, gz, 0.12, 0.6, 0.5, mat.iron);
    }
  }
  // Counterweight rails along the east wall.
  for (const z of [-288.6, -281.4]) b.box(S.x1 - 0.6, 66, z, 0.2, 134, 0.2, mat.edge);

  // Mid level (+48): landing beside the lift and the foot of the north-wall stair.
  b.slab(L1.x0, L1.x1, L1.z0, L1.z1, LEVEL.L1, 0.5, mat.darkCast);
  for (let x = L1.x0 + 1.5; x < L1.x1; x += 4) {
    b.box(x, LEVEL.L1 - 0.8, (S.z0 + L1.z1) / 2, 0.4, 0.6, L1.z1 - S.z0, mat.steel);
    b.rod([x, LEVEL.L1 - 1.1, L1.z1 - 0.3], [x, LEVEL.L1 - 6, S.z0], 0.14, mat.steel);
  }
  b.box((L1.x0 + L1.x1) / 2, LEVEL.L1 - 0.33, L1.z1 - 0.08, L1.x1 - L1.x0, 0.6, 0.16, mat.steel);
  b.box(L1.x1 - 0.08, LEVEL.L1 - 0.33, (L1.z0 + L1.z1) / 2, 0.16, 0.6, L1.z1 - L1.z0, mat.steel);
  b.rail(L1.x0, L1.z1, LIFT.x0, L1.z1, LEVEL.L1);
  b.rail(L1.x1, L1.z1, L1.x1, L1.z0, LEVEL.L1);
  b.rail(FLIGHTS.x0, L1.z0, L1.x1, L1.z0, LEVEL.L1, mat.steel, false);
  b.plate('+048  中段', 'L1  /  MID LANDING', S.x0 + 0.05, LEVEL.L1 + 2.4, -293, 2.2, 0.7, Math.PI / 2);

  // North-wall stair: four flights of sixty steps, switching back at narrow landings.
  const [aN, aS] = FLIGHTS.a,
    [bN, bS] = FLIGHTS.b;
  const aMid = (aN + aS) / 2,
    bMid = (bN + bS) / 2,
    w = aS - aN - 0.08;
  const runs = [
    { from: FLIGHTS.x0, to: FLIGHTS.x1, z: aMid, y: LEVEL.L1, rails: [true, false] },
    { from: FLIGHTS.x1, to: FLIGHTS.x0, z: bMid, y: LEVEL.L1 + 12, rails: [true, true] },
    { from: FLIGHTS.x0, to: FLIGHTS.x1, z: aMid, y: LEVEL.L1 + 24, rails: [true, false] },
    { from: FLIGHTS.x1, to: FLIGHTS.x0, z: bMid, y: LEVEL.L1 + 36, rails: [true, true] },
  ];
  for (const r of runs) {
    b.flight({ x0: r.from, z0: r.z, x1: r.to, z1: r.z, y0: r.y, y1: r.y + FLIGHTS.rise, width: w, steps: 60, rails: r.rails });
    // Brackets stay inside the flight's own band, so nothing crosses the flight beside it:
    // the wall-side flight is braced to the wall, the outer flight to the hanger line.
    const outer = r.z + w / 2,
      wallSide = r.z === aMid,
      inner = wallSide ? S.z0 : bN + 0.02;
    for (let k = 1; k <= 5; k++) {
      const t = k / 6,
        x = r.from + (r.to - r.from) * t,
        y = r.y + FLIGHTS.rise * t;
      b.beam([x, y - 0.3, outer + 0.04], [x, y - 0.3, inner], 0.12, 0.2, mat.steel);
      b.beam([x, y - 0.34, outer], [x, y - (wallSide ? 2.6 : 1.4), inner + 0.06], 0.1, 0.12, mat.steel);
      if (wallSide) b.box(x, y - 1.8, S.z0 + 0.04, 0.4, 2.0, 0.08, mat.iron);
    }
  }
  const landing = (lx0, lx1, y) => {
    b.slab(lx0, lx1, S.z0, bS, y, 0.3, mat.grate, METAL);
    b.box((lx0 + lx1) / 2, y - 0.55, S.z0 + 0.4, lx1 - lx0, 0.5, 0.8, mat.darkCast);
    b.box((lx0 + lx1) / 2, y - 0.23, bS - 0.06, lx1 - lx0, 0.4, 0.12, mat.steel);
    const edgeX = lx0 < S.x0 + 1 ? lx1 - 0.08 : lx0 + 0.08,
      midX = (lx0 + lx1) / 2;
    b.box(edgeX, y - 0.23, (S.z0 + bS) / 2, 0.12, 0.4, bS - S.z0, mat.steel);
    b.beam([midX, y - 0.4, bS - 0.1], [midX, y - 2.6, S.z0 + 0.1], 0.12, 0.14, mat.steel);
  };
  landing(S.x0, FLIGHTS.x0, LEVEL.L1);
  landing(S.x0, FLIGHTS.x0, LEVEL.L1 + 24);
  landing(S.x0, FLIGHTS.x0, LEVEL.L2);
  landing(FLIGHTS.x1, S.x1, LEVEL.L1 + 12);
  landing(FLIGHTS.x1, S.x1, LEVEL.L1 + 36);
  // Fences between the bands, along the open side and around the landings.
  b.barrier(FLIGHTS.x0, aS, FLIGHTS.x1, aS, LEVEL.L1, 50);
  b.barrier(FLIGHTS.x0, bS, FLIGHTS.x1, bS, LEVEL.L1, 50);
  b.barrier(FLIGHTS.x0, bN, FLIGHTS.x0, bS, LEVEL.L1, 1.8);
  b.barrier(FLIGHTS.x0, aN, FLIGHTS.x0, aS, LEVEL.L2, 1.8);
  b.barrier(S.x0, bS, FLIGHTS.x0, bS, LEVEL.L1 + 24, 1.8);
  b.barrier(FLIGHTS.x1, bS, S.x1, bS, LEVEL.L1 + 12, 1.8);
  b.barrier(FLIGHTS.x1, bS, S.x1, bS, LEVEL.L1 + 36, 1.8);
  b.rail(S.x0, bS, FLIGHTS.x0, bS, LEVEL.L1 + 24, mat.ochre, false);
  b.rail(FLIGHTS.x1, bS, S.x1, bS, LEVEL.L1 + 12, mat.ochre, false);
  b.rail(FLIGHTS.x1, bS, S.x1, bS, LEVEL.L1 + 36, mat.ochre, false);
  b.rail(FLIGHTS.x0, aN, FLIGHTS.x0, aS, LEVEL.L2, mat.ochre, false);
  for (const [y, tag] of [
    [LEVEL.L1 + 12, '+060'],
    [LEVEL.L1 + 24, '+072'],
    [LEVEL.L1 + 36, '+084'],
  ])
    b.plate(tag, 'NORTH STAIR', y === LEVEL.L1 + 24 ? S.x0 + 0.05 : S.x1 - 0.05, y + 2.2, -299.8, 1.3, 0.44, y === LEVEL.L1 + 24 ? Math.PI / 2 : -Math.PI / 2);

  // Hanger columns on the open edge of the stair carry the outer stringers down to the landing.
  for (const x of [70.5, 77.5, 84.5, 91.5]) {
    const y0 = x <= L1.x1 ? LEVEL.L1 : LEVEL.L1 + 24 - (FLIGHTS.rise * (x - FLIGHTS.x0)) / (FLIGHTS.x1 - FLIGHTS.x0) - 0.4;
    const top = LEVEL.L2 + 2.6,
      z = bS + 0.13;
    b.box(x, (y0 + top) / 2, z, 0.22, top - y0, 0.22, mat.steel);
    b.collider(x, (y0 + top) / 2, z, 0.24, top - y0, 0.24, { camera: false, walk: false });
    b.box(x, y0 + 0.02, z, 0.4, 0.04, 0.4, mat.iron);
  }
  b.beam([70.5, LEVEL.L2 + 2.6, bS + 0.13], [91.5, LEVEL.L2 + 2.6, bS + 0.13], 0.2, 0.32, mat.steel);
  // Wall string beams ring the shaft below and above the stair.
  for (const y of [16, 32, 104, 120]) {
    b.box((S.x0 + S.x1) / 2, y, S.z1 - 0.18, S.x1 - S.x0, 0.45, 0.36, mat.steel);
    b.box((S.x0 + S.x1) / 2, y, S.z0 + 0.18, S.x1 - S.x0, 0.45, 0.36, mat.steel);
    b.box(S.x0 + 0.18, y, (S.z0 + S.z1) / 2, 0.36, 0.45, S.z1 - S.z0, mat.steel);
    b.box(S.x1 - 0.18, y, (S.z0 + S.z1) / 2, 0.36, 0.45, S.z1 - S.z0, mat.steel);
  }
  // Cable trays climbing the walls, with junction boxes every twelve metres.
  const tray = (x, z, nx, nz, from, to) => {
    const h = to - from,
      ax = Math.abs(nx) > 0;
    b.box(x, from + h / 2, z, ax ? 0.08 : 0.6, h, ax ? 0.6 : 0.08, mat.iron);
    for (const side of [-1, 1]) b.box(x + nx * 0.08 + (ax ? 0 : side * 0.29), from + h / 2, z + nz * 0.08 + (ax ? side * 0.29 : 0), 0.04, h, 0.04, mat.steel);
    for (let k = 0; k < 4; k++) {
      const off = -0.18 + k * 0.12,
        r = k % 2 ? 0.035 : 0.05;
      b.rod([x + nx * 0.1 + (ax ? 0 : off), from, z + nz * 0.1 + (ax ? off : 0)], [x + nx * 0.1 + (ax ? 0 : off), to, z + nz * 0.1 + (ax ? off : 0)], r, k === 1 ? mat.ochreDark : mat.black);
    }
    for (let y = from + 3; y < to; y += 12) b.box(x + nx * 0.25, y, z + nz * 0.25, ax ? 0.3 : 0.7, 0.55, ax ? 0.7 : 0.3, mat.enamel);
  };
  tray(S.x0 + 0.06, -279, 1, 0, 0.3, CORE.top - 0.8);
  tray(65.6, S.z1 - 0.06, 0, -1, 0.3, CORE.top - 0.8);
  tray(S.x1 - 0.06, -299.6, -1, 0, 0.3, CORE.top - 0.8);
  for (const y of [12, 36, 60, 84, 108])
    b.plate('+' + String(y).padStart(3, '0'), 'SHAFT  /  L-01', 84, y + 1.2, S.z1 - 0.06, 1.3, 0.44, Math.PI);

  // Control level (+96).
  b.slab(L2.x0, L2.x1, L2.z0, L2.z1, LEVEL.L2, 0.5, mat.darkCast);
  for (let z = L2.z1 - 1.5; z > L2.z0; z -= 4) b.rod([L2.x1, LEVEL.L2 - 0.5, z], [S.x0, LEVEL.L2 - 5, z], 0.18, mat.steel);
  b.box((L2.x0 + L2.x1) / 2, LEVEL.L2 - 0.33, L2.z1 - 0.08, L2.x1 - L2.x0, 0.6, 0.16, mat.steel);
  b.box(L2.x1 - 0.08, LEVEL.L2 - 0.33, (L2.z0 + L2.z1) / 2, 0.16, 0.6, L2.z1 - L2.z0, mat.steel);
  b.rail(L2.x0, L2.z1, L2.x1, L2.z1, LEVEL.L2);
  b.rail(L2.x1, L2.z0, L2.x1, LIFT.z0, LEVEL.L2);
  b.rail(FLIGHTS.x0, L2.z0, L2.x1, L2.z0, LEVEL.L2, mat.steel, false);
  for (let i = 0; i < 3; i++) b.box(S.x0 + 0.5, LEVEL.L2 + 1.1, -294.5 + i * 1.5, 0.9, 2.2, 1.3, mat.enamel, true);
  b.plate('+096  主控层', 'L2  /  CORE CONTROL', S.x0 + 0.05, LEVEL.L2 + 2.8, -287, 2.4, 0.76, Math.PI / 2);

  // Crown: a gallery ring on the walls, a bridge to the lift and the frame overhead.
  const ring = LEVEL.CROWN,
    o = 3;
  const deck = (a, c, d, e) => b.slab(a, c, d, e, ring, 0.6, mat.deck);
  deck(x0 - o, x1 + o, S.z1, z1 + o);
  deck(x0 - o, x1 + o, z0 - o, S.z0);
  deck(x0 - o, S.x0, S.z0, S.z1);
  deck(S.x1, x1 + o, S.z0, S.z1);
  for (let x = x0 - o + 1; x < x1 + o; x += 4)
    for (const z of [z1 + o - 1, z0 - o + 1]) b.box(x, ring - 2, z, 0.8, 3, 1.4, mat.darkCast);
  for (let z = z0 - o + 1; z < z1 + o; z += 4)
    for (const x of [x0 - o + 1, x1 + o - 1]) b.box(x, ring - 2, z, 1.4, 3, 0.8, mat.darkCast);
  const px0 = x0 - o + 0.15,
    px1 = x1 + o - 0.15,
    pz0 = z0 - o + 0.15,
    pz1 = z1 + o - 0.15;
  for (const [a, c, d, e] of [
    [px0, pz1, px1, pz1],
    [px0, pz0, px1, pz0],
    [px0, pz0, px0, pz1],
    [px1, pz0, px1, pz1],
  ]) {
    b.box((a + d) / 2, ring + 0.5, (c + e) / 2, Math.abs(d - a) + 0.3, 1.0, Math.abs(e - c) + 0.3, mat.cast);
    b.barrier(a, c, d, e, ring);
  }
  b.rail(S.x0, S.z1, CROWN_BRIDGE.x0, S.z1, ring);
  b.rail(CROWN_BRIDGE.x1, S.z1, S.x1, S.z1, ring);
  b.rail(S.x0, S.z0, S.x1, S.z0, ring);
  b.rail(S.x0, S.z0, S.x0, S.z1, ring);
  b.rail(S.x1, S.z0, S.x1, S.z1, ring);
  b.slab(CROWN_BRIDGE.x0, CROWN_BRIDGE.x1, CROWN_BRIDGE.z0, CROWN_BRIDGE.z1, ring, 0.4, mat.grate, METAL);
  b.rail(CROWN_BRIDGE.x0, CROWN_BRIDGE.z1, CROWN_BRIDGE.x0, CROWN_BRIDGE.z0, ring, mat.ochre);
  b.rail(CROWN_BRIDGE.x1, CROWN_BRIDGE.z1, CROWN_BRIDGE.x1, CROWN_BRIDGE.z0, ring, mat.ochre);
  for (const zz of [-276, -271]) b.rod([CROWN_BRIDGE.x0, ring - 0.4, zz], [CROWN_BRIDGE.x1, ring - 0.4, zz], 0.14, mat.steel);
  const towers = [
    [x0 - o + 1.5, z0 - o + 1.5],
    [x1 + o - 1.5, z0 - o + 1.5],
    [x0 - o + 1.5, z1 + o - 1.5],
    [x1 + o - 1.5, z1 + o - 1.5],
  ];
  for (const [tx, tz] of towers) b.box(tx, ring + 12, tz, 3, 24, 3, mat.cast, true);
  const fy = ring + 21;
  b.box((x0 + x1) / 2, fy, towers[0][1], x1 - x0 + 2 * o - 3, 2.2, 1.6, mat.darkCast);
  b.box((x0 + x1) / 2, fy, towers[2][1], x1 - x0 + 2 * o - 3, 2.2, 1.6, mat.darkCast);
  b.box(towers[0][0], fy, (z0 + z1) / 2, 1.6, 2.2, z1 - z0 + 2 * o - 3, mat.darkCast);
  b.box(towers[1][0], fy, (z0 + z1) / 2, 1.6, 2.2, z1 - z0 + 2 * o - 3, mat.darkCast);
  b.box(LIFT.cx, fy + 0.4, (z0 + z1) / 2, 1.4, 1.6, z1 - z0 + 2 * o, mat.steel);
  b.box((x0 + x1) / 2, fy + 0.4, LIFT.cz, x1 - x0 + 2 * o, 1.6, 1.4, mat.steel);
  b.box(LIFT.cx, fy - 2, LIFT.cz, 6, 3, 6, mat.darkCast);
  b.plate('冠顶  +132', 'CROWN  /  OBSERVATION', 81, ring + 2.75, S.z1 - 0.05, 2.6, 0.82, Math.PI);
  for (const x of [CROWN_BRIDGE.x0, CROWN_BRIDGE.x1]) b.box(x, ring + 1.6, S.z1, 0.12, 3.2, 0.12, mat.iron);
  b.box(81, ring + 3.25, S.z1, CROWN_BRIDGE.x1 - CROWN_BRIDGE.x0, 0.12, 0.12, mat.iron);
  return { towers, fy };
}
