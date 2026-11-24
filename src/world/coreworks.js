import * as T from '../../assets/three.module.min.js';
import { Box } from '../engine/physics.js';
import { textPlate } from '../render/materials.js';
import { CORE, SHAFT, CORE_DOOR, LIFT, LEVEL, CONSOLE, RECORD, LIFT_PANEL, CROWN_BRIDGE } from '../game/layout.js';

const OFF = new T.Color(0.16, 0.15, 0.13),
  EMERGENCY = new T.Color(1.25, 0.28, 0.1),
  WORK = new T.Color(3.3, 2.35, 1.5),
  STRIP = new T.Color(3.0, 1.25, 0.34);

export const CALL_PANELS = [
  { y: 0, x: 87.1, z: -279.4 },
  { y: LEVEL.L1, x: 84.9, z: -290.3 },
  { y: LEVEL.L2, x: 75.9, z: -284.6 },
  { y: LEVEL.CROWN, x: 83.55, z: -279.2 },
];

export function buildCoreworks(b, frame) {
  const { scene, mat, physics } = b;
  const dyn = (x, y, z, w, h, d, o = {}) => physics.add(new Box(x, y, z, w, h, d, { ...o, dynamic: true }));
  const fence = (x1, z1, x2, z2, y, h = 1.8) => {
    const box = dyn((x1 + x2) / 2, y + h / 2, (z1 + z2) / 2, 0.14, h, Math.hypot(x2 - x1, z2 - z1) + 0.14, {
      yaw: Math.atan2(x2 - x1, z2 - z1),
      walk: false,
      camera: false,
    });
    return box;
  };

  // Entrance leaves slide into the wall.
  const leaves = [-1, 1].map((side) => {
    const g = new T.Group();
    g.position.set(81 + side * 1.5, 0, CORE_DOOR.z);
    scene.add(g);
    b.part(g, 0, 4, 0, 3, 8, 0.5, mat.rivetedPanel);
    b.part(g, side * -1.46, 4, 0.27, 0.08, 8, 0.06, mat.hazard);
    for (const y of [1.2, 4, 6.8]) b.part(g, 0, y, 0.28, 2.9, 0.16, 0.08, mat.steel);
    const box = dyn(81 + side * 1.5, 4, CORE_DOOR.z, 3, 8, 0.5);
    return { g, box, side };
  });
  const doorLamp = new T.Mesh(b.boxGeo, mat.redLight);
  doorLamp.scale.set(0.5, 0.18, 0.18);
  doorLamp.position.set(81, CORE_DOOR.height + 0.95, CORE.z1 + 0.55);
  scene.add(doorLamp);

  // Lift car.
  const car = new T.Group();
  car.position.set(LIFT.cx, 0, LIFT.cz);
  scene.add(car);
  const W = LIFT.x1 - LIFT.x0,
    D = LIFT.z1 - LIFT.z0,
    hw = W / 2,
    hd = D / 2;
  b.part(car, 0, -0.32, 0, W, 0.64, D, mat.steel);
  b.part(car, 0, -0.023, 0, W - 0.2, 0.058, D - 0.2, mat.iron);
  for (let z = -hd + 0.6; z < hd; z += 0.46) b.part(car, 0, 0.018, z, W - 0.3, 0.032, 0.044, mat.steel);
  for (const [x, z] of [
    [-hw + 0.1, -hd + 0.1],
    [-hw + 0.1, hd - 0.1],
  ])
    b.part(car, x, 0.55, z, 0.12, 1.1, 0.12, mat.ochre);
  b.part(car, hw - 0.1, 0.55, 0, 0.06, 1.1, D - 0.3, mat.grate);
  b.part(car, hw - 0.06, 0.08, 0, 0.03, 0.16, D - 0.3, mat.hazard);
  for (const side of [-1, 1]) b.part(car, 0, -0.5, side * (hd - 0.06), W + 0.02, 0.28, 0.16, mat.ochre);
  // Side-hung car frame: two stiles on the guide side, a crosshead, bracing and guide shoes.
  const sx = hw - 0.15,
    sz = hd - 0.15,
    headY = 3.6;
  for (const side of [-1, 1]) {
    b.part(car, sx, headY / 2, side * sz, 0.18, headY, 0.18, mat.ochre);
    for (const y of [0.3, headY - 0.3]) b.part(car, hw + 0.2, y, side * (hd - 0.5), 0.5, 0.3, 0.36, mat.iron);
    const brace = b.part(car, sx, headY / 2, (side * sz) / 2, 0.07, Math.hypot(headY - 0.4, sz), 0.07, mat.steel);
    brace.rotation.x = Math.atan2(-side * sz, headY - 0.4);
  }
  b.part(car, sx, headY, 0, 0.3, 0.34, D - 0.1, mat.ochre);
  b.part(car, sx - 0.2, headY - 0.2, 0, 0.1, 0.1, D - 0.4, mat.steel);
  b.part(car, sx - 0.25, headY - 0.3, 0, 0.12, 0.06, 1.4, mat.whiteLight, false);
  for (const z of [-1.2, -0.4, 0.4, 1.2]) b.part(car, sx, headY + 0.28, z, 0.2, 0.22, 0.12, mat.iron);
  const panel = new T.Group();
  panel.position.set(LIFT_PANEL.dx, 0, LIFT_PANEL.dz);
  car.add(panel);
  b.part(panel, 0, 0.55, 0, 0.5, 1.1, 0.5, mat.enamel);
  b.part(panel, 0, 1.13, 0, 0.6, 0.06, 0.6, mat.iron);
  const panelLamp = b.part(panel, 0, 1.2, 0, 0.18, 0.08, 0.18, mat.lampOff, false);
  const tag = textPlate('升降台', 'L-01  /  CAR', 0.48, 0.16);
  tag.position.set(0, 0.86, 0.256);
  panel.add(tag);
  const deck = dyn(LIFT.cx, -0.32, LIFT.cz, W, 0.64, D, { surface: 'metal' });
  const stiles = [-1, 1].map((side) => dyn(LIFT.cx + sx, headY / 2, LIFT.cz + side * sz, 0.2, headY, 0.2, { camera: false, walk: false }));
  const panelBox = dyn(LIFT.cx + LIFT_PANEL.dx, 0.55, LIFT.cz + LIFT_PANEL.dz, 0.5, 1.1, 0.5);

  // Car sides open only where a landing meets the car.
  const { x0, x1, z0, z1 } = LIFT;
  const S = SHAFT;
  const sides = [
    { a: [x0, z0], b: [x1, z0], open: [0, LEVEL.L1] },
    { a: [CROWN_BRIDGE.x0, z1], b: [CROWN_BRIDGE.x1, z1], open: [0, LEVEL.CROWN] },
    { a: [x0, z1], b: [CROWN_BRIDGE.x0, z1], open: [0] },
    { a: [CROWN_BRIDGE.x1, z1], b: [x1, z1], open: [0] },
    { a: [x0, z0], b: [x0, -284], open: [0, LEVEL.L2] },
    { a: [x0, -284], b: [x0, z1], open: [0] },
    { a: [x1, z0], b: [x1, z1], open: [0] },
  ].map((s) => {
    const box = fence(s.a[0], s.a[1], s.b[0], s.b[1], 0);
    const len = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
    const bar = new T.Mesh(b.boxGeo, mat.ochre);
    bar.scale.set(s.a[0] === s.b[0] ? 0.08 : len, 0.08, s.a[0] === s.b[0] ? len : 0.08);
    bar.position.set((s.a[0] + s.b[0]) / 2 - LIFT.cx, 1.05, (s.a[1] + s.b[1]) / 2 - LIFT.cz);
    car.add(bar);
    return { ...s, box, bar, cx: (s.a[0] + s.b[0]) / 2, cz: (s.a[1] + s.b[1]) / 2 };
  });
  // Landing gates keep the shaft closed while the car is elsewhere.
  const gates = [
    { y: 0, segs: [[x0, z0, x1, z0], [x0, z1, x1, z1], [x0, z0, x0, z1], [x1, z0, x1, z1]] },
    { y: LEVEL.L1, segs: [[x0, z0, x1, z0]] },
    { y: LEVEL.L2, segs: [[x0, z0, x0, -284]] },
    { y: LEVEL.CROWN, segs: [[CROWN_BRIDGE.x0, z1, CROWN_BRIDGE.x1, z1]] },
  ].map((g) => ({
    ...g,
    parts: g.segs.map(([ax, az, bx, bz]) => {
      const box = fence(ax, az, bx, bz, g.y);
      box.moveTo(box.x, box.y, box.z);
      const len = Math.hypot(bx - ax, bz - az);
      const bar = new T.Mesh(b.boxGeo, mat.hazard);
      bar.scale.set(ax === bx ? 0.1 : len, 0.1, ax === bx ? len : 0.1);
      bar.position.set((ax + bx) / 2, g.y + 1.05, (az + bz) / 2);
      scene.add(bar);
      return { box, bar };
    }),
  }));
  for (const g of gates)
    for (const [ax, az, bx, bz] of g.segs)
      for (const [px, pz] of [
        [ax, az],
        [bx, bz],
      ])
        b.box(px, g.y + 1.25, pz, 0.14, 2.5, 0.14, mat.iron);

  // Counterweight and hoist ropes.
  const weight = new T.Mesh(b.boxGeo, mat.darkCast);
  weight.scale.set(1.5, 4.2, 6.2);
  weight.castShadow = true;
  scene.add(weight);
  const ropeGeo = new T.CylinderGeometry(0.03, 0.03, 1, 6);
  const sheave = frame.fy - 2.2,
    carRopeX = LIFT.cx + sx,
    weightX = S.x1 - 1.4;
  const rope = (x, z) => {
    const r = new T.Mesh(ropeGeo, mat.steel);
    r.position.set(x, 0, z);
    scene.add(r);
    return r;
  };
  const ropes = [-1.2, -0.4, 0.4, 1.2].map((z) => rope(carRopeX, LIFT.cz + z));
  const weightRopes = [-0.6, -0.2, 0.2, 0.6].map((z) => rope(weightX, LIFT.cz + z));
  // Twin sheaves under the crown frame carry the ropes across to the counterweight.
  const radius = 1.1,
    wheels = [carRopeX + radius, weightX - radius].map((x) => {
      const g = new T.Group();
      g.position.set(x, sheave, LIFT.cz);
      scene.add(g);
      const rim = new T.Mesh(new T.TorusGeometry(radius, 0.12, 8, 28), mat.steel);
      g.add(rim);
      for (let i = 0; i < 3; i++) b.part(g, 0, 0, 0, 0.1, radius * 2, 0.1, mat.iron).rotation.z = (i * Math.PI) / 3;
      b.part(g, 0, 0, 0, 0.5, 0.5, 1.8, mat.iron);
      for (const dz of [-0.24, 0.24]) b.box(x, sheave + 1.2, LIFT.cz + dz, 0.36, 2.4, 0.06, mat.darkCast);
      return g;
    });
  b.box((carRopeX + weightX) / 2, sheave + radius, LIFT.cz, weightX - carRopeX - 2 * radius, 0.08, 1.2, mat.steel);
  b.box((carRopeX + weightX) / 2, sheave + 2.4, LIFT.cz, weightX - carRopeX + 2, 0.6, 0.8, mat.steel);


  // Call panels at each landing.
  const calls = CALL_PANELS.map((c) => {
    b.box(c.x, c.y + 0.6, c.z, 0.32, 1.2, 0.32, mat.enamel, { camera: false });
    const lamp = new T.Mesh(b.boxGeo, mat.lampOff);
    lamp.scale.set(0.2, 0.1, 0.2);
    lamp.position.set(c.x, c.y + 1.26, c.z);
    scene.add(lamp);
    return { ...c, lamp };
  });

  // Core control desk on L2 and the survey lectern on the crown.
  const desk = new T.Group();
  desk.position.set(CONSOLE.x, CONSOLE.y, CONSOLE.z);
  scene.add(desk);
  b.part(desk, 0, 0.5, 0, 0.9, 1.0, 2.6, mat.enamel);
  b.part(desk, -0.22, 1.32, 0, 0.12, 0.7, 2.6, mat.iron);
  const screens = [-0.8, 0, 0.8].map((z) => {
    const s = b.part(desk, -0.15, 1.35, z, 0.02, 0.5, 0.66, mat.lampOff, false);
    s.rotation.z = -0.25;
    return s;
  });
  b.part(desk, 0.2, 1.02, 0.9, 0.3, 0.06, 0.4, mat.instrumentPanel);
  const restartLever = new T.Group();
  restartLever.position.set(0.25, 1.02, -0.6);
  desk.add(restartLever);
  b.part(restartLever, 0, 0.18, 0, 0.06, 0.36, 0.06, mat.edge);
  b.part(restartLever, 0, 0.38, 0, 0.12, 0.08, 0.3, mat.red);
  restartLever.rotation.z = 0.55;
  const deskTag = textPlate('核心主控', 'CORE  /  RESTART', 1.1, 0.36);
  deskTag.position.set(0.46, 0.7, 0);
  deskTag.rotation.y = Math.PI / 2;
  desk.add(deskTag);
  physics.add(new Box(CONSOLE.x, CONSOLE.y + 0.85, CONSOLE.z, 0.9, 1.7, 2.6));

  b.box(RECORD.x, RECORD.y + 0.55, RECORD.z, 1.2, 1.1, 0.7, mat.enamel, true);
  b.box(RECORD.x, RECORD.y + 1.14, RECORD.z - 0.08, 1.3, 0.08, 0.8, mat.iron);
  b.plate('观测记录', 'S-01  /  SURVEY', RECORD.x, RECORD.y + 0.82, RECORD.z - 0.36, 0.86, 0.28, Math.PI);
  const recordLamp = new T.Mesh(b.boxGeo, mat.amber);
  recordLamp.scale.set(0.3, 0.05, 0.16);
  recordLamp.position.set(RECORD.x, RECORD.y + 1.2, RECORD.z - 0.2);
  scene.add(recordLamp);

  // Lamps on the shaft walls and light strips up the outside, lit by height.
  const lights = [];
  const addLight = (x, y, z, sx, sy, sz, kind) => {
    lights.push({ x, y, z, sx, sy, sz, kind });
    if (kind !== 'lamp') return;
    // A pressed-steel fixture: back plate, hood and two cage bars.
    const nx = x < S.x0 + 1 ? 1 : x > S.x1 - 1 ? -1 : 0,
      nz = nx ? 0 : z < S.z0 + 1 ? 1 : -1,
      wide = (a, c) => (nx ? [c, a] : [a, c]);
    const [pw, pd] = wide(0.5, 0.05);
    b.box(x - nx * 0.05, y, z - nz * 0.05, pw, 0.9, pd, mat.iron);
    const [hw2, hd2] = wide(0.56, 0.24);
    b.box(x + nx * 0.05, y + 0.42, z + nz * 0.05, hw2, 0.05, hd2, mat.iron);
    for (const off of [-0.13, 0.13]) b.box(x + nx * 0.12 + (nx ? 0 : off), y, z + nz * 0.12 + (nx ? off : 0), 0.02, 0.7, 0.02, mat.iron);
  };
  for (let y = 4; y < 128; y += 8) {
    for (const x of [67, 75, 87, 95]) addLight(x, y, S.z1 - 0.08, 0.32, 0.62, 0.12, 'lamp');
    if (y < 46 || y > 100) for (const x of [70, 81, 92]) addLight(x, y, S.z0 + 0.08, 0.32, 0.62, 0.12, 'lamp');
    for (const z of [-272, -280, -288, -296]) addLight(S.x0 + 0.08, y, z, 0.12, 0.62, 0.32, 'lamp');
    for (const z of [-271.5, -280.5, -289.5, -298.5]) {
      if (z === -298.5 && (y === 60 || y === 84)) continue;
      addLight(S.x1 - 0.08, y, z, 0.12, 0.62, 0.32, 'lamp');
    }
  }
  for (let y = 2; y < 128; y += 4) {
    for (const [x, z] of [
      [CORE.x0 - 0.05, CORE.z1 - 2.2],
      [CORE.x1 + 0.05, CORE.z1 - 2.2],
      [CORE.x0 - 0.05, CORE.z0 + 2.2],
      [CORE.x1 + 0.05, CORE.z0 + 2.2],
    ])
      addLight(x, y, z, 0.3, 3.5, 0.9, 'strip');
    for (const [x, z] of [
      [CORE.x0 + 2.2, CORE.z1 + 0.05],
      [CORE.x1 - 2.2, CORE.z1 + 0.05],
      [CORE.x0 + 2.2, CORE.z0 - 0.05],
      [CORE.x1 - 2.2, CORE.z0 - 0.05],
    ])
      addLight(x, y, z, 0.9, 3.5, 0.3, 'strip');
  }
  const lightMesh = new T.InstancedMesh(b.boxGeo, new T.MeshBasicMaterial({ color: 0xffffff }), lights.length);
  const o = new T.Object3D();
  lights.forEach((l, i) => {
    o.position.set(l.x, l.y, l.z);
    o.scale.set(l.sx, l.sy, l.sz);
    o.updateMatrix();
    lightMesh.setMatrixAt(i, o.matrix);
    lightMesh.setColorAt(i, OFF);
  });
  lightMesh.instanceColor.needsUpdate = true;
  lightMesh.computeBoundingSphere();
  lightMesh.frustumCulled = false;
  scene.add(lightMesh);
  let lightKey = '';

  const beacons = frame.towers.map(([x, z]) => {
    const m = new T.Mesh(b.boxGeo, mat.redLight);
    m.scale.set(0.9, 0.5, 0.9);
    m.position.set(x, LEVEL.CROWN + 24.3, z);
    scene.add(m);
    return m;
  });

  const fill = new T.PointLight(0xffe2bf, 0, 46, 1.6);
  scene.add(fill);
  const shaftLight = new T.PointLight(0xffd7a8, 0, 60, 1.4);
  shaftLight.position.set(LIFT.cx, 6, LIFT.cz);
  scene.add(shaftLight);

  const smooth = (t) => t * t * (3 - 2 * t);
  let lastY = 0,
    lastDoor = 0;
  return {
    car,
    shadowsDirty: false,
    update(dt, time, site, player, inside) {
      const open = smooth(site.coreDoor);
      for (const l of leaves) {
        const x = 81 + l.side * (1.5 + 3 * open);
        l.g.position.x = x;
        l.box.moveTo(x, 4, CORE_DOOR.z);
      }
      const powered = site.has('main'),
        restarted = site.has('console');
      doorLamp.material = powered ? mat.green : mat.redLight;

      const y = site.liftY;
      car.position.y = y;
      if (Math.abs(y - lastY) > 0.8 || Math.abs(open - lastDoor) > 0.08) {
        this.shadowsDirty = true;
        lastY = y;
        lastDoor = open;
      }
      deck.moveTo(LIFT.cx, y - 0.32, LIFT.cz);
      panelBox.moveTo(LIFT.cx + LIFT_PANEL.dx, y + 0.55, LIFT.cz + LIFT_PANEL.dz);
      const stopped = !site.liftMoving;
      for (const s of sides) {
        const opened = stopped && s.open.includes(y);
        s.box.enabled = !opened;
        s.box.moveTo(s.cx, y + 0.9, s.cz);
        s.bar.position.y = T.MathUtils.damp(s.bar.position.y, opened ? 2.5 : 1.05, 5, dt);
      }
      for (const g of gates) {
        const here = stopped && y === g.y;
        for (const p of g.parts) {
          p.box.enabled = !here;
          p.bar.position.y = T.MathUtils.damp(p.bar.position.y, g.y + (here ? 2.4 : 1.05), 5, dt);
        }
      }
      const wy = 128 - y * 0.92;
      weight.position.set(weightX, wy, LIFT.cz);
      for (const r of ropes) {
        const from = y + headY + 0.4,
          len = sheave - from;
        r.scale.y = Math.max(0.1, len);
        r.position.y = from + len / 2;
      }
      for (const r of weightRopes) {
        const from = wy + 2.1,
          len = sheave - from;
        r.scale.y = Math.max(0.1, len);
        r.position.y = from + len / 2;
      }
      for (const w of wheels) w.rotation.z = -y / radius;
      for (const [i, st] of stiles.entries()) st.moveTo(LIFT.cx + sx, y + headY / 2, LIFT.cz + (i ? 1 : -1) * sz);
      const dest = site.liftDestination();
      panelLamp.material = site.liftMoving ? mat.amber : dest !== null ? mat.green : powered ? mat.redLight : mat.lampOff;
      for (const c of calls)
        c.lamp.material = !powered ? mat.lampOff : y === c.y && stopped ? mat.green : site.allowedStop(c.y) ? mat.amber : mat.redLight;

      const since = restarted ? site.time - site.restartAt : -1;
      restartLever.rotation.z = T.MathUtils.damp(restartLever.rotation.z, restarted ? -0.7 : 0.55, 6, dt);
      screens.forEach((s, i) => (s.material = restarted ? mat.screen : powered && Math.sin(time * 2 + i) > 0 ? mat.amber : mat.lampOff));
      recordLamp.visible = !site.has('record') || Math.sin(time * 4) > 0;
      const blink = Math.sin(time * 2.4) > 0.2;
      for (const bc of beacons) {
        bc.material = restarted ? mat.amber : mat.redLight;
        bc.visible = restarted || blink;
      }

      // Lamp colours change only while a cascade is running.
      const cascade = restarted ? Math.min(140, Math.floor(Math.max(0, since - 0.4) * 26)) : -1;
      const key = (powered ? 'p' : 'o') + cascade;
      if (key !== lightKey) {
        lightKey = key;
        lights.forEach((l, i) => {
          let c = OFF;
          if (l.kind === 'lamp') {
            if (cascade >= 0 && l.y <= cascade) c = WORK;
            else if (powered) c = EMERGENCY;
          } else if (cascade >= 0 && l.y <= cascade) c = STRIP;
          lightMesh.setColorAt(i, c);
        });
        lightMesh.instanceColor.needsUpdate = true;
      }

      const level = restarted ? 1 : powered ? 0.45 : 0.15;
      fill.position.set(
        Math.max(S.x0 + 3, Math.min(S.x1 - 3, player.x)),
        player.y + 9,
        Math.max(S.z0 + 3, Math.min(S.z1 - 3, player.z))
      );
      fill.intensity = inside * 40 * level;
      shaftLight.position.y = y + 4;
      shaftLight.intensity = inside * (restarted ? 90 : powered ? 30 : 0);
    },
  };
}
