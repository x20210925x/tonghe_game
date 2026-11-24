// Every coordinate shared by geometry, collision, machines, sound and the route lives here.
// Y is up. Facing -Z is "forward" along the inspection route.

export const SPAWN = { x: 0, y: 0, z: 13.4, yaw: 0 };
// Chapter two opens on the control level, beside the console the first shift restarted.
export const CH2_SPAWN = { x: 70.4, y: 96, z: -288.2, yaw: 0.9 };

export const BOOTH = { x0: -4, x1: 4, z0: 4, z1: 17, desk: { x: -3.05, y: 1.02, z: 10.7 } };
export const DOOR = { x: 0, z: 4.1, width: 2.24, height: 2.42, slide: -2.31 };

export const DECK = { x0: -13, x1: 14, z0: -123, z1: 4.55 };
export const VALVE = { x: 2.3, z: -33.1 };
export const GATE = { z: -53.6, x0: -13.35, x1: 14.35, height: 5.2, open: 6.8 };
export const OUTLET = { x: 24, z: -64 };

// The transfer beam over the gate is reachable by an optional steel stair tower.
export const BEAM = { top: 22.935, x0: -26.5, x1: 47.5, z0: -61.65, z1: -48.35 };
export const TOWER = { x0: -12.5, x1: -9.9, z0: -48.35, z1: -43.15, flights: 15 };

export const BRIDGE = { x: 12, z: -65, endX: 72, endZ: -115, width: 3.85 };

export const HALL = { x0: 70, x1: 90, z0: -137, z1: -104 };
export const MEZZ = { x0: 84, x1: 89.6, z0: -134.6, z1: -124, top: 4 };
export const MEZZ_STAIR = { x0: 86.6, x1: 89.6, zBottom: -117.6, zTop: -124 };
export const CATWALK = { x0: 57.4, x1: 70, z: -132, width: 1.7, gap: [63.2, 64.4] };
export const SWITCHES = [
  { id: 's1', x: 87.4, y: 0, z: -105.05, face: Math.PI },
  { id: 's2', x: 89.05, y: 4, z: -130.6, face: -Math.PI / 2 },
  { id: 's3', x: 58, y: 0, z: -132, face: Math.PI / 2 },
];
export const BREAKER = { x: 78, z: -121.85 };

export const TRESTLE = { x0: 76.5, x1: 85.5, z0: -265, z1: -132.8 };
export const ALCOVE = { x0: 85.5, x1: 90.6, z0: -201.5, z1: -194.5 };
export const CART = { x: 81, start: -143, end: -255.5, deck: 0.51 };

// The core: a hollow concrete tower. Its shaft holds a lift and a steel stair hung on the north wall.
export const CORE = { x0: 61, x1: 101, z0: -305, z1: -265, wall: 3, base: -30, top: 132 };
export const SHAFT = { x0: 64, x1: 98, z0: -302, z1: -268 };
export const CORE_DOOR = { x0: 78, x1: 84, z: -266.5, height: 8 };
export const LIFT = { x0: 76.5, x1: 85.5, z0: -289.5, z1: -280.5, cx: 81, cz: -285, stops: [0, 48, 96, 132] };
export const LEVEL = { L1: 48, L2: 96, CROWN: 132 };
export const FLIGHTS = { x0: 67, x1: 95, a: [-302, -299.4], b: [-299.4, -296.8], rise: 12 };
export const L1 = { x0: 64, x1: 85.5, z0: -296.8, z1: -289.5 };
export const L2 = { x0: 64, x1: 76.5, z0: -296.8, z1: -284 };
export const CONSOLE = { x: 66.2, y: 96, z: -288.5 };
export const LIFT_PANEL = { dx: 3.55, dz: 3.55 };
export const CROWN_BRIDGE = { x0: 78, x1: 84, z0: -280.5, z1: -268 };
export const RECORD = { x: 92, y: 132, z: -262.9 };

