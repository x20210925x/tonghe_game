import test from 'node:test';
import assert from 'node:assert/strict';
import { Site } from '../src/game/site.js';
import { objective, STEPS2 } from '../src/game/quest.js';
import { GUST, gustAt, windExposure, refugeBehind, riseRate, PUMP } from '../src/game/flood.js';
import { RESERVOIR, STORM_BRIDGE, REFUGE, GATES } from '../src/game/layout.js';

const tick = (site, seconds, input) => {
  const events = [];
  for (let i = 0; i < Math.round(seconds * 60); i++) events.push(...site.step(1 / 60, input));
  return events;
};
const chapter2 = () => {
  const site = new Site();
  site.reset(2);
  return site;
};
const at = { x: 70, y: 96, z: -290 };

test('the reservoir waits until the bridge, then each open gate slows it and three drain it', () => {
  const site = chapter2();
  tick(site, 60);
  assert.equal(site.level, RESERVOIR.start, 'still water while the inspector is in the core');
  site.set('bridge');
  tick(site, 60);
  const closed = site.level - RESERVOIR.start;
  assert.ok(closed > 0.3, 'it rises once the shift is on the bridge');
  assert.ok(riseRate(1) < riseRate(0) && riseRate(2) < riseRate(1) && riseRate(3) < 0);
  site.set('power');
  assert.ok(site.openGate('g1'));
  tick(site, 12);
  assert.equal(site.gates.g1, 1, 'a commanded gate swings fully open');
  const before = site.level;
  tick(site, 60);
  assert.ok(site.level - before < closed * 0.8, 'one open gate slows the rise');
  site.gates.g2 = site.gates.g3 = 1;
  site.flags.junction = site.flags.g2 = site.flags.g3 = true;
  const events = tick(site, 200);
  assert.ok(site.level < RESERVOIR.start, 'three open gates drain the reservoir');
  assert.equal(events.filter((e) => e === 'recede').length, 1);
  assert.ok(site.has('recede'));
  assert.ok(site.level >= RESERVOIR.low);
});

test('a shift at half speed still beats the flood; a stalled one is overtopped once and recovers', () => {
  // A typical crossing: two minutes to the first gate, ninety seconds to the second, forty-five to the third.
  const slow = chapter2();
  slow.set('bridge');
  tick(slow, 240);
  slow.set('power');
  slow.openGate('g1');
  tick(slow, 180);
  slow.set('junction');
  slow.openGate('g2');
  tick(slow, 90);
  assert.ok(slow.level < RESERVOIR.crest, `level ${slow.level.toFixed(2)} stays below the crest at half speed`);

  const stalled = chapter2();
  stalled.set('bridge');
  stalled.set('power');
  stalled.openGate('g1');
  const events = tick(stalled, 1200);
  assert.equal(events.filter((e) => e === 'overtop').length, 1, 'the crest is overtopped exactly once');
  stalled.recover();
  assert.equal(stalled.level, RESERVOIR.recover);
  assert.equal(stalled.gates.g1, 1, 'opened gates stay open after a retry');
  assert.ok(stalled.has('g1'));
  assert.deepEqual(tick(stalled, 1).filter((e) => e === 'overtop'), []);
});

test('gates open only in their own way and order', () => {
  const site = chapter2();
  assert.equal(site.canOpen('g1'), false, 'gate 1 needs the hoist house power');
  site.set('power');
  assert.equal(site.canOpen('g1'), true);
  assert.equal(site.canOpen('g2'), false, 'gate 2 needs the gallery junction box reset');
  site.set('junction');
  assert.equal(site.canOpen('g2'), true);
  assert.equal(site.openGate('g3'), false, 'gate 3 is hydraulic: only the hand pump moves it');
  assert.equal(site.openGate('g2'), true);
  assert.equal(site.openGate('g2'), false, 'a gate opens once');
});

