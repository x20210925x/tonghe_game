import * as T from '../../assets/three.module.min.js';

// Tapered cross-sections keep the silhouette continuous while joints articulate.
function garment(rings, material, segments = 24) {
  const p = [],
    idx = [],
    uv = [];
  const bottom = rings[0][0],
    span = rings.at(-1)[0] - bottom;
  rings.forEach(([y, rx, rz, offset = 0], row) => {
    for (let j = 0; j <= segments; j++) {
      const a = (j * Math.PI * 2) / segments,
        fold = 1 + 0.019 * Math.sin(7 * a + row * 0.6) + 0.014 * Math.cos(11 * a - row * 0.9);
      p.push(Math.sin(a) * rx * fold, y, Math.cos(a) * rz * fold + offset);
      uv.push(0.5 + 0.485 * Math.sin(a), 0.012 + (0.976 * (y - bottom)) / span);
      const i = row * (segments + 1) + j;
      if (row && j) idx.push(i - segments - 2, i, i - 1, i - segments - 2, i - segments - 1, i);
    }
  });
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(p, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new T.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function makeWorker(atlas) {
  // pelvis → waist (pivot at hip height) → upper (modelled in absolute heights).
  // Leaning and twisting the torso turns it about the waist, so it stays on the hips.
  const group = new T.Group(),
    pelvis = new T.Group(),
    waist = new T.Group(),
    upper = new T.Group();
  group.add(pelvis);
  pelvis.add(waist);
  waist.add(upper);
  waist.position.y = 0.86;
  upper.position.y = -0.86;
  const cloth = (color, roughness = 0.94) =>
    new T.MeshStandardMaterial({ color, roughness, side: T.DoubleSide });
  function panel(x, y, color, bump = 0.006) {
    const t = atlas.clone();
    t.offset.set(x + 0.003, y + 0.003);
    t.repeat.set(0.494, 0.494);
    t.needsUpdate = true;
    return new T.MeshStandardMaterial({
      color,
      map: t,
      bumpMap: t,
      bumpScale: bump,
      roughness: 0.89,
      side: T.DoubleSide,
    });
  }
  const orange = panel(0, 0.5, 0xf0e5d7),
    sleeve = panel(0.5, 0, 0xe0c8ad, 0.004),
    darkOrange = cloth(0x653e2b),
    pant = panel(0, 0, 0xe0e6e3),
    boots = cloth(0x282c29, 0.65);
  const web = cloth(0x454636),
    bag = panel(0.5, 0.5, 0xd8d5c5, 0.009),
    collar = panel(0, 0, 0x9ba5a0, 0.002);
  function oval(parent, x, y, z, rx, ry, rz, mat) {
    const mesh = new T.Mesh(new T.SphereGeometry(1, 20, 14), mat);
    mesh.position.set(x, y, z);
    mesh.scale.set(rx, ry, rz);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function strap(parent, x, y, z, w, h, d, mat, angle = 0) {
    const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.z = angle;
    parent.add(mesh);
    return mesh;
  }
  const torso = garment(
    [
      [0.77, 0.227, 0.178],
      [0.84, 0.243, 0.176],
      [0.88, 0.23, 0.15],
      [0.92, 0.231, 0.162],
      [1.01, 0.208, 0.146],
      [1.18, 0.238, 0.161],
      [1.34, 0.256, 0.164],
      [1.42, 0.224, 0.142],
      [1.48, 0.14, 0.12],
      [1.49, 0.09, 0.09],
    ],
    orange
  );
  upper.add(torso);
  upper.add(
    garment(
      [
        [0.774, 0.23, 0.179],
        [0.785, 0.233, 0.179],
        [0.8, 0.235, 0.177],
      ],
      darkOrange
    )
  );
  strap(upper, 0, 1.18, -0.155, 0.012, 0.55, 0.014, boots);
  const head = new T.Group();
  head.position.y = 1.45;
  upper.add(head);
  head.add(
    garment(
      [
        [-0.018, 0.15, 0.119, 0.016],
        [0.045, 0.148, 0.147, 0.019],
        [0.12, 0.143, 0.151, 0.012],
        [0.23, 0.125, 0.126, 0.009],
        [0.28, 0.088, 0.091, 0.014],
        [0.301, 0.001, 0.001, 0.013],
      ],
      sleeve
    )
  );
  // A folded collar and wraparound splash goggles sit inside the orange hood.
  head.add(
    garment(
      [
        [-0.015, 0.106, 0.075, -0.035],
        [0.022, 0.111, 0.087, -0.046],
        [0.054, 0.103, 0.093, -0.065],
        [0.081, 0.099, 0.102, -0.065],
        [0.109, 0.095, 0.108, -0.06],
        [0.139, 0.093, 0.099, -0.063],
        [0.148, 0.088, 0.091, -0.062],
      ],
      collar
    )
  );
  const visor = new T.MeshStandardMaterial({
    color: 0x596965,
    metalness: 0.76,
    roughness: 0.18,
    side: T.DoubleSide,
  });
  function goggleLens(width, height, forward, material) {
    const xyz = [],
      indices = [];
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24 - 0.5) * 2.65,
        edge = Math.abs(i / 12 - 1),
        z = -0.043 - Math.cos(a) * forward;
      const top = 0.185 + height * (1 - 0.4 * edge ** 3);
      const base = 0.182 - height * (1 - 0.34 * edge ** 3) + 0.011 * Math.exp(-70 * (i / 12 - 1) ** 2);
      xyz.push(width * Math.sin(a), base, z, width * Math.sin(a), top, z);
      if (i) {
        const n = i * 2;
        indices.push(n - 2, n - 1, n, n, n - 1, n + 1);
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(xyz, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    const shell = new T.Mesh(g, material);
    head.add(shell);
  }
  goggleLens(0.129, 0.045, 0.137, boots);
  goggleLens(0.124, 0.034, 0.142, visor);
  const pack = garment(
    [
      [0.94, 0.126, 0.06, 0.167],
      [0.98, 0.187, 0.102, 0.178],
      [1.07, 0.195, 0.108, 0.17],
      [1.25, 0.18, 0.113, 0.17],
      [1.35, 0.16, 0.106, 0.163],
      [1.383, 0.1, 0.061, 0.156],
    ],
    bag
  );
  upper.add(pack);
  for (const side of [-1, 1]) {
    strap(upper, side * 0.117, 1.22, -0.138, 0.037, 0.48, 0.026, web, side * -0.17);

    oval(upper, side * 0.14, 1.408, 0.011, 0.026, 0.02, 0.137, web);
  }

  const ground = document.createElement('canvas');
  ground.width = ground.height = 96;
  const gc = ground.getContext('2d');
  const contact = gc.createRadialGradient(48, 48, 0, 48, 48, 47);
  contact.addColorStop(0, 'rgba(12,16,15,.59)');
  contact.addColorStop(0.44, 'rgba(12,16,15,.33)');
  contact.addColorStop(1, 'rgba(12,16,15,0)');
  gc.fillStyle = contact;
  gc.fillRect(0, 0, 96, 96);
  const shadow = new T.Mesh(
    new T.PlaneGeometry(0.68, 0.56),
    new T.MeshBasicMaterial({ map: new T.CanvasTexture(ground), transparent: true, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.035;
  shadow.renderOrder = 3;
  group.add(shadow);
  const legs = [],
    arms = [];
  for (const side of [-1, 1]) {
    const hip = new T.Group();
    hip.position.set(0.113 * side, 0.86, 0);
    pelvis.add(hip);
    hip.add(
      garment(
        [
          [-0.429, 0.077, 0.082],
          [-0.384, 0.082, 0.098],
          [-0.28, 0.092, 0.106],
          [-0.13, 0.106, 0.117],
          [0.045, 0.112, 0.126],
        ],
        pant
      )
    );
    const knee = new T.Group();
    knee.position.y = -0.385;
    hip.add(knee);
    knee.add(
      garment(
        [
          [-0.358, 0.063, 0.07],
          [-0.31, 0.074, 0.081],
          [-0.268, 0.071, 0.078],
          [-0.205, 0.088, 0.087],
          [-0.17, 0.084, 0.091],
          [-0.09, 0.083, 0.086],
          [0.02, 0.078, 0.083],
        ],
        pant
      )
    );
    const ankle = new T.Group();
    ankle.position.y = -0.36;
    knee.add(ankle);
    ankle.add(
      garment(
        [
          [-0.438, 0.073, 0.119, -0.036],
          [-0.42, 0.081, 0.132, -0.041],
          [-0.395, 0.08, 0.13, -0.043],
          [-0.367, 0.077, 0.115, -0.03],
          [-0.332, 0.073, 0.085, -0.005],
          [-0.289, 0.073, 0.074],
          [-0.274, 0.067, 0.069],
        ],
        boots
      )
    );
    for (let j = 0; j < 3; j++)
      strap(ankle, 0, -0.326 - j * 0.023, -0.08 - j * 0.014, 0.114, 0.007, 0.015, web);
    strap(ankle, 0, -0.44, -0.049, 0.145, 0.027, 0.24, boots);
    for (const part of ankle.children) part.position.y += 0.36;
    const shoulder = new T.Group();
    shoulder.position.set(0.228 * side, 1.369, 0);
    upper.add(shoulder);
    shoulder.rotation.z = side * 0.11;
    shoulder.add(
      garment(
        [
          [-0.288, 0.067, 0.073],
          [-0.22, 0.07, 0.076],
          [-0.13, 0.083, 0.085],
          [-0.028, 0.093, 0.093],
          [0.04, 0.058, 0.066],
          [0.052, 0.01, 0.018],
        ],
        sleeve
      )
    );
    const elbow = new T.Group();
    elbow.position.y = -0.259;
    shoulder.add(elbow);
    elbow.add(
      garment(
        [
          [-0.228, 0.05, 0.061],
          [-0.211, 0.055, 0.06],
          [-0.17, 0.058, 0.066],
          [-0.08, 0.067, 0.073],
          [0.018, 0.071, 0.077],
        ],
        sleeve
      )
    );
    oval(elbow, 0, -0.259, -0.007, 0.043, 0.073, 0.052, boots);
    oval(elbow, -side * 0.033, -0.267, -0.036, 0.019, 0.045, 0.021, boots);
    for (let finger = 0; finger < 3; finger++)
      oval(elbow, -0.024 + 0.024 * finger, -0.306, -0.011, 0.016, 0.033, 0.027, boots);
    oval(shoulder, side * 0.074, -0.15, 0, 0.009, 0.035, 0.039, darkOrange);
    hip.name = side < 0 ? 'leftHip' : 'rightHip';
    knee.name = side < 0 ? 'leftKnee' : 'rightKnee';
    ankle.name = side < 0 ? 'leftAnkle' : 'rightAnkle';
    elbow.name = side < 0 ? 'leftElbow' : 'rightElbow';
    legs.push({ hip, knee, ankle });
    arms.push({ shoulder, elbow });
  }
  // The model faces -Z. Positive hip rotation advances the knee; flexion at the knee
  // must rotate the calf toward +Z. Solve for the sole first, then counterrotate the ankle.
  const thigh = 0.385,
    shin = 0.36,
    sole = 0.094;
  let phase = 0,
    weight = 0,
    reach = 0;
  const targets = [{}, {}];
  // speed is signed: negative plays the cycle backwards for walking backwards.
  function animate(dt, speed, time, useHands = 0, opening = null, air = 0, crouch = 0) {
    const pace = Math.abs(speed),
      run = T.MathUtils.smoothstep(pace, 2.4, 4.4),
      cycle = 1.24 + 0.82 * run,
      support = 0.6 - 0.18 * run,
      heel = 0.3 - 0.12 * run,
      toe = 0.45;
    weight = T.MathUtils.damp(weight, Math.min(1, pace / 0.9), 14, dt);
    reach = T.MathUtils.damp(reach, useHands, 8, dt);
    const previous = Math.floor(phase * 2);
    phase += (speed * dt) / cycle;
    const span = cycle * support,
      leg = thigh + shin - 0.005,
      limits = [0, 0];
    for (let i = 0; i < 2; i++) {
      const p = (((phase + i * 0.5) % 1) + 1) % 1,
        foot = targets[i];
      const swing = T.MathUtils.clamp((p - support) / (1 - support), 0, 1);
      const ease = swing * swing * (3 - 2 * swing);
      foot.forward =
        (p < support ? span * (0.5 - p / support) : span * (ease - 0.5)) * weight +
        (i ? -0.024 : 0.024) * (1 - weight);
      foot.lift = (0.095 + 0.13 * run) * Math.sin(swing * Math.PI) ** 1.45 * weight;
      // Heel strike, flat foot, then the heel rises into toe-off.
      foot.roll =
        weight *
        (p < support
          ? heel * Math.max(0, 1 - p / 0.14) - toe * Math.max(0, (p - support + 0.16) / 0.16)
          : -toe + (toe + heel) * ease);
      foot.height = sole + foot.lift + (foot.roll < 0 ? 0.17 : 0.072) * Math.abs(Math.sin(foot.roll));
      limits[i] = foot.height + Math.sqrt(Math.max(0.01, leg * leg - foot.forward * foot.forward));
    }
    // The highest the pelvis may sit with both soles reachable, with the V at each footfall
    // rounded off, then compressed toward its lowest point so the body glides.
    const gap = Math.abs(limits[0] - limits[1]),
      soft = 0.06,
      reachable = Math.min(limits[0], limits[1]) - (Math.max(soft - gap, 0) ** 2) / (4 * soft);
    const low = sole + 0.072 * Math.sin(heel * weight) + Math.sqrt(Math.max(0.01, leg * leg - (span * weight * 0.5) ** 2));
    let pelvisHeight = Math.min(0.826 - 0.03 * run, reachable);
    if (pelvisHeight > low) pelvisHeight = low + (pelvisHeight - low) * 0.66;
    pelvisHeight = Math.min(pelvisHeight, reachable) - 0.12 * crouch;
    pelvis.position.y = pelvisHeight - 0.86;
    pelvis.position.x = Math.sin(phase * 2 * Math.PI + 0.38) * 0.014 * weight;
    waist.rotation.x = -0.05 * weight - 0.12 * run;
    waist.rotation.z = 0.02 * Math.sin(phase * 2 * Math.PI) * weight;
    waist.rotation.y = -0.09 * Math.cos(phase * 2 * Math.PI) * weight;
    waist.position.y = 0.86 + Math.sin(time * 1.7) * 0.003 * (1 - weight);
    head.rotation.y = Math.sin(time * 0.52) * 0.038;
    for (let i = 0; i < 2; i++) {
      const foot = targets[i],
        leg = legs[i],
        vertical = pelvisHeight - foot.height;
      const d = Math.hypot(vertical, foot.forward);
      const flex = -Math.acos(
        T.MathUtils.clamp((d * d - thigh * thigh - shin * shin) / (2 * thigh * shin), -1, 1)
      );
      const hip =
        Math.atan2(foot.forward, vertical) -
        Math.atan2(shin * Math.sin(flex), thigh + shin * Math.cos(flex));
      leg.hip.rotation.x = hip;
      leg.knee.rotation.x = flex;
      leg.ankle.rotation.x = foot.roll - hip - flex;
      const counter = -foot.forward / (cycle * support * 0.5);
      const arm = arms[i],
        working = reach * (i === 1 ? 1 : 0.79);
      arm.shoulder.rotation.x = T.MathUtils.lerp(
        -0.08 + counter * (0.4 + run * 0.23),
        0.66 + 0.08 * Math.sin(time * 3 + i),
        working
      );
      arm.elbow.rotation.x = T.MathUtils.lerp(
        0.24 + run * 0.69 + Math.max(0, counter) * 0.17,
        0.95,
        working
      );
      arm.shoulder.rotation.z = (i ? 1 : -1) * (0.09 + 0.026 * weight - 0.055 * working);
      if (opening !== null) {
        const a = (i === 0 ? 2.8 : 0.34) - 0.47 * Math.sin(opening * 3 * Math.PI);
        const x = -0.09 + 0.252 * Math.cos(a) - arm.shoulder.position.x;
        const down = arm.shoulder.position.y + pelvis.position.y - (0.98 + 0.252 * Math.sin(a));
        const radial = Math.hypot(x, down),
          forward = 0.456,
          armLen = 0.259,
          forearm = 0.273;
        const bend = Math.acos(
          T.MathUtils.clamp(
            (radial * radial + forward * forward - armLen * armLen - forearm * forearm) /
              (2 * armLen * forearm),
            -1,
            1
          )
        );
        arm.shoulder.rotation.order = 'ZXY';
        arm.shoulder.rotation.z = T.MathUtils.lerp(arm.shoulder.rotation.z, Math.atan2(x, down), reach);
        arm.shoulder.rotation.x = T.MathUtils.lerp(
          arm.shoulder.rotation.x,
          Math.atan2(forward, radial) -
            Math.atan2(forearm * Math.sin(bend), armLen + forearm * Math.cos(bend)),
          reach
        );
        arm.elbow.rotation.x = T.MathUtils.lerp(arm.elbow.rotation.x, bend, reach);
      }
    }
    // Airborne: tuck the lead knee, trail the other leg and open the arms for balance.
    if (air > 0.001) {
      const lerp = T.MathUtils.lerp;
      for (let i = 0; i < 2; i++) {
        const leg = legs[i],
          arm = arms[i],
          lead = i === 0;
        const hip = lead ? 0.62 : -0.12,
          knee = lead ? -0.95 : -0.72;
        leg.hip.rotation.x = lerp(leg.hip.rotation.x, hip, air);
        leg.knee.rotation.x = lerp(leg.knee.rotation.x, knee, air);
        leg.ankle.rotation.x = lerp(leg.ankle.rotation.x, -(hip + knee) * 0.75, air);
        if (opening === null) {
          arm.shoulder.rotation.x = lerp(arm.shoulder.rotation.x, lead ? -0.45 : 0.55, air);
          arm.shoulder.rotation.z = lerp(arm.shoulder.rotation.z, (i ? 1 : -1) * 0.42, air);
          arm.elbow.rotation.x = lerp(arm.elbow.rotation.x, 0.75, air);
        }
      }
      pelvis.position.y = lerp(pelvis.position.y, -0.02, air);
      waist.rotation.x = lerp(waist.rotation.x, 0.1, air);
    }
    return pace > 0.15 && air < 0.5 && Math.floor(phase * 2) !== previous;
  }
  return { group, animate, head };
}