// ---------- Chapter two: the north dam ----------
// A door in the core's north wall at +96 opens onto a storm bridge to the crest of the north
// dam. The wind blows from the west, so the broken rails are on the east (downwind) edge and
// the windbreaks on the west edge of the refuges over each pier.
export const NORTH_DOOR = { x0: 64.4, x1: 66.6, y: 96, height: 2.4, slide: 2.25 };
export const STORM_BRIDGE = { x0: 63.9, x1: 67.1, z0: -305, z1: -466, top: 96, piers: [-345, -385, -425] };
export const REFUGE = { x0: 62.2, x1: 68.8, half: 4 };
export const BROKEN_RAILS = [
  [-367, -357],
  [-411, -401],
];
// The dam spans the canyon. Its crest (+96) runs along x; the hoist house stands on the
// upstream half, the road on the downstream half. Three 12 m bays between 6 m piers.
export const DAM = { x0: -70, x1: 195, up: -478, down: -466, crest: 96, face: 70, sill: 89, walk: [56, 134] };
export const ROAD = { z0: -473, z1: -466 };
export const BAY = 12;
export const GATES = [
  { id: 'g1', x: 82, door: 80 },
  { id: 'g2', x: 100, door: 101 },
  { id: 'g3', x: 118, door: 119 },
];
export const GATE_SLOT = { z0: -476.6, z1: -476.0, lift: 5.4 };
export const HOUSE = { x0: 70, x1: 130, z0: -478, z1: -473, top: 103.6, walls: [88, 94, 112] };
export const SHAFT_ROOM = { door: 91 };
// The gallery shaft drops through pier 2 to a corridor inside the dam at +84.
export const GALLERY = { x0: 88.6, x1: 105.2, z0: -477.6, z1: -475, y: 84, height: 3, shaftX1: 93.4, mid: -476.3 };
export const JUNCTION = { x: 104.4, y: 84, z: -477.25 };
// Control points in the hoist house. face: the direction the front looks (0 = +z).
export const PANELS = {
  power: { x: 70.75, z: -476.4, face: Math.PI / 2 },
  g1: { x: 76.9, z: -473.75, face: Math.PI },
  g2: { x: 108.9, z: -473.75, face: Math.PI },
  pump: { x: 126.6, z: -476.9, face: 0 },
};
export const RESERVOIR = { start: 92, crest: 96, recover: 93.5, low: 90.6 };
// The water-level station at the west end of the crest, where the night's log is written.
export const GAUGE = { x: 59.4, z: -476.5 };

export const ARCHIVE_SPOTS = {
  a1: { x: -3.05, y: 1.02, z: 10.7, base: 0 },
  a2: { x: -11.6, y: 0.62, z: -22, base: 0 },
  a3: { x: 45.4, y: 23.5, z: -55, base: BEAM.top },
  a4: { x: -11.4, y: 0.62, z: -120.6, base: 0 },
  a5: { x: 85, y: 4.62, z: -133.4, base: MEZZ.top },
  a6: { x: 89.6, y: 0.62, z: -198, base: 0 },
  a7: { x: 65.2, y: 48.62, z: -291, base: LEVEL.L1 },
  a8: { x: 81, y: 132.62, z: -306.6, base: LEVEL.CROWN },
  // Chapter two: the control level, a bridge refuge, the gallery and the pump room.
  a9: { x: 74.6, y: 96.62, z: -286.2, base: LEVEL.L2 },
  a10: { x: 63.25, y: 96.62, z: -383.4, base: STORM_BRIDGE.top },
  a11: { x: 95.6, y: 84.62, z: -475.45, base: GALLERY.y },
  a12: { x: 129.0, y: 96.62, z: -474.3, base: DAM.crest },
};

