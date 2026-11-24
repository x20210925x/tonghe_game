import * as T from '../../assets/three.module.min.js';
import { Physics } from '../engine/physics.js';
import { Input } from '../engine/input.js';
import { CameraRig } from '../engine/camera.js';
import { Player } from '../actor/player.js';
import { loadDaylight } from '../render/daylight.js';
import { makeMaterials } from '../render/materials.js';
import { SceneResolve } from '../render/post.js';
import { installShadowCascade } from '../render/cascade.js';
import { buildWorld } from '../world/world.js';
import { drawDial } from '../world/machines.js';
import { CALL_PANELS } from '../world/coreworks.js';
import { Site, BAND, HOLD_TIME } from './site.js';
import { objective } from './quest.js';
import { gustAt, windExposure, refugeBehind, GUST, PUMP } from './flood.js';
import { ARCHIVES, archivesOf, chapterOf } from './lore.js';
import * as L from './layout.js';

const $ = (id) => document.getElementById(id);
const clamp = T.MathUtils.clamp;
const SAVE_VERSION = 2;

// Where to stand if a save points at empty air, by how far the story has gone.
const CHECKPOINTS = [
  ['crown', [81, L.LEVEL.CROWN, -272, Math.PI]],
  ['console', [70, L.LEVEL.L2, -287, -Math.PI / 2]],
  ['stall', [72, L.LEVEL.L1, -293, -Math.PI / 2]],
  ['core', [81, 0, -275, 0]],
  ['main', [80, 0, -128, 0]],
  ['hall', [74, 0, -116, 0]],
  ['valve', [2, 0, -40, 0]],
  ['door', [0, 0, 0, 0]],
];
// Chapter two's checkpoints, latest first: on the crest outside the last room worked, the
// crest end of the bridge, or inside the north door. Its start is the control level.
const CHECKPOINTS2 = [
  ['g2', [103, 96, -470.5, -Math.PI / 2]],
  ['junction', [91, 96, -470.5, -Math.PI / 2]],
  ['g1', [80, 96, -470.5, -Math.PI / 2]],
  ['crest', [67, 96, -469.5, -Math.PI / 2]],
  ['ndoor', [65.5, 96, -298.5, 0]],
];
const spawnOf = (chapter) => {
  const s = chapter === 2 ? L.CH2_SPAWN : L.SPAWN;
  return [s.x, s.y, s.z, s.yaw];
};

