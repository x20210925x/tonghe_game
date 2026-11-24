import * as T from '../../assets/three.module.min.js';
import { Box } from '../engine/physics.js';
import { cutWall } from './core.js';
import {
  NORTH_DOOR,
  STORM_BRIDGE as SB,
  REFUGE,
  BROKEN_RAILS,
  DAM,
  ROAD,
  BAY,
  GATES,
  GATE_SLOT,
  HOUSE,
  SHAFT_ROOM,
  GALLERY,
  JUNCTION,
  PANELS,
  RESERVOIR,
  insideDam,
} from '../game/layout.js';

// Chapter two's ground: the north door of the core, the storm bridge and the north dam with its
// hoist house, gallery and reservoir. Everything here also stands in chapter one, closed.
const METAL = { surface: 'metal' };
const bayOf = (g) => [g.x - BAY / 2, g.x + BAY / 2];
const SILL = DAM.sill,
  TOP = DAM.crest;
const LEAF_LOW = SILL,
  LEAF_HIGH = TOP + 0.4;

// Downstream steps: step k spans z from DOWN + 2.4k to DOWN + 2.4(k+1) and tops out at FACE - 4k.
const STEP = { run: 2.4, rise: 4, count: 20 };
const nosing = (z) => DAM.face - ((z - (DAM.down + STEP.run)) * STEP.rise) / STEP.run;

function waterTexture() {
  // A tiling normal map of soft ripples, drawn once.
  const size = 128,
    c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d'),
    img = g.createImageData(size, size);
  const h = (x, y) =>
    Math.sin((x / size) * Math.PI * 6 + Math.sin((y / size) * Math.PI * 4) * 1.3) * 0.5 +
    Math.sin((y / size) * Math.PI * 10 + (x / size) * Math.PI * 2) * 0.3 +
    Math.sin(((x + y) / size) * Math.PI * 14) * 0.2;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = h(x + 1, y) - h(x - 1, y),
        dy = h(x, y + 1) - h(x, y - 1),
        i = (y * size + x) * 4;
      img.data[i] = 128 + dx * 90;
      img.data[i + 1] = 128 + dy * 90;
      img.data[i + 2] = 255;
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  const tex = new T.CanvasTexture(c);
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  return tex;
}

