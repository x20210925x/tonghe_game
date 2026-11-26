import * as T from '../../assets/three.module.min.js';
import { Body } from '../engine/physics.js';
import { makeWorker } from './worker.js';

const WALK = 2.15,
  RUN = 4.8,
  FLY = 9,
  CLIMB = 7,
  JUMP = 6.3,
  COYOTE = 0.12,
  BUFFER = 0.14;

// The inspector: a collision body, a rigged model and the feel of moving them together.
export class Player {
  constructor(atlas) {
    this.body = new Body();
    this.rig = makeWorker(atlas);
    this.group = this.rig.group;
    this.facing = 0;
    this.air = 0;
    this.crouch = 0;
    this.sinceGround = 0;
    this.jumpBuffer = 0;
    this.speed = 0;
    this.locked = false;
    this.speedScale = 1;
    this.flying = false;
  }
  setFlying(on, noclip = false) {
    const b = this.body;
    this.flying = on;
    b.flying = on;
    b.noclip = on && noclip;
    if (on) {
      b.grounded = false;
      b.ground = null;
      b.vy = 0;
    } else b.peak = b.y;
  }
  get pos() {
    return this.body;
  }
  place(x, y, z, facing = this.facing) {
    this.body.place(x, y, z);
    this.facing = facing;
    this.group.rotation.y = facing;
    this.group.position.set(x, y, z);
  }
  // move: { x, z } in camera space, yaw of the camera, run and jump intents.
  update(dt, physics, intent, yaw) {
    const b = this.body;
    let mx = this.locked ? 0 : intent.x,
      mz = this.locked ? 0 : intent.z;
    const mag = Math.hypot(mx, mz);
    if (mag > 1) {
      mx /= mag;
      mz /= mag;
    }
    const c = Math.cos(yaw),
      s = Math.sin(yaw);
    const wx = mx * c + mz * s,
      wz = mz * c - mx * s;
    if (this.flying) return this.fly(dt, physics, intent, wx, wz);
    // Pulling back walks backwards facing forward, a little slower, instead of turning round.
    const back = mz > 0.35;
    this.backing = back;
    const top = (intent.run ? RUN * (back ? 0.6 : 1) : WALK * (back ? 0.72 : 1)) * this.speedScale;
    const control = b.grounded ? 13 : 3.2;
    // Wind adds to the speed the inspector tries to hold: running into a gust holds ground.
    b.vx = T.MathUtils.damp(b.vx, wx * top + (intent.windX || 0), control, dt);
    b.vz = T.MathUtils.damp(b.vz, wz * top + (intent.windZ || 0), control, dt);
    if (intent.jump) this.jumpBuffer = BUFFER;
    else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.sinceGround = b.grounded ? 0 : this.sinceGround + dt;
    let jumped = false;
    if (this.jumpBuffer > 0 && this.sinceGround < COYOTE && !this.locked && b.vy <= 0.01) {
      b.jump(JUMP);
      this.jumpBuffer = 0;
      this.sinceGround = COYOTE;
      jumped = true;
    }
    const ox = b.x,
      oz = b.z;
    const landed = physics.move(b, dt);
    const ground = b.ground;
    const carryX = ground && ground.dynamic ? ground.dx : 0,
      carryZ = ground && ground.dynamic ? ground.dz : 0;
    const moved = Math.hypot(b.x - ox - carryX, b.z - oz - carryZ) / Math.max(dt, 1e-4);
    this.speed = T.MathUtils.damp(this.speed, moved * (back ? -1 : 1), 18, dt);
    // Face where the inspector walks, not where the wind shoves.
    const fx = b.vx - (intent.windX || 0),
      fz = b.vz - (intent.windZ || 0);
    if (Math.hypot(fx, fz) > 0.25 && moved > 0.08) {
      const want = back ? Math.atan2(fx, fz) : Math.atan2(-fx, -fz),
        diff = want - this.facing;
      this.facing += Math.atan2(Math.sin(diff), Math.cos(diff)) * (1 - Math.exp(-(b.grounded ? 13 : 5) * dt));
    }
    this.air = T.MathUtils.damp(this.air, b.grounded ? 0 : 1, b.grounded ? 16 : 7, dt);
    if (landed > 0.6) this.crouch = Math.min(1, landed / 3.5 + 0.35);
    this.crouch = T.MathUtils.damp(this.crouch, 0, 7, dt);
    this.group.position.set(b.x, b.y, b.z);
    this.group.rotation.y = this.facing;
    return { landed, jumped };
  }
  // Creative-style flight: no gravity, Space climbs, Shift sinks, touching ground lands.
  fly(dt, physics, intent, wx, wz) {
    const b = this.body,
      k = this.speedScale;
    b.vx = T.MathUtils.damp(b.vx, wx * FLY * k, 8, dt);
    b.vz = T.MathUtils.damp(b.vz, wz * FLY * k, 8, dt);
    b.vy = T.MathUtils.damp(b.vy, (Number(!!intent.up) - Number(!!intent.down)) * CLIMB * k, 9, dt);
    physics.move(b, dt);
    if (b.grounded && !b.noclip) this.setFlying(false);
    if (Math.hypot(b.vx, b.vz) > 0.25) {
      const diff = Math.atan2(-b.vx, -b.vz) - this.facing;
      this.facing += Math.atan2(Math.sin(diff), Math.cos(diff)) * (1 - Math.exp(-8 * dt));
    }
    this.speed = 0;
    this.air = T.MathUtils.damp(this.air, this.flying ? 0.55 : 0, 6, dt);
    this.group.position.set(b.x, b.y, b.z);
    this.group.rotation.y = this.facing;
    return { landed: 0, jumped: false };
  }
  animate(dt, time, hands = 0, opening = null) {
    const step = this.rig.animate(
      dt,
      this.body.grounded ? this.speed : 0,
      time,
      hands,
      opening,
      this.air,
      this.crouch
    );
    return step;
  }
}
