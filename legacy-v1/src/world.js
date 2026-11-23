import * as T from '../../assets/three.module.min.js';
import { Reflector } from '../../assets/Reflector.js';
import { textPlate } from './materials.js';
import { buildMachines, onShortcut, GATE_Z, VALVE, CART } from './machines.js';
import { installDaylight } from './daylight.js';
import { createWetDeck, cadence } from './wet-deck.js';

export const LIFT = { x: 81, z: -263, top: 78 };
export const controlPoint = { x: 78, z: -120 };
const floorAreas = [
  [-3.8, 3.8, 3.7, 16.7],
  [-13, 14, -123, 4.55],
  [12, 73, -118.2, -111.8],
  [70, 90, -137, -104],
  [76.5, 85.5, -259.7, -133],
  [76.9, 85.1, -267.1, -258.7],
];
const blockers = [
  [-3.8, -1.18, 3.85, 4.3],
  [1.18, 3.8, 3.85, 4.3],
  [-3.7, -2.54, 7.7, 13.2],
  [2.69, 3.7, 10.4, 14.4],
  [76.64, 79.36, -122.4, -121.32],
  [6.95, 9.05, -109.1, -108.9],
  [34.65, 37.35, -80.65, -75.75],
  [46.65, 49.35, -80.65, -75.75],
  [82.85, 84.95, -133.1, -132.9],
  [-8.05, -5.95, -42.1, -41.9],
];
export function canStand(x, z, stage, inspection) {
  if (stage === 3) return x >= 77.15 && x <= 84.85 && z >= -266.85 && z <= -259.15;
  if (stage >= 4)
    return (
      (x >= 77.15 && x <= 84.85 && z >= -267.2 && z <= -259.15) ||
      (x >= 71.5 && x <= 92.5 && z >= -291.4 && z <= -266.9) ||
      (x >= 51.6 && x <= 72 && z >= -285.7 && z <= -274.8)
    );
  if (inspection && stage === 1 && inspection.gateHeight < 2.05 && Math.abs(z - GATE_Z) < 0.61)
    return false;
  if (Math.abs(x - VALVE.x) < 1.02 && Math.abs(z - VALVE.z) < 0.64) return false;
  if (
    inspection &&
    !inspection.aboard &&
    Math.abs(x - CART.x) < 1.07 &&
    Math.abs(z - inspection.cartZ) < 1.84
  )
    return false;
  if (
    !onShortcut(x, z) &&
    !floorAreas.some(([l, r, n, s]) => x >= l + 0.2 && x <= r - 0.2 && z >= n + 0.2 && z <= s - 0.2)
  )
    return false;
  if (stage === 0 && z < 4.55) return false;
  return !blockers.some(([l, r, n, s]) => x > l - 0.2 && x < r + 0.2 && z > n - 0.2 && z < s + 0.2);
}