export function areaAt(x, y, z) {
  if (z < -464 && z > -480 && x > 50 && x < 140 && y > 80) {
    if (y < 92) return { name: '检修廊', code: 'GALLERY +084' };
    if (x > HOUSE.x0 && x < HOUSE.x1 && z < HOUSE.z1 && y < HOUSE.top) return { name: '启闭机房', code: 'DAM HOIST HOUSE' };
    return { name: '北坝坝顶', code: 'DAM CREST +096' };
  }
  if (z < -305 && z > -466 && x > 58 && x < 74 && y > 85) return { name: '风雨栈桥', code: 'NORTH BRIDGE +096' };
  if (x > SHAFT.x0 - 3.2 && x < SHAFT.x1 + 3.2 && z > SHAFT.z0 - 6 && z < SHAFT.z1 + 6 && y > 130)
    return { name: '砼核 · 冠顶', code: 'CROWN +132' };
  if (x > SHAFT.x0 - 0.5 && x < SHAFT.x1 + 0.5 && z > SHAFT.z0 - 0.5 && z < SHAFT.z1 + 0.2) {
    if (y > 92) return { name: '砼核 · 主控层', code: 'CORE L2' };
    if (y > 40) return { name: '砼核 · 北墙梯', code: 'CORE L1' };
    return { name: '砼核 · 底层', code: 'CORE L0' };
  }
  if (z > BOOTH.z0 - 0.1 && Math.abs(x) < 4.2 && y < 5) return { name: '值班室', code: 'SECTOR 01' };
  if (y > 15 && z < -40 && z > -66) return { name: '转运梁', code: 'SECTOR 01 +023' };
  if (x > 69.5 && x < 91 && z > -138 && z < -103) return { name: '动力间', code: 'SECTOR 02' };
  if (x > 55 && x < 70 && z > -134 && z < -130) return { name: '悬挑检修道', code: 'SECTOR 02' };
  if (x > 75 && x < 92 && z < -137) return { name: '轨道栈桥', code: 'SECTOR 03' };
  if (x > 14 && x < 72 && z < -60 && z > -120) return { name: '斜桥', code: 'SECTOR 02' };
  return { name: '泄洪廊', code: 'SECTOR 01' };
}

// Under a roof on the dam: the hoist house rooms, the gallery shaft and the gallery itself.
export function insideDam(x, y, z) {
  if (x > HOUSE.x0 && x < HOUSE.x1 && z > HOUSE.z0 && z < HOUSE.z1 - 0.3 && y > 95 && y < HOUSE.top) return true;
  return x > GALLERY.x0 - 0.3 && x < GALLERY.x1 + 0.3 && z > GALLERY.z0 - 0.3 && z < GALLERY.z1 + 0.3 && y > 82 && y < 96;
}

export function insideCore(x, y, z) {
  return x > SHAFT.x0 - 0.2 && x < SHAFT.x1 + 0.2 && z > SHAFT.z0 - 0.2 && z < SHAFT.z1 + 1.2 && y < 131;
}

// Developer teleports: [label, x, y, z, facing].
export const DEV_SPOTS = {
  booth: ['值班室', 0, 0, 13.4, 0],
  valve: ['旁通阀', 2.2, 0, -29.5, 0],
  beam: ['转运梁顶 +023', 0, BEAM.top, -55, -Math.PI / 2],
  hall: ['动力间', 76, 0, -116, 0],
  catwalk: ['悬挑检修道', 68.5, 0, -132, Math.PI / 2],
  trestle: ['轨道栈桥', 79.5, 0, -150, 0],
  core: ['砼核底层', 81, 0, -274, 0],
  l1: ['中段 +048', 72, LEVEL.L1, -293, Math.PI / 2],
  stair: ['北墙梯 +072', 65.5, LEVEL.L1 + 24, -299.4, -Math.PI / 2],
  l2: ['主控层 +096', 69, LEVEL.L2, -288.5, Math.PI / 2],
  crown: ['冠顶 +132', 81, LEVEL.CROWN, -266, Math.PI],
  ndoor: ['北门 +096', 65.5, LEVEL.L2, -299, 0],
  bridge: ['风雨栈桥', 65.5, 96, -383, 0],
  crest: ['北坝坝顶', 66.5, 96, -469, -Math.PI / 2],
  shaftroom: ['廊道竖井', 91, 96, -474, 0],
  gallery: ['检修廊 +084', 96, 84, -476.3, -Math.PI / 2],
  pump: ['3 号闸机房', 122, 96, -474.2, -Math.PI / 2],
};
