import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../../assets/three.module.min.js';
import { makeWorker } from '../src/worker.js';
import { Inspection } from '../src/inspection.js';
import { canStand } from '../src/world.js';
import { CART, GATE_Z, BRIDGE } from '../src/machines.js';

test('sagittal gait keeps the knee forward, the forearm forward and a supporting sole at the floor', () => {
  const paint = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {} };
  const saved = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => paint }) };
  try {
    const worker = makeWorker(new T.Texture());
    const heel = new T.Vector3(),
      toe = new T.Vector3(),
      hip = new T.Vector3(),
      knee = new T.Vector3(),
      ankle = new T.Vector3();
    const rigs = ['left', 'right'].map((side) =>
      Object.fromEntries(
        ['Hip', 'Knee', 'Ankle', 'Elbow'].map((j) => [j, worker.group.getObjectByName(side + j)])
      )
    );
    for (const speed of [0, 2.08, 4.65, 0]) {
      let strikes = 0,
        opposition = 0,
        samples = 0;
      for (let i = 0; i < 240; i++) {
        if (worker.animate(1 / 60, speed, i / 60)) strikes++;
        worker.group.updateMatrixWorld(true);
        let contact = Infinity;
        if (speed > 0 && i > 40) {
          const wristZ = rigs.map((rig) => rig.Elbow.localToWorld(new T.Vector3(0, -0.27, 0)).z);
          const ankleZ = rigs.map((rig) => rig.Ankle.getWorldPosition(new T.Vector3()).z);
          opposition += (wristZ[0] - wristZ[1]) * (ankleZ[0] - ankleZ[1]);
          samples++;
        }
        for (const rig of rigs) {
          rig.Hip.getWorldPosition(hip);
          rig.Knee.getWorldPosition(knee);
          rig.Ankle.getWorldPosition(ankle);
          const lineZ = hip.z + ((ankle.z - hip.z) * (hip.y - knee.y)) / (hip.y - ankle.y);
          assert.ok(knee.z <= lineZ + 0.001, 'knee bent behind hip–ankle line');
          assert.ok(rig.Elbow.rotation.x >= 0, 'elbow bent behind upper arm');
          rig.Ankle.localToWorld(heel.set(0, -0.0935, 0.071));
          rig.Ankle.localToWorld(toe.set(0, -0.0935, -0.169));
          const low = Math.min(heel.y, toe.y);
          assert.ok(low >= -0.002, 'boot clipped the walking plane');
          contact = Math.min(contact, low);
        }
        if (speed <= 2.08 && i > 40) assert.ok(contact < 0.007, 'supporting sole floated in stance');
      }
      if (speed > 0) {
        assert.ok(strikes >= 8, 'moving feet did not alternate contacts');
        assert.ok(opposition / samples < -0.015, 'hands and feet on the same side swung together');
      }
    }
  } finally {
    if (saved) globalThis.document = saved;
    else delete globalThis.document;
  }
});

test('valve must settle within tolerance before its gate becomes passable', () => {
  const site = new Inspection();
  site.atValve = true;
  for (let i = 0; i < 160; i++) site.step(1 / 60, false, false);
  assert.equal(site.regulated, false);
  assert.equal(canStand(0, GATE_Z, 1, site), false);
  site.turn(0.56);
  const events = [];
  for (let i = 0; i < 340; i++) {
    const e = site.step(1 / 60, false, false);
    if (e) events.push(e);
  }
  assert.deepEqual(events, ['release']);
  assert.ok(canStand(0, GATE_Z, 1, site));
  for (let i = 0; i <= 100; i++) {
    const t = i / 100;
    assert.ok(
      canStand(BRIDGE.x * (1 - t) + BRIDGE.endX * t, BRIDGE.z * (1 - t) + BRIDGE.endZ * t, 1, site)
    );
  }
});

test('past checkpoints and mid-journey railcar saves resume in a consistent state', () => {
  const site = new Inspection();
  site.restore({}, 1, 77, -119);
  assert.equal(site.regulated, true);
  site.restore({}, 1, 0, -16);
  assert.equal(site.regulated, false);
  site.restore({}, 2);
  site.aboard = true;
  for (let i = 0; i < 120; i++) site.step(1 / 60, true, false);
  const saved = site.snapshot();
  site.restore(saved, 2);
  assert.equal(site.cartZ, saved.cartZ);
  assert.equal(site.aboard, true);
  assert.equal(site.cartSpeed, 0);
  for (let i = 0; i < 180; i++) site.step(1 / 60, true, false);
  site.stopping = true;
  for (let i = 0; i < 220; i++) site.step(1 / 60, true, false);
  assert.equal(site.aboard, false);
  assert.ok(site.cartZ > CART.end);
  site.aboard = true;
  let dock = 0;
  for (let i = 0; i < 2100; i++) if (site.step(1 / 60, true, false) === 'dock') dock++;
  assert.equal(dock, 1);
  assert.equal(site.cartZ, CART.end);
  assert.equal(site.cartSpeed, 0);
});
