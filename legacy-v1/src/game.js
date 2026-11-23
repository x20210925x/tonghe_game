import * as T from '../../assets/three.module.min.js';
import { loadDaylight } from './daylight.js';
import { Inspection } from './inspection.js';
import { CART, VALVE, BRIDGE } from './machines.js';
import { SceneResolve } from './photography.js';
import { makeMaterials } from './materials.js';
import { buildWorld, canStand, LIFT, controlPoint } from './world.js';
import { makeWorker } from './worker.js';

const OBJECTIVES = [
  '打开检修门，进入泄洪廊',
  '沿检修灯前往动力间，合上电闸',
  '沿东侧检修道登上升降台',
  '随升降台前往上层观测台',
  '抵达观测栏杆，记录巡检',
];
const VERBS = ['打开检修门', '合上动力电闸', '启动升降台', '', '记录巡检'];
const Y_UP = new T.Vector3(0, 1, 0);
const clamp = T.MathUtils.clamp;
const $ = (id) => document.getElementById(id);

export class Game {
  static async create(sound, settings, callbacks) {
    const game = new Game(sound, settings, callbacks);
    try {
      const [m, atlas, daylight] = await Promise.all([
        makeMaterials(game.renderer),
        new T.TextureLoader().loadAsync('../assets/workwear.webp'),
        loadDaylight(game.renderer),
      ]);
      atlas.colorSpace = T.SRGBColorSpace;
      atlas.anisotropy = 4;
      game.world = buildWorld(game.scene, m, daylight);
      game.worker = makeWorker(atlas);
      game.scene.add(game.worker.group);
      game.quality();
      game.bind();
      return game;
    } catch (e) {
      game.renderer.dispose();
      game.canvas.remove();
      throw e;
    }
  }
  constructor(sound, settings, callbacks) {
    this.site = new Inspection();
    this.touchDrive = false;
    this.touchBrake = false;
    this.handUntil = 0;
    this.sound = sound;
    this.settings = settings;
    this.callbacks = callbacks;
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.canvas = this.renderer.domElement;
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute('aria-label', '三维巡检场景，可用 WASD 移动和方向键环视');
    $('viewport').append(this.canvas);
    this.scene = new T.Scene();
    this.scene.background = new T.Color(0xa4afa9);
    this.scene.fog = new T.FogExp2(0xa8b4bb, 0.00265);
    this.camera = new T.PerspectiveCamera(59, 1, 0.065, 1150);
    this.camera.userData.inspectionView = true;
    this.resolve = new SceneResolve(this.renderer, this.camera);
    this.keys = new Set();
    this.pos = new T.Vector3();
    this.vel = new T.Vector3();
    this.aim = new T.Vector3();
    this.dest = new T.Vector3();
    this.work = new T.Vector3();
    this.dir = new T.Vector3();
    this.hit = new T.Vector3();
    this.ray = new T.Ray();
    this.moveStick = { x: 0, y: 0 };
    this.active = false;
    this.runTouch = false;
    this.time = 0;
    this.stage = 0;
    this.frame = 0;
    this.lastTime = 0;
  }
  quality() {
    this.world.quality(this.settings.quality);
    const ratio =
      this.settings.quality === 'high' ? 1.65 : this.settings.quality === 'low' ? 0.86 : 1.19;
    this.baseRatio = Math.min(devicePixelRatio, ratio);
    this.frameScale = 1;
    this.slowFrames = 0;
    this.renderer.shadowMap.enabled = this.settings.quality !== 'low';
    this.resize();
  }
  resize() {
    const w = innerWidth,
      h = innerHeight;
    this.renderer.setPixelRatio(this.baseRatio * this.frameScale);
    this.renderer.setSize(w, h, false);
    this.resolve.resize(this.canvas.width, this.canvas.height);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  bind() {
    addEventListener('resize', () => this.resize());
    addEventListener('keydown', (e) => {
      if (!this.active || e.metaKey || e.ctrlKey || e.altKey) return;
      if (
        [
          'KeyW',
          'KeyS',
          'KeyA',
          'KeyD',
          'ShiftLeft',
          'ShiftRight',
          'ArrowLeft',
          'ArrowRight',
          'ArrowUp',
          'ArrowDown',
          'KeyE',
          'Escape',
        ].includes(e.code)
      ) {
        e.preventDefault();
        this.keys.add(e.code);
        if (this.site.atValve && (e.code === 'KeyA' || e.code === 'KeyD')) {
          this.turnValve((e.code === 'KeyD' ? 1 : -1) * (e.repeat ? 0.025 : 0.08));
          return;
        }
        if (e.code === 'KeyE' && !e.repeat) this.interact();
        if (e.code === 'Escape' && !e.repeat) this.callbacks.pause();
      }
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => {
      if (this.active) this.callbacks.pause();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.active) this.callbacks.pause();
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('pointerdown', (e) => {
      if (!this.active || this.drag) return;
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
      this.canvas.setPointerCapture(e.pointerId);
      this.canvas.style.cursor = 'grabbing';
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.active || this.drag?.id !== e.pointerId) return;
      this.rotate(e.clientX - this.drag.x, e.clientY - this.drag.y);
      this.drag.x = e.clientX;
      this.drag.y = e.clientY;
    });
    const release = (e) => {
      if (this.drag?.id === e.pointerId) {
        this.drag = null;
        this.canvas.style.cursor = 'grab';
      }
    };
    this.canvas.addEventListener('lostpointercapture', release);
    this.canvas.addEventListener('pointerup', release);
    this.canvas.addEventListener('pointercancel', release);
    const pad = $('touch-pad'),
      knob = pad.firstElementChild;
    const stick = (e) => {
      const r = pad.getBoundingClientRect();
      let x = (e.clientX - r.left - r.width / 2) / 35,
        y = (e.clientY - r.top - r.height / 2) / 35;
      const mag = Math.max(1, Math.hypot(x, y));
      x /= mag;
      y /= mag;
      this.moveStick = { x, y };
      knob.style.transform = 'translate(' + x * 29 + 'px,' + y * 29 + 'px)';
    };
    pad.addEventListener('pointerdown', (e) => {
      if (this.stickId != null) return;
      this.stickId = e.pointerId;
      pad.setPointerCapture(e.pointerId);
      stick(e);
    });
    pad.addEventListener('pointermove', (e) => {
      if (this.stickId === e.pointerId) stick(e);
    });
    pad.addEventListener('lostpointercapture', () => {
      this.stickId = null;
      this.moveStick = { x: 0, y: 0 };
      knob.style.transform = '';
    });
    $('touch-run').onclick = () => {
      this.runTouch = !this.runTouch;
      $('touch-run').setAttribute('aria-pressed', String(this.runTouch));
    };
    $('valve-open').onclick = () => this.turnValve(0.08);
    $('valve-close').onclick = () => this.turnValve(-0.08);
    for (const [id, prop] of [
      ['traction', 'touchDrive'],
      ['brake', 'touchBrake'],
    ]) {
      const b = $(id);
      b.onpointerdown = (e) => {
        b.setPointerCapture(e.pointerId);
        this[prop] = true;
      };
      b.onlostpointercapture =
        b.onpointerup =
        b.onpointercancel =
          () => {
            this[prop] = false;
          };
    }
    $('interaction').onclick = () => this.interact();
  }
  turnValve(amount) {
    if (!this.active || !this.site.atValve) return;
    this.site.turn(amount);
    this.sound.effect('detent');
  }
  rotate(dx, dy) {
    this.revealFree = true;
    const amount = 0.0038 * this.settings.sensitivity;
    this.yaw -= dx * amount;
    this.pitch = clamp(this.pitch - dy * amount, -0.83, 1.32);
  }
  reset() {
    this.pos.set(0, 0, 10.5);
    this.vel.set(0, 0, 0);
    this.yaw = 0;
    this.pitch = -0.055;
    this.worker.group.rotation.y = 0;
    this.stage = 0;
    this.surveyTime = 0;
    this.revealFree = false;
    this.liftHeight = 0;
    this.ride = 0;
    this.time = 0;
    this.site.restore();
    this.touchDrive = this.touchBrake = false;
    this.handUntil = 0;
    this.visited = new Set();
    this.area = '';
    this.runTouch = false;
    $('touch-run').setAttribute('aria-pressed', 'false');
    this.world.door.position.x = 0;
    this.cameraReady = false;
    this.bannerUntil = 0;
    $('zone-banner').classList.remove('show');
    this.nextSave = 2;
    this.syncHUD();
  }
  restore(data) {
    this.reset();
    if (
      data &&
      Number.isInteger(data.stage) &&
      data.stage >= 0 &&
      data.stage <= 4 &&
      Number.isFinite(data.x) &&
      Number.isFinite(data.z) &&
      (canStand(data.x, data.z, data.stage) ||
        (data.stage === 1 && Math.abs(data.x - VALVE.x) < 1.05 && Math.abs(data.z - VALVE.z) < 0.68))
    ) {
      this.stage = data.stage;
      this.site.restore(data.site || {}, data.stage, data.x, data.z);
      this.pos.set(data.x, 0, data.z);
      if (this.site.aboard) this.pos.set(CART.x, CART.deck, this.site.cartZ - 0.41);
      else if (!canStand(this.pos.x, this.pos.z, this.stage, this.site)) {
        if (Math.abs(this.pos.x - CART.x) < 1.1 && Math.abs(this.pos.z - this.site.cartZ) < 2)
          this.pos.x = CART.x - 1.55;
        else if (Math.abs(this.pos.z - VALVE.z) < 1) this.pos.z = VALVE.z + 1.1;
        else this.pos.z += 1.4;
      }
      this.yaw = Number.isFinite(data.yaw) ? data.yaw : 0;
      this.time = Number.isFinite(data.time) ? Math.max(0, data.time) : 0;
      this.ride = clamp(Number(data.ride) || 0, 0, 31);
      this.liftHeight = this.stage === 4 ? LIFT.top : this.stage === 3 ? this.rideHeight() : 0;
      this.pos.y = this.site.aboard ? CART.deck : this.liftHeight;
      this.world.door.position.x = this.stage > 0 ? -2.31 : 0;
      this.syncHUD();
    }
  }
  save() {
    if (this.stage <= 4)
      this.callbacks.save({
        stage: this.stage,
        x: this.pos.x,
        z: this.pos.z,
        yaw: this.yaw,
        time: this.time,
        ride: this.ride,
        site: this.site.snapshot(),
      });
  }
  resume() {
    if (this.active) return;
    this.active = true;
    this.lastTime = performance.now();
    this.nextSave = this.time + 2;
    this.keys.clear();
    this.canvas.style.cursor = 'grab';
    this.canvas.focus({ preventScroll: true });
    this.sound.start();
    this.frame = requestAnimationFrame((t) => this.tick(t));
  }
  pause() {
    if (!this.active) return;
    this.active = false;
    cancelAnimationFrame(this.frame);
    this.keys.clear();
    this.vel.set(0, 0, 0);
    if (this.drag && this.canvas.hasPointerCapture(this.drag.id))
      this.canvas.releasePointerCapture(this.drag.id);
    if (this.stickId != null && $('touch-pad').hasPointerCapture(this.stickId))
      $('touch-pad').releasePointerCapture(this.stickId);
    this.drag = null;
    this.moveStick = { x: 0, y: 0 };
    this.touchDrive = this.touchBrake = false;
    this.sound.idle();
    this.save();
  }
  target() {
    if (this.stage === 0) return [0, 1.25, 4.1];
    if (this.stage === 1) {
      if (!this.site.regulated) return [VALVE.x, 1.28, VALVE.z + 0.4];
      if (this.pos.x < 13.5 && this.pos.z > -89) return [BRIDGE.x, 1.0, BRIDGE.z];
      return [controlPoint.x, 1.6, controlPoint.z - 0.7];
    }
    if (this.stage === 2) {
      if (!this.site.aboard && this.site.cartZ > CART.end + 1 && this.pos.z > this.site.cartZ - 5)
        return [CART.x, 1.4, this.site.cartZ];
      return [LIFT.x, 1.1, LIFT.z];
    }
    if (this.stage === 4)
      return this.pos.z > -274 && this.pos.x > 71.5
        ? [80, LIFT.top + 1.0, -279]
        : [54.6, LIFT.top + 1.3, -275.9];
    return null;
  }
  device() {
    const near = (x, z, r) => Math.hypot(this.pos.x - x, this.pos.z - z) < r;
    if (this.site.atValve) return 'leave-valve';
    if (this.site.aboard) return 'dismount';
    if (this.stage === 1 && !this.site.regulated && near(VALVE.x, VALVE.z, 2.65)) return 'valve';
    if (this.stage === 2 && this.site.cartZ > CART.end + 0.3 && near(CART.x, this.site.cartZ, 3.1))
      return 'cart';
    if (this.stage === 0 && near(0, 4.1, 2.35)) return 'door';
    if (this.stage === 1 && this.site.regulated && near(78, -120, 3)) return 'breaker';
    if (this.stage === 2 && near(LIFT.x, LIFT.z, 3.15)) return 'lift';
    if (this.stage === 4 && near(54.6, -275.9, 3)) return 'record';
    return null;
  }
  closeEnough() {
    return !!this.device();
  }
  interact() {
    if (!this.active) return;
    const device = this.device();
    if (!device) return;
    if (device === 'valve') {
      this.valveView = { yaw: this.yaw, pitch: this.pitch };
      this.site.atValve = true;
      this.site.hold = 0;
      this.pos.set(VALVE.x - 0.25, 0, VALVE.z + 1.03);
      this.vel.set(0, 0, 0);
      this.worker.group.rotation.y = 0;
      this.yaw = 0.63;
      this.pitch = -0.13;
      this.syncHUD();
      return;
    }
    if (device === 'leave-valve') {
      this.site.atValve = false;
      this.yaw = this.valveView.yaw;
      this.pitch = this.valveView.pitch;
      this.site.hold = 0;
      this.syncHUD();
      this.save();
      return;
    }
    if (device === 'cart') {
      this.site.aboard = true;
      this.site.stopping = false;
      this.site.cartSpeed = 0;
      this.vel.set(0, 0, 0);
      this.worker.group.rotation.y = 0;
      this.yaw = 0;
      this.pitch = -0.07;
      this.sound.effect('board');
      this.syncHUD();
      this.save();
      return;
    }
    if (device === 'dismount') {
      this.site.stopping = true;
      return;
    }
    this.handUntil = this.time + 0.65;
    if (this.stage === 4) {
      this.stage = 5;
      this.surveyTime = this.time;
      this.revealYaw = Math.atan2(this.pos.x, this.pos.z - 4.1);
      this.revealFree = false;
      this.syncHUD();
      this.sound.effect('arrive');
      return;
    }
    this.sound.effect(['door', 'power', 'lift'][this.stage]);
    this.stage++;
    if (this.stage === 2) this.announce('轨车与升降井已通电');
    if (this.stage === 3) {
      this.ride = 0;
      this.announce('升降台上行');
    }
    this.syncHUD();
    this.save();
  }
  announce(text) {
    $('zone-banner').textContent = text;
    $('zone-banner').classList.add('show');
    this.bannerUntil = this.time + 3.5;
  }
  syncHUD() {
    const site = this.site;
    $('valve-panel').hidden = !site.atValve;
    $('cart-panel').hidden = !site.aboard;
    $('play-screen').classList.toggle('at-machine', site.atValve || site.aboard);
    let task = OBJECTIVES[this.stage] || '巡检完成';
    if (this.stage === 1)
      task = site.regulated ? '通过泄压闸，沿斜桥前往动力间' : '到闸前调节旁通阀，为通行闸泄压';
    if (site.atValve) task = '将压力稳定在 0.60 至 0.72 MPa';
    if (this.stage === 2 && !site.aboard && site.cartZ > CART.end + 0.2)
      task = '搭乘轨车或沿东侧检修道前往升降井';
    if (site.aboard) task = '驾驶轨车前往升降井';
    $('objective-text').textContent = task;
    $('interaction').hidden = true;
  }
  rideHeight() {
    const t = clamp(this.ride / 31, 0, 1);
    return LIFT.top * t * t * (3 - 2 * t);
  }
  step(dt) {
    this.time += dt;
    if (this.stage === 5) {
      if (this.time - this.surveyTime >= 3.8) {
        this.pause();
        this.callbacks.complete(this.surveyTime);
        return;
      }
      if (!this.revealFree) {
        const delta = this.revealYaw - this.yaw;
        this.yaw += Math.atan2(Math.sin(delta), Math.cos(delta)) * (1 - Math.exp(-1.55 * dt));
        this.pitch = T.MathUtils.damp(this.pitch, -0.3, 1.8, dt);
        const turn = this.revealYaw - this.worker.group.rotation.y;
        this.worker.group.rotation.y +=
          Math.atan2(Math.sin(turn), Math.cos(turn)) * (1 - Math.exp(-2.2 * dt));
      }
    }
    const left = this.keys.has('ArrowLeft'),
      right = this.keys.has('ArrowRight'),
      up = this.keys.has('ArrowUp'),
      down = this.keys.has('ArrowDown');
    this.yaw += (Number(left) - Number(right)) * dt * 1.58 * this.settings.sensitivity;
    this.pitch = clamp(this.pitch + (Number(up) - Number(down)) * dt * 1.15, -0.83, 1.32);
    let x = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA')) + this.moveStick.x,
      z = Number(this.keys.has('KeyS')) - Number(this.keys.has('KeyW')) + this.moveStick.y;
    if (this.stage === 5) {
      x = 0;
      z = 0;
    }
    if (this.site.atValve || this.site.aboard) {
      x = 0;
      z = 0;
    }
    const mag = Math.max(1, Math.hypot(x, z));
    x /= mag;
    z /= mag;
    const run = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.runTouch;
    const speed = run ? 4.65 : 2.08,
      c = Math.cos(this.yaw),
      s = Math.sin(this.yaw);
    this.vel.x = T.MathUtils.damp(this.vel.x, (x * c + z * s) * speed, 12, dt);
    this.vel.z = T.MathUtils.damp(this.vel.z, (z * c - x * s) * speed, 12, dt);
    const oldX = this.pos.x,
      oldZ = this.pos.z;
    const nx = this.pos.x + this.vel.x * dt,
      nz = this.pos.z + this.vel.z * dt;
    if (canStand(nx, this.pos.z, this.stage, this.site)) this.pos.x = nx;
    if (canStand(this.pos.x, nz, this.stage, this.site)) this.pos.z = nz;
    const dist = Math.hypot(this.pos.x - oldX, this.pos.z - oldZ),
      actual = dist / Math.max(0.0001, dt);
    if (actual > 0.09) {
      const desired = Math.atan2(-this.vel.x, -this.vel.z),
        diff = desired - this.worker.group.rotation.y;
      this.worker.group.rotation.y +=
        Math.atan2(Math.sin(diff), Math.cos(diff)) * (1 - Math.exp(-13 * dt));
    }
    const machineryEvent = this.site.step(
      dt,
      this.keys.has('KeyW') || this.touchDrive,
      this.keys.has('KeyS') || this.touchBrake
    );
    if (machineryEvent === 'release') {
      this.yaw = this.valveView.yaw;
      this.pitch = this.valveView.pitch;
      this.sound.effect('gate');
      this.announce('压力稳定 · 通行闸开启');
      this.syncHUD();
      this.save();
    }
    if (this.site.aboard) this.pos.set(CART.x, CART.deck, this.site.cartZ - 0.41);
    if (machineryEvent === 'dock' || machineryEvent === 'step-off') {
      this.pos.set(CART.x - 1.55, 0, this.site.cartZ);
      this.vel.set(0, 0, 0);
      this.touchDrive = this.touchBrake = false;
      this.sound.effect('board');
      this.syncHUD();
      this.save();
      if (machineryEvent === 'dock') this.announce('到站 · 升降井');
    }
    if (this.stage === 3) {
      this.ride += dt;
      this.liftHeight = this.rideHeight();
      if (this.ride >= 31) {
        this.stage = 4;
        this.liftHeight = LIFT.top;
        this.sound.effect('arrive');
        this.announce('上层观测台');
        this.syncHUD();
        this.save();
      }
    }
    this.pos.y = this.site.aboard ? CART.deck : this.liftHeight;
    this.worker.group.position.copy(this.pos);
    const operating = this.site.atValve || this.site.aboard || this.time < this.handUntil;
    if (
      this.worker.animate(
        dt,
        actual,
        this.time,
        Number(operating),
        this.site.atValve ? this.site.opening : null
      )
    )
      this.sound.step((this.pos.x > 13 && this.pos.x < 70) || this.stage === 3, run);
    this.cameraStep(dt, c, s);
    this.world.update(dt, this.time, this.pos, this.camera, this.stage, this.liftHeight, this.site);
    this.sound.update(this.pos.x, this.pos.z, this.yaw, this.stage, this.time, this.site);
    if (this.time > this.nextSave) {
      this.save();
      this.nextSave = this.time + 2;
    }
    this.hud();
  }
  cameraStep(dt, c, s) {
    const indoors = this.pos.z > 2 && Math.abs(this.pos.x) < 4.5;
    const d = this.site.atValve ? 3.1 : this.site.aboard ? 5.3 : indoors ? 3.18 : 6.4,
      pitch = this.pitch + (indoors ? 0 : 0.09);
    this.dir.set(-s * Math.cos(pitch), Math.sin(pitch), -c * Math.cos(pitch)).normalize();
    const overlook =
      this.stage === 5 && !this.revealFree
        ? T.MathUtils.smoothstep(this.time - this.surveyTime, 0, 2.7)
        : 0;
    const shoulder = 0.38 + overlook * 1.02;
    this.aim.set(
      this.pos.x + c * shoulder,
      this.pos.y + 1.39 + overlook * 2.0,
      this.pos.z - s * shoulder
    );
    this.dest.copy(this.aim).addScaledVector(this.dir, -d);
    const outsideRail = !indoors && !canStand(this.dest.x, this.dest.z, this.stage);
    this.dest.y = Math.max(this.pos.y + (outsideRail ? 1.58 : 0.22), this.dest.y + 0.16);
    this.work.subVectors(this.dest, this.aim);
    let distance = this.work.length();
    this.ray.set(this.aim, this.work.normalize());
    for (const box of this.world.collision) {
      if (this.ray.intersectBox(box, this.hit))
        distance = Math.min(distance, Math.max(0.23, this.hit.distanceTo(this.aim) - 0.18));
    }
    if (this.stage === 0) {
      const dz = this.ray.direction.z;
      if (Math.abs(dz) > 0.001) {
        const t = (4.12 - this.aim.z) / dz;
        if (t > 0 && t < distance && Math.abs(this.aim.x + this.ray.direction.x * t) < 1.2)
          distance = Math.max(0.2, t - 0.15);
      }
    }
    this.dest.copy(this.aim).addScaledVector(this.work, distance);
    if (!this.cameraReady) {
      this.camera.position.copy(this.dest);
      this.cameraReady = true;
    } else {
      this.camera.position.lerp(this.dest, 1 - Math.exp(-19 * dt));
      if (this.camera.position.distanceTo(this.aim) > distance + 0.01)
        this.camera.position.copy(this.dest);
    }
    this.work.copy(this.camera.position).add(this.dir);
    this.camera.up.copy(Y_UP);
    this.camera.lookAt(this.work);
    this.camera.updateMatrixWorld();
    this.worker.group.visible = this.camera.position.distanceTo(this.pos) > 0.85;
  }
  hud() {
    const pos = this.pos;
    const area =
      this.stage >= 4
        ? '上层观测台'
        : this.stage === 3
          ? '升降井'
          : pos.z > 3.85
            ? '值班室'
            : pos.x > 72 && pos.z < -135
              ? '东侧检修道'
              : pos.x > 69
                ? '动力间'
                : pos.x > 14
                  ? '肋间栈桥'
                  : '泄洪廊';
    if (area !== this.area) {
      if (this.area && !this.visited.has(area) && this.stage !== 3 && this.stage !== 4)
        this.announce(area);
      this.area = area;
      this.visited.add(area);
      $('area-name').textContent = area;
      $('area-code').textContent =
        this.stage >= 4 ? 'UPPER DECK' : this.stage === 3 ? 'SHAFT L-01' : 'SECTOR 01';
    }
    if (this.time > (this.bannerUntil || 0)) $('zone-banner').classList.remove('show');
    $('height').textContent = '+' + this.pos.y.toFixed(1).padStart(5, '0');
    $('entry-tip').hidden = this.time > 14 || this.stage > 0;
    const device = this.device(),
      show = !!device;
    if (this.site.atValve) {
      $('pressure-reading').value = this.site.pressure.toFixed(2) + ' MPa';
      $('pressure-stability').textContent = this.site.hold > 0 ? '正在稳压…' : '目标 0.60–0.72 MPa';
    }
    if (this.site.aboard) {
      $('cart-speed').value = (this.site.cartSpeed * 3.6).toFixed(0) + ' km/h';
      $('cart-range').value = Math.ceil(this.site.cartZ - CART.end) + ' m';
    }

    $('interaction').hidden = !show;
    if (show)
      $('interaction').lastElementChild.textContent =
        {
          valve: '操作旁通阀',
          'leave-valve': '松开手轮',
          cart: '登上检修轨车',
          dismount: this.site.cartSpeed > 0.2 ? '停车并下车' : '下车',
        }[device] || VERBS[this.stage];
    const tar = this.target(),
      marker = $('marker');
    marker.hidden = !tar || show || !this.settings.marker;
    if (!marker.hidden) {
      this.work.set(...tar);
      const dist = this.work.distanceTo(this.aim);
      this.work.project(this.camera);
      let x = this.work.x,
        y = this.work.y;
      const behind = this.work.z > 1;
      if (behind) {
        x = -x;
        y = -y;
        if (Math.abs(x) < 0.05) x = 1;
      }
      const outside = behind || Math.abs(x) > 0.85 || Math.abs(y) > 0.65;
      if (outside) {
        const scale = Math.max(Math.abs(x) / 0.85, Math.abs(y) / 0.65, 0.001);
        x /= scale;
        y /= scale;
      }
      marker.classList.toggle('edge', outside);
      marker.style.left = (x * 0.5 + 0.5) * 100 + '%';
      marker.style.top = (-y * 0.5 + 0.5) * 100 + '%';
      marker.lastElementChild.textContent = Math.round(dist) + ' m';
    }
  }
  tick(now) {
    if (!this.active) return;
    const elapsed = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (elapsed > 0.046) this.slowFrames++;
    else this.slowFrames = Math.max(0, this.slowFrames - 3);
    if (this.slowFrames > 36 && this.frameScale > 0.67) {
      this.frameScale = Math.max(0.66, this.frameScale - 0.14);
      this.slowFrames = 0;
      this.resize();
    }
    const dt = clamp(elapsed, 0.001, 0.1);
    this.step(dt);
    this.resolve.render(this.scene, this.camera, this.settings.quality);
    this.frame = requestAnimationFrame((t) => this.tick(t));
  }
}
