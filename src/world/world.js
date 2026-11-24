import * as T from '../../assets/three.module.min.js';
import { Builder } from './builder.js';
import { buildScenery } from './scenery.js';
import { buildBooth, buildSpillway, buildBridge, buildPowerHall, buildTrestle } from './zones.js';
import { buildCore } from './core.js';
import { buildMachines } from './machines.js';
import { buildCoreworks } from './coreworks.js';
import { buildPickups } from './pickups.js';
import { buildAtmosphere } from '../render/atmosphere.js';
import { buildWeather } from '../render/weather.js';

// Assembles the structure and returns one update for everything that moves.
export function buildWorld(scene, mat, daylight, physics) {
  const b = new Builder(scene, mat, physics);
  const scenery = buildScenery(b, daylight);
  buildBooth(b);
  buildSpillway(b);
  buildBridge(b);
  buildPowerHall(b);
  buildTrestle(b);
  const frame = buildCore(b);
  const machines = buildMachines(b);
  const coreworks = buildCoreworks(b, frame);
  const pickups = buildPickups(b);
  const atmosphere = buildAtmosphere(scene);
  const weather = buildWeather(scene, mat, scenery);
  b.finish();

  // Interior eye adaptation scales indirect light on every lit material at once.
  const lit = new Set();
  scene.traverse((o) => {
    const list = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of list) if (m.isMeshStandardMaterial) lit.add(m);
  });
  for (const m of lit) m.userData.env = m.envMapIntensity;
  let ambient = 1;

  return {
    dial: machines.dial,
    cart: machines.cart,
    lift: coreworks.car,
    scenery,
    weather,
    quality(mode) {
      scenery.quality(mode);
      atmosphere.quality(mode);
      weather.quality(mode);
    },
    setAmbient(k) {
      if (Math.abs(k - ambient) < 0.01) return;
      ambient = k;
      for (const m of lit) m.envMapIntensity = m.userData.env * k;
      scenery.hemi.intensity = 0.29 * k;
    },
    update(dt, time, site, player, camera, inside) {
      machines.update(dt, time, site, camera);
      coreworks.update(dt, time, site, player, inside);
      pickups.update(time, site);
      scenery.update(dt, time, player, camera, inside);
      atmosphere.update(dt, time, camera, site, inside, weather.state.storm);
      if (machines.shadowsDirty || coreworks.shadowsDirty) {
        scenery.farSun.shadow.needsUpdate = true;
        machines.shadowsDirty = coreworks.shadowsDirty = false;
      }
    },
    refreshShadows() {
      scenery.farSun.shadow.needsUpdate = true;
    },
  };
}

export { T };
