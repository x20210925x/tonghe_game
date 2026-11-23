import * as T from '../../assets/three.module.min.js';
import { Box } from '../engine/physics.js';
import { textPlate } from '../render/materials.js';
import { DOOR, GATE, VALVE, OUTLET, SWITCHES, BREAKER, CART, HALL } from '../game/layout.js';
import { BAND } from '../game/site.js';

export function drawDial(canvas, pressure, band = BAND) {
  const c = canvas.getContext('2d'),
    r = canvas.width / 2;
  c.clearRect(0, 0, r * 2, r * 2);
  c.save();
  c.translate(r, r);
  c.scale(r / 110, r / 110);
  for (const [radius, fill] of [
    [108, '#29342f'],
    [104, '#7d8376'],
    [101, '#343d38'],
    [97, '#d5d3b9'],
  ]) {
    c.fillStyle = fill;
    c.beginPath();
    c.arc(0, 0, radius, 0, Math.PI * 2);
    c.fill();
  }
  const angle = (v) => Math.PI * (0.76 + (1.48 * v) / 1.6);
  c.beginPath();
  c.arc(0, 0, 80, angle(band[0]), angle(band[1]));
  c.strokeStyle = '#48775d';
  c.lineWidth = 11;
  c.stroke();
  c.beginPath();
  c.arc(0, 0, 80, angle(1.2), angle(1.6));
  c.strokeStyle = '#ae644d';
  c.lineWidth = 5;
  c.stroke();
  for (let n = 0; n <= 40; n++) {
    const a = angle(n * 0.04),
      major = n % 5 === 0,
      inner = major ? 67 : 75;
    c.beginPath();
    c.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
    c.lineTo(Math.cos(a) * 86, Math.sin(a) * 86);
    c.lineWidth = major ? 2 : 1;
    c.strokeStyle = '#323830';
    c.stroke();
    if (major) {
      c.fillStyle = '#3b4037';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.font = 'bold 10px monospace';
      c.fillText((n * 0.04).toFixed(1), Math.cos(a) * 56, Math.sin(a) * 56);
    }
  }
  c.fillStyle = '#555c50';
  c.textAlign = 'center';
  c.font = '11px monospace';
  c.fillText('MPa', 0, 42);
  c.rotate(angle(Math.max(0, Math.min(1.6, pressure))));
  c.fillStyle = '#a1452e';
  c.beginPath();
  c.moveTo(-14, -4);
  c.lineTo(78, 0);
  c.lineTo(-14, 4);
  c.closePath();
  c.fill();
  c.fillStyle = '#33382f';
  c.beginPath();
  c.arc(0, 0, 7, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

function lever(b, parent, m) {
  const g = new T.Group();
  parent.add(g);
  b.part(g, 0, 0.14, 0.035, 0.06, 0.31, 0.09, b.mat.edge);
  b.part(g, 0, 0.27, 0.06, 0.27, 0.065, 0.105, m);
  return g;
}

export function buildMachines(b) {
  const { scene, mat, physics } = b;
  const dyn = (x, y, z, w, h, d, o = {}) => physics.add(new Box(x, y, z, w, h, d, { ...o, dynamic: true }));

  // Sliding door of the duty booth.
  const door = new T.Group();
  door.position.set(DOOR.x, 0, DOOR.z);
  scene.add(door);
  b.part(door, 0, 1.21, 0, 2.24, 2.42, 0.12, mat.doorPanel);
  const tag = textPlate('D-01', 'ACCESS   /   01', 0.47, 0.16, '#4b564c', '#c8c9b6');
  tag.position.set(-0.66, 1.77, 0.071);
  door.add(tag);
  for (const x of [-0.92, 0.92]) for (const y of [0.105, 0.4]) b.part(door, x, y, 0.088, 0.02, 0.02, 0.012, mat.edge);
  for (const x of [-0.99, -0.87, -0.75]) b.part(door, x, 0.59, 0.071, 0.062, 0.11, 0.012, mat.ochreDark);
  b.part(door, 0, 1.67, 0.07, 0.67, 0.25, 0.036, mat.black);
  b.part(door, 0, 1.67, 0.095, 0.56, 0.16, 0.012, mat.edge);
  b.part(door, 0.74, 1.05, 0.12, 0.27, 0.045, 0.09, mat.edge);
  b.part(door, 0, 0.26, 0.069, 2.07, 0.39, 0.016, mat.steel);
  const doorBox = dyn(DOOR.x, 1.21, DOOR.z, DOOR.width, DOOR.height, 0.2);

  // Head-relief gate. Guide rails hang from the transfer deck; the lintel stays in silhouette.
  const gate = new T.Group();
  gate.position.z = GATE.z;
  scene.add(gate);
  for (let i = 0; i < 8; i++) b.part(gate, -13.25 + (i + 0.5) * 3.438, 2.55, 0, 3.438, 5.1, 0.49, mat.rivetedPanel);
  for (let i = 0; i < 12; i++) b.part(gate, -12.32 + i * 2.32, 2.55, 0.34, 0.14, 4.95, 0.34, mat.steel);
  for (const y of [0.62, 2.55, 4.49]) b.part(gate, 0.5, y, 0.48, 27.6, 0.21, 0.28, mat.iron);
  for (const x of [-9, 10]) b.part(gate, x, 8.4, 0, 0.24, 7, 0.24, mat.edge);
  const gateSign = textPlate('03   泄压闸', 'G–03    /    HEAD RELIEF', 3.0, 0.97);
  gateSign.position.set(2.4, 3.48, 0.56);
  gate.add(gateSign);
  const gateBox = dyn(0.5, 2.6, GATE.z, 27.7, 5.1, 0.6);

  // Bypass valve: hand wheel and pressure gauge on the housing.
  const wheel = new T.Group();
  wheel.position.set(VALVE.x - 0.34, 0.98, VALVE.z + 0.56);
  scene.add(wheel);
  wheel.add(new T.Mesh(new T.TorusGeometry(0.273, 0.03, 10, 40), mat.ochre));
  for (let i = 0; i < 3; i++) b.part(wheel, 0, 0, 0, 0.038, 0.54, 0.037, mat.steel).rotation.z = (i * Math.PI) / 3;
  b.part(wheel, 0, 0, 0.015, 0.105, 0.105, 0.11, mat.iron);
  const dial = document.createElement('canvas');
  dial.width = dial.height = 256;
  const dialTex = new T.CanvasTexture(dial);
  dialTex.colorSpace = T.SRGBColorSpace;
  const gauge = new T.Mesh(
    new T.PlaneGeometry(0.52, 0.52),
    new T.MeshStandardMaterial({ map: dialTex, transparent: true, roughness: 0.58, metalness: 0.06 })
  );
  gauge.position.set(VALVE.x + 0.44, 1.1, VALVE.z + 0.416);
  scene.add(gauge);

  // A live outlet over the reservoir; the ribbed casing hides the head of the falling sheet.
  b.box(OUTLET.x, -1.0, -55.15, 4.4, 13.2, 4.43, mat.darkCast);
  b.box(OUTLET.x, 5.52, -57, 5.35, 5.8, 7, mat.cast);
  b.rod([OUTLET.x, 7.2, -54.05], [OUTLET.x, 17.8, -54.05], 0.85, mat.steel);
  for (const y of [8.65, 11.4, 14.15, 16.9]) b.rod([OUTLET.x, y, -54.05], [OUTLET.x, y + 0.11, -54.05], 0.96, mat.iron);
  for (const x of [21.6, 26.4]) b.box(x, 5.64, -57, 0.15, 5.88, 7.15, mat.steel);
  b.box(OUTLET.x, 4.92, -60.56, 4.45, 2.43, 0.29, mat.iron);
  const falling = new T.Mesh(
    new T.PlaneGeometry(1, 1, 18, 28),
    new T.ShaderMaterial({
      side: T.DoubleSide,
      transparent: true,
      depthWrite: false,
      uniforms: { flow: { value: 0 }, clock: { value: 0 } },
      vertexShader: `varying vec2 st;uniform float flow,clock;void main(){
      st=uv;float f=1.-uv.y;vec3 p=position;
      p.x=(uv.x-.5)*(3.8+f*1.7)+.12*sin(f*9.+uv.x*19.-clock*4.)*f;
      p.y=-11.22*f;p.z=-3.5*sqrt(f+.002)-.23*sin(uv.x*39.+clock*3.-f*13.)*f;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
      fragmentShader: `varying vec2 st;uniform float flow,clock;
      float h(vec2 p){return fract(sin(dot(p,vec2(91.3,217.9)))*43758.5);}
      float noise(vec2 p){vec2 i=floor(p),t=fract(p);t=t*t*(3.-2.*t);return mix(mix(h(i),h(i+vec2(1,0)),t.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),t.x),t.y);}
      void main(){float f=1.-st.y;float stripe=noise(vec2(st.x*61.,st.y*3.+clock*3.5))*.64+noise(vec2(st.x*177.,st.y*10.+clock*7.2))*.36;
      float edge=smoothstep(0.,.10,min(st.x,1.-st.x)+stripe*.066-.045);float foam=smoothstep(.45,.86,stripe+f*.14);
      gl_FragColor=vec4(mix(vec3(.17,.29,.32),vec3(.82,.89,.88),foam),flow*edge*(.24+stripe*.68));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
    })
  );
  falling.position.set(OUTLET.x, 4.8, -60.78);
  scene.add(falling);
  const mistCanvas = document.createElement('canvas');
  mistCanvas.width = mistCanvas.height = 64;
  const mctx = mistCanvas.getContext('2d');
  const g = mctx.createRadialGradient(32, 32, 0, 32, 32, 31);
  g.addColorStop(0, 'rgba(236,242,235,.65)');
  g.addColorStop(0.34, 'rgba(225,237,233,.31)');
  g.addColorStop(1, 'rgba(222,236,230,0)');
  mctx.fillStyle = g;
  mctx.fillRect(0, 0, 64, 64);
  const spray = new T.InstancedMesh(
    new T.PlaneGeometry(1, 1),
    new T.MeshBasicMaterial({ map: new T.CanvasTexture(mistCanvas), transparent: true, depthWrite: false, opacity: 0.51, side: T.DoubleSide }),
    22
  );
  const particle = new T.Object3D();
  spray.frustumCulled = false;
  scene.add(spray);

  // Isolating switches: a cabinet, a lever and a status lamp each.
  const switches = SWITCHES.map((sw, i) => {
    const group = new T.Group();
    group.position.set(sw.x, sw.y, sw.z);
    group.rotation.y = sw.face;
    scene.add(group);
    b.part(group, 0, 0.8, 0, 0.9, 1.6, 0.5, mat.enamel);
    b.part(group, 0, 1.64, 0, 1.0, 0.08, 0.6, mat.iron);
    b.part(group, 0, 0.95, 0.255, 0.62, 0.7, 0.02, mat.electricPanel);
    const lamp = b.part(group, 0.3, 1.74, 0.12, 0.12, 0.12, 0.12, mat.redLight, false);
    const plate = textPlate('隔离 0' + (i + 1), 'ISO-0' + (i + 1), 0.6, 0.2);
    plate.position.set(0, 1.45, 0.27);
    group.add(plate);
    const handle = lever(b, group, mat.red);
    handle.position.set(-0.22, 0.62, 0.28);
    handle.rotation.x = -0.5;
    physics.add(new Box(sw.x, sw.y + 0.8, sw.z, 0.9, 1.6, 0.5, { yaw: sw.face }));
    return { id: sw.id, lamp, handle };
  });

  // Main breaker lever and the indicator above the cabinet.
  const mainLever = lever(b, scene, mat.red);
  mainLever.position.set(77.45, 1.13, -121.14);
  mainLever.rotation.x = 0.62;
  const mainLamp = new T.Mesh(b.boxGeo, mat.redLight);
  mainLamp.scale.set(0.16, 0.16, 0.16);
  mainLamp.position.set(79.05, 2.66, -121.4);
  scene.add(mainLamp);
  const beacon = new T.PointLight(0xffad5a, 10, 12, 2);
  beacon.position.set(78, 2.8, -119.6);
  scene.add(beacon);

  // Trestle lamps come on in sequence when the supply is restored.
  const trestleLamps = [];
  for (let z = -146; z >= -262; z -= 16) {
    b.box(85.05, 0.62, z, 0.13, 1.24, 0.13, mat.iron);
    b.collider(85.05, 0.62, z, 0.2, 1.24, 0.2, { camera: false });
    const head = new T.Mesh(b.boxGeo, mat.lampOff);
    head.scale.set(0.22, 0.2, 0.22);
    head.position.set(85.05, 1.3, z);
    scene.add(head);
    trestleLamps.push(head);
  }

  // Track shuttle.
  const cart = new T.Group();
  cart.position.set(CART.x, 0, CART.start);
  scene.add(cart);
  b.part(cart, 0, 0.37, 0, 1.84, 0.26, 3.36, mat.ochre);
  b.part(cart, 0, 0.48, 0, 1.73, 0.06, 3.24, mat.iron);
  b.part(cart, 0, 1.0, -1.17, 1.53, 0.94, 0.73, mat.enamel);
  b.part(cart, 0, 1.51, -1.15, 1.6, 0.09, 0.78, mat.instrumentPanel);
  const throttle = b.part(cart, 0.32, 1.66, -0.92, 0.06, 0.27, 0.067, mat.ochre);
  const headlights = [];
  for (const side of [-1, 1]) {
    b.part(cart, side * 0.87, 0.89, 0, 0.045, 0.048, 2.8, mat.ochre);
    for (const dz of [-1.38, 1.38]) b.part(cart, side * 0.87, 0.7, dz, 0.053, 0.43, 0.055, mat.iron);
    headlights.push(b.part(cart, side * 0.58, 0.81, -1.57, 0.19, 0.14, 0.05, mat.lampOff, false));
    b.part(cart, side * 0.64, 0.31, 1.725, 0.43, 0.16, 0.13, mat.rubber);
    b.part(cart, side * 0.77, 0.6, 1.48, 0.2, 0.22, 0.17, mat.iron);
    for (let k = 0; k < 5; k++) b.part(cart, side * 0.924, 0.373, 0.52 + k * 0.19, 0.01, 0.15, 0.072, mat.iron).rotation.x = -0.39;
  }
  for (let k = 0; k < 12; k++) b.part(cart, 0, 0.515, 1.52 - k * 0.12, 1.57, 0.008, 0.013, mat.edge);
  const rearID = textPlate('M-04', 'TRACK  /  01', 0.43, 0.155);
  rearID.position.set(0, 0.371, 1.686);
  cart.add(rearID);
  const serial = textPlate('轨检  04', 'M-04  /  INSPECTION', 1.02, 0.31);
  serial.position.set(0, 0.8, -0.791);
  cart.add(serial);
  const wheels = [];
  const wheelGeo = new T.CylinderGeometry(0.19, 0.19, 0.13, 18);
  for (const wx of [-0.72, 0.72])
    for (const wz of [-1.08, 1.08]) {
      const hub = new T.Group();
      hub.position.set(wx, 0.22, wz);
      cart.add(hub);
      const w = new T.Mesh(wheelGeo, mat.steel);
      w.rotation.z = Math.PI / 2;
      hub.add(w);
      b.part(hub, 0, 0, 0, 0.145, 0.054, 0.31, mat.edge);
      wheels.push(hub);
    }
  const cartBody = dyn(CART.x, 0.3, CART.start, 1.84, 0.6, 3.36, { surface: 'metal' });
  const cartDesk = dyn(CART.x, 1.0, CART.start - 1.17, 1.6, 1.1, 0.8);

  let lastPressure = -1,
    lastGateBand = -1,
    lastCart = CART.start;
  const ease = (t) => t * t * (3 - 2 * t);
  return {
    dial,
    cart,
    shadowsDirty: false,
    update(dt, time, site, camera) {
      const dx = DOOR.slide * ease(site.door);
      door.position.x = dx;
      doorBox.moveTo(DOOR.x + dx, 1.21, DOOR.z);

      gate.position.y = site.gate;
      gateBox.moveTo(0.5, site.gate + 2.6, GATE.z);
      wheel.rotation.z = -site.opening * Math.PI * 3;
      const pressure = Math.round(site.pressure * 100);
      if (pressure !== lastPressure) {
        drawDial(dial, pressure / 100);
        dialTex.needsUpdate = true;
        lastPressure = pressure;
      }
      const flow = T.MathUtils.smoothstep(site.gate, 0, 4);
      falling.visible = spray.visible = flow > 0.01;
      falling.material.uniforms.clock.value = time;
      falling.material.uniforms.flow.value = flow;
      if (spray.visible) {
        for (let i = 0; i < 22; i++) {
          const age = (time * 0.23 + i * 0.618) % 1,
            side = Math.sin(i * 31.8),
            size = (1.4 + age * 3.8) * flow;
          particle.position.set(OUTLET.x + side * (1.8 + age * 3.3), -6.25 + age * 2.5, -64.6 - age * (1.4 + Math.cos(i * 1.9)));
          particle.quaternion.copy(camera.quaternion);
          particle.scale.set(size, size * 0.74, 1);
          particle.updateMatrix();
          spray.setMatrixAt(i, particle.matrix);
        }
        spray.instanceMatrix.needsUpdate = true;
      }

      for (const sw of switches) {
        const on = site.has(sw.id);
        sw.handle.rotation.x = T.MathUtils.damp(sw.handle.rotation.x, on ? 1.05 : -0.5, 7, dt);
        sw.lamp.material = on ? mat.green : mat.redLight;
      }
      const powered = site.has('main');
      mainLever.rotation.x = T.MathUtils.damp(mainLever.rotation.x, powered ? 2.48 : 0.62, 6, dt);
      mainLamp.material = powered ? mat.green : site.switchesClosed === 3 ? mat.amber : mat.redLight;
      const since = powered ? site.time - site.powerAt : -1;
      beacon.intensity = powered ? 16 : 6 + 2 * Math.sin(time * 3);
      beacon.color.setHex(powered ? 0xffd9a0 : 0xff7a3a);
      trestleLamps.forEach((l, i) => (l.material = since > 0.6 + i * 0.35 ? mat.lamp : mat.lampOff));
      headlights.forEach((h) => (h.material = powered ? mat.whiteLight : mat.lampOff));

      cart.position.z = site.cartZ;
      throttle.rotation.x = 0.2 + site.cartSpeed * 0.042;
      for (const hub of wheels) hub.rotation.x = (CART.start - site.cartZ) / 0.19;
      cartBody.enabled = cartDesk.enabled = !site.aboard;
      cartBody.moveTo(CART.x, 0.3, site.cartZ);
      cartDesk.moveTo(CART.x, 1.0, site.cartZ - 1.17);

      const band = Math.floor(site.gate / 1.6);
      if (band !== lastGateBand || (!site.aboard && Math.abs(site.cartZ - lastCart) > 1)) {
        this.shadowsDirty = true;
        lastGateBand = band;
        lastCart = site.cartZ;
      }
    },
  };
}

export const HALL_CENTER = [(HALL.x0 + HALL.x1) / 2, 0, (HALL.z0 + HALL.z1) / 2];
export { BREAKER };
