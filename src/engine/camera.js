import * as T from '../../assets/three.module.min.js';

const clamp = T.MathUtils.clamp;
const UP = new T.Vector3(0, 1, 0);

// Third-person rig: orbit around a shoulder pivot, pulled in by anything solid behind it.
export class CameraRig {
  constructor(camera, physics) {
    this.camera = camera;
    this.physics = physics;
    this.yaw = 0;
    this.pitch = -0.08;
    this.distance = 4.3;
    this.shoulder = 0.42;
    this.pivot = new T.Vector3();
    this.dir = new T.Vector3();
    this.dest = new T.Vector3();
    this.look = new T.Vector3();
    this.ready = false;
    this.override = null;
    this.blend = 0;
    this.height = 1.48;
    this.lift = 0;
  }
  rotate(dx, dy) {
    this.yaw -= dx;
    this.pitch = clamp(this.pitch - dy, -1.25, 1.05);
  }
  snap() {
    this.ready = false;
  }
  // Frame a fixed shot (device close-ups, the finale). Pass null to return control.
  frame(shot) {
    this.override = shot;
  }
  update(dt, target, mode) {
    const cam = this.camera,
      c = Math.cos(this.yaw),
      s = Math.sin(this.yaw);
    const want = mode.distance ?? this.distance;
    this.distanceNow = T.MathUtils.damp(this.distanceNow ?? want, want, 4, dt);
    this.lift = T.MathUtils.damp(this.lift, mode.lift ?? 0, 3, dt);
    const pitch = this.pitch + (mode.tilt ?? 0);
    this.dir.set(-s * Math.cos(pitch), Math.sin(pitch), -c * Math.cos(pitch)).normalize();
    const sh = mode.shoulder ?? this.shoulder;
    this.pivot.set(target.x + c * sh, target.y + this.height + this.lift, target.z - s * sh);
    // Keep the pivot itself out of low ceilings.
    const head = this.physics.raycast(target.x, target.y + 1.2, target.z, 0, 1, 0, this.height + this.lift);
    if (head < this.height + this.lift - 0.2) this.pivot.y = target.y + 1.2 + Math.max(0.1, head - 0.25);
    const back = -1;
    let dist = this.distanceNow;
    const hit = this.physics.raycast(
      this.pivot.x,
      this.pivot.y,
      this.pivot.z,
      this.dir.x * back,
      this.dir.y * back,
      this.dir.z * back,
      dist + 0.3
    );
    dist = Math.min(dist, Math.max(0.35, hit - 0.25));
    this.dest.copy(this.pivot).addScaledVector(this.dir, -dist);
    if (this.dest.y < target.y + 0.25) this.dest.y = target.y + 0.25;
    this.blend = T.MathUtils.damp(this.blend, this.override ? 1 : 0, this.override?.speed ?? 2.6, dt);
    if (this.override && this.blend > 0.001) {
      const o = this.override;
      this.dest.lerp(o.position, this.blend);
      this.look.copy(this.pivot).addScaledVector(this.dir, 10).lerp(o.target, this.blend);
    } else this.look.copy(this.pivot).addScaledVector(this.dir, 10);
    if (!this.ready) {
      cam.position.copy(this.dest);
      this.ready = true;
    } else {
      const k = 1 - Math.exp(-(this.override ? 6 : 22) * dt);
      cam.position.lerp(this.dest, k);
      // Never trail behind a wall the rig just pulled in front of.
      if (!this.override && cam.position.distanceTo(this.pivot) > dist + 0.05) cam.position.copy(this.dest);
    }
    cam.up.copy(UP);
    cam.lookAt(this.look);
    cam.updateMatrixWorld();
    return cam.position.distanceTo(this.pivot);
  }
}
