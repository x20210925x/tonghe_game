import * as T from '../../assets/three.module.min.js';
import { Box } from '../engine/physics.js';
import { textPlate } from '../render/materials.js';

// A small vocabulary for poured and fabricated architecture. Every visible box is batched into
// instanced meshes by material and region; solid pieces register matching collision boxes.
export class Builder {
  constructor(scene, mat, physics) {
    this.scene = scene;
    this.mat = mat;
    this.physics = physics;
    this.batches = new Map();
    this.temp = new T.Object3D();
    this.boxGeo = new T.BoxGeometry(1, 1, 1);
    this.pipeGeo = new T.CylinderGeometry(1, 1, 1, 12);
    this.up = new T.Vector3(0, 1, 0);
  }
  instance(geom, material, x, y, z, w, h, d, rot = null) {
    const key =
      geom.uuid +
      material.uuid +
      ':' +
      Math.floor(x / 120) +
      ':' +
      Math.floor(z / 120) +
      ':' +
      Math.floor(y / 80);
    let batch = this.batches.get(key);
    if (!batch) this.batches.set(key, (batch = { geom, material, matrices: [] }));
    const t = this.temp;
    t.position.set(x, y, z);
    t.scale.set(w, h, d);
    if (rot?.isQuaternion) t.quaternion.copy(rot);
    else if (rot) t.quaternion.setFromEuler(rot);
    else t.quaternion.identity();
    t.updateMatrix();
    batch.matrices.push(t.matrix.clone());
  }
  // collide: true for solid, or { walk, block, camera, surface, yaw }.
  box(x, y, z, w, h, d, m = this.mat.cast, collide = null) {
    const yaw = (collide && collide.yaw) || 0;
    this.instance(this.boxGeo, m, x, y, z, w, h, d, yaw ? new T.Euler(0, yaw, 0) : null);
    if (collide) this.collider(x, y, z, w, h, d, collide === true ? {} : collide);
  }
  turned(x, y, z, w, h, d, yaw, m) {
    this.instance(this.boxGeo, m, x, y, z, w, h, d, new T.Euler(0, yaw, 0));
  }
  collider(x, y, z, w, h, d, o = {}) {
    return this.physics.add(new Box(x, y, z, w, h, d, o));
  }
  slab(x0, x1, z0, z1, top, thick = 0.6, m = this.mat.deck, o = {}) {
    this.box((x0 + x1) / 2, top - thick / 2, (z0 + z1) / 2, x1 - x0, thick, z1 - z0, m, o);
  }
  // A solid volume given by its extents.
  block(x0, x1, y0, y1, z0, z1, m = this.mat.cast, o = true) {
    this.box((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, m, o);
  }
  // An invisible fence that keeps the inspector on the walkway without hiding the view.
  barrier(x1, z1, x2, z2, y0 = 0, h = 1.7, thick = 0.14) {
    const dx = x2 - x1,
      dz = z2 - z1,
      len = Math.hypot(dx, dz);
    if (len < 0.01) return null;
    return this.collider((x1 + x2) / 2, y0 + h / 2, (z1 + z2) / 2, thick, h, len + thick, {
      yaw: Math.atan2(dx, dz),
      walk: false,
      camera: false,
    });
  }
  rod(a, b, r, m = this.mat.iron) {
    const va = new T.Vector3(...a),
      vb = new T.Vector3(...b),
      len = va.distanceTo(vb);
    if (len < 1e-4) return;
    const mid = va.clone().lerp(vb, 0.5);
    const q = new T.Quaternion().setFromUnitVectors(this.up, vb.sub(va).normalize());
    this.instance(this.pipeGeo, m, mid.x, mid.y, mid.z, r, len, r, new T.Euler().setFromQuaternion(q));
  }
  // A box whose long axis runs from a to b; its height stays perpendicular to the slope.
  beam(a, b, w, h, m = this.mat.steel) {
    const va = new T.Vector3(...a),
      vb = new T.Vector3(...b),
      dir = vb.clone().sub(va),
      len = dir.length();
    if (len < 1e-4) return;
    dir.divideScalar(len);
    const side = new T.Vector3().crossVectors(Math.abs(dir.y) > 0.98 ? new T.Vector3(1, 0, 0) : this.up, dir).normalize();
    const up = new T.Vector3().crossVectors(dir, side);
    const q = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(side, up, dir));
    const mid = va.lerp(vb, 0.5);
    this.instance(this.boxGeo, m, mid.x, mid.y, mid.z, w, h, len, q);
  }
  // Guard rail: posts on base plates, a top rail, two intermediate rails and a toe board.
  rail(x1, z1, x2, z2, level = 0, m = this.mat.steel, fence = true) {
    const length = Math.hypot(x2 - x1, z2 - z1),
      n = Math.max(1, Math.ceil(length / 1.8)),
      yaw = Math.atan2(x2 - x1, z2 - z1);
    for (let i = 0; i <= n; i++) {
      const t = i / n,
        x = x1 + (x2 - x1) * t,
        z = z1 + (z2 - z1) * t;
      this.box(x, level + 0.53, z, 0.055, 1.06, 0.055, m);
      this.box(x, level + 0.012, z, 0.15, 0.024, 0.15, this.mat.iron);
      this.box(x, level + 1.07, z, 0.08, 0.03, 0.08, this.mat.iron);
    }
    this.rod([x1, level + 1.04, z1], [x2, level + 1.04, z2], 0.034, m);
    this.rod([x1, level + 0.72, z1], [x2, level + 0.72, z2], 0.018, m);
    this.rod([x1, level + 0.4, z1], [x2, level + 0.4, z2], 0.018, m);
    if (length > 0.2) this.turned((x1 + x2) / 2, level + 0.075, (z1 + z2) / 2, 0.014, 0.13, length, yaw, this.mat.iron);
    if (fence) this.barrier(x1, z1, x2, z2, level);
  }
  // A handrail that follows a sloped flight.
  handrail(a, b, m = this.mat.ochre) {
    const len = Math.hypot(b[0] - a[0], b[2] - a[2]),
      n = Math.max(1, Math.ceil(len / 1.15));
    for (let i = 0; i <= n; i++) {
      const t = i / n,
        x = a[0] + (b[0] - a[0]) * t,
        y = a[1] + (b[1] - a[1]) * t,
        z = a[2] + (b[2] - a[2]) * t;
      this.box(x, y + 0.5, z, i % 3 ? 0.03 : 0.05, 1.0, i % 3 ? 0.03 : 0.05, this.mat.steel);
    }
    this.rod([a[0], a[1] + 1.0, a[2]], [b[0], b[1] + 1.0, b[2]], 0.034, m);
    this.rod([a[0], a[1] + 0.66, a[2]], [b[0], b[1] + 0.66, b[2]], 0.017, this.mat.steel);
    this.rod([a[0], a[1] + 0.33, a[2]], [b[0], b[1] + 0.33, b[2]], 0.017, this.mat.steel);
  }
  lamp(x, z, h = 1.23, base = 0, head = this.mat.lamp) {
    this.box(x, base + h * 0.45, z, 0.13, h * 0.9, 0.13, this.mat.iron);
    this.box(x, base + h - 0.035, z, 0.19, 0.19, 0.19, head);
    this.box(x, base + h + 0.09, z, 0.235, 0.045, 0.235, this.mat.steel);
    this.collider(x, base + h / 2, z, 0.2, h, 0.2, { camera: false });
  }
  plate(text, sub, x, y, z, w, h, angle = 0, bg, fg) {
    const sign = textPlate(text, sub, w, h, bg, fg);
    sign.position.set(x, y, z);
    sign.rotation.y = angle;
    this.scene.add(sign);
    return sign;
  }
  // A plate on two posts, standing on the floor.
  sign(text, sub, x, z, angle = 0, base = 0) {
    this.plate(text, sub, x, base + 1.91, z, 2.14, 0.7, angle);
    const c = Math.cos(angle),
      s = Math.sin(angle);
    for (const off of [-0.96, 0.96]) {
      const px = x + off * c - 0.04 * s,
        pz = z - off * s - 0.04 * c;
      this.box(px, base + 1.03, pz, 0.072, 2.05, 0.095, this.mat.iron);
      this.collider(px, base + 1.03, pz, 0.14, 2.05, 0.14, { camera: false });
    }
  }
  // An overhead sign gantry: two posts, a crossbar and the plate hung beneath it.
  // facing is the plate's rotation; the posts stand along its width.
  gantry(text, sub, x, z, facing, span, top = 3.2, base = 0, w = 2.3, h = 0.72) {
    const c = Math.cos(facing),
      s = Math.sin(facing),
      m = this.mat;
    for (const side of [-1, 1]) {
      const px = x + (side * span * c) / 2,
        pz = z - (side * span * s) / 2;
      this.box(px, base + top / 2, pz, 0.16, top, 0.16, m.steel);
      this.box(px, base + 0.02, pz, 0.34, 0.04, 0.34, m.iron);
      this.collider(px, base + top / 2, pz, 0.2, top, 0.2, { camera: false });
      const hx = x + side * (w / 2 - 0.2) * c,
        hz = z - side * (w / 2 - 0.2) * s;
      this.turned(hx, base + top - 0.18, hz, 0.04, 0.22, 0.04, facing, m.iron);
    }
    this.turned(x, base + top, z, span + 0.24, 0.18, 0.18, facing, m.steel);
    this.turned(x, base + top + 0.13, z, span + 0.24, 0.06, 0.12, facing, m.ochre);
    this.plate(text, sub, x, base + top - 0.29 - h / 2, z, w, h, facing);
  }
  // Floor trench for cables: flush cover plates with edge angles and ribs, following a path.
  trench(points, width = 0.56) {
    const m = this.mat;
    for (let i = 0; i < points.length - 1; i++) {
      const [ax, az] = points[i],
        [bx, bz] = points[i + 1],
        len = Math.hypot(bx - ax, bz - az),
        yaw = Math.atan2(bx - ax, bz - az),
        cx = (ax + bx) / 2,
        cz = (az + bz) / 2,
        px = Math.cos(yaw),
        pz = -Math.sin(yaw);
      this.turned(cx, 0.006, cz, width, 0.012, len + width, yaw, m.iron);
      for (const side of [-1, 1]) this.turned(cx + (side * px * width) / 2, 0.01, cz + (side * pz * width) / 2, 0.045, 0.02, len + width, yaw, m.edge);
      const n = Math.floor(len / 0.8);
      for (let k = 1; k < n; k++) {
        const t = k / n;
        this.turned(ax + (bx - ax) * t, 0.0135, az + (bz - az) * t, width - 0.08, 0.004, 0.035, yaw, m.steel);
      }
    }
  }
  // A straight run of steps from (x0, y0, z0) at the bottom to (x1, y1, z1) at the top.
  flight({ x0, z0, x1, z1, y0, y1, width, steps, m = this.mat.grate, rails = [true, true], fence = [false, false] }) {
    const dx = x1 - x0,
      dz = z1 - z0,
      len = Math.hypot(dx, dz),
      yaw = Math.atan2(dx, dz),
      rise = (y1 - y0) / steps,
      run = len / steps,
      ux = dx / len,
      uz = dz / len,
      px = uz,
      pz = -ux;
    for (let i = 1; i <= steps; i++) {
      const t = (i - 0.5) / steps,
        cx = x0 + dx * t,
        cz = z0 + dz * t,
        top = y0 + rise * i;
      this.turned(cx, top - 0.045, cz, width, 0.09, run + 0.015, yaw, m);
      this.turned(cx - ux * run * 0.47, top - 0.06, cz - uz * run * 0.47, width, 0.04, 0.05, yaw, this.mat.ochreDark);
      this.collider(cx, top - 0.06, cz, width, 0.12, run + 0.02, { yaw, surface: 'metal', camera: false });
    }
    const half = width / 2;
    for (const side of [-1, 1]) {
      const ox = px * side * (half - 0.04),
        oz = pz * side * (half - 0.04);
      const sx = px * side * (half + 0.03),
        sz = pz * side * (half + 0.03);
      this.beam([x0 + sx, y0 - 0.12, z0 + sz], [x1 + sx, y1 - 0.12, z1 + sz], 0.06, 0.34, this.mat.steel);
      this.beam([x0 + sx, y0 + 0.03, z0 + sz], [x1 + sx, y1 + 0.03, z1 + sz], 0.1, 0.03, this.mat.iron);
      const idx = side < 0 ? 0 : 1;
      if (rails[idx])
        this.handrail([x0 + ox, y0 + rise * 0.5, z0 + oz], [x1 + ox, y1 + rise * 0.5, z1 + oz]);
      if (fence[idx])
        this.barrier(x0 + ox, z0 + oz, x1 + ox, z1 + oz, Math.min(y0, y1), Math.abs(y1 - y0) + 1.8);
    }
  }
  part(parent, x, y, z, w, h, d, m, shadow = true) {
    const o = new T.Mesh(this.boxGeo, m);
    o.scale.set(w, h, d);
    o.position.set(x, y, z);
    o.castShadow = shadow;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  }
  finish() {
    for (const { geom, material, matrices } of this.batches.values()) {
      const mesh = new T.InstancedMesh(geom, material, matrices.length);
      matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = !material.isMeshBasicMaterial;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      this.scene.add(mesh);
    }
    this.batches.clear();
  }
}