export class Game {
  static async create(sound, settings, callbacks) {
    const game = new Game(sound, settings, callbacks);
    try {
      const [mat, atlas, daylight] = await Promise.all([
        makeMaterials(game.renderer),
        new T.TextureLoader().loadAsync('assets/workwear.webp'),
        loadDaylight(game.renderer),
      ]);
      atlas.colorSpace = T.SRGBColorSpace;
      atlas.anisotropy = 4;
      game.world = buildWorld(game.scene, mat, daylight, game.physics);
      game.player = new Player(atlas);
      game.scene.add(game.player.group);
      game.world.weather.attach(game.player);
      game.quality();
      game.bind();
      game.renderer.compile(game.scene, game.camera);
      return game;
    } catch (e) {
      game.renderer.dispose();
      game.canvas.remove();
      throw e;
    }
  }
  constructor(sound, settings, callbacks) {
    installShadowCascade();
    this.sound = sound;
    this.settings = settings;
    this.callbacks = callbacks;
    this.site = new Site();
    this.physics = new Physics();
    this.renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: false });
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.canvas = this.renderer.domElement;
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute('aria-label', '三维巡检场景');
    $('viewport').append(this.canvas);
    this.scene = new T.Scene();
    this.scene.background = new T.Color(0xa4afa9);
    this.fogOut = new T.Color(0xa8b4bb);
    this.fogIn = new T.Color(0x232624);
    this.scene.fog = new T.FogExp2(this.fogOut.clone(), 0.00265);
    this.camera = new T.PerspectiveCamera(60, 1, 0.1, 1500);
    this.camera.userData.inspectionView = true;
    this.post = new SceneResolve(this.renderer, this.camera);
    this.rig = new CameraRig(this.camera, this.physics);
    this.input = new Input(this.canvas, settings);
    this.active = false;
    this.frame = 0;
    this.lastTime = 0;
    this.work = new T.Vector3();
    this.head = new T.Vector3();
    this.rain = new T.Vector3();
    this.mode = 'walk';
    this.hud = {};
    this.moveYaw = null;
    this.chapter = 1;
  }
  quality() {
    const q = this.settings.quality;
    this.world.quality(q);
    this.baseRatio = Math.min(devicePixelRatio, q === 'high' ? 1.65 : q === 'low' ? 0.86 : 1.19);
    this.frameScale = 1;
    this.slowFrames = 0;
    this.renderer.shadowMap.enabled = q !== 'low';
    this.world.refreshShadows();
    this.resize();
  }
  resize() {
    if (!this.world) return;
    const w = innerWidth,
      h = innerHeight;
    this.renderer.setPixelRatio(this.baseRatio * this.frameScale);
    this.renderer.setSize(w, h, false);
    this.post.resize(this.canvas.width, this.canvas.height);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 0.8 ? 70 : 60;
    this.camera.updateProjectionMatrix();
  }
  bind() {
    addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.active) this.callbacks.pause();
    });
    this.input.onUnlock = () => {
      if (this.active && this.mode !== 'cinematic') this.callbacks.pause();
    };
    this.input.bindStick($('touch-pad'), $('touch-pad').firstElementChild);
    this.input.bindHold($('valve-close'), 'x', -1);
    this.input.bindHold($('valve-open'), 'x', 1);
    this.input.bindHold($('traction'), 'z', -1);
    this.input.bindHold($('brake'), 'z', 1);
    $('touch-run').onclick = () => {
      this.input.touchRun = !this.input.touchRun;
      $('touch-run').setAttribute('aria-pressed', String(this.input.touchRun));
    };
    $('touch-jump').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.input.tap('Space');
    });
    $('interaction').onclick = () => this.input.tap('KeyE');
    $('pump-stroke').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.input.tap('KeyE');
    });
    this.interactables = this.makeInteractables();
  }

  // ---------- Lifecycle ----------
  reset(chapter = this.chapter) {
    this.chapter = chapter === 2 ? 2 : 1;
    this.site.reset(this.chapter);
    this.mode = 'walk';
    this.time = 0;
    this.handUntil = 0;
    this.safe = [];
    this.visited = new Set();
    this.area = '';
    this.bannerUntil = 0;
    this.respawning = 0;
    this.endingAt = -1;
    this.maxHeight = 0;
    this.nextSave = 3;
    this.lastLook = 0;
    this.detent = 0;
    this.hintKey = '';
    this.inside = undefined;
    this.lastTap = -1;
    this.moveYaw = null;
    this.windClock = 0;
    this.gust = gustAt(0);
    this.exposed = 0;
    this.failSpot = null;
    this.fallSpot = null;
    this.player.setFlying(false);
    const spawn = spawnOf(this.chapter);
    this.player.place(...spawn);
    this.player.locked = false;
    this.rig.yaw = spawn[3];
    this.rig.pitch = -0.06;
    this.rig.frame(null);
    this.rig.blend = 0;
    this.rig.snap();
    this.input.touchRun = false;
    $('touch-run').setAttribute('aria-pressed', 'false');
    $('zone-banner').classList.remove('show');
    $('fade').classList.remove('show');
    this.hud = {};
    // Chapter two is one long night of rain, lit by a helmet lamp.
    this.world.weather.set(this.chapter === 2 ? 'storm' : 'day', true);
    this.world.weather.lampOn = this.chapter === 2;
    this.world.refreshShadows();
  }
  // A save only resumes the chapter it was written in; otherwise the chapter starts fresh.
  restore(data, chapter = data?.chapter ?? 1) {
    this.reset(chapter);
    if (!data || data.v !== SAVE_VERSION || (data.chapter ?? 1) !== this.chapter) return;
    this.site.restore(data.site || {}, this.chapter);
    const p = data.player || {};
    let spot = null;
    if ([p.x, p.y, p.z].every(Number.isFinite) && this.supported(p.x, p.y, p.z)) spot = [p.x, p.y, p.z, Number(p.yaw) || 0];
    if (!spot) spot = this.checkpoint();
    this.player.place(spot[0], spot[1], spot[2], spot[3]);
    this.rig.yaw = Number.isFinite(data.cam?.yaw) ? data.cam.yaw : spot[3];
    this.rig.pitch = Number.isFinite(data.cam?.pitch) ? clamp(data.cam.pitch, -1.2, 1) : -0.06;
    this.maxHeight = Number(data.maxHeight) || 0;
    for (const a of data.visited || []) this.visited.add(a);
    this.time = this.site.time;
    this.nextSave = this.time + 3;
    this.world.refreshShadows();
  }
  checkpoint() {
    const list = this.chapter === 2 ? CHECKPOINTS2 : CHECKPOINTS;
    return list.find(([flag]) => this.site.has(flag))?.[1] || spawnOf(this.chapter);
  }
  supported(x, y, z) {
    const list = this.physics.near(x - 1, x + 1, z - 1, z + 1, []);
    const s = this.physics.support(list, x, z, y + 0.3, 0.2);
    return !!s && Math.abs(s.h - y) < 0.35;
  }
  snapshot() {
    const last = this.safe.at(-1);
    const b = this.player.body;
    const spot = last || { x: b.x, y: b.y, z: b.z };
    return {
      v: SAVE_VERSION,
      chapter: this.chapter,
      site: this.site.snapshot(),
      player: { x: spot.x, y: spot.y, z: spot.z, yaw: this.player.facing },
      cam: { yaw: this.rig.yaw, pitch: this.rig.pitch },
      maxHeight: this.maxHeight,
      visited: [...this.visited],
    };
  }
  save() {
    if (this.mode === 'valve') this.site.atValve = false;
    this.callbacks.save(this.snapshot());
    if (this.mode === 'valve') this.site.atValve = true;
  }
  resume() {
    if (this.active) return;
    this.active = true;
    this.lastTime = performance.now();
    this.input.enabled = true;
    this.input.reset();
    this.input.lock();
    this.canvas.focus({ preventScroll: true });
    this.sound.start();
    this.frame = requestAnimationFrame((t) => this.tick(t));
  }
  pause(quiet = false) {
    if (!this.active) return;
    this.active = false;
    cancelAnimationFrame(this.frame);
    this.input.enabled = false;
    this.input.reset();
    this.input.unlock();
    if (!quiet) this.sound.idle();
    if (this.mode !== 'cinematic') this.save();
  }
  stats() {
    return {
      chapter: this.chapter,
      time: this.site.time,
      found: this.found(),
      total: archivesOf(this.chapter).length,
      height: this.maxHeight,
      fails: this.site.fails,
    };
  }
  found() {
    return this.site.archives.filter((id) => chapterOf(id) === this.chapter).length;
  }
  freeRoam() {
    this.mode = 'walk';
    this.rig.frame(null);
    this.player.locked = false;
  }

  // ---------- Interaction ----------
  makeInteractables() {
    const s = this.site,
      list = [];
    const add = (o) => list.push(o);
    const off = (text) => ({ text, disabled: true });
    add({
      pos: () => [L.DOOR.x, 0, L.DOOR.z + 0.6],
      r: 2.2,
      label: () => !s.has('door') && '打开检修门',
      act: () => {
        s.set('door');
        this.sound.effect('door');
        this.save();
      },
    });
    for (const a of ARCHIVES) {
      const spot = L.ARCHIVE_SPOTS[a.id];
      add({
        pos: () => [spot.x, spot.base, spot.z],
        r: a.id === 'a1' ? 1.9 : 1.7,
        dy: 2.4,
        label: () =>
          s.chapter === chapterOf(a.id) && !s.found(a.id) && (a.id === 'a1' ? '阅读巡检工单' : '查看档案 · ' + a.title),
        act: () => this.readArchive(a.id),
      });
    }
    add({
      pos: () => [L.VALVE.x, 0, L.VALVE.z + 0.9],
      r: 2.3,
      label: () => !s.has('valve') && '操作旁通阀',
      act: () => this.enterValve(),
    });
    for (const sw of L.SWITCHES) {
      const fx = sw.x + Math.sin(sw.face) * 0.9,
        fz = sw.z + Math.cos(sw.face) * 0.9;
      add({
        pos: () => [fx, sw.y, fz],
        r: 1.8,
        label: () => !s.has(sw.id) && '合上隔离开关',
        act: () => {
          s.set(sw.id);
          this.sound.effect('switch');
          const n = s.switchesClosed;
          this.announce(n === 3 ? '隔离开关已全部合上' : `隔离开关 ${n}/3`);
          this.save();
        },
      });
    }
    add({
      pos: () => [L.BREAKER.x, 0, L.BREAKER.z + 1.1],
      r: 2.4,
      label: () => !s.has('main') && (s.switchesClosed === 3 ? '合上动力总闸' : off(`总闸联锁 · 隔离开关 ${s.switchesClosed}/3`)),
      act: () => {
        s.set('main');
        this.sound.effect('power');
        this.announce('供电恢复 · 轨车与砼核已通电');
        this.save();
      },
    });
    add({
      pos: () => [L.CART.x, 0, s.cartZ],
      r: 2.9,
      label: () =>
        !s.aboard && s.cartZ > L.CART.end + 0.5 && this.mode === 'walk' && (s.has('main') ? '登上检修轨车' : off('轨车无电')),
      act: () => this.board(),
    });
    add({
      pos: () => [L.LIFT.cx + L.LIFT_PANEL.dx, s.liftY, L.LIFT.cz + L.LIFT_PANEL.dz],
      r: 1.9,
      label: () => {
        if (!s.has('main')) return off('升降台 · 无电');
        if (s.liftMoving) return null;
        const d = s.liftDestination();
        if (d === null) return off('上段供电中断');
        return d === 0 ? '下行至底层' : d === L.LEVEL.CROWN ? '上行至冠顶' : '启动升降台 · 上行';
      },
      act: () => {
        const d = s.liftDestination();
        if (d !== null && s.callLift(d)) this.sound.effect('lift');
      },
    });
    for (const c of CALL_PANELS) {
      add({
        pos: () => [c.x, c.y, c.z],
        r: 1.6,
        label: () => {
          if (!s.has('main') || s.liftMoving || s.liftY === c.y) return null;
          return s.allowedStop(c.y) ? '呼叫升降台' : off('呼叫无效 · 该段未通电');
        },
        act: () => {
          if (s.callLift(c.y)) this.sound.effect('lift');
        },
      });
    }
    add({
      pos: () => [L.CONSOLE.x + 1.1, L.CONSOLE.y, L.CONSOLE.z],
      r: 2.1,
      label: () => !s.has('console') && '重启砼核',
      act: () => {
        s.set('console');
        this.sound.effect('restart');
        this.announce('砼核重启');
        this.save();
      },
    });
    add({
      pos: () => [L.RECORD.x, L.RECORD.y, L.RECORD.z - 1.1],
      r: 2.2,
      label: () => s.chapter === 1 && !s.has('record') && '记录巡检',
      act: () => this.finish(),
    });

    // ---------- Chapter two ----------
    const ch2 = () => s.chapter === 2;
    const front = (spot, d = 0.9) => [spot.x + Math.sin(spot.face) * d, L.DAM.crest, spot.z + Math.cos(spot.face) * d];
    const D = L.NORTH_DOOR;
    add({
      pos: () => [(D.x0 + D.x1) / 2, D.y, -301.0],
      r: 1.9,
      label: () => ch2() && !s.has('ndoor') && '打开北门',
      act: () => {
        s.set('ndoor');
        this.sound.effect('door');
        this.save();
      },
    });
    add({
      pos: () => front(L.PANELS.power),
      r: 1.6,
      label: () => ch2() && !s.has('power') && '合上机房电源',
      act: () => {
        s.set('power');
        this.sound.effect('power');
        this.announce('1 号闸机房 · 已通电');
        this.save();
      },
    });
    const gateConsole = (id, n, why) =>
      add({
        pos: () => front(L.PANELS[id]),
        r: 1.6,
        label: () => ch2() && !s.has(id) && (s.canOpen(id) ? `开启 ${n} 号闸` : off(why)),
        act: () => {
          if (!s.openGate(id)) return;
          this.sound.effect('gate');
          this.announce(`${n} 号闸开启 · 泄洪`);
          this.save();
        },
      });
    gateConsole('g1', 1, '1 号闸 · 机房无电');
    gateConsole('g2', 2, '2 号闸 · 无电（检修廊接线箱跳闸）');
    add({
      pos: () => [L.JUNCTION.x, L.JUNCTION.y, L.JUNCTION.z + 0.8],
      r: 1.5,
      label: () => ch2() && !s.has('junction') && '复位接线箱',
      act: () => {
        s.set('junction');
        this.sound.effect('switch');
        this.sound.effect('power');
        this.announce('接线箱复位 · 2 号闸来电');
        this.save();
      },
    });
    add({
      pos: () => front(L.PANELS.pump),
      r: 1.5,
      label: () => ch2() && !s.has('g3') && '操作手压泵',
      act: () => this.enterPump(),
    });
    add({
      pos: () => [L.GAUGE.x, L.DAM.crest, L.GAUGE.z + 0.9],
      r: 1.8,
      label: () => ch2() && !s.has('logged') && (s.has('recede') ? '记录水情' : null),
      act: () => this.finish(),
    });
    return list;
  }
  focus() {
    const b = this.player.body;
    let best = null,
      dist = Infinity;
    for (const it of this.interactables) {
      const [x, y, z] = it.pos();
      if (Math.abs(b.y - y) > (it.dy || 1.6)) continue;
      const d = Math.hypot(b.x - x, b.z - z);
      if (d > it.r || d >= dist) continue;
      const label = it.label();
      if (!label) continue;
      best = { it, label: typeof label === 'string' ? { text: label } : label };
      dist = d;
    }
    return best;
  }
  interact() {
    const f = this.focus();
    if (!f) return;
    if (f.label.disabled) {
      this.sound.effect('deny');
      return;
    }
    this.handUntil = this.time + 0.7;
    f.it.act();
  }
  readArchive(id) {
    const first = this.site.collect(id);
    if (id === 'a1') this.site.set('workorder');
    this.sound.effect('archive');
    this.save();
    this.callbacks.archive(id, first);
  }
  enterValve() {
    this.mode = 'valve';
    this.site.atValve = true;
    this.site.hold = 0;
    this.player.place(L.VALVE.x - 0.25, 0, L.VALVE.z + 1.03, 0);
    this.savedView = { yaw: this.rig.yaw, pitch: this.rig.pitch };
    this.rig.yaw = 0.63;
    this.rig.pitch = -0.14;
  }
  leaveValve() {
    this.mode = 'walk';
    this.site.atValve = false;
    this.site.hold = 0;
    if (this.savedView) Object.assign(this.rig, this.savedView);
    this.player.place(L.VALVE.x - 0.25, 0, L.VALVE.z + 1.35, this.player.facing);
  }
  enterPump() {
    const p = L.PANELS.pump;
    this.mode = 'pump';
    this.site.atPump = true;
    this.savedView = { yaw: this.rig.yaw, pitch: this.rig.pitch };
    this.player.place(p.x - 0.2, L.DAM.crest, p.z + 0.85, 0);
    this.rig.yaw = -0.55;
    this.rig.pitch = -0.2;
  }
  leavePump() {
    const p = L.PANELS.pump;
    this.mode = 'walk';
    this.site.atPump = false;
    if (this.savedView) Object.assign(this.rig, this.savedView);
    this.player.place(p.x - 0.2, L.DAM.crest, p.z + 1.3, this.player.facing);
  }
  // The crest is overtopped: back to the last checkpoint with the water a little lower.
  fail(text) {
    if (this.mode === 'pump') this.leavePump();
    this.failSpot = this.checkpoint();
    this.respawning = 0.0001;
    this.respawned = false;
    this.fallAt = this.time;
    this.announce(text, 4.2);
    this.sound.effect('fall');
    $('fade').classList.add('show');
  }
  board() {
    const s = this.site;
    s.aboard = true;
    s.stopping = false;
    s.cartSpeed = 0;
    this.mode = 'cart';
    this.rig.yaw = 0;
    this.rig.pitch = -0.1;
    this.sound.effect('board');
  }
  finish() {
    const s = this.site,
      two = this.chapter === 2;
    s.set(two ? 'logged' : 'record');
    this.sound.effect('record');
    this.save();
    this.mode = 'cinematic';
    this.player.locked = true;
    const cp = this.camera.position;
    // Chapter one circles the core; chapter two the dam at first light.
    this.orbitAt = two ? { x: 92, z: -470, r: 96, h: 128, y: 92 } : { x: 81, z: -285, r: 112, h: 172, y: 116 };
    const o = this.orbitAt;
    this.orbit = Math.atan2(cp.x - o.x, cp.z - o.z);
    this.shot = { position: new T.Vector3(), target: new T.Vector3(o.x, o.y, o.z), speed: 0.7 };
    this.rig.frame(this.shot);
    this.endingAt = this.time + 3.2;
  }
  announce(text, seconds = 3.6) {
    $('zone-banner').textContent = text;
    $('zone-banner').classList.add('show');
    this.bannerUntil = this.time + seconds;
  }
  onEvent(e) {
    const s = this.site;
    if (e === 'release') {
      this.leaveValve();
      this.sound.effect('gate');
      this.announce('压力稳定 · 泄压闸开启');
      this.world.refreshShadows();
      this.save();
    } else if (e === 'dock' || e === 'step-off') {
      this.mode = 'walk';
      this.player.place(L.CART.x - 1.55, 0, s.cartZ, 0);
      this.sound.effect('board');
      if (e === 'dock') this.announce('到站 · 砼核');
      this.save();
    } else if (e === 'gate-g3') {
      if (this.mode === 'pump') this.leavePump();
      this.sound.effect('gate');
      this.announce('3 号闸开启 · 三孔全开', 4);
      this.save();
    } else if (e === 'rising') {
      this.sound.effect('alarm');
      this.announce(`库水位 ${s.level.toFixed(1)} m · 逼近坝顶`, 3.4);
    } else if (e === 'overtop') this.fail('洪水漫过坝顶 · 回到检查点');
    else if (e === 'recede') {
      this.world.weather.set('dawn');
      this.announce('水位回落 · 雨停了', 4.5);
      this.save();
    } else if (e === 'lift-start') this.sound.effect('lift');
    else if (e === 'lift-stop') {
      const b = this.player.body;
      const onCar = b.ground && b.ground.dynamic && Math.abs(b.y - s.liftY) < 0.3;
      if (s.liftY === L.LEVEL.L1 && !s.has('stall')) {
        s.set('stall');
        this.sound.effect('stall');
        this.announce('上段供电中断 · 升降台停于 +048', 4.5);
      } else if (s.liftY === L.LEVEL.CROWN && onCar) {
        s.set('crown');
        this.sound.effect('arrive');
        this.announce('砼核 · 冠顶  +132', 4);
      } else this.sound.effect('arrive');
      this.save();
    }
  }

  // ---------- Simulation ----------
  step(dt) {
    const s = this.site,
      p = this.player,
      b = p.body;
    const inp = this.input.read(dt);
    if (inp.pause && this.mode !== 'cinematic') {
      this.callbacks.pause();
      return;
    }
    if (inp.journal && this.mode !== 'cinematic') {
      this.callbacks.journal();
      return;
    }
    this.time += dt;
    // Free look (Option / Alt): the camera turns, the walking direction stays put.
    // On release the camera swings back behind the walking direction.
    const free = inp.freeLook && this.mode === 'walk' && !this.respawning;
    if (free && this.moveYaw === null) this.moveYaw = this.rig.yaw;
    if (this.mode !== 'cinematic' && !this.respawning) {
      this.rig.rotate(inp.lookX, inp.lookY);
      if (inp.lookX || inp.lookY) this.lastLook = this.time;
    }
    if (!free && this.moveYaw !== null) {
      this.moveYaw -= inp.lookX;
      const d = Math.atan2(Math.sin(this.moveYaw - this.rig.yaw), Math.cos(this.moveYaw - this.rig.yaw));
      if (Math.abs(d) < 0.01 || this.mode !== 'walk') {
        this.rig.yaw = this.moveYaw;
        this.moveYaw = null;
      } else this.rig.yaw += d * (1 - Math.exp(-14 * dt));
    }
    const walkYaw = this.moveYaw ?? this.rig.yaw;
    let drive = false,
      brake = false,
      pumpHeld = false,
      strokes = 0;
    if (this.respawning) {
      /* Input waits for the screen to clear. */
    } else if (this.mode === 'valve') {
      if (inp.x) {
        const before = s.opening;
        s.turn(inp.x * 0.3 * dt);
        this.detent += Math.abs(s.opening - before);
        if (this.detent > 0.03) {
          this.detent = 0;
          this.sound.effect('detent');
        }
      }
      if (inp.interact) this.leaveValve();
    } else if (this.mode === 'cart') {
      drive = inp.z < -0.3;
      brake = inp.z > 0.3;
      if (inp.interact) s.stopping = true;
    } else if (this.mode === 'pump') {
      if (Math.abs(inp.x) > 0.5 || Math.abs(inp.z) > 0.5) this.leavePump();
      else {
        pumpHeld = inp.use;
        strokes = inp.interact ? 1 : 0;
        if (strokes) this.sound.effect('detent');
      }
    } else if (this.mode === 'walk' && inp.interact) this.interact();
    if (inp.lamp && this.chapter === 2 && this.mode !== 'cinematic') {
      this.world.weather.lampOn = !this.world.weather.lampOn;
      this.sound.effect('detent');
    }

    const nearCore = Math.hypot(b.x - 81, b.z - L.CORE.z1) < 24 && b.y < 8;
    for (const e of s.step(dt, { drive, brake, nearCore, pumpHeld, strokes })) this.onEvent(e);
    // Gusts cross the storm bridge on a fixed beat once the shift is out on it.
    let windX = 0;
    if (this.chapter === 2 && s.has('bridge')) {
      this.windClock += dt;
      this.gust = gustAt(this.windClock);
      this.exposed = this.mode === 'walk' && !p.flying && !this.respawning ? windExposure(b.x, b.y, b.z) : 0;
      windX = GUST.speed * this.gust.push * this.exposed;
    }
    const inside = L.insideCore(b.x, b.y, b.z) || L.insideDam(b.x, b.y, b.z) ? 1 : 0;
    this.inside = T.MathUtils.damp(this.inside ?? inside, inside, 1.4, dt);
    this.world.update(dt, this.time, s, b, this.camera, this.inside);
    this.head.set(b.x, b.y + 1.62, b.z);
    this.rain.set(2.4 + 9 * this.gust.push, 0, -1.1);
    for (const e of this.world.weather.update(dt, this.time, this.camera, this.head, this.inside, this.rain))
      if (e.type === 'thunder') this.sound.thunder?.(e.delay, e.power);

    let landed = 0;
    if (this.mode === 'cart' || this.mode === 'valve' || this.mode === 'pump') {
      if (this.mode === 'cart') p.place(L.CART.x, L.CART.deck, s.cartZ - 0.41, 0);
      else if (this.mode === 'pump') p.place(L.PANELS.pump.x - 0.2, L.DAM.crest, L.PANELS.pump.z + 0.85, 0);
      else p.place(L.VALVE.x - 0.25, 0, L.VALVE.z + 1.03, 0);
      p.speed = 0;
      p.air = 0;
    } else {
      p.locked = this.mode !== 'walk' || this.respawning > 0;
      const dev = !!this.settings.dev;
      p.speedScale = dev ? this.settings.devSpeed || 1 : 1;
      let toggled = false;
      if (inp.jump && this.mode === 'walk') {
        if (dev && this.settings.devFly && this.time - this.lastTap < 0.32) {
          p.setFlying(!p.flying, !!this.settings.devNoclip);
          this.lastTap = -1;
          toggled = true;
        } else this.lastTap = this.time;
      }
      if (p.flying && (!dev || this.mode !== 'walk')) p.setFlying(false);
      if (p.flying) b.noclip = !!this.settings.devNoclip;
      const r = p.update(
        dt,
        this.physics,
        { x: inp.x, z: inp.z, run: inp.run, jump: inp.jump && !p.locked && !toggled, up: inp.up, down: inp.down, windX },
        walkYaw
      );
      landed = r.landed;
      if (r.jumped) this.sound.effect('jump');
      if (landed > 1.1) this.sound.land(landed, b.ground?.surface === 'metal');
    }
    const hands = this.mode === 'cart' || this.mode === 'valve' || this.mode === 'pump' || this.time < this.handUntil ? 1 : 0;
    const stepped = p.animate(dt, this.time, hands, this.mode === 'valve' ? s.opening : null);
    if (stepped && this.mode === 'walk') this.sound.step(b.ground?.surface === 'metal', inp.run);
    this.maxHeight = Math.max(this.maxHeight, b.y);

    this.trackSafety(dt);
    this.trackProgress();
    if (this.mode === 'cinematic') {
      this.orbit += dt * 0.075;
      const o = this.orbitAt;
      this.shot.position.set(o.x + Math.sin(this.orbit) * o.r, o.h, o.z + Math.cos(this.orbit) * o.r);
      if (this.endingAt > 0 && this.time > this.endingAt) {
        this.endingAt = -1;
        this.input.unlock();
        this.callbacks.complete(this.stats());
      }
    }
    this.adapt(dt);
    const camMode =
      this.mode === 'valve' || this.mode === 'pump'
        ? { distance: 3.1 }
        : this.mode === 'cart'
          ? { distance: 5.6, lift: 0.3 }
          : { distance: this.zoneDistance(b) };
    if (this.mode === 'cart' && this.time - this.lastLook > 1.4) {
      const d = -this.rig.yaw;
      this.rig.yaw += Math.atan2(Math.sin(d), Math.cos(d)) * (1 - Math.exp(-1.6 * dt));
      this.rig.pitch = T.MathUtils.damp(this.rig.pitch, -0.12, 1.6, dt);
    }
    const camDist = this.rig.update(dt, b, camMode);
    p.group.visible = camDist > 0.75;
    this.sound.update({
      x: b.x,
      y: b.y,
      z: b.z,
      yaw: this.rig.yaw,
      inside: this.inside,
      booth: b.z > L.BOOTH.z0 && Math.abs(b.x) < 4 ? 1 : 0,
      site: s,
    });
    this.updateHUD();
    if (this.time > this.nextSave && this.mode === 'walk') {
      this.save();
      this.nextSave = this.time + 3;
    }
  }
  zoneDistance(b) {
    if (b.z > L.BOOTH.z0 - 0.5 && Math.abs(b.x) < 4.2) return 3.0;
    if (L.insideDam(b.x, b.y, b.z)) return 2.5;
    if (this.inside > 0.5 && b.y > 40) return 4.2;
    if (b.y > 15 && b.y < 30 && b.z < -40 && b.z > -50) return 3.4;
    return 4.6;
  }
  trackSafety(dt) {
    const b = this.player.body;
    if (this.respawning) {
      this.respawning += dt;
      if (this.respawning > 0.55 && !this.respawned) {
        const cutoff = this.fallAt - 1.2;
        const spot = [...this.safe].reverse().find((p) => p.t < cutoff) || this.safe[0];
        if (this.failSpot) {
          this.player.place(...this.failSpot);
          this.rig.yaw = this.failSpot[3];
          this.site.recover();
          this.failSpot = null;
          this.safe = [];
          this.save();
        } else if (this.fallSpot) {
          // Blown off the storm bridge: back in the lee of the last refuge passed.
          this.player.place(...this.fallSpot);
          this.rig.yaw = this.fallSpot[3];
          this.fallSpot = null;
        } else if (spot) this.player.place(spot.x, spot.y, spot.z, this.player.facing);
        else this.player.place(...this.checkpoint());
        this.rig.snap();
        this.respawned = true;
      }
      if (this.respawning > 0.95) {
        this.respawning = 0;
        $('fade').classList.remove('show');
      }
      return;
    }
    if (this.mode !== 'walk' || this.player.flying) return;
    const drop = b.peak - b.y;
    if (b.y < -5.6 || (!this.settings.dev && !b.grounded && drop > 10.5)) {
      const fromBridge = this.chapter === 2 && b.peak > L.STORM_BRIDGE.top - 1 && b.z < L.STORM_BRIDGE.z0 && b.z > L.STORM_BRIDGE.z1;
      this.fallSpot = fromBridge ? refugeBehind(b.z) : null;
      this.respawning = 0.0001;
      this.respawned = false;
      this.fallAt = this.time;
      this.sound.effect(b.y < -5.6 ? 'splash' : 'fall');
      $('fade').classList.add('show');
      return;
    }
    this.safeClock = (this.safeClock || 0) + dt;
    if (b.grounded && b.ground && !b.ground.dynamic && this.safeClock > 0.25) {
      this.safeClock = 0;
      this.safe.push({ x: b.x, y: b.y, z: b.z, t: this.time });
      if (this.safe.length > 48) this.safe.shift();
    }
  }
  trackProgress() {
    const s = this.site,
      b = this.player.body;
    if (!s.has('hall') && b.x > L.HALL.x0 - 0.3 && b.z < L.HALL.z1 && b.z > L.HALL.z0 && b.y < 6) {
      s.set('hall');
      this.save();
    }
    if (!s.has('core') && L.insideCore(b.x, b.y, b.z) && b.y < 8 && b.z < L.SHAFT.z1 - 0.5) {
      s.set('core');
      this.announce('砼核', 3);
      this.save();
    }
    if (this.chapter === 2) {
      if (!s.has('bridge') && s.has('ndoor') && b.z < L.STORM_BRIDGE.z0 - 1.5 && b.y > 94) {
        s.set('bridge');
        this.windClock = 0;
        this.announce('暴雨 · 库水位开始上涨', 3.6);
        this.save();
      }
      if (!s.has('crest') && b.z < L.DAM.down + 0.5 && b.y > 94) {
        s.set('crest');
        this.save();
      }
    }
    if (!s.has('crown') && b.y > L.LEVEL.CROWN - 1.5) {
      s.set('crown');
      this.save();
    }
    const area = L.areaAt(b.x, b.y, b.z);
    if (area.name !== this.area) {
      if (this.area && !this.visited.has(area.name) && area.name !== '砼核 · 冠顶') this.announce(area.name, 2.8);
      this.area = area.name;
      this.visited.add(area.name);
      $('area-name').textContent = area.name;
      $('area-code').textContent = area.code;
    }
  }
  // Rooms on the dam are lit once their power is back; the pump room has its emergency lamps.
  roomLight(b) {
    const s = this.site;
    if (this.chapter !== 2 || !L.insideDam(b.x, b.y, b.z)) return 0;
    if (b.y < 92 || (b.x > L.HOUSE.walls[0] && b.x < L.HOUSE.walls[1])) return s.has('junction') ? 0.8 : 0;
    if (b.x < L.HOUSE.walls[0]) return s.has('power') ? 1 : 0;
    if (b.x < L.HOUSE.walls[2]) return s.has('junction') ? 1 : 0;
    return 0.45;
  }
  adapt(dt) {
    const k = this.inside,
      w = this.world.weather,
      storm = w.state.storm;
    this.roomLit = T.MathUtils.damp(this.roomLit ?? 0, this.roomLight(this.player.body), 3, dt);
    // Night needs a little more exposure; the shaft at night is mostly lamp and dark.
    this.renderer.toneMappingExposure = (1.04 + 0.3 * k) * (1 + 0.28 * storm);
    this.world.setAmbient((1 - 0.68 * k) * w.ambient + 0.12 * k * this.roomLit);
    this.scene.fog.color.copy(w.fog).lerp(this.fogIn, k * (1 - storm));
    // The haze settles in the canyon; above the transfer decks the air clears. Rain closes it in.
    const clear = 0.00265 - 0.0015 * T.MathUtils.smoothstep(this.camera.position.y, 15, 140);
    const outside = clear + (0.0056 - clear) * storm;
    this.scene.fog.density = outside + (0.0078 - outside) * k;
  }

  // ---------- HUD ----------
  set(key, el, value, prop = 'textContent') {
    if (this.hud[key] === value) return;
    this.hud[key] = value;
    el[prop] = value;
  }
  updateHUD() {
    const s = this.site,
      b = this.player.body;
    if (this.time > this.bannerUntil) $('zone-banner').classList.remove('show');
    this.set('height', $('height'), (b.y < 0 ? '-' : '+') + Math.abs(b.y).toFixed(1).padStart(5, '0'));
    this.set('count', $('archive-count'), `${this.found()}/${archivesOf(this.chapter).length}`);
    const obj = objective(s, b);
    if (this.hud.obj !== obj.text) {
      const fresh = this.hud.objId !== obj.id && this.hud.objId !== undefined;
      this.hud.obj = obj.text;
      this.hud.objId = obj.id;
      $('objective-text').textContent = obj.text;
      if (fresh) {
        $('objective').classList.remove('updated');
        void $('objective').offsetWidth;
        $('objective').classList.add('updated');
      }
    }
    const atMachine = this.mode === 'valve' || this.mode === 'cart' || this.mode === 'pump';
    this.set('valve', $('valve-panel'), this.mode !== 'valve', 'hidden');
    this.set('cart', $('cart-panel'), this.mode !== 'cart', 'hidden');
    this.set('pump', $('pump-panel'), this.mode !== 'pump', 'hidden');
    if (this.mode === 'pump') {
      this.set('pumpP', $('pump-pressure'), Math.round(s.pump * 100) + '%');
      this.set('pumpG', $('pump-gate'), Math.round(s.gates.g3 * 100) + '%');
      $('pump-fill').style.transform = `scaleX(${clamp(s.pump, 0, 1)})`;
      this.set('pumpS', $('pump-state'), s.pump < PUMP.crack ? '压力不足 · 继续压泵' : '阀门开启 · 闸门上升中');
    }
    // The reservoir gauge: chapter two only.
    const two = this.chapter === 2;
    this.set('waterShown', $('water-gauge'), !two, 'hidden');
    if (two) {
      this.set('water', $('water-level'), s.level.toFixed(2));
      const fill = Math.round(clamp((s.level - 88) / (L.RESERVOIR.crest - 88), 0, 1) * 200) / 200;
      if (this.hud.waterFill !== fill) {
        this.hud.waterFill = fill;
        $('water-fill').style.transform = `scaleX(${fill})`;
      }
      this.set('waterHigh', $('water-gauge'), s.level >= 95 ? 'high' : s.gatesOpen >= 3 ? 'falling' : '', 'className');
    }
    $('play-screen').classList.toggle('at-machine', atMachine);
    $('play-screen').classList.toggle('cinematic', this.mode === 'cinematic');
    if (this.mode === 'valve') {
      this.set('pressure', $('pressure-reading'), s.pressure.toFixed(2) + ' MPa');
      const pr = Math.round(s.pressure * 100);
      if (this.hud.dial !== pr) {
        this.hud.dial = pr;
        drawDial($('pressure-face'), pr / 100);
      }
      const inBand = s.pressure >= BAND[0] && s.pressure <= BAND[1];
      $('pressure-hold').style.transform = `scaleX(${clamp(s.hold / HOLD_TIME, 0, 1)})`;
      this.set('stab', $('pressure-stability'), inBand ? '压力在区间内 · 保持' : s.pressure > BAND[1] ? '压力偏高 · 开大阀门' : '压力偏低 · 关小阀门');
    }
    if (this.mode === 'cart') {
      this.set('speed', $('cart-speed'), (s.cartSpeed * 3.6).toFixed(0) + ' km/h');
      this.set('range', $('cart-range'), Math.ceil(s.cartZ - L.CART.end) + ' m');
    }
    let prompt = null;
    if (this.mode === 'valve') prompt = { text: '松开手轮' };
    else if (this.mode === 'pump') prompt = { text: '压泵' };
    else if (this.mode === 'cart') prompt = { text: s.cartSpeed > 0.2 ? '停车并下车' : '下车' };
    else if (this.mode === 'walk' && !this.respawning) prompt = this.focus()?.label || null;
    const promptKey = prompt ? prompt.text + (prompt.disabled ? '!' : '') : '';
    if (this.hud.prompt !== promptKey) {
      this.hud.prompt = promptKey;
      $('interaction').hidden = !prompt;
      if (prompt) {
        $('interaction').lastElementChild.textContent = prompt.text;
        $('interaction').classList.toggle('disabled', !!prompt.disabled);
      }
    }
    const marker = $('marker');
    const showMarker = obj.target && !prompt && this.settings.marker && this.mode === 'walk';
    marker.hidden = !showMarker;
    if (showMarker) {
      this.work.set(...obj.target);
      const dist = this.work.distanceTo(this.camera.position);
      this.work.project(this.camera);
      let x = this.work.x,
        y = this.work.y;
      const behind = this.work.z > 1;
      if (behind) {
        x = -x;
        y = -y;
        if (Math.abs(x) < 0.05) x = 1;
      }
      const outside = behind || Math.abs(x) > 0.86 || Math.abs(y) > 0.7;
      if (outside) {
        const sc = Math.max(Math.abs(x) / 0.86, Math.abs(y) / 0.7, 0.001);
        x /= sc;
        y /= sc;
      }
      marker.classList.toggle('edge', outside);
      marker.style.transform = `translate(${(x * 0.5 + 0.5) * innerWidth}px,${(-y * 0.5 + 0.5) * innerHeight}px) translate(-50%,-50%)`;
      const dy = obj.target[1] - b.y;
      const tag = Math.round(dist) + ' m' + (Math.abs(dy) > 6 ? (dy > 0 ? ' ↑' : ' ↓') : '');
      this.set('markerText', marker.lastElementChild, tag);
    }
    this.hints(b);
    const devOn = !!this.settings.dev;
    this.set('devShown', $('dev-readout'), !devOn, 'hidden');
    if (devOn && (this.devClock = (this.devClock || 0) + 1) % 10 === 0) {
      const p = this.player;
      const flags = [p.flying ? (b.noclip ? '飞行·穿墙' : '飞行') : b.grounded ? '着地' : '空中', '速度 ×' + (this.settings.devSpeed || 1).toFixed(2)];
      $('dev-readout').textContent =
        `DEV  ${b.x.toFixed(1)}, ${b.y.toFixed(1)}, ${b.z.toFixed(1)}  ·  视角 ${this.rig.yaw.toFixed(2)} / ${this.rig.pitch.toFixed(2)}  ·  ${Math.round(this.fps || 0)} FPS  ·  ${flags.join('  ·  ')}`;
    }
  }
  teleport(key) {
    const spot = L.DEV_SPOTS[key];
    if (!spot) return;
    const [, x, y, z, yaw] = spot;
    if (this.mode === 'valve') this.leaveValve();
    if (this.mode === 'pump') this.leavePump();
    if (this.mode === 'cart') {
      this.site.aboard = false;
      this.site.cartSpeed = 0;
    }
    if (this.mode === 'cinematic') this.freeRoam();
    this.mode = 'walk';
    this.player.place(x, y, z, yaw);
    this.rig.yaw = yaw;
    this.rig.pitch = -0.08;
    this.rig.snap();
    this.moveYaw = null;
    this.safe = [{ x, y, z, t: this.time }];
    this.inside = undefined;
  }
  hints(b) {
    let key = '';
    const touch = $('app').classList.contains('touch');
    const bridgeWind = this.chapter === 2 && this.site.has('bridge') && b.z < L.STORM_BRIDGE.z0 && b.z > L.STORM_BRIDGE.z1 && b.y > 94;
    if (this.mode === 'walk' && !this.respawning) {
      if (this.time < 16 && !this.site.has('door')) key = touch ? '' : 'start';
      else if (this.chapter === 2 && this.time < 14 && !this.site.has('ndoor')) key = 'ch2';
      else if (bridgeWind && this.gust.phase === 'gust' && this.exposed) key = 'gust';
      else if (bridgeWind && this.gust.phase === 'warn' && windExposure(b.x, b.y, b.z)) key = 'gustwarn';
      else if (b.x > L.CATWALK.x1 - 4.5 && b.x < L.CATWALK.x1 + 0.5 && Math.abs(b.z - L.CATWALK.z) < 1.2 && !this.site.has('s3'))
        key = 'gap';
      else if (Math.abs(b.x - (L.TOWER.x0 + L.TOWER.x1) / 2) < 3.2 && b.z > L.TOWER.z1 - 1 && b.z < L.TOWER.z1 + 3 && b.y < 1)
        key = 'tower';
      else if (this.site.has('stall') && !this.site.has('console') && b.y > 47 && b.y < 49 && b.x > 76 && b.z > -291) key = 'stairs';
    }
    if (key === this.hintKey) return;
    this.hintKey = key;
    const text = {
      start: '单击画面锁定视角 · W A S D 移动 · Shift 奔跑 · 空格 跳跃 · E 交互',
      gap: '检修道断开 · 助跑后按空格跳过去',
      tower: '转运梁检修梯 · 可攀至 +023 高处',
      stairs: '北墙检修梯通往主控层',
      ch2: touch ? '北门在北墙梯顶平台' : '北门在北墙梯顶平台 · L 开关头灯',
      gustwarn: '阵风将至 · 躲进避风处，或向西（左侧）顶风奔跑',
      gust: '阵风！',
    }[key];
    $('hint').textContent = text || '';
    $('hint').classList.toggle('show', !!text);
    $('hint').classList.toggle('alert', key === 'gust' || key === 'gustwarn');
  }

  // ---------- Frame ----------
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
    const dt = clamp(elapsed, 0.001, 0.05);
    this.fpsTime = (this.fpsTime || 0) + elapsed;
    this.fpsFrames = (this.fpsFrames || 0) + 1;
    if (this.fpsTime > 0.5) {
      this.fps = this.fpsFrames / this.fpsTime;
      this.fpsTime = this.fpsFrames = 0;
    }
    this.step(dt);
    if (!this.active) return;
    this.post.render(this.scene, this.camera, this.settings.quality);
    this.frame = requestAnimationFrame((t) => this.tick(t));
  }
}
