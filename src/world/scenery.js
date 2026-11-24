import * as T from '../../assets/three.module.min.js';
import { Reflector } from '../../assets/Reflector.js';
import { installDaylight } from '../render/daylight.js';
import { createWetDeck, cadence } from '../render/water.js';
import { DECK, HALL, TRESTLE } from '../game/layout.js';

// Curved buttress ribs. Each formwork face keeps its own edge vertices and measures texture
// distance along the curve, including the horizontal toe.
function ribGeometry(side, z, size) {
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
  // Fade every border to nothing so a bank can never show a straight edge.
  ctx.globalCompositeOperation = 'destination-in';
  ctx.save();
  ctx.translate(128, 48);
  ctx.scale(1, 96 / 256);
  const mask = ctx.createRadialGradient(0, 0, 0, 0, 0, 128);
  mask.addColorStop(0, 'rgba(0,0,0,1)');
  mask.addColorStop(0.55, 'rgba(0,0,0,.85)');
  mask.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = mask;
  ctx.fillRect(-128, -128, 256, 256);
  ctx.restore();
  return new T.CanvasTexture(c);
}

export const SOLAR = new T.Vector3(0.554, 0.743, 0.375).normalize();

export function buildScenery(b, daylight) {
  const { scene, mat } = b;
  const sky = installDaylight(scene, daylight);
  const ribSurface = mat.cast.clone();
  ribSurface.defines = { RIB_SURFACE: 1 };
  ribSurface.onBeforeCompile = mat.cast.onBeforeCompile;
  ribSurface.customProgramCacheKey = mat.cast.customProgramCacheKey;
  // Downstream and upstream ribs differ in spacing, so their silhouettes never align into a tunnel.
  for (let row = -8; row <= 4; row++)
    for (const side of [-1, 1]) {
      const z = row * (side < 0 ? 73 : 94) + (side < 0 ? -20 : 34),
        rib = new T.Mesh(ribGeometry(side, z, side < 0 ? 1 : 1.17), ribSurface);
      rib.castShadow = true;
      rib.receiveShadow = true;
      scene.add(rib);
      const sx = side < 0 ? -86 : 211;
      b.box(sx, 93, z, 37, 213, side < 0 ? 73 : 94, mat.darkCast);
      b.box(sx - side * 17.9, 163, z, 2.5, 2.8, side < 0 ? 73 : 94, mat.cast);
      if (row % 2 === 0) {
        const y = 37 + (side > 0 ? 18 : 0),
          x = side < 0 ? -60.3 : 178.5;
        b.box(x, y, z, 7.3, 1.3, 24.6, mat.darkCast);
        b.rail(x - side * 3.4, z - 12, x - side * 3.4, z + 12, y + 0.65, mat.steel, false);
        b.box(x - side * 3.72, y + 0.06, z + 8, 0.12, 0.31, 0.51, mat.lamp);
        for (let j = 0; j < 4; j++) b.box(x + side * 0.6, y - 1.7, z - 9 + j * 6, 5.4, 2.8, 0.66, mat.darkCast);
      }
      for (let j = 0; j < 5; j++) b.box(sx - side * 19.3, 161.2, z + j * 11 - 22, 1.9, 2.1, 1.1, mat.darkCast);
    }
  // Distant spill gates and transfer decks close the southern horizon; the north dam is built
  // in full by dam.js.
  for (const z of [182, 246]) {
    b.box(55, 91, z, 264, 13, 13, mat.darkCast);
    b.box(55, 99, z, 264, 2.8, 15, mat.cast);
    for (let i = 0; i < 5; i++) {
      b.box(-58 + i * 53, 39, z, 10, 101, 15, mat.cast);
      b.box(-58 + i * 53, 91, z, 17, 9, 19, mat.darkCast);
    }
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
        .replace('blendOverlay( base.rgb, color )', 'mix(vec3(.044,.072,.074),base.rgb,.53)+ripple*.004'),
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
  const pools = createWetDeck([
    [DECK.x0, DECK.x1, DECK.z0, 3.5],
    [HALL.x0, HALL.x1, HALL.z0, HALL.z1],
    [TRESTLE.x0, TRESTLE.x1, TRESTLE.z0 + 0.4, HALL.z0],
  ]);
  scene.add(pools);
  let reflect = true,
    indoors = false;
  cadence(pools, 2, () => reflect && !indoors);
  cadence(water, 3, () => !indoors);
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
  for (let i = 0; i < 34; i++) {
    const m = new T.SpriteMaterial({ map: tex, color: 0xc2c7bd, opacity: 0.235, transparent: true, depthWrite: false });
    const s = new T.Sprite(m);
    // Banks lie on the reservoir, below every walkway, and clear of the deck sides.
    s.position.set(i % 2 ? -30 : 135, -5.2 + (i % 3) * 0.4, 100 - i * 23);
    s.scale.set(69 + (i % 4) * 13, 5 + (i % 3) * 1.5, 1);
    s.userData.x = s.position.x;
    s.userData.opacity = 0.3;
    scene.add(s);
    fogBanks.push(s);
  }

  const hemiSky = new T.Color(0xc8ddf5),
    hemiGround = new T.Color(0x6e6252);
  const hemi = new T.HemisphereLight(hemiSky, hemiGround, 0.29);
  scene.add(hemi);
  // Both suns carry the full intensity; the cascade patch picks one per fragment.
  const SUN = 3.55;
  const sun = new T.DirectionalLight(0xffddb2, SUN);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -56, right: 56, top: 60, bottom: -52, near: 0.5, far: 420 });
  sun.shadow.normalBias = 0.043;
  sun.shadow.bias = -0.00023;
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun, sun.target);
  const farSun = new T.DirectionalLight(0xffddb2, SUN);
  farSun.target.position.set(48, 83, -160);
  farSun.position.copy(farSun.target.position).addScaledVector(SOLAR, 730);
  farSun.castShadow = true;
  farSun.shadow.mapSize.set(4096, 4096);
  Object.assign(farSun.shadow.camera, { left: -390, right: 390, top: 343, bottom: -343, near: 10, far: 1400 });
  farSun.shadow.camera.updateProjectionMatrix();
  farSun.shadow.normalBias = 0.15;
  farSun.shadow.bias = -0.00009;
  farSun.shadow.autoUpdate = false;
  farSun.shadow.needsUpdate = true;
  scene.add(farSun, farSun.target);

  // Weather tints: the sun becomes thin moonlight in the storm and a low warm light at dawn.
  // Both cascades always keep the same intensity; lightning lifts them together.
  const sunDay = new T.Color(0xffddb2),
    sunNight = new T.Color(0x8ea6c8),
    sunDawn = new T.Color(0xffb789),
    mistDay = new T.Color(0xc2c7bd),
    mistNight = new T.Color(0x2a3138),
    mist = new T.Color();
  let sunScale = 1,
    nearSun = true;
  const applySun = () => {
    farSun.intensity = SUN * sunScale;
    sun.intensity = nearSun ? SUN * sunScale : 0;
  };
  return {
    sky,
    hemi,
    sun,
    farSun,
    weather(state, flash, time) {
      const u = sky.material.uniforms;
      u.uStorm.value = state.storm;
      u.uDawn.value = state.dawn;
      u.uFlash.value = flash;
      u.uTime.value = time;
      sun.color.copy(sunDay).lerp(sunDawn, state.dawn).lerp(sunNight, state.storm);
      farSun.color.copy(sun.color);
      sunScale = 1 - 0.93 * state.storm - 0.25 * state.dawn * (1 - state.storm) + flash * 0.9;
      applySun();
      hemi.color.copy(hemiSky).lerp(sunNight, state.storm * 0.6);
      hemi.groundColor.copy(hemiGround).multiplyScalar(1 - 0.7 * state.storm);
      mist.copy(mistDay).lerp(mistNight, state.storm);
      for (const f of fogBanks) f.material.color.copy(mist);
    },
    quality(mode) {
      reflect = mode !== 'low';
      pools.material.uniforms.uReflect.value = Number(reflect);
      water.visible = mode !== 'low';
      flatWater.visible = !water.visible;
      fogBanks.forEach((f, i) => (f.visible = mode !== 'low' || i % 3 === 0));
      sun.shadow.mapSize.set(mode === 'high' ? 4096 : 2048, mode === 'high' ? 4096 : 2048);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
      // Without shadow maps the cascade patch is inactive, so only one sun may shine.
      nearSun = mode !== 'low';
      applySun();
    },
    update(dt, time, player, camera, inside) {
      indoors = inside > 0.6;
      sky.position.copy(camera.position);
      sun.target.position.copy(player);
      sun.position.copy(player).addScaledVector(SOLAR, 190);
      water.material.uniforms.uTime.value = time;
      pools.material.uniforms.uTime.value = time;
      fogBanks.forEach((s, i) => {
        s.position.x = s.userData.x + Math.sin(time * 0.018 + i) * 4.2;
        // A billboard close to the camera would read as a pane of glass; let it thin out instead.
        const d = s.position.distanceTo(camera.position);
        s.material.opacity = s.userData.opacity * T.MathUtils.smoothstep(d, 45, 110);
      });
    },
  };
}
