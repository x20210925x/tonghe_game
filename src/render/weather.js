import * as T from '../../assets/three.module.min.js';
import { WET } from './materials.js';

// Weather presets. storm: night cloud and rain; dawn: the low warm light after it.
export const SKIES = {
  day: { storm: 0, rain: 0, dawn: 0 },
  storm: { storm: 1, rain: 1, dawn: 0 },
  dawn: { storm: 0.12, rain: 0, dawn: 1 },
};
const FOG = {
  day: new T.Color(0xa8b4bb),
  storm: new T.Color(0x151b21),
  dawn: new T.Color(0x9c918a),
};

// Rain as thin streaks wrapped around the camera. Each drop is one line segment whose tail is
// derived from its head, so a drop that wraps round the box never stretches across it.
function buildRain(scene) {
  const count = 6000,
    span = 36,
    height = 22;
  const pos = new Float32Array(count * 6),
    tip = new Float32Array(count * 2),
    seed = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * span,
      y = (Math.random() - 0.5) * height,
      z = (Math.random() - 0.5) * span,
      s = Math.random();
    pos.set([x, y, z, x, y, z], i * 6);
    tip.set([0, 1], i * 2);
    seed.set([s, s], i * 2);
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(pos, 3));
  geo.setAttribute('tip', new T.BufferAttribute(tip, 1));
  geo.setAttribute('seed', new T.BufferAttribute(seed, 1));
  const uniforms = {
    uTime: { value: 0 },
    uCenter: { value: new T.Vector3() },
    uWind: { value: new T.Vector2(2.4, -1.1) },
    uAmount: { value: 0 },
    uFlash: { value: 0 },
  };
  const rain = new T.LineSegments(
    geo,
    new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
      uniforms,
      vertexShader: `attribute float tip,seed;uniform float uTime,uAmount;uniform vec3 uCenter;uniform vec2 uWind;
        varying float vFade,vTip;
        void main(){
          float speed=13.+seed*5.,fall=uTime*speed;
          vec3 p=position+vec3(uWind.x,-speed,uWind.y)*uTime;
          vec3 rel;
          rel.xz=mod(p.xz-uCenter.xz+${(span / 2).toFixed(1)},${span.toFixed(1)})-${(span / 2).toFixed(1)};
          rel.y=mod(p.y-uCenter.y+${(height / 2).toFixed(1)},${height.toFixed(1)})-${(height / 2).toFixed(1)};
          vec3 dir=normalize(vec3(uWind.x,-speed,uWind.y));
          vec3 w=uCenter+rel-dir*(.55+.4*seed)*tip;
          vec4 mv=modelViewMatrix*vec4(w,1.);
          vFade=(1.-smoothstep(${(span * 0.28).toFixed(1)},${(span * 0.5).toFixed(1)},length(rel.xz)))
            *(1.-smoothstep(${(height * 0.3).toFixed(1)},${(height * 0.5).toFixed(1)},abs(rel.y)))
            *smoothstep(1.6,5.,-mv.z)*uAmount*(.35+.65*fract(seed*13.7));
          vTip=tip;
          gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `uniform float uFlash;varying float vFade,vTip;
        void main(){gl_FragColor=vec4(vec3(.17,.19,.22)*(1.+uFlash*4.)*vFade*(1.-vTip*.8),1.);}`,
    })
  );
  rain.frustumCulled = false;
  rain.renderOrder = 3;
  scene.add(rain);
  return { rain, uniforms, count };
}

// A helmet lamp: a small cone of light thrown where the camera looks, without shadows.
function buildHeadlamp(scene, mat) {
  const spot = new T.SpotLight(0xffeedd, 0, 42, 0.43, 0.6, 1.5);
  spot.castShadow = false;
  scene.add(spot, spot.target);
  const bulb = new T.Mesh(new T.BoxGeometry(0.075, 0.045, 0.03), mat.lampOff);
  const housing = new T.Mesh(new T.BoxGeometry(0.095, 0.06, 0.05), mat.iron);
  bulb.position.set(0, 0.238, -0.153);
  housing.position.set(0, 0.238, -0.128);
  return { spot, bulb, housing, on: mat.whiteLight, off: mat.lampOff };
}

export function buildWeather(scene, mat, scenery) {
  const { rain, uniforms, count } = buildRain(scene);
  const lamp = buildHeadlamp(scene, mat);
  const state = { ...SKIES.day },
    target = { ...SKIES.day };
  const fog = FOG.day.clone(),
    work = new T.Vector3(),
    look = new T.Vector3();
  let name = 'day',
    flash = 0,
    pulses = [],
    nextBolt = 8,
    lampLevel = 0;
  const strike = (time) => {
    const t0 = time;
    pulses = [
      [t0, 1],
      [t0 + 0.11 + Math.random() * 0.06, 0.55 + Math.random() * 0.4],
      [t0 + 0.3 + Math.random() * 0.2, 0.3 + Math.random() * 0.5],
    ];
    // Thunder follows after the light has crossed one to four kilometres of rain.
    const distance = 700 + Math.random() * 3300;
    return { delay: distance / 343, power: 1 - distance / 4600 };
  };
  return {
    state,
    fog,
    lamp,
    lampOn: false,
    get name() {
      return name;
    },
    get flash() {
      return flash;
    },
    // Outdoor light relative to the clear day: env, hemisphere and sun follow it.
    get ambient() {
      return 1 - 0.8 * state.storm - 0.18 * state.dawn * (1 - state.storm) + flash * 0.9;
    },
    set(sky, instant = false) {
      name = sky;
      Object.assign(target, SKIES[sky]);
      if (instant) {
        Object.assign(state, target);
        pulses = [];
        flash = 0;
      }
    },
    // Bring the next lightning strike forward (debugging and scripted moments).
    bolt() {
      nextBolt = 0;
    },
    quality(mode) {
      rain.geometry.setDrawRange(0, (mode === 'low' ? count / 3 : count) * 2);
    },
    attach(player) {
      player.rig.head.add(lamp.housing, lamp.bulb);
    },
    // shelter: 0 in the open, 1 under a roof. wind: horizontal drift of the rain in m/s.
    update(dt, time, camera, head, shelter = 0, wind = null) {
      const events = [];
      const k = 1 - Math.exp(-dt / 2.6);
      for (const key of Object.keys(state)) state[key] += (target[key] - state[key]) * k;
      if (Math.abs(target.storm - state.storm) < 0.002) state.storm = target.storm;
      // Lightning only while the storm is up.
      if (state.storm > 0.6 && time > nextBolt) {
        nextBolt = time + 9 + Math.random() * 16;
        events.push({ type: 'thunder', ...strike(time) });
      } else if (state.storm <= 0.6) nextBolt = Math.max(nextBolt, time + 6);
      flash = 0;
      for (const [t0, power] of pulses) {
        const t = time - t0;
        if (t >= 0 && t < 0.7) flash = Math.max(flash, power * Math.exp(-t * 11) * (t < 0.02 ? t / 0.02 : 1));
      }
      flash *= state.storm;
      WET.value = Math.max(state.storm, state.dawn * 0.75);
      fog.copy(FOG.day).lerp(FOG.dawn, state.dawn).lerp(FOG.storm, state.storm);
      fog.offsetHSL(0, 0, flash * 0.12);
      scenery.weather(state, flash, time);

      uniforms.uTime.value = time;
      uniforms.uCenter.value.copy(camera.position);
      uniforms.uAmount.value = state.rain * (1 - shelter);
      uniforms.uFlash.value = flash;
      if (wind) uniforms.uWind.value.set(wind.x, wind.z);
      rain.visible = uniforms.uAmount.value > 0.01;

      lampLevel = T.MathUtils.damp(lampLevel, this.lampOn ? 1 : 0, 9, dt);
      lamp.spot.intensity = lampLevel * 160;
      lamp.bulb.visible = lamp.housing.visible = this.lampOn || state.storm > 0.5;
      lamp.bulb.material = lampLevel > 0.5 ? lamp.on : lamp.off;
      if (head) {
        camera.getWorldDirection(look);
        work.copy(head).addScaledVector(look, 0.3);
        lamp.spot.position.copy(work);
        // Tilted a little below the line of sight, so the path ahead is lit, not the horizon.
        lamp.spot.target.position.copy(work).addScaledVector(look, 10);
        lamp.spot.target.position.y -= 1.7;
      }
      return events;
    },
  };
}
