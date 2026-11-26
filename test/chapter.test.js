import test from 'node:test';
import assert from 'node:assert/strict';
import { Site, CH1_FLAGS } from '../src/game/site.js';
import { stepsOf, STEPS, STEPS2 } from '../src/game/quest.js';
import { ARCHIVES, archivesOf, chapterOf } from '../src/game/lore.js';
import { ARCHIVE_SPOTS, CART, LEVEL } from '../src/game/layout.js';

test('chapter two opens with the first shift finished', () => {
  const site = new Site();
  site.reset(2);
  assert.equal(site.chapter, 2);
  for (const f of CH1_FLAGS) assert.ok(site.has(f), f);
  assert.equal(site.liftY, LEVEL.L2);
  assert.equal(site.cartZ, CART.end);
  assert.equal(site.gate, 6.8);
  assert.equal(stepsOf(site), STEPS2);
  // The lift is free to go anywhere once the core runs.
  assert.equal(site.liftDestination(), LEVEL.CROWN);
  site.reset(1);
  assert.equal(site.chapter, 1);
  assert.equal(site.has('door'), false);
  assert.equal(stepsOf(site), STEPS);
});

test('chapter saves round-trip and old saves stay chapter one', () => {
  const site = new Site();
  site.reset(2);
  site.collect('a10');
  site.callLift(0);
  const saved = JSON.parse(JSON.stringify(site.snapshot()));
  assert.equal(saved.chapter, 2);
  const back = new Site();
  back.restore(saved);
  assert.equal(back.chapter, 2);
  assert.deepEqual(back.archives, ['a10'], 'two-digit archive ids survive a reload');
  assert.equal(back.liftY, LEVEL.L2, 'a lift saved mid-ride returns to where it started');
  assert.ok(back.has('record'));
  back.restore({ flags: { door: true }, liftY: 48 });
  assert.equal(back.chapter, 1, 'saves from before chapters belong to chapter one');
  assert.equal(back.liftY, 0);
  back.restore({}, 2);
  assert.equal(back.liftY, LEVEL.L2, 'an empty chapter two save starts at the control level');
});

test('every archive belongs to one chapter and has a stand', () => {
  const all = [...archivesOf(1), ...archivesOf(2)];
  assert.equal(all.length, ARCHIVES.length);
  assert.equal(archivesOf(1).length, 8);
  for (const a of ARCHIVES) {
    assert.ok(ARCHIVE_SPOTS[a.id], a.id);
    assert.equal(chapterOf(a.id), a.chapter ?? 1);
  }
});
