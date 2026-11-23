import * as T from '../../assets/three.module.min.js';
import { textPlate } from './materials.js';

export const VALVE = { x: 2.3, z: -33.1 };
export const CART = { x: 81, start: -143, end: -251, deck: 0.51 };
export const GATE_Z = -53.6;
export const BRIDGE = { x: 12, z: -65, endX: 72, endZ: -115, width: 3.85 };
export function onShortcut(x, z) {
  const dx = BRIDGE.endX - BRIDGE.x,
    dz = BRIDGE.endZ - BRIDGE.z,
    len = Math.hypot(dx, dz);
  const along = ((x - BRIDGE.x) * dx + (z - BRIDGE.z) * dz) / len;
  return (
    along >= -0.15 &&
    along <= len + 0.15 &&
    Math.abs((x - BRIDGE.x) * dz - (z - BRIDGE.z) * dx) / len < BRIDGE.width / 2 - 0.19
  );
}

function drawDial(canvas, pressure) {
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
  c.arc(0, 0, 80, angle(0.6), angle(0.72));
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
  c.rotate(angle(pressure));
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

export function buildMachines(scene, mat, { box, add, rod, part, boxGeo, plate }) {
  // The guide rails hang from the existing transfer deck. The lintel stays in silhouette as the gate rises.
  const gate = new T.Group();
  gate.position.z = GATE_Z;
  scene.add(gate);
  for (let i = 0; i < 8; i++)
    part(gate, -13.25 + (i + 0.5) * 3.438, 2.55, 0, 3.438, 5.1, 0.49, mat.rivetedPanel);
  for (let i = 0; i < 12; i++) part(gate, -12.32 + i * 2.32, 2.55, 0.34, 0.14, 4.95, 0.34, mat.steel);
  for (const y of [0.62, 2.55, 4.49]) part(gate, 0.5, y, 0.48, 27.6, 0.21, 0.28, mat.iron);
  for (const x of [-13.4, 14.4]) {
    box(x, 8.3, GATE_Z, 1, 16.6, 1.38, mat.darkCast, true);
    rod([x, 1, GATE_Z + 0.79], [x, 17.4, GATE_Z + 0.79], 0.18, mat.steel);
  }
  const gateSign = textPlate('03   泄压闸', 'G–03    /    HEAD RELIEF', 3.0, 0.97);
  gateSign.position.set(2.4, 3.48, 0.56);
  gate.add(gateSign);
  for (const x of [-9, 10]) {
    rod([x, 11.45, GATE_Z], [x, 18.75, GATE_Z], 0.49, mat.enamel);
    rod([x, 10.4, GATE_Z], [x, 12.5, GATE_Z], 0.33, mat.steel);
    part(gate, x, 8.4, 0, 0.24, 7, 0.24, mat.edge);
  }
  // Wheel, pressure gauge and trunk line.
  const { x, z } = VALVE;
  box(x, 0.71, z, 1.61, 1.42, 0.81, mat.enamel, true);
  box(x, 1.44, z, 1.71, 0.12, 0.9, mat.steel);
  for (const dx of [-0.62, 0.62]) rod([x + dx, 0.12, z - 0.3], [x + dx, 0.12, GATE_Z], 0.086, mat.steel);
  const wheel = new T.Group();
  wheel.position.set(x - 0.34, 0.98, z + 0.56);
  scene.add(wheel);
  const ring = new T.Mesh(new T.TorusGeometry(0.273, 0.03, 10, 40), mat.ochre);
  wheel.add(ring);
  for (let i = 0; i < 3; i++) {
    const spoke = part(wheel, 0, 0, 0, 0.038, 0.54, 0.037, mat.steel);
    spoke.rotation.z = (i * Math.PI) / 3;
  }
  part(wheel, 0, 0, 0.015, 0.105, 0.105, 0.11, mat.iron);
  const canvas = document.getElementById('pressure-face'),
    tex = new T.CanvasTexture(canvas);
  tex.colorSpace = T.SRGBColorSpace;
  const gauge = new T.Mesh(
    new T.PlaneGeometry(0.52, 0.52),
    new T.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.58, metalness: 0.06 })
  );
  gauge.position.set(x + 0.44, 1.1, z + 0.416);
  scene.add(gauge);
  plate('旁通阀', 'P–03    /    BYPASS', x, 1.84, z + 0.09, 1.37, 0.43);
  box(x, 1.53, z, 0.16, 0.78, 0.13, mat.iron);
  // Diagonal grating gives the player a shorter route with a close view into the discharge.
  const { x: ax, z: az, endX: bx, endZ: bz, width } = BRIDGE,
    dx = bx - ax,
    dz = bz - az,
    len = Math.hypot(dx, dz);
  const rot = new T.Euler(0, Math.atan2(dx, dz), 0),
    px = dz / len,
    pz = -dx / len;
  const xyz = (t, off, y) => [ax + dx * t + px * off, y, az + dz * t + pz * off];
  for (let i = 0; i < 36; i++) {
    const [gx, gy, gz] = xyz(0.5, (i / 35 - 0.5) * (width - 0.06), -0.061);
    add(boxGeo, mat.steel, gx, gy, gz, 0.029, 0.122, len, rot);
  }
  for (let i = 0; i <= 356; i++) {
    const [gx, gy, gz] = xyz(i / 356, 0, -0.025);
    add(boxGeo, mat.iron, gx, gy, gz, width, 0.056, 0.028, rot);
  }
  for (let i = 0; i <= 26; i++) {
    const [gx, gy, gz] = xyz(i / 26, 0, -0.23);
    add(boxGeo, mat.steel, gx, gy, gz, width + 0.05, 0.29, 0.14, rot);
  }
  for (const side of [-1, 1]) {
    const off = side * (width / 2 - 0.09);
    for (const h of [0.57, 1.07])
      rod(xyz(0, off, h), xyz(1, off, h), h > 0.9 ? 0.038 : 0.022, mat.ochreDark);
    for (let i = 0; i <= 26; i++) {
      const [xx, yy, zz] = xyz(i / 26, off, 0.54);
      box(xx, yy, zz, 0.066, 1.08, 0.066, mat.steel);
    }
    rod(xyz(0, off, -1.34), xyz(1, off, -1.34), 0.126, mat.iron);
    for (let i = 0; i < 13; i++)
      rod(xyz(i / 13, off, -1.34), xyz((i + 1) / 13, off, -0.23), 0.08, mat.steel);
  }
  plate('斜桥   ↗', 'P-02   /   MAINTENANCE', 10.3, 1.44, -62.3, 1.72, 0.52);
  box(10.3, 0.74, -62.38, 0.12, 1.48, 0.11, mat.iron);

  // A live outlet over the reservoir. Its ribbed steel casing conceals the head of the falling sheet.
  box(24, -1.0, -55.15, 4.4, 13.2, 4.43, mat.darkCast);
  box(24, 5.52, -57, 5.35, 5.8, 7, mat.cast);
  rod([24, 7.2, -54.05], [24, 17.8, -54.05], 0.85, mat.steel);
  for (const y of [8.65, 11.4, 14.15, 16.9])
    rod([24, y, -54.05], [24, y + 0.11, -54.05], 0.96, mat.iron);
  for (const x of [21.6, 26.4]) box(x, 5.64, -57, 0.15, 5.88, 7.15, mat.steel);
  box(24, 4.92, -60.56, 4.45, 2.43, 0.29, mat.iron);
  const waterSheet = new T.PlaneGeometry(1, 1, 18, 28);
  const falling = new T.Mesh(
    waterSheet,
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
  falling.position.set(24, 4.8, -60.78);
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
    new T.MeshBasicMaterial({
      map: new T.CanvasTexture(mistCanvas),
      transparent: true,
      depthWrite: false,
      opacity: 0.51,
      side: T.DoubleSide,
    }),
    22
  );
  const particle = new T.Object3D();
  spray.frustumCulled = false;
  scene.add(spray);

  const cart = new T.Group();
  cart.position.set(CART.x, 0, CART.start);
  scene.add(cart);
  part(cart, 0, 0.37, 0, 1.84, 0.26, 3.36, mat.ochre);
  part(cart, 0, 0.48, 0, 1.73, 0.06, 3.24, mat.iron);
  part(cart, 0, 1.0, -1.17, 1.53, 0.94, 0.73, mat.enamel);
  part(cart, 0, 1.51, -1.15, 1.6, 0.09, 0.78, mat.instrumentPanel);
  const throttle = part(cart, 0.32, 1.66, -0.92, 0.06, 0.27, 0.067, mat.ochre);
  for (const side of [-1, 1]) {
    part(cart, side * 0.87, 0.89, 0, 0.045, 0.048, 2.8, mat.ochre);
    for (const dz of [-1.38, 1.38]) part(cart, side * 0.87, 0.7, dz, 0.053, 0.43, 0.055, mat.iron);
    part(cart, side * 0.58, 0.81, -1.57, 0.19, 0.14, 0.05, mat.whiteLight);
  }
  // End buffers, anti-slip tread, tow eye and lamp housings remain visible from the driving camera.
  for (const side of [-1, 1]) {
    part(cart, side * 0.64, 0.31, 1.725, 0.43, 0.16, 0.13, mat.rubber);
    part(cart, side * 0.77, 0.6, 1.48, 0.2, 0.22, 0.17, mat.iron);
    const glass = new T.Mesh(
      new T.SphereGeometry(0.062, 12, 8),
      new T.MeshStandardMaterial({
        color: 0x933b20,
        emissive: 0xc94819,
        emissiveIntensity: 0.8,
        roughness: 0.31,
      })
    );
    glass.position.set(side * 0.77, 0.6, 1.581);
    glass.scale.z = 0.37;
    cart.add(glass);
    for (let k = 0; k < 5; k++)
      part(cart, side * 0.924, 0.373, 0.52 + k * 0.19, 0.01, 0.15, 0.072, mat.iron).rotation.x = -0.39;
  }
  for (let k = 0; k < 12; k++) part(cart, 0, 0.515, 1.52 - k * 0.12, 1.57, 0.008, 0.013, mat.edge);
  const eye = new T.Mesh(new T.TorusGeometry(0.092, 0.027, 9, 20), mat.iron);
  eye.position.set(0, 0.22, 1.79);
  eye.rotation.x = Math.PI / 2;
  cart.add(eye);
  const rearID = textPlate('M-04', 'TRACK  /  01', 0.43, 0.155);
  rearID.position.set(0, 0.371, 1.686);
  cart.add(rearID);
  const wheels = [];
  for (const wx of [-0.72, 0.72])
    for (const wz of [-1.08, 1.08]) {
      const hub = new T.Group();
      hub.position.set(wx, 0.22, wz);
      cart.add(hub);
      const wheel = new T.Mesh(new T.CylinderGeometry(0.19, 0.19, 0.13, 18), mat.steel);
      wheel.rotation.z = Math.PI / 2;
      hub.add(wheel);
      part(hub, 0, 0, 0, 0.145, 0.054, 0.31, mat.edge);
      wheels.push(hub);
    }
  const serial = textPlate('轨检  04', 'M-04  /  INSPECTION', 1.02, 0.31);
  serial.position.set(0, 0.8, -0.791);
  cart.add(serial);
  const trackEnd = CART.end - 2.4,
    trackStart = CART.start + 2.5;
  for (const off of [-0.72, 0.72])
    box(CART.x + off, 0.042, (trackStart + trackEnd) / 2, 0.095, 0.084, trackStart - trackEnd, mat.edge);
  for (let z = trackStart; z > trackEnd; z -= 1.38) box(CART.x, 0.022, z, 1.98, 0.044, 0.14, mat.iron);
  plate('检修轨车', 'M-04  /  LIFT SHUTTLE', 78.4, 1.74, CART.start + 2, 1.64, 0.52);
  box(78.4, 0.88, CART.start + 1.95, 0.11, 1.76, 0.13, mat.iron);
  let previousPressure = -1;
  return {
    gate,
    update(dt, time, state, camera) {
      gate.position.y = state.gateHeight;
      wheel.rotation.z = -state.opening * Math.PI * 3;
      const pressure = Math.round(state.pressure * 100);
      if (pressure !== previousPressure) {
        drawDial(canvas, pressure / 100);
        tex.needsUpdate = true;
        previousPressure = pressure;
      }
      const flow = T.MathUtils.smoothstep(state.gateHeight, 0, 4);
      falling.visible = spray.visible = flow > 0.01;
      falling.material.uniforms.clock.value = time;
      falling.material.uniforms.flow.value = flow;
      if (spray.visible) {
        for (let i = 0; i < 22; i++) {
          const age = (time * 0.23 + i * 0.618) % 1,
            side = Math.sin(i * 31.8),
            size = (1.4 + age * 3.8) * flow;
          particle.position.set(
            24 + side * (1.8 + age * 3.3),
            -6.25 + age * 2.5,
            -64.6 - age * (1.4 + Math.cos(i * 1.9))
          );
          particle.quaternion.copy(camera.quaternion);
          particle.scale.set(size, size * 0.74, 1);
          particle.updateMatrix();
          spray.setMatrixAt(i, particle.matrix);
        }
        spray.instanceMatrix.needsUpdate = true;
      }
      cart.position.z = state.cartZ;
      throttle.rotation.x = 0.2 + state.cartSpeed * 0.042;
      for (const hub of wheels) hub.rotation.x = (CART.start - state.cartZ) / 0.19;
    },
  };
}