function ribGeometry(side, z, size) {
  // Give each formwork face its own edge vertices. Rows inside a face share normals
  // and use distance along the curve for the texture, including the horizontal toe.
  const rows = 92,
    positions = [],
    uvs = [],
    indices = [],
    profiles = [];
  let arc = 0;
  for (let i = 0; i <= rows; i++) {
    const t = (i / rows) ** 1.45,
      y = -16 + t * 238 * size;
    const front = (side === -1 ? -65 : 184) - side * (53 * Math.exp(-t * 6.7) + 3) * size;
    const back = side === -1 ? -104 : 227,
      half = (6.2 + 8 * Math.exp(-t * 5)) * size;
    if (i) arc += Math.hypot(front - profiles[i - 1].front, y - profiles[i - 1].y);
    profiles.push({
      front,
      y,
      arc,
      corners: [
        [back, y, z - half],
        [front, y, z - half],
        [front, y, z + half],
        [back, y, z + half],
      ],
    });
  }
  for (let face = 0; face < 4; face++) {
    const start = positions.length / 3;
    for (let i = 0; i <= rows; i++) {
      const row = profiles[i];
      for (const k of [face, (face + 1) % 4]) {
        const p = row.corners[k];
        positions.push(...p);
        if (face === 1) uvs.push(p[2], row.arc);
        else if (face === 3) uvs.push(p[2], p[1]);
        else uvs.push(p[0], p[1]);
      }
      if (i < rows) {
        const n = start + i * 2;
        if (side === -1) indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
        else indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
      }
    }
  }
  const cap = positions.length / 3;
  for (const p of profiles[rows].corners) {
    positions.push(...p);
    uvs.push(p[0], p[2]);
  }
  if (side === -1) indices.push(cap, cap + 2, cap + 1, cap, cap + 3, cap + 2);
  else indices.push(cap, cap + 1, cap + 2, cap, cap + 2, cap + 3);
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}
function mistTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 96;
  const ctx = c.getContext('2d');
  let seed = 203;
  const random = () => (seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296;
  for (let n = 0; n < 76; n++) {
    const x = 34 + random() * 188,
      y = 25 + random() * 48,
      r = 10 + random() * 18;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(208,212,202,.18)');
    g.addColorStop(1, 'rgba(208,212,202,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return new T.CanvasTexture(c);
}

export function buildWorld(scene, mat, daylight) {
  const batches = new Map(),
    collision = [],
    temp = new T.Object3D(),
    boxGeo = new T.BoxGeometry(1, 1, 1),
    pipeGeo = new T.CylinderGeometry(1, 1, 1, 12);
  const add = (geom, material, x, y, z, w, h, d, rot = null) => {
    const key = geom.uuid + material.uuid + Math.floor(z / 100);
    if (!batches.has(key)) batches.set(key, { geom, material, matrices: [] });
    temp.position.set(x, y, z);
    temp.scale.set(w, h, d);
    temp.rotation.set(0, 0, 0);
    if (rot) temp.rotation.copy(rot);
    temp.updateMatrix();
    batches.get(key).matrices.push(temp.matrix.clone());
  };
  const box = (x, y, z, w, h, d, m = mat.cast, solid = false) => {
    add(boxGeo, m, x, y, z, w, h, d);
    if (solid)
      collision.push(
        new T.Box3(
          new T.Vector3(x - w / 2, y - h / 2, z - d / 2),
          new T.Vector3(x + w / 2, y + h / 2, z + d / 2)
        )
      );
  };
  function rod(a, b, r, m = mat.iron) {
    const va = new T.Vector3(...a),
      vb = new T.Vector3(...b),
      len = va.distanceTo(vb);
    const mid = va.clone().lerp(vb, 0.5),
      q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), vb.sub(va).normalize());
    add(pipeGeo, m, mid.x, mid.y, mid.z, r, len, r, new T.Euler().setFromQuaternion(q));
  }
  function rail(x1, z1, x2, z2, level = 0, material = mat.steel) {
    const length = Math.hypot(x2 - x1, z2 - z1),
      n = Math.ceil(length / 2.8);
    for (let i = 0; i <= n; i++) {
      const t = i / n,
        x = x1 + (x2 - x1) * t,
        z = z1 + (z2 - z1) * t;
      box(x, level + 0.52, z, 0.065, 1.04, 0.065, material);
      box(x, level + 0.035, z, 0.16, 0.065, 0.16, mat.iron);
    }
    rod([x1, level + 1.04, z1], [x2, level + 1.04, z2], 0.036, material);
    rod([x1, level + 0.54, z1], [x2, level + 0.54, z2], 0.021, material);
  }
  function plate(text, sub, x, y, z, w, h, angle = 0, bg, fg) {
    const sign = textPlate(text, sub, w, h, bg, fg);
    sign.position.set(x, y, z);
    sign.rotation.y = angle;
    scene.add(sign);
    return sign;
  }
  function lamp(x, z, h = 1.23, base = 0) {
    box(x, base + h * 0.45, z, 0.13, h * 0.9, 0.13, mat.iron);
    box(x, base + h - 0.035, z, 0.19, 0.19, 0.19, mat.lamp);
    box(x, base + h + 0.09, z, 0.235, 0.045, 0.235, mat.steel);
  }
  const sky = installDaylight(scene, daylight);
  // Downstream and upstream ribs differ in spacing, so their silhouettes never align into a tunnel.
  const ribSurface = mat.cast.clone();
  ribSurface.defines = { RIB_SURFACE: 1 };
  ribSurface.onBeforeCompile = mat.cast.onBeforeCompile;
  ribSurface.customProgramCacheKey = mat.cast.customProgramCacheKey;
  for (let row = -8; row <= 4; row++)
    for (const side of [-1, 1]) {
      const z = row * (side < 0 ? 73 : 94) + (side < 0 ? -20 : 34),
        geo = ribGeometry(side, z, side < 0 ? 1 : 1.17);
      const rib = new T.Mesh(geo, ribSurface);
      rib.castShadow = true;
      rib.receiveShadow = true;
      scene.add(rib);
      const sx = side < 0 ? -86 : 211;
      box(sx, 93, z, 37, 213, side < 0 ? 73 : 94, mat.darkCast);
      box(sx - side * 17.9, 163, z, 2.5, 2.8, side < 0 ? 73 : 94, mat.cast);
      if (row % 2 === 0) {
        const y = 37 + (side > 0 ? 18 : 0),
          x = side < 0 ? -60.3 : 178.5;
        box(x, y, z, 7.3, 1.3, 24.6, mat.darkCast);
        rail(x - side * 3.4, z - 12, x - side * 3.4, z + 12, y + 0.65);
        box(x - side * 3.72, y + 0.06, z + 8, 0.12, 0.31, 0.51, mat.lamp);
        for (let j = 0; j < 4; j++)
          box(x + side * 0.6, y - 1.7, z - 9 + j * 6, 5.4, 2.8, 0.66, mat.darkCast);
      }
      for (let j = 0; j < 5; j++)
        box(sx - side * 19.3, 161.2, z + j * 11 - 22, 1.9, 2.1, 1.1, mat.darkCast);
    }
  // Distant spill gates and transfer decks close the horizon.
  for (const z of [-475, -530, -624, 182, 246]) {
    box(55, 91, z, 264, 13, 13, mat.darkCast);
    box(55, 99, z, 264, 2.8, 15, mat.cast);
    for (let i = 0; i < 5; i++) {
      box(-58 + i * 53, 39, z, 10, 101, 15, mat.cast);
      box(-58 + i * 53, 91, z, 17, 9, 19, mat.darkCast);
    }
  }
  // Maintenance booth, with a full-height opening and a glazed side slit.
  box(0, -0.35, 10.2, 8, 0.7, 13.7, mat.deck);
  box(0, 2.11, 17.05, 8, 4.22, 0.4, mat.cast, true);
  box(-3.9, 2.11, 10.5, 0.32, 4.22, 13.5, mat.cast, true);
  box(3.9, 0.62, 10.5, 0.34, 1.24, 13.5, mat.cast, true);
  box(3.9, 3.74, 10.5, 0.34, 0.74, 13.5, mat.cast, true);
  for (const z of [4, 8.4, 12.8, 16.9]) box(3.9, 2.2, z, 0.34, 2.1, 0.18, mat.iron, true);
  box(0, 4.28, 10.1, 8.4, 0.36, 14.2, mat.darkCast, true);
  for (const side of [-1, 1]) box(side * 2.55, 2.12, 4.06, 2.75, 4.24, 0.44, mat.cast, true);
  box(0, 3.37, 4.06, 2.4, 1.75, 0.44, mat.cast, true);
  for (const x of [-1.17, 1.17]) box(x, 1.24, 4.16, 0.11, 2.48, 0.19, mat.iron);
  box(0, 2.56, 4.12, 2.45, 0.14, 0.22, mat.iron);
  const door = new T.Group();
  door.position.set(0, 0, 4.1);
  scene.add(door);
  function part(parent, x, y, z, w, h, d, m) {
    const o = new T.Mesh(new T.BoxGeometry(w, h, d), m);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  }
  part(door, 0, 1.21, 0, 2.24, 2.42, 0.12, mat.doorPanel);
  const tag = textPlate('D-01', 'ACCESS   /   01', 0.47, 0.16, '#4b564c', '#c8c9b6');
  tag.position.set(-0.66, 1.77, 0.071);
  door.add(tag);
  for (const x of [-0.92, 0.92])
    for (const y of [0.105, 0.4]) part(door, x, y, 0.088, 0.02, 0.02, 0.012, mat.edge);
  for (const x of [-0.99, -0.87, -0.75]) part(door, x, 0.59, 0.071, 0.062, 0.11, 0.012, mat.ochreDark);
  part(door, 0, 1.67, 0.07, 0.67, 0.25, 0.036, mat.black);
  part(door, 0, 1.67, 0.095, 0.56, 0.16, 0.012, mat.edge);
  part(door, 0.74, 1.05, 0.12, 0.27, 0.045, 0.09, mat.edge);
  part(door, 0, 0.26, 0.069, 2.07, 0.39, 0.016, mat.steel);
  plate('泄洪廊', '01  /  SPILLWAY', 0, 2.99, 4.31, 1.76, 0.54);
  plate('值班室', '01-A  /  CONTROL', 0, 3, 3.79, 2.02, 0.64, Math.PI);
  box(1.57, 1.26, 4.4, 0.22, 0.33, 0.13, mat.iron);
  box(1.57, 1.31, 4.48, 0.1, 0.085, 0.04, mat.lamp);
  box(0, 3.78, 4.42, 1.4, 0.12, 0.28, mat.iron);
  box(0, 3.7, 4.49, 1.23, 0.06, 0.13, mat.whiteLight);
  // Workbench, radio, filing cabinets and surface-mounted cable conduits.
  box(-3.13, 0.96, 10.4, 1.14, 0.12, 4.85, mat.olive, true);
  for (const z of [8.22, 12.57])
    for (const x of [-3.57, -2.7]) box(x, 0.46, z, 0.065, 0.92, 0.065, mat.iron);
  box(-3.18, 1.18, 9.2, 0.5, 0.34, 0.71, mat.enamel);
  box(-2.917, 1.19, 9.2, 0.025, 0.19, 0.48, mat.black);
  for (let i = 0; i < 5; i++) box(-2.902, 1.19, 9.05 + i * 0.055, 0.024, 0.095, 0.014, mat.edge);
  rod([-3.28, 1.35, 9.37], [-3.39, 1.92, 9.37], 0.013, mat.edge);
  for (let i = 0; i < 4; i++)
    box(-3.05, 1.045 + i * 0.029, 11.71, 0.4, 0.027, 0.53, i % 2 ? mat.pale : mat.olive);
  for (let i = 0; i < 3; i++) {
    const z = 11.2 + i * 1.13;
    box(3.31, 0.89, z, 0.88, 1.78, 1.06, mat.enamel, true);
    box(2.85, 0.92, z, 0.017, 1.53, 0.93, i === 1 ? mat.electricPanel : mat.doorPanel);
    box(2.835, 0.98, z + 0.29, 0.05, 0.21, 0.045, mat.iron);
    for (let j = 0; j < 5; j++) box(2.859, 0.34 + j * 0.065, z, 0.013, 0.018, 0.6, mat.iron);
  }
  for (const x of [-2.91, -2.59]) {
    rod([x, 3.8, 4.4], [x, 3.8, 16.6], 0.073, mat.steel);
    for (let i = 5; i < 17; i += 2) box(x, 3.87, i, 0.21, 0.18, 0.06, mat.iron);
  }
  for (const z of [7.3, 13.3]) {
    box(0.1, 4.0, z, 0.4, 0.12, 1.9, mat.iron);
    box(0.1, 3.93, z, 0.28, 0.04, 1.74, mat.whiteLight);
  }
  // The first transfer span throws a deep band of shade across the exposed deck.
  for (const x of [-20, 41]) {
    for (const z of [-51, -59]) box(x, 4.3, z, 3.5, 28.6, 3.3, mat.darkCast);
    box(x, 18.1, -55, 5.1, 2.95, 14, mat.cast);
  }
  box(10.5, 20.6, -55, 72, 3.5, 12.5, mat.cast);
  box(10.5, 22.62, -55, 74, 0.63, 13.3, mat.darkCast);
  rail(-26, -48.65, 47, -48.65, 22.94);
  rail(-26, -61.35, 47, -61.35, 22.94);
  for (const z of [-52.3, -56.3, -58.4]) rod([-25, 18.35, z], [46, 18.35, z], 0.25, mat.steel);
  for (let x = -24; x < 46; x += 4.1) box(x, 18.48, -55, 0.17, 1.0, 9.5, mat.iron);
  box(0.1, 3.68, 3.72, 1.22, 0.16, 0.26, mat.iron);
  box(0.1, 3.66, 3.56, 0.98, 0.09, 0.04, mat.lamp);
  // The exterior deck, bridge and return gallery form one connected walking surface.
  box(0.5, -1.25, -59.2, 27, 2.5, 127.5, mat.deck);
  box(42.5, -0.55, -115, 61, 1.1, 6.4, mat.deck);
  box(80, -1.55, -120.5, 20, 3.1, 33, mat.deck);
  box(81, -0.85, -195.9, 9, 1.7, 126.2, mat.deck);
  for (let z = 0; z > -120; z -= 15) {
    box(-11.1, -5, z, 2.3, 9, 2.4, mat.darkCast);
    box(11.6, -5, z, 2.3, 9, 2.4, mat.cast);
    box(-12, 0.045, z, 1, 0.09, 5.4, mat.darkCast);
    box(11.9, 0.011, z, 0.1, 0.018, 3.2, mat.ochreDark);
  }
  for (let z = -8; z > -112; z -= 23) lamp(12.8, z, 1.23);
  rail(-12.72, 2, -12.72, -122.7);
  rail(13.65, 2, 13.65, -62.8);
  rail(13.65, -69.0, 13.65, -111.76);
  rail(13.65, -118.26, 13.65, -122.7);
  rail(-12.72, -122.7, 13.65, -122.7);
  rail(14, -111.98, 70.2, -111.98, 0, mat.ochreDark);
  rail(14, -118.02, 70.2, -118.02, 0, mat.ochreDark);
  for (let x = 15; x < 72; x += 5.2) {
    box(x, -1.14, -115, 0.24, 0.61, 6.58, mat.iron);
    box(x, 0.011, -115, 0.035, 0.015, 6.35, mat.iron);
    if (x < 63) rod([x, -2.89, -117.9], [x + 5.2, -1.15, -117.9], 0.11, mat.steel);
  }
  for (const z of [-117.9, -112.1]) box(42, -2.87, z, 58, 0.21, 0.24, mat.steel);
  for (const x of [17, 38, 59]) lamp(x, -118.02, 1.1);
  // Overhead transfer beam interrupts the sunlight above the middle of the bridge.
  for (const x of [36, 48]) {
    box(x, 0, -78.2, 2.7, 21, 4.9, mat.darkCast, true);
    box(x, 0, -131, 2.7, 21, 4.9, mat.darkCast, true);
    box(x, 10.3, -104.6, 3.1, 2.4, 60.2, mat.cast);
  }
  box(42, 11.85, -104.6, 16.4, 0.82, 60.2, mat.darkCast);
  for (const z of [-132.4, -77.2]) rod([35, 13.6, z], [49, 13.6, z], 0.32, mat.steel);
  for (let z = -140; z >= -253; z -= 10.4) {
    box(78.1, -5.9, z, 1.56, 10.3, 1.7, mat.cast);
    box(84.1, -5.9, z, 1.56, 10.3, 1.7, mat.cast);
    box(81, -1.97, z, 11.0, 1, 2.1, mat.darkCast);
    box(77.4, 0.011, z, 0.1, 0.016, 3.7, mat.ochreDark);
  }
  for (let z = -146; z >= -254; z -= 24) lamp(85.05, z);
  rail(76.8, -137, 76.8, -258.6);
  rail(85.18, -137, 85.18, -258.6);
  rail(70.2, -104.2, 89.8, -104.2);
  rail(89.8, -104.2, 89.8, -136.8);
  rail(70.2, -118.2, 70.2, -136.8);
  rail(70.2, -104.2, 70.2, -111.8);
  rail(70.2, -136.8, 76.6, -136.8);
  rail(85.4, -136.8, 89.8, -136.8);
  // Breaker cabinet.
  box(78, 1.21, -121.85, 2.65, 2.42, 1.12, mat.enamel, true);
  box(78, 2.49, -121.85, 2.88, 0.14, 1.31, mat.iron);
  plate('动力电闸', 'P-02  /  LIFT SUPPLY', 78, 1.96, -121.276, 1.93, 0.62);
  box(77.45, 1.15, -121.26, 0.53, 0.67, 0.11, mat.iron);
  box(78.51, 1.05, -121.265, 0.91, 0.95, 0.1, mat.electricPanel);

  const lever = new T.Group();
  lever.position.set(77.45, 1.13, -121.14);
  scene.add(lever);
  part(lever, 0, 0.14, 0.035, 0.06, 0.31, 0.09, mat.edge);
  part(lever, 0, 0.27, 0.06, 0.27, 0.065, 0.105, mat.red);
  lever.rotation.x = 0.62;
  lamp(79.8, -121.8, 2.65);
  // Tall shaft, counterweights, level marks, inspection galleries and lift cage.
  for (const x of [75.8, 86.2])
    for (const z of [-258.65, -267.35]) {
      box(x, 40, z, 0.58, 98, 0.61, mat.steel);
      box(x, 83, z, 1.1, 4.6, 1.16, mat.darkCast);
    }
  for (let y = 0; y < 87; y += 7.8) {
    for (const x of [75.8, 86.2]) {
      box(x, y, -263, 0.55, 0.41, 9.62, mat.steel);
      rod([x, y, -267.1], [x, y + 7.8, -258.9], 0.105, mat.steel);
    }
    if (y < 76) box(81, y + 1.3, -267.95, 10.9, 0.33, 0.29, mat.iron);
  }
  for (const x of [76.55, 85.43]) box(x, 38, -263, 0.16, 95, 0.31, mat.edge);
  const lift = new T.Group();
  scene.add(lift);
  lift.position.set(81, 0, -263);
  part(lift, 0, -0.32, 0, 8.56, 0.64, 8.56, mat.steel);
  part(lift, 0, -0.029, 0, 8.34, 0.058, 8.34, mat.iron);
  for (let z = -3.8; z < 4; z += 0.46) part(lift, 0, 0.014, z, 8.29, 0.032, 0.044, mat.steel);
  for (const x of [-4.09, 4.09]) {
    part(lift, x, 0.99, 0, 0.073, 0.088, 8.18, mat.ochre);
    part(lift, x, 0.51, 0, 0.044, 0.053, 8.18, mat.steel);
    for (const z of [-4.09, -1.4, 1.4, 4.09]) part(lift, x, 0.5, z, 0.067, 1, 0.068, mat.steel);
  }
  for (const x of [-3.75, 3.75])
    for (const z of [-3.75, 3.75]) box(81 + x, 44, -263 + z, 0.034, 95, 0.034, mat.iron);
  box(81, 86, -263, 12.2, 2.9, 12.6, mat.cast);
  box(82, 76.5, -279.2, 22, 3, 24.6, mat.deck);
  box(88, 29.5, -283, 9.8, 91.1, 11.7, mat.cast);
  rail(71.3, -267.08, 76.83, -267.08, 78);
  rail(85.17, -267.08, 92.7, -267.08, 78);
  rail(71.3, -267.08, 71.3, -274.5, 78);
  rail(71.3, -286, 71.3, -291.24, 78);
  rail(71.3, -291.24, 92.7, -291.24, 78);
  rail(92.7, -291.24, 92.7, -267.08, 78);
  box(61.5, 77.22, -280.25, 20.8, 1.56, 11.75, mat.deck);
  rail(51.35, -274.6, 71.3, -274.6, 78);
  rail(51.35, -285.9, 71.3, -285.9, 78);
  rail(51.35, -274.6, 51.35, -285.9, 78);
  for (const z of [-275.8, -284.6]) rod([52.1, 76.5, z], [85, 60, z], 0.74, mat.darkCast);
  box(54.6, 78.64, -275.38, 0.85, 1.28, 0.68, mat.enamel);
  plate('观测记录', 'S-01  /  SURVEY', 54.6, 79.02, -275.74, 0.79, 0.27, Math.PI);
  box(54.6, 79.33, -275.4, 0.92, 0.12, 0.73, mat.iron);
  box(54.6, 79.402, -275.56, 0.26, 0.04, 0.18, mat.lamp);
  plate('观测台', '78 M  /  OBSERVATION', 81, 80.8, -277, 2.7, 0.85);
  for (const x of [79.55, 82.45]) box(x, 79.38, -277, 0.1, 2.76, 0.14, mat.iron);
  const shaftLamps = [];
  const unlit = new T.MeshStandardMaterial({ color: 0x4b463b, roughness: 0.55 });
  for (let i = 0; i < 10; i++) {
    const y = 3 + i * 8.3;
    box(75.8, y, -258.15, 0.65, 0.92, 0.23, mat.iron);
    const lamp = part(scene, 75.8, y, -258, 0.38, 0.56, 0.11, unlit);
    shaftLamps.push(lamp);
  }
  for (const [x, z, angle, text, sub] of [
    [8, -109, 0, '动力间  →', 'P-02  /  POWER'],
    [83.9, -133, 0, '升降井', 'L-01  /  LIFT'],
    [-7, -42, 0, '泄洪廊', '01  /  SPILLWAY'],
  ]) {
    plate(text, sub, x, 1.91, z, 2.14, 0.7, angle);
    for (const dx of [-0.96, 0.96]) box(x + dx, 1.03, z - 0.04, 0.072, 2.05, 0.095, mat.iron);
  }
  const machines = buildMachines(scene, mat, { box, add, rod, part, boxGeo, plate });
  for (const { geom, material, matrices } of batches.values()) {
    const mesh = new T.InstancedMesh(geom, material, matrices.length);
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    scene.add(mesh);
  }

  const shader = Reflector.ReflectorShader;
  const waterShader = {
    ...shader,
    uniforms: { ...shader.uniforms, uTime: { value: 0 } },
    vertexShader:
      'varying vec3 vWorldWater;\n' +
      shader.vertexShader.replace('vUv =', 'vWorldWater=(modelMatrix*vec4(position,1.)).xyz; vUv ='),
    fragmentShader:
      'uniform float uTime; varying vec3 vWorldWater;\n' +
      shader.fragmentShader
        .replace(
          'vec4 base = texture2DProj( tDiffuse, vUv );',
          `
      vec2 p=vWorldWater.xz;vec2 q=vUv.xy/vUv.w;
      float ripple=sin(p.x*1.9+p.y*.34+uTime*.86)*.55+sin(p.y*3.2+p.x*.24-uTime*.63)*.29+sin(p.x*6.3+uTime*.7)*.16;
      q+=vec2(ripple*.0009,ripple*.0028);
      vec4 base=texture2D(tDiffuse,q);`
        )
        .replace(
          'blendOverlay( base.rgb, color )',
          'mix(vec3(.044,.072,.074),base.rgb,.53)+ripple*.004'
        ),
  };
  const water = new Reflector(new T.PlaneGeometry(1150, 1600), {
    textureWidth: 640,
    textureHeight: 384,
    clipBias: 0.001,
    multisample: 0,
    shader: waterShader,
  });
  water.rotation.x = -Math.PI / 2;
  water.position.set(35, -6.4, -150);
  scene.add(water);
  const pools = createWetDeck();
  scene.add(pools);
  let reflectDeck = true;
  cadence(pools, 2, () => reflectDeck);
  cadence(water, 3);
  const flatWater = new T.Mesh(
    water.geometry,
    new T.MeshStandardMaterial({ color: 0x51605e, metalness: 0.24, roughness: 0.3 })
  );
  flatWater.position.copy(water.position);
  flatWater.rotation.copy(water.rotation);
  flatWater.visible = false;
  scene.add(flatWater);
  const tex = mistTexture(),
    fogBanks = [];
  for (let i = 0; i < 32; i++) {
    const m = new T.SpriteMaterial({
      map: tex,
      color: 0xc2c7bd,
      opacity: 0.235,
      transparent: true,
      depthWrite: false,
    });
    const s = new T.Sprite(m);
    s.position.set(i % 2 ? -23 : 117, -1 + (i % 3) * 1.2, 100 - i * 23);
    s.scale.set(69 + (i % 4) * 13, 12 + (i % 3) * 4, 1);
    s.userData.x = s.position.x;
    scene.add(s);
    fogBanks.push(s);
  }
  scene.add(new T.HemisphereLight(0xc8ddf5, 0x6e6252, 0.29));
  const sun = new T.DirectionalLight(0xffdbaf, 1.1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -52, right: 52, top: 56, bottom: -48, near: 0.5, far: 370 });
  sun.shadow.normalBias = 0.043;
  sun.shadow.bias = -0.00023;
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun, sun.target);
  const farSun = new T.DirectionalLight(0xffdfb5, 2.45);
  const solar = new T.Vector3(0.554, 0.743, 0.375).normalize();
  farSun.target.position.set(48, 83, -143);
  farSun.position.copy(farSun.target.position).addScaledVector(solar, 730);
  farSun.castShadow = true;
  farSun.shadow.mapSize.set(4096, 4096);
  Object.assign(farSun.shadow.camera, {
    left: -390,
    right: 390,
    top: 343,
    bottom: -343,
    near: 10,
    far: 1350,
  });
  farSun.shadow.camera.updateProjectionMatrix();
  farSun.shadow.normalBias = 0.15;
  farSun.shadow.bias = -0.00009;
  farSun.shadow.autoUpdate = false;
  farSun.shadow.needsUpdate = true;
  scene.add(farSun, farSun.target);
  const roomLight = new T.PointLight(0xf7e6cd, 28, 19, 2);
  roomLight.position.set(0.5, 3.47, 8.2);
  scene.add(roomLight);
  const doorLight = new T.PointLight(0xffffcf, 9, 7, 2);
  doorLight.position.set(0.2, 3.24, 14.2);
  scene.add(doorLight);
  const beacon = new T.PointLight(0xffad5a, 16, 10, 2);
  beacon.position.set(78, 2.6, -120.2);
  scene.add(beacon);
  const gateBounds = new T.Box3();
  collision.push(gateBounds);
  let energized = 0,
    lastGateBand = -1,
    lastCartStop = CART.start;
  return {
    collision,
    door,
    lift,
    sky,
    quality(mode) {
      reflectDeck = mode !== 'low';
      pools.material.uniforms.uReflect.value = Number(reflectDeck);
      water.visible = mode !== 'low';
      flatWater.visible = !water.visible;
      fogBanks.forEach((b, i) => (b.visible = mode !== 'low' || i % 3 === 0));
    },
    update(dt, time, player, camera, stage, height, inspection) {
      machines.update(dt, time, inspection, camera);
      const gateBand = Math.floor(inspection.gateHeight / 1.6);
      if (
        gateBand !== lastGateBand ||
        (!inspection.aboard && Math.abs(inspection.cartZ - lastCartStop) > 1)
      ) {
        farSun.shadow.needsUpdate = true;
        lastGateBand = gateBand;
        lastCartStop = inspection.cartZ;
      }
      gateBounds.min.set(-13.35, inspection.gateHeight, GATE_Z - 0.47);
      gateBounds.max.set(14.35, inspection.gateHeight + 5.2, GATE_Z + 0.56);
      door.position.x = T.MathUtils.damp(door.position.x, stage > 0 ? -2.31 : 0, 3.5, dt);
      lever.rotation.x = T.MathUtils.damp(lever.rotation.x, stage >= 2 ? 2.48 : 0.62, 6, dt);
      energized = stage >= 2 ? energized + dt : 0;
      shaftLamps.forEach((lamp, i) => (lamp.material = energized > i * 0.42 + 0.18 ? mat.lamp : unlit));
      lift.position.y = height;
      sky.position.copy(camera.position);
      sun.target.position.copy(player);
      sun.position.copy(player).addScaledVector(solar, 171);
      water.material.uniforms.uTime.value = time;
      pools.material.uniforms.uTime.value = time;
      fogBanks.forEach((s, i) => (s.position.x = s.userData.x + Math.sin(time * 0.018 + i) * 4.2));
    },
  };
}
