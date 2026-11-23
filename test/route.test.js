import test from 'node:test';
import assert from 'node:assert/strict';
import { Site, BAND, HOLD_TIME } from '../src/game/site.js';
import { objective, STEPS } from '../src/game/quest.js';
import { CART, LEVEL } from '../src/game/layout.js';
import { ARCHIVES } from '../src/game/lore.js';

const tick = (site, seconds, input) => {
  const events = [];
  for (let i = 0; i < seconds * 60; i++) events.push(...site.step(1 / 60, input));
  return events;
};
const at = { x: 0, y: 0, z: 0 };

test('the valve must be held inside the band despite drift', () => {
  const site = new Site();
  site.atValve = true;
  assert.deepEqual(tick(site, 4), []);
  assert.equal(site.has('valve'), false);
  site.opening = 0.6;
  const events = [];
  for (let i = 0; i < 60 * 12 && !site.has('valve'); i++) {
    const err = (BAND[0] + BAND[1]) / 2 - site.pressure;
    site.turn(-err * 0.05);
    events.push(...site.step(1 / 60));
  }
  assert.deepEqual(events, ['release']);
  assert.ok(site.hold === 0 && !site.atValve);
  tick(site, 6);
  assert.equal(site.gate, 6.8);
  assert.ok(HOLD_TIME > 2);
});

test('the route advances in order and skipping the work order is allowed', () => {
  const site = new Site();
  assert.equal(objective(site, at).id, 'workorder');
  site.set('door');
  assert.equal(objective(site, at).id, 'valve');
  for (const f of ['valve', 'hall', 's1', 's2']) site.set(f);
  assert.match(objective(site, at).text, /2\/3/);
  site.set('s3');
  assert.equal(objective(site, at).id, 'main');
  for (const f of ['main', 'core', 'stall', 'console', 'crown', 'record']) site.set(f);
  assert.equal(objective(site, at).id, 'free');
  assert.equal(STEPS.length, 11);
});

test('lift stalls at mid level until the core is restarted, then climbs to the crown', () => {
  const site = new Site();
  assert.equal(site.liftDestination(), null);
  site.set('main');
  assert.equal(site.liftDestination(), LEVEL.L1);
  site.callLift(site.liftDestination());
  const ev = tick(site, 30);
  assert.deepEqual(ev, ['lift-stop']);
  assert.equal(site.liftY, LEVEL.L1);
  site.set('stall');
  assert.equal(site.liftDestination(), null);
  site.set('console');
  const auto = tick(site, 40);
  assert.deepEqual(auto, ['lift-start', 'lift-stop']);
  assert.equal(site.liftY, LEVEL.L2);
  assert.equal(site.liftDestination(), LEVEL.CROWN);
});

test('saves restore a consistent structure', () => {
  const site = new Site();
  site.set('door');
  site.set('valve');
  site.set('main');
  site.collect('a1');
  site.collect('a3');
  site.callLift(LEVEL.L1);
  tick(site, 3);
  const saved = JSON.parse(JSON.stringify(site.snapshot()));
  const back = new Site();
  back.restore(saved);
  assert.equal(back.liftY, 0, 'a lift saved mid-ride returns to where it started');
  assert.equal(back.gate, 6.8);
  assert.deepEqual(back.archives, ['a1', 'a3']);
  back.restore({ flags: { main: true, stall: true, console: true }, liftY: 0 });
  assert.equal(back.liftY, LEVEL.L2, 'after the restart the lift waits at the control level');
  back.restore({ flags: { main: true }, cartZ: 99999, archives: ['a1', 'x', 4] });
  assert.equal(back.cartZ, CART.start);
  assert.deepEqual(back.archives, ['a1']);
});

test('the cart docks exactly once at the core and brakes when asked', () => {
  const site = new Site();
  site.set('main');
  site.aboard = true;
  tick(site, 4, { drive: true });
  site.stopping = true;
  const stop = tick(site, 4, { drive: true });
  assert.deepEqual(stop, ['step-off']);
  assert.ok(site.cartZ > CART.end);
  site.aboard = true;
  const dock = tick(site, 60, { drive: true }).filter((e) => e === 'dock');
  assert.equal(dock.length, 1);
  assert.equal(site.cartZ, CART.end);
});

test('every archive has text and a place', () => {
  assert.equal(new Set(ARCHIVES.map((a) => a.id)).size, ARCHIVES.length);
  for (const a of ARCHIVES) assert.ok(a.text.length && a.where && a.title);
});