// A ribbon of white water from behind the gate, over the lip and down the stepped face.
function spillSheet(x0, x1) {
  const path = [
    [GATE_SLOT.z1, SILL + 0.25],
    [DAM.down, SILL + 0.25],
    [DAM.down + 0.6, SILL - 0.8],
    [DAM.down + 1.2, SILL - 3.5],
    [DAM.down + 1.7, SILL - 7.5],
    [DAM.down + 2.1, SILL - 12.5],
    [DAM.down + 2.4, SILL - 17.5],
  ];
  for (let z = DAM.down + 3; z <= DAM.down + STEP.run * STEP.count + 0.3; z += 1.5) path.push([z, nosing(z) + 0.35]);
  const xyz = [],
    uv = [],
    index = [];
  let s = 0;
  path.forEach(([z, y], i) => {
    if (i) s += Math.hypot(z - path[i - 1][0], y - path[i - 1][1]);
    xyz.push(x0, y, z, x1, y, z);
    uv.push(0, s / 8, 1, s / 8);
    if (i) {
      const n = i * 2;
      index.push(n - 2, n - 1, n, n, n - 1, n + 1);
    }
  });
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(xyz, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  const lip = Math.hypot(DAM.down - GATE_SLOT.z1, 0) / 8;
  const sheet = new T.Mesh(
    geo,
    new T.ShaderMaterial({
      side: T.DoubleSide,
      transparent: true,
      depthWrite: false,
      uniforms: { flow: { value: 0 }, clock: { value: 0 }, light: { value: 1 } },
      vertexShader: `varying vec2 st;void main(){st=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec2 st;uniform float flow,clock,light;
      float h(vec2 p){return fract(sin(dot(p,vec2(91.3,217.9)))*43758.5);}
      float noise(vec2 p){vec2 i=floor(p),t=fract(p);t=t*t*(3.-2.*t);return mix(mix(h(i),h(i+vec2(1,0)),t.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),t.x),t.y);}
      void main(){
        float v=st.y-clock*1.6;
        float stripe=noise(vec2(st.x*38.,v*9.))*.6+noise(vec2(st.x*120.,v*26.))*.4;
        float aerated=smoothstep(${lip.toFixed(3)},${(lip + 0.5).toFixed(3)},st.y);
        float foam=smoothstep(.5-aerated*.35,.86,stripe);
        float edge=smoothstep(0.,.03,min(st.x,1.-st.x));
        // Foam is lit by the sky: dim at night, bright in a lightning flash.
        vec3 col=mix(vec3(.05,.085,.09),vec3(.72,.78,.78),foam)*clamp(.12+.88*light,.12,1.4);
        gl_FragColor=vec4(col,flow*edge*(.5+.45*stripe)*(.55+.45*aerated));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    })
  );
  sheet.frustumCulled = false;
  sheet.visible = false;
  return sheet;
}

export function buildDam(b) {
  const { scene, mat, physics } = b;
  const dyn = (x, y, z, w, h, d, o = {}) => physics.add(new Box(x, y, z, w, h, d, { ...o, dynamic: true }));
  const block = (x0, x1, y0, y1, z0, z1, m = mat.darkCast, o = true) => {
    if (x1 - x0 > 1e-3 && y1 - y0 > 1e-3 && z1 - z0 > 1e-3) b.block(x0, x1, y0, y1, z0, z1, m, o);
  };
  const group = new T.Group();
  scene.add(group);
  const lights = { r1: [], r2: [], r3: [], r4: [], gallery: [] };
  const strip = (key, x, y, z, w, d) => lights[key].push(b.part(group, x, y, z, w, 0.06, d, mat.stripOff, false));

  // ---------- North door of the core (+96) ----------
  const D = NORTH_DOOR,
    dz = -301.8,
    dc = (D.x0 + D.x1) / 2,
    dTop = D.y + D.height;
  b.box(dc, D.y + 0.012, -303.5, D.x1 - D.x0, 0.024, 3.0, mat.edge);
  for (const x of [D.x0 - 0.07, D.x1 + 0.07]) b.box(x, D.y + D.height / 2 + 0.06, -301.94, 0.14, D.height + 0.12, 0.12, mat.steel);
  b.box(dc, dTop + 0.07, -301.94, D.x1 - D.x0 + 0.28, 0.14, 0.12, mat.steel);
  b.box(dc + 1.3, dTop + 0.26, -301.83, 4.9, 0.12, 0.1, mat.iron);
  for (const x of [dc - 1.0, dc + 1.3, dc + 3.6]) b.box(x, dTop + 0.26, -301.92, 0.12, 0.3, 0.06, mat.steel);
  const leaf = new T.Group();
  leaf.position.set(dc, D.y, dz);
  group.add(leaf);
  b.part(leaf, 0, D.height / 2, 0, D.x1 - D.x0 + 0.1, D.height - 0.04, 0.07, mat.doorPanel);
  b.part(leaf, 0, D.height / 2, 0.05, D.x1 - D.x0 - 0.1, 0.1, 0.04, mat.ochre);
  b.part(leaf, -0.82, 1.05, 0.06, 0.06, 0.32, 0.06, mat.steel);
  b.part(leaf, 0, 1.75, 0.04, 0.6, 0.34, 0.03, mat.black);
  for (const x of [-0.75, 0.75]) b.part(leaf, x, D.height + 0.18, 0, 0.16, 0.2, 0.08, mat.iron);
  const doorBox = dyn(dc, D.y + D.height / 2 + 0.05, dz, D.x1 - D.x0 + 0.1, D.height - 0.1, 0.24);
  for (const x of [D.x0 - 0.75, D.x1 + 0.75]) b.box(x, D.y + 1.85, -305.13, 0.24, 0.3, 0.26, mat.lamp);
  b.plate('北门  →  北坝', 'N-01  /  STORM BRIDGE', dc, dTop + 0.78, -301.97, 2.0, 0.5);

  // ---------- Storm bridge ----------
  const xc = (SB.x0 + SB.x1) / 2,
    top = SB.top;
  const spans = [];
  let south = SB.z0;
  for (const p of SB.piers) {
    spans.push([south, p + REFUGE.half]);
    south = p - REFUGE.half;
  }
  spans.push([south, SB.z1]);
  // Bearing corbels on the core and on the dam face carry the end spans.
  b.box(xc, 94.25, -306.1, 4.2, 3.22, 2.2, mat.cast);
  b.box(xc, 94.25, DAM.down + 1.1, 4.2, 3.22, 2.2, mat.cast);
  const inBroken = (z) => BROKEN_RAILS.some(([a, c]) => z > a && z < c);
  for (const [za, zb] of spans) {
    const len = za - zb,
      mid = (za + zb) / 2;
    b.slab(SB.x0, SB.x1, zb, za, top - 0.03, 0.09, mat.grate, false);
    // Grating texture: bearing bars across the deck and edge angles along it.
    for (let z = za - 0.2; z > zb; z -= 0.34) b.box(xc, top - 0.012, z, SB.x1 - SB.x0 - 0.1, 0.024, 0.045, mat.iron);
    for (const x of [SB.x0 + 0.04, SB.x1 - 0.04]) b.box(x, top - 0.01, mid, 0.08, 0.06, len, mat.edge);
    b.collider(xc, top - 0.06, mid, SB.x1 - SB.x0, 0.12, len, METAL);
    for (const x of [SB.x0 + 0.1, SB.x1 - 0.1]) {
      b.beam([x, 95.74, za], [x, 95.74, zb], 0.2, 0.24, mat.steel);
      b.beam([x, 93.45, za - 0.6], [x, 93.45, zb + 0.6], 0.2, 0.24, mat.steel);
      const n = Math.round(len / 4);
      for (let i = 0; i <= n; i++) {
        const z = za - (len * i) / n;
        b.box(x, 94.6, z, 0.14, 2.3, 0.14, mat.steel);
        if (i < n) {
          const z2 = za - (len * (i + 1)) / n;
          if (i % 2) b.beam([x, 93.5, z], [x, 95.7, z2], 0.1, 0.12, mat.steel);
          else b.beam([x, 95.7, z], [x, 93.5, z2], 0.1, 0.12, mat.steel);
        }
      }
    }
    for (let z = za - 1; z > zb; z -= 2) b.box(xc, 95.79, z, SB.x1 - SB.x0 + 0.1, 0.16, 0.12, mat.steel);
    for (let z = za; z > zb + 7; z -= 8) {
      b.beam([SB.x0 + 0.1, 93.4, z], [SB.x1 - 0.1, 93.4, z - 8], 0.07, 0.07, mat.iron);
      b.beam([SB.x1 - 0.1, 93.4, z], [SB.x0 + 0.1, 93.4, z - 8], 0.07, 0.07, mat.iron);
    }
    // Cable tray under the east edge, from the core to the dam.
    b.box(SB.x1 - 0.55, 95.48, mid, 0.42, 0.06, len, mat.iron);
    for (const off of [-0.1, 0.06]) b.rod([SB.x1 - 0.55 + off, 95.54, za], [SB.x1 - 0.55 + off, 95.54, zb], 0.035, mat.black);
    // West rail is whole; the east rail is broken where the storm tore it.
    b.rail(SB.x0 + 0.05, za, SB.x0 + 0.05, zb, top, mat.ochre);
    let start = za;
    const cuts = BROKEN_RAILS.filter(([a, c]) => c <= za && a >= zb).sort((p, q) => q[1] - p[1]);
    for (const [a, c] of cuts) {
      if (start - c > 0.2) b.rail(SB.x1 - 0.05, start, SB.x1 - 0.05, c, top, mat.ochre);
      start = a;
    }
    if (start - zb > 0.2) b.rail(SB.x1 - 0.05, start, SB.x1 - 0.05, zb, top, mat.ochre);
    for (let z = za - 6; z > zb + 2; z -= 12) {
      if (inBroken(z)) continue;
      b.box(SB.x1 - 0.05, 97.2, z, 0.12, 0.26, 0.12, mat.steel);
      b.box(SB.x1 - 0.2, 97.36, z, 0.32, 0.1, 0.2, mat.lamp);
    }
  }
  for (const [a, c] of BROKEN_RAILS) {
    // Torn posts lean out over the drop; a snapped rail hangs from the last one.
    const x = SB.x1 - 0.05;
    const posts = [c - 1.6, (a + c) / 2 + 1.2, a + 1.4];
    posts.forEach((z, i) => {
      const lean = 0.35 + i * 0.25;
      b.beam([x, top, z], [x + lean, top + 0.95, z + (i - 1) * 0.2], 0.055, 0.055, mat.ochre);
      b.box(x, top + 0.012, z, 0.15, 0.024, 0.15, mat.iron);
    });
    b.rod([x, top + 1.04, c], [x + 0.45, top + 0.2, c - 2.2], 0.03, mat.ochre);
    b.rod([x, top + 1.04, a], [x + 0.7, top - 0.6, a + 1.8], 0.03, mat.ochre);
    for (const z of [a, c]) b.box(x, top + 1.22, z, 0.14, 0.14, 0.14, mat.redLight);
    b.plate('护栏损坏', 'GUARDRAIL DOWN', SB.x1 - 0.1, top + 0.72, c + 1.0, 0.86, 0.3, -Math.PI / 2, '#3a1d14', '#f0c9a6');
  }
  // Piers rise from the river (or the dam toe) to hammerhead caps; each cap carries a refuge.
  SB.piers.forEach((p, i) => {
    b.box(xc, -4.4, p, 6.6, 3.6, 5.2, mat.cast);
    b.box(xc, 13, p, 4.6, 34, 3.4, mat.darkCast);
    b.box(xc, 50, p, 4.0, 40.2, 3.0, mat.darkCast);
    b.box(xc, 81.5, p, 3.4, 23.2, 2.6, mat.darkCast);
    b.box(xc, 94.26, p, 7.0, 2.52, 8.4, mat.cast);
    b.slab(REFUGE.x0, REFUGE.x1, p - REFUGE.half, p + REFUGE.half, top, 0.5, mat.deck);
    // Windbreak: louvred steel on the west edge, posts at the ends and the middle.
    for (const z of [p - 3.6, p, p + 3.6]) b.box(REFUGE.x0 + 0.12, top + 1.35, z, 0.16, 2.7, 0.16, mat.steel);
    for (let k = 0; k < 8; k++) b.box(REFUGE.x0 + 0.17, top + 0.35 + k * 0.3, p, 0.05, 0.2, 7.1, mat.steel);
    b.box(REFUGE.x0 + 0.12, top + 2.75, p, 0.22, 0.12, 7.4, mat.iron);
    b.collider(REFUGE.x0 + 0.14, top + 1.4, p, 0.3, 2.8, 7.4, { camera: false });
    b.box(REFUGE.x0 + 0.33, top + 2.3, p + 2.6, 0.2, 0.14, 0.34, mat.lamp);
    b.plate('避风处', `REFUGE  /  P-0${i + 1}`, REFUGE.x0 + 0.23, top + 1.75, p, 1.2, 0.38, Math.PI / 2);
    b.rail(REFUGE.x1 - 0.05, p + REFUGE.half, REFUGE.x1 - 0.05, p - REFUGE.half, top, mat.ochre);
    for (const z of [p + REFUGE.half, p - REFUGE.half]) {
      b.rail(REFUGE.x0 + 0.25, z, SB.x0 + 0.05, z, top, mat.ochre);
      b.rail(SB.x1 - 0.05, z, REFUGE.x1 - 0.05, z, top, mat.ochre);
    }
  });

  // ---------- Dam body ----------
  const { x0: X0, x1: X1, up: UP, down: DOWN } = DAM;
  const G = GATES.map(bayOf);
  const P2 = [G[0][1], G[1][0]];
  const gx0 = GALLERY.x0,
    gx1 = GALLERY.x1,
    sx1 = GALLERY.shaftX1,
    gz0 = GALLERY.z0,
    gz1 = GALLERY.z1;
  const gy = GALLERY.y,
    gTop = gy + GALLERY.height;
  block(X0, X1, -12, gy, UP, DOWN);
  // Gallery layer.
  block(X0, gx0, gy, gTop, UP, DOWN);
  block(gx1, X1, gy, gTop, UP, DOWN);
  block(gx0, gx1, gy, gTop, UP, gz0);
  block(gx0, gx1, gy, gTop, gz1, DOWN);
  // Between the gallery roof and the sills, pierced only by the shaft.
  block(X0, gx0, gTop, SILL, UP, DOWN);
  block(sx1, X1, gTop, SILL, UP, DOWN);
  block(gx0, sx1, gTop, SILL, UP, gz0);
  block(gx0, sx1, gTop, SILL, gz1, DOWN);
  // Crest: piers and the non-overflow sections stand to the top; the bays are open channels.
  block(X0, G[0][0], SILL, TOP, UP, DOWN);
  block(G[1][1], G[2][0], SILL, TOP, UP, DOWN);
  block(G[2][1], X1, SILL, TOP, UP, DOWN);
  block(P2[0], gx0, SILL, TOP, UP, DOWN);
  block(sx1, P2[1], SILL, TOP, UP, DOWN);
  block(gx0, sx1, SILL, TOP, UP, gz0);
  block(gx0, sx1, SILL, TOP, gz1, DOWN);
  // The shaft is roofed except over the first flight.
  const holeX = sx1 - 0.9;
  block(gx0, sx1, TOP - 0.6, TOP, GALLERY.mid, gz1, mat.darkCast);
  block(holeX, sx1, TOP - 0.6, TOP, gz0, GALLERY.mid, mat.darkCast);
  for (const [a, c] of G) {
    block(a, c, TOP - 1.4, TOP, ROAD.z0, ROAD.z1, mat.darkCast);
    block(a, c, TOP - 0.6, TOP, UP, GATE_SLOT.z0 - 0.1);
    block(a, c, TOP - 0.6, TOP, GATE_SLOT.z1 + 0.1, ROAD.z0);
  }
  // Downstream face: twenty steps from +70 to the river.
  for (let k = 0; k < STEP.count; k++)
    block(X0, X1, -12, DAM.face - STEP.rise * k, DOWN + STEP.run * k, DOWN + STEP.run * (k + 1), mat.darkCast, { camera: true, walk: false });
  // Training walls continue the piers down the face, one each side of every bay.
  for (const [a, c] of G)
    for (const x of [a - 0.5, c + 0.5]) {
      b.box(x, (DAM.face + SILL + 1) / 2, DOWN + 1.1, 1.0, SILL + 1 - DAM.face, 2.2, mat.cast);
      b.beam([x, nosing(DOWN + 1.8) + 0.6, DOWN + 1.8], [x, nosing(DOWN + 47.5) + 0.6, DOWN + 47.5], 1.0, 3.6, mat.cast);
    }
  // Road paving over the whole crest, with a hazard line along the drop.
  b.box((X0 + X1) / 2, TOP, (ROAD.z0 + ROAD.z1) / 2, X1 - X0, 0.06, ROAD.z1 - ROAD.z0, mat.deck, true);
  b.box((X0 + X1) / 2, TOP + 0.033, ROAD.z1 - 0.45, X1 - X0, 0.006, 0.12, mat.hazard);
  // Parapets: concrete upstream where the hoist house does not stand, rails downstream.
  for (const [a, c] of [
    [X0, HOUSE.x0],
    [HOUSE.x1, X1],
  ]) {
    b.box((a + c) / 2, TOP + 0.55, UP + 0.3, c - a, 1.1, 0.6, mat.cast, true);
    b.box((a + c) / 2, TOP + 1.12, UP + 0.3, c - a, 0.06, 0.7, mat.darkCast);
  }
  const [w0, w1] = DAM.walk;
  b.rail(X0 + 1, ROAD.z1 - 0.15, w0, ROAD.z1 - 0.15, TOP, mat.steel, false);
  b.rail(w0, ROAD.z1 - 0.15, SB.x0, ROAD.z1 - 0.15, TOP, mat.ochre);
  b.rail(SB.x1, ROAD.z1 - 0.15, w1, ROAD.z1 - 0.15, TOP, mat.ochre);
  b.rail(w1, ROAD.z1 - 0.15, X1 - 1, ROAD.z1 - 0.15, TOP, mat.steel, false);
  for (let x = X0 + 10; x < X1; x += 22) b.lamp(x, ROAD.z1 - 0.6, 4.2, TOP);
  // The open crest ends at closed barrier gates.
  for (const x of [w0, w1]) {
    b.box(x, TOP + 0.6, (ROAD.z0 + ROAD.z1) / 2, 0.12, 1.2, ROAD.z1 - ROAD.z0 - 0.4, mat.steel);
    for (let k = 0; k < 4; k++) b.box(x, TOP + 0.35 + k * 0.28, (ROAD.z0 + ROAD.z1) / 2, 0.06, 0.12, ROAD.z1 - ROAD.z0 - 0.5, k % 2 ? mat.hazard : mat.black);
    b.barrier(x, ROAD.z0 - 5, x, ROAD.z1, TOP, 1.8);
  }
  b.gantry('坝顶  ·  封闭', 'CREST CLOSED', w0 + 0.6, (ROAD.z0 + ROAD.z1) / 2, Math.PI / 2, ROAD.z1 - ROAD.z0 - 0.6, 3.3, TOP, 2.0, 0.6);
  b.gantry('坝顶  ·  封闭', 'CREST CLOSED', w1 - 0.6, (ROAD.z0 + ROAD.z1) / 2, -Math.PI / 2, ROAD.z1 - ROAD.z0 - 0.6, 3.3, TOP, 2.0, 0.6);
  b.gantry('北坝  ·  启闭机房', 'N-DAM  /  HOIST HOUSE', xc, DOWN + 1.6, 0, SB.x1 - SB.x0 - 0.3, 3.3, TOP, 2.3, 0.66);

  // ---------- Hoist house ----------
  const H = HOUSE,
    hTop = H.top,
    inner0 = H.z0 + 0.4,
    inner1 = H.z1 - 0.4;
  block(H.x0, H.x1, TOP, hTop, H.z0, inner0, mat.cast);
  const doors = [...GATES.map((g) => g.door), SHAFT_ROOM.door];
  const windows = [74, 84.5, 97.5, 106.5, 115, 125.5];
  cutWall(b, 'x', inner1, H.z1, H.x0, H.x1, TOP, hTop, [
    ...doors.map((x) => ({ a0: x - 0.9, a1: x + 0.9, y0: TOP, y1: TOP + 2.4 })),
    ...windows.map((x) => ({ a0: x - 1.2, a1: x + 1.2, y0: TOP + 2.9, y1: TOP + 4.1 })),
  ], mat.cast);
  block(H.x0, H.x0 + 0.4, TOP, hTop, inner0, inner1, mat.cast);
  block(H.x1 - 0.4, H.x1, TOP, hTop, inner0, inner1, mat.cast);
  for (const x of H.walls) block(x - 0.2, x + 0.2, TOP, hTop, inner0, inner1, mat.cast);
  block(H.x0 - 0.3, H.x1 + 0.3, hTop, hTop + 0.7, H.z0 - 0.3, H.z1 + 0.3, mat.darkCast);
  b.box((H.x0 + H.x1) / 2, hTop + 0.8, H.z1 + 0.2, H.x1 - H.x0 + 0.6, 0.2, 0.2, mat.cast);
  const roomOf = (x) => (x < H.walls[0] ? 'r1' : x < H.walls[1] ? 'r2' : x < H.walls[2] ? 'r3' : 'r4');
  const glass = { r1: [], r2: [], r3: [], r4: [] };
  for (const x of windows) {
    glass[roomOf(x)].push(b.part(group, x, TOP + 3.5, H.z1 - 0.2, 2.4, 1.2, 0.05, mat.black, false));
    for (const k of [-0.6, 0, 0.6]) b.box(x + k * 1.9, TOP + 3.5, H.z1 - 0.17, 0.06, 1.2, 0.08, mat.steel);
  }
  doors.forEach((x) => {
    b.box(x, TOP + 2.44, H.z1 + 0.12, 0.42, 0.1, 0.2, mat.lamp);
    b.box(x, TOP + 2.55, H.z1 + 0.45, 2.3, 0.1, 0.9, mat.iron);
  });
  GATES.forEach((g, i) =>
    b.plate(`${i + 1} 号闸`, `G-0${i + 1}  /  HOIST`, g.door + 1.9, TOP + 1.9, H.z1 + 0.03, 1.2, 0.4)
  );
  b.plate('廊道竖井', 'GALLERY SHAFT', SHAFT_ROOM.door, TOP + 2.9, H.z1 + 0.03, 1.4, 0.4);
  // Ceiling strips per room: dark until the room has power.
  for (const [key, a, c] of [
    ['r1', H.x0 + 0.4, H.walls[0] - 0.2],
    ['r2', H.walls[0] + 0.2, H.walls[1] - 0.2],
    ['r3', H.walls[1] + 0.2, H.walls[2] - 0.2],
    ['r4', H.walls[2] + 0.2, H.x1 - 0.4],
  ])
    for (let x = a + 2; x < c - 1; x += 4.5) strip(key, x, hTop - 0.08, -474.6, 1.4, 0.2);
  // Slot guards: a kerb and rail either side of each leaf, the hoists above.
  const leaves = [],
    cables = [];
  GATES.forEach((g, i) => {
    const [a, c] = bayOf(g);
    for (const z of [GATE_SLOT.z0 - 0.15, GATE_SLOT.z1 + 0.15]) {
      b.box(g.x, TOP + 0.08, z, BAY, 0.16, 0.18, mat.hazard);
      b.rail(a, z, c, z, TOP + 0.16, mat.ochre);
    }
    const leafGroup = new T.Group();
    leafGroup.position.set(g.x, LEAF_LOW, (GATE_SLOT.z0 + GATE_SLOT.z1) / 2);
    group.add(leafGroup);
    const h = LEAF_HIGH - LEAF_LOW;
    b.part(leafGroup, 0, h / 2, -0.12, BAY + 0.5, h, 0.12, mat.steel);
    for (let k = 0; k < 6; k++) b.part(leafGroup, 0, 0.5 + k * 1.3, 0.12, BAY + 0.3, 0.32, 0.36, mat.iron);
    for (const x of [-BAY / 4, BAY / 4]) b.part(leafGroup, x, h + 0.15, 0, 0.4, 0.3, 0.4, mat.ochreDark);
    leaves.push(leafGroup);
    if (i < 2) {
      // Rope hoists hang from the roof; each cable reaches down to a lifting lug.
      for (const x of [g.x - BAY / 4, g.x + BAY / 4]) {
        b.rod([x - 0.8, hTop - 0.9, -476.3], [x + 0.8, hTop - 0.9, -476.3], 0.42, mat.enamel);
        b.box(x + 1.3, hTop - 0.9, -476.3, 0.8, 0.7, 0.7, mat.enamel);
        b.box(x, hTop - 0.3, -476.3, 2.6, 0.3, 0.3, mat.steel);
        cables.push({ i, mesh: b.part(group, x, 0, -476.3, 0.05, 1, 0.05, mat.black, false), top: hTop - 1.32 });
      }
    } else {
      // Hydraulic hoist: two cylinders hung from the roof, their rods following the leaf.
      for (const x of [g.x - BAY / 4, g.x + BAY / 4]) {
        b.rod([x, hTop - 1.4, -476.3], [x, hTop - 0.3, -476.3], 0.34, mat.enamel);
        b.box(x, hTop - 0.2, -476.3, 0.9, 0.2, 0.9, mat.steel);
        b.rod([x, hTop - 0.75, -477.05], [x, hTop - 0.75, -476.5], 0.05, mat.black);
        cables.push({ i, mesh: b.part(group, x, 0, -476.3, 0.16, 1, 0.16, mat.edge, false), top: hTop - 1.4 });
      }
    }
  });
  // Control points.
  const cabinet = (spot, w, h, d, m) => {
    const c = Math.cos(spot.face),
      s = Math.sin(spot.face);
    b.box(spot.x - s * 0.02, TOP + h / 2, spot.z - c * 0.02, w, h, d, m, { yaw: spot.face });
    return [spot.x + s * (d / 2 + 0.01), spot.z + c * (d / 2 + 0.01)];
  };
  const powerFace = cabinet(PANELS.power, 1.2, 2.1, 0.6, mat.electricPanel);
  const powerLamp = b.part(group, powerFace[0], TOP + 1.9, PANELS.power.z, 0.04, 0.1, 0.1, mat.redLight, false);
  const powerLever = new T.Group();
  powerLever.position.set(powerFace[0] + 0.05, TOP + 1.25, PANELS.power.z);
  group.add(powerLever);
  b.part(powerLever, 0.05, 0, 0, 0.1, 0.5, 0.08, mat.red);
  const consoles = {};
  for (const key of ['g1', 'g2']) {
    const spot = PANELS[key];
    const [fx, fz] = cabinet(spot, 1.5, 1.05, 0.7, mat.instrumentPanel);
    b.box(spot.x, TOP + 1.3, spot.z + 0.25, 1.5, 0.5, 0.14, mat.instrumentPanel);
    consoles[key] = {
      screen: b.part(group, spot.x, TOP + 1.32, spot.z + 0.17, 0.9, 0.32, 0.02, mat.stripOff, false),
      lamp: b.part(group, spot.x + 0.55, TOP + 0.95, fz - 0.02, 0.1, 0.1, 0.04, mat.redLight, false),
    };
  }
  // Hand pump for the hydraulic gate: power pack, pressure gauge and a long lever.
  const pump = PANELS.pump;
  b.box(pump.x + 1.0, TOP + 0.6, pump.z - 0.15, 1.6, 1.2, 0.9, mat.enamel, true);
  b.box(pump.x - 0.2, TOP + 0.5, pump.z, 0.5, 1.0, 0.5, mat.iron, true);
  // Pressure line from the power pack up to the cylinders over gate 3.
  const pipeX = pump.x + 1.6,
    pipeZ = -477.05,
    pipeY = hTop - 0.75;
  b.rod([pipeX, TOP + 1.2, pipeZ], [pipeX, pipeY, pipeZ], 0.05, mat.black);
  b.rod([pipeX, pipeY, pipeZ], [GATES[2].x - BAY / 4, pipeY, pipeZ], 0.05, mat.black);
  b.part(group, pump.x + 0.6, TOP + 0.85, pump.z + 0.32, 0.36, 0.36, 0.03, mat.paper, false);
  const needle = new T.Group();
  needle.position.set(pump.x + 0.6, TOP + 0.85, pump.z + 0.35);
  group.add(needle);
  b.part(needle, 0, 0.08, 0, 0.02, 0.16, 0.01, mat.red, false);
  const lever = new T.Group();
  lever.position.set(pump.x - 0.2, TOP + 1.0, pump.z + 0.05);
  group.add(lever);
  b.part(lever, 0, 0.55, 0, 0.07, 1.1, 0.07, mat.ochre);
  b.part(lever, 0, 1.1, 0, 0.12, 0.12, 0.3, mat.rubber);

  // ---------- Gallery shaft and gallery (+84) ----------
  const zA = (gz0 + GALLERY.mid) / 2,
    zB = (GALLERY.mid + gz1) / 2,
    fw = GALLERY.mid - gz0 - 0.1,
    fx0 = gx0 + 0.9,
    fx1 = holeX;
  const flights = [
    { z: zA, bottom: fx0, topX: fx1, y: TOP - 3 },
    { z: zB, bottom: fx1, topX: fx0, y: TOP - 6 },
    { z: zA, bottom: fx0, topX: fx1, y: TOP - 9 },
    { z: zB, bottom: fx1, topX: fx0, y: gy },
  ];
  for (const f of flights)
    b.flight({ x0: f.bottom, z0: f.z, x1: f.topX, z1: f.z, y0: f.y, y1: f.y + 3, width: fw, steps: 12, rails: [true, true] });
  for (const y of [TOP - 3, gTop]) b.slab(gx0, fx0, gz0, gz1, y, 0.14, mat.grate, METAL);
  b.slab(fx1, sx1, gz0, gz1, TOP - 6, 0.14, mat.grate, METAL);
  b.barrier(fx0, GALLERY.mid, fx1, GALLERY.mid, gy, TOP - gy + 1.2);
  for (let y = gy + 1; y < TOP; y += 3) b.box((fx0 + fx1) / 2, y, GALLERY.mid, fx1 - fx0, 0.05, 0.05, mat.steel);
  b.rail(gx0, GALLERY.mid, holeX, GALLERY.mid, TOP, mat.ochre);
  b.box((gx0 + holeX) / 2, TOP + 0.08, GALLERY.mid + 0.05, holeX - gx0, 0.16, 0.1, mat.hazard);
  b.plate('↓  检修廊 +084', 'GALLERY', (gx0 + holeX) / 2, TOP + 1.45, GALLERY.mid + 0.06, 1.5, 0.42);
  // The corridor: a drain along the south wall, a cable tray to the junction box, lamps.
  b.box((gx0 + gx1) / 2, gy + 0.006, gz1 - 0.2, gx1 - gx0, 0.012, 0.24, mat.iron);
  b.box((sx1 + gx1) / 2, gTop - 0.5, gz0 + 0.18, gx1 - sx1, 0.06, 0.32, mat.iron);
  for (const off of [0.08, 0.2]) b.rod([sx1, gTop - 0.45, gz0 + off], [JUNCTION.x - 0.5, gTop - 0.45, gz0 + off], 0.03, mat.black);
  b.rod([gx0, gy + 0.45, gz1 - 0.12], [gx1, gy + 0.45, gz1 - 0.12], 0.09, mat.steel);
  for (let x = gx0 + 1.5; x < gx1; x += 3.4) strip('gallery', x, gTop - 0.05, (gz0 + gz1) / 2, 0.9, 0.16);
  const beacons = [];
  for (let x = sx1 + 1; x < gx1; x += 5) beacons.push(b.part(group, x, gTop - 0.12, gz1 - 0.1, 0.16, 0.12, 0.12, mat.redLight, false));
  b.plate('检修廊  +084', 'GALLERY  /  N-DAM', sx1 + 1.6, gy + 2.1, gz0 + 0.03, 1.4, 0.42);
  // The junction box that tripped when the gallery flooded.
  b.box(JUNCTION.x, gy + 1.3, gz0 + 0.18, 0.95, 1.25, 0.34, mat.electricPanel);
  b.box(JUNCTION.x, gy + 2.0, gz0 + 0.1, 0.5, 0.18, 0.2, mat.iron);
  const junctionLamp = b.part(group, JUNCTION.x + 0.32, gy + 1.78, gz0 + 0.37, 0.08, 0.08, 0.03, mat.redLight, false);
  const junctionHandle = new T.Group();
  junctionHandle.position.set(JUNCTION.x - 0.15, gy + 1.15, gz0 + 0.38);
  group.add(junctionHandle);
  b.part(junctionHandle, 0, 0.12, 0, 0.06, 0.26, 0.05, mat.ochre);
  const flood = new T.Mesh(
    new T.PlaneGeometry(gx1 - 97.5, gz1 - gz0),
    new T.MeshStandardMaterial({ color: 0x0f1517, roughness: 0.06, metalness: 0.3, transparent: true, opacity: 0.86 })
  );
  flood.rotation.x = -Math.PI / 2;
  flood.position.set((97.5 + gx1) / 2, gy + 0.16, (gz0 + gz1) / 2);
  group.add(flood);

  // ---------- Reservoir and spill ----------
  const ripples = waterTexture();
  ripples.repeat.set(36, 110);
  const waterMat = new T.MeshStandardMaterial({
    color: 0x18211f,
    roughness: 0.12,
    metalness: 0.25,
    normalMap: ripples,
    normalScale: new T.Vector2(0.35, 0.35),
  });
  const depth = 820;
  const reservoir = new T.Mesh(new T.PlaneGeometry(X1 - X0, depth), waterMat);
  reservoir.rotation.x = -Math.PI / 2;
  reservoir.position.set((X0 + X1) / 2, RESERVOIR.start, UP - 0.03 - depth / 2);
  group.add(reservoir);
  const pockets = GATES.map((g) => {
    const m = new T.Mesh(new T.PlaneGeometry(BAY, GATE_SLOT.z0 - UP + 0.02), waterMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(g.x, RESERVOIR.start, (UP + GATE_SLOT.z0) / 2);
    group.add(m);
    return m;
  });
  const sheets = GATES.map((g) => {
    const [a, c] = bayOf(g);
    const s = spillSheet(a + 0.1, c - 0.1);
    group.add(s);
    return s;
  });

  // One ceiling light follows the inspector through whichever room has power, so lit rooms
  // read as lit without a light per lamp.
  const roomLamp = new T.PointLight(0xffe2b8, 0, 15, 1.3);
  scene.add(roomLamp);
  let roomLevel = 0;

  const state = { door: 0, gates: [0, 0, 0], level: RESERVOIR.start };
  const flash = (t, rate = 2.4) => Math.sin(t * Math.PI * rate) > 0;
  const setLit = (list, on, lit = mat.strip) => {
    for (const m of list) m.material = on ? lit : mat.stripOff;
  };
  const api = {
    shadowsDirty: false,
    state,
    update(dt, time, site, camera, light = 1, body = null) {
      const ch2 = site.chapter === 2;
      // Door.
      const open = ch2 && site.has('ndoor') ? 1 : 0;
      state.door = T.MathUtils.damp(state.door, open, 2.2, dt);
      const slide = state.door * D.slide;
      leaf.position.x = dc + slide;
      doorBox.moveTo(dc + slide, D.y + D.height / 2 + 0.05, dz);
      doorBox.enabled = state.door < 0.92;
      // Reservoir.
      state.level = Number.isFinite(site.level) ? site.level : RESERVOIR.start;
      const shown = Math.min(state.level, TOP - 0.15);
      reservoir.position.y = shown;
      for (const p of pockets) p.position.y = shown;
      ripples.offset.set(time * 0.006, -time * 0.011);
      // Gates and their hoists.
      GATES.forEach((g, i) => {
        const target = site.gates?.[g.id] ?? 0;
        const before = state.gates[i];
        state.gates[i] = target;
        if (Math.abs(target - before) > 0.002) api.shadowsDirty = true;
        const y = LEAF_LOW + GATE_SLOT.lift * target;
        leaves[i].position.y = y;
        const flow = T.MathUtils.smoothstep(target, 0, 0.35) * T.MathUtils.clamp((state.level - SILL) / 2, 0, 1);
        sheets[i].visible = flow > 0.01;
        sheets[i].material.uniforms.flow.value = flow;
        sheets[i].material.uniforms.clock.value = time;
        sheets[i].material.uniforms.light.value = light;
      });
      for (const c of cables) {
        const leafTop = LEAF_LOW + GATE_SLOT.lift * state.gates[c.i] + (LEAF_HIGH - LEAF_LOW) + 0.3;
        const len = Math.max(0.05, c.top - leafTop);
        c.mesh.scale.y = len;
        c.mesh.position.y = leafTop + len / 2;
      }
      // Rooms light up as they get power; the gallery blinks red until its box is reset.
      const power = ch2 && site.has('power'),
        reset = ch2 && site.has('junction');
      setLit(lights.r1, power);
      setLit(lights.r2, reset);
      setLit(lights.r3, reset);
      setLit(lights.r4, ch2, mat.amber);
      setLit(lights.gallery, reset);
      for (const [key, on] of [
        ['r1', power],
        ['r2', reset],
        ['r3', reset],
        ['r4', ch2],
      ])
        for (const m of glass[key]) m.material = on ? (key === 'r4' ? mat.amber : mat.screen) : mat.black;
      const blink = flash(time);
      beacons.forEach((m) => (m.visible = ch2 && !reset && blink));
      powerLamp.material = power ? mat.green : mat.redLight;
      powerLever.rotation.z = power ? -0.9 : 0.5;
      junctionLamp.material = reset ? mat.green : mat.redLight;
      junctionLamp.visible = reset || !ch2 || blink;
      junctionHandle.rotation.z = reset ? -1.2 : 0;
      consoles.g1.screen.material = power ? mat.screen : mat.stripOff;
      consoles.g1.lamp.material = site.has('g1') ? mat.green : mat.redLight;
      consoles.g2.screen.material = reset ? mat.screen : mat.stripOff;
      consoles.g2.lamp.material = site.has('g2') ? mat.green : mat.redLight;
      // Hydraulic pressure on the gauge; the lever follows the pump stroke.
      needle.rotation.z = 1.2 - 2.4 * T.MathUtils.clamp(site.pump ?? 0, 0, 1);
      lever.rotation.x = -0.25 - 0.55 * (site.stroke ?? 0);
      flood.visible = !reset;
      let want = 0;
      if (ch2 && body && insideDam(body.x, body.y, body.z)) {
        const [w1, w2, w3] = H.walls;
        if (body.y < 92) {
          want = reset ? 0.8 : 0;
          roomLamp.position.set(T.MathUtils.clamp(body.x, gx0 + 1, gx1 - 1), gTop - 0.35, (gz0 + gz1) / 2);
        } else {
          const [a, c, on] =
            body.x < w1 ? [H.x0, w1, power ? 1 : 0] : body.x < w2 ? [w1, w2, reset ? 0.8 : 0] : body.x < w3 ? [w2, w3, reset ? 1 : 0] : [w3, H.x1, 0.4];
          want = on;
          roomLamp.position.set(T.MathUtils.clamp(body.x, a + 2, c - 2), hTop - 0.7, -475.2);
        }
      }
      roomLevel = T.MathUtils.damp(roomLevel, want, 4, dt);
      roomLamp.intensity = roomLevel * 55;
      roomLamp.color.set(want < 0.5 && want > 0 ? 0xffb070 : 0xffe2b8);
    },
  };
  return api;
}
