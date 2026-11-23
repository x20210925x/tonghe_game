import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../assets/three.module.min.js';
import { makeWorker } from '../src/actor/worker.js';

test('gait keeps knees forward and a supporting sole on the floor; air pose stays above it', () => {
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
      Object.fromEntries(['Hip', 'Knee', 'Ankle', 'Elbow'].map((j) => [j, worker.group.getObjectByName(side + j)]))
    );
    for (const speed of [0, 2.15, 4.8, -1.55, -2.9, 0]) {
      let strikes = 0;
      for (let i = 0; i < 240; i++) {
        if (worker.animate(1 / 60, speed, i / 60)) strikes++;
        worker.group.updateMatrixWorld(true);
        let contact = Infinity;
        for (const rig of rigs) {
          rig.Hip.getWorldPosition(hip);
          rig.Knee.getWorldPosition(knee);
          rig.Ankle.getWorldPosition(ankle);
          const lineZ = hip.z + ((ankle.z - hip.z) * (hip.y - knee.y)) / (hip.y - ankle.y);
          assert.ok(knee.z <= lineZ + 0.001, 'knee bent behind hip–ankle line');
          rig.Ankle.localToWorld(heel.set(0, -0.0935, 0.071));
          rig.Ankle.localToWorld(toe.set(0, -0.0935, -0.169));
          const low = Math.min(heel.y, toe.y);
          assert.ok(low >= -0.002, 'boot clipped the walking plane');
          contact = Math.min(contact, low);
        }
        if (Math.abs(speed) <= 2.15 && i > 40) assert.ok(contact < 0.007, 'supporting sole floated in stance');
      }
      if (speed !== 0) assert.ok(strikes >= 8, 'moving feet did not alternate contacts');
    }
    for (let i = 0; i < 60; i++) worker.animate(1 / 60, 0, i / 60, 0, null, 1, 0);
    worker.group.updateMatrixWorld(true);
    for (const rig of rigs) {
      rig.Ankle.localToWorld(toe.set(0, -0.0935, -0.169));
      assert.ok(toe.y > -0.05, 'tucked foot reached below the body');
    }
  } finally {
    if (saved) globalThis.document = saved;
    else delete globalThis.document;
  }
});