test('the hand pump opens gate 3 while it is worked, and stalls when left', () => {
  const site = chapter2();
  site.atPump = true;
  const held = tick(site, 40, { pumpHeld: true });
  assert.ok(site.has('g3'), 'holding the lever opens the gate within forty seconds');
  assert.equal(site.gates.g3, 1);
  assert.equal(held.filter((e) => e === 'gate-g3').length, 1);

  const left = chapter2();
  left.atPump = true;
  tick(left, 8, { pumpHeld: true });
  const part = left.gates.g3;
  assert.ok(left.pump > PUMP.crack * 0.9, 'pressure builds while pumping');
  left.atPump = false;
  tick(left, 30);
  assert.ok(left.pump < 0.05, 'pressure leaks away');
  assert.ok(left.gates.g3 - part < 0.05 && left.gates.g3 < 1, 'the gate holds where it stopped');
  // Quick presses work as well as holding.
  const mash = chapter2();
  mash.atPump = true;
  for (let i = 0; i < 60 * 30 && !mash.has('g3'); i++) mash.step(1 / 60, { strokes: i % 12 === 0 ? 1 : 0 });
  assert.ok(mash.has('g3'), 'five presses a second also open it');
});

test('gusts always warn first, and refuges, the doorway and the crest are sheltered', () => {
  for (let t = 0; t < GUST.period * 3; t += 0.05) {
    const g = gustAt(t);
    if (g.push > 0) assert.ok(gustAt(t - GUST.warn * 0.5).warn > 0 || gustAt(t - GUST.warn * 0.5).push > 0, `no warning before ${t}`);
  }
  assert.equal(gustAt(0).push, 0, 'the first seconds on the bridge are calm');
  const mid = STORM_BRIDGE.x0 + 1.6;
  assert.equal(windExposure(mid, 96, -363), 1, 'the open deck is exposed');
  for (const p of STORM_BRIDGE.piers) assert.equal(windExposure(mid, 96, p), 0, 'refuge lee');
  assert.equal(windExposure(mid, 96, -306.5), 0, 'the doorway');
  assert.equal(windExposure(80, 96, -470), 0, 'the crest under the hoist house');
  assert.equal(windExposure(mid, 48, -363), 0, 'nowhere off the bridge level');
  const back = refugeBehind(-372);
  assert.equal(back[2], STORM_BRIDGE.piers[0], 'blown off past the first refuge, you return to it');
  assert.ok(back[0] > REFUGE.x0 && back[0] < REFUGE.x1);
  const door = refugeBehind(-320);
  assert.ok(door[2] > STORM_BRIDGE.z0 - 2, 'before the first refuge, back to the door');
  for (const z of [-320, -372, -400, -450]) assert.equal(windExposure(...refugeBehind(z).slice(0, 3)), 0, 'restarts are sheltered');
});

test('chapter two saves keep the water and the gates', () => {
  const site = chapter2();
  site.set('ndoor');
  site.set('bridge');
  site.set('power');
  site.openGate('g1');
  site.atPump = true;
  tick(site, 10, { pumpHeld: true });
  const saved = JSON.parse(JSON.stringify(site.snapshot()));
  const back = new Site();
  back.restore(saved);
  assert.equal(back.chapter, 2);
  assert.ok(Math.abs(back.level - site.level) < 1e-9);
  assert.equal(back.gates.g1, 1, 'a commanded gate is restored open');
  assert.ok(Math.abs(back.gates.g3 - site.gates.g3) < 1e-9, 'a half-pumped gate stays half open');
  assert.equal(back.atPump, false);
  back.restore({ chapter: 2, flags: { bridge: true }, level: 95.99 });
  assert.equal(back.level, RESERVOIR.recover, 'a save at the brink restores to a fair level');
  back.restore({ chapter: 2, flags: { g2: true } });
  assert.equal(back.gates.g2, 1);
  assert.equal(GATES.length, 3);
});

test('the chapter two route runs from the north door to the water log', () => {
  const site = chapter2();
  const ids = [];
  const finish = { ndoor: [], crest: ['bridge'], power: [], g1: [], junction: [], g2: [], g3: [], recede: [], logged: [] };
  for (const [flag, extra] of Object.entries(finish)) {
    ids.push(objective(site, at).id);
    assert.ok(objective(site, at).text.length > 0);
    for (const f of [...extra, flag]) site.set(f);
  }
  assert.deepEqual(ids, STEPS2.map((s) => s.id));
  assert.equal(objective(site, at).id, 'free');
  const fresh = chapter2();
  fresh.atPump = true;
  tick(fresh, 5, { pumpHeld: true });
  for (const f of ['ndoor', 'bridge', 'crest', 'power', 'g1', 'junction', 'g2']) fresh.set(f);
  assert.match(objective(fresh, at).text, /\d+%/, 'the pump step shows its progress');
});
