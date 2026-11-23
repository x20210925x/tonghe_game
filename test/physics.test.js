import test from 'node:test';
import assert from 'node:assert/strict';
import { Physics, Box, Body } from '../src/engine/physics.js';

const floor = (p, top = 0) => p.add(new Box(0, top - 0.5, 0, 40, 1, 40));
const run = (p, b, seconds, setV = () => {}) => {
  let landed = 0;
  for (let i = 0; i < seconds * 60; i++) {
    setV(b);
    landed = Math.max(landed, p.move(b, 1 / 60));
  }
  return landed;
};

test('walls stop the body and low steps are climbed', () => {
  const p = new Physics();
  floor(p);
  p.add(new Box(3, 1.5, 0, 1, 3, 10));
  p.add(new Box(-3, 0.15, 0, 2, 0.3, 4));
  const b = new Body();
  b.place(0, 0, 0);
  run(p, b, 2, (v) => (v.vx = 3));
  assert.ok(b.x < 3 - 0.5 - b.radius + 0.02, 'walked through a wall');
  assert.equal(b.y, 0);
  b.place(0, 0, 0);
  run(p, b, 1, (v) => (v.vx = -3));
  assert.ok(Math.abs(b.y - 0.3) < 1e-6, 'did not step onto the kerb');
});

test('stairs carry the body up and down without leaving the ground', () => {
  const p = new Physics();
  floor(p);
  for (let i = 1; i <= 20; i++) p.add(new Box(1 + i * 0.3, i * 0.2 - 0.05, 0, 0.3, 0.1, 2));
  p.add(new Box(9, 3.95, 0, 4, 0.1, 2));
  const b = new Body();
  b.place(0, 0, 0);
  let airborne = 0;
  run(p, b, 5, (v) => {
    v.vx = 2;
    if (!v.grounded) airborne++;
  });
  assert.ok(Math.abs(b.y - 4) < 1e-6, 'did not reach the landing: ' + b.y);
  assert.equal(airborne, 0);
  run(p, b, 5, (v) => (v.vx = -2));
  assert.ok(Math.abs(b.y) < 1e-6);
});

test('a jump clears a gap a running inspector can cross and lands', () => {
  const p = new Physics();
  p.add(new Box(-5, -0.5, 0, 10, 1, 2));
  p.add(new Box(6.2, -0.5, 0, 10, 1, 2));
  const b = new Body();
  b.place(-1.2, 0, 0);
  b.vx = 4.8;
  for (let i = 0; i < 120; i++) {
    if (i === 14) b.jump(6.3);
    b.vx = 4.8;
    p.move(b, 1 / 60);
  }
  assert.ok(b.grounded && b.y === 0 && b.x > 1.2, 'fell into the gap');
  const c = new Body();
  c.place(0, 0, 0);
  run(p, c, 0.8, (v) => (v.vx = 2));
  assert.ok(c.y < -2, 'walked across empty space');
});

test('moving platforms carry what stands on them and fences turn with their yaw', () => {
  const p = new Physics();
  const lift = p.add(new Box(0, -0.3, 0, 4, 0.6, 4, { dynamic: true }));
  const b = new Body();
  b.place(0, 0, 0);
  p.move(b, 1 / 60);
  for (let i = 1; i <= 120; i++) {
    lift.moveTo(0, -0.3 + i * 0.05, 0);
    p.move(b, 1 / 60);
  }
  assert.ok(Math.abs(b.y - 6) < 0.01, 'left behind by the lift: ' + b.y);
  const q = new Physics();
  floor(q);
  q.add(new Box(0, 0.85, 0, 0.14, 1.7, 10, { yaw: Math.PI / 4, walk: false }));
  const c = new Body();
  c.place(-2, 0, 2);
  run(q, c, 2, (v) => {
    v.vx = 2;
    v.vz = -2;
  });
  assert.ok(c.x + -c.z < 0.2, 'crossed a diagonal fence');
});

test('camera rays stop at the first camera-blocking box', () => {
  const p = new Physics();
  p.add(new Box(5, 0, 0, 1, 4, 4));
  p.add(new Box(3, 0, 0, 0.2, 4, 4, { camera: false }));
  assert.ok(Math.abs(p.raycast(0, 0, 0, 1, 0, 0, 10) - 4.5) < 1e-6);
  assert.equal(p.raycast(0, 0, 0, -1, 0, 0, 10), 10);
});

test('running jumps up and down a flight of thin treads never sink through it', () => {
  const p = new Physics();
  p.add(new Box(-5, -0.5, 0, 10, 1, 3));
  const rise = 0.2,
    run = 0.467;
  for (let i = 1; i <= 60; i++) p.add(new Box((i - 0.5) * run, i * rise - 0.06, 0, run + 0.02, 0.12, 2.5));
  const stairAt = (x) => Math.max(0, Math.min(60, Math.ceil(x / run))) * rise;
  for (const dir of [1, -1]) {
    const b = new Body();
    if (dir > 0) b.place(-1, 0, 0);
    else b.place(27.8, 12, 0);
    let low = Infinity;
    for (let i = 0; i < 60 * 9; i++) {
      b.vx = 4.8 * dir;
      if (b.grounded && (i % 20 === 0 || i % 7 === 3)) b.jump(6.3);
      p.move(b, 1 / 60);
      if (b.x > 0.5 && b.x < 27) low = Math.min(low, b.y - stairAt(b.x));
      if ((dir > 0 && b.x > 27.5) || (dir < 0 && b.x < -0.5)) break;
    }
    for (let i = 0; i < 60; i++) {
      b.vx = 0;
      p.move(b, 1 / 60);
    }
    assert.ok(low > -0.08, `sank ${low.toFixed(2)} m into the stair going ${dir > 0 ? 'up' : 'down'}`);
    assert.ok(dir > 0 ? b.y > 11.5 : b.y < 0.5, 'did not finish the flight: ' + b.y);
  }
});

test('jumping on a fast lift lands back on it instead of being pushed off', () => {
  const p = new Physics();
  const lift = p.add(new Box(0, -0.32, 0, 9, 0.64, 9, { dynamic: true }));
  const b = new Body();
  b.place(3.8, 0, 0);
  p.move(b, 1 / 60);
  let y = 0;
  for (let i = 0; i < 60 * 6; i++) {
    y += 4.3 / 60;
    lift.moveTo(0, y - 0.32, 0);
    if (b.grounded && i % 25 === 5) b.jump(6.3);
    p.move(b, 1 / 60);
    assert.ok(b.y > y - 0.5, `fell through the rising lift at frame ${i}: body ${b.y.toFixed(2)} lift ${y.toFixed(2)}`);
  }
  assert.ok(Math.abs(b.x - 3.8) < 0.01, 'pushed sideways off the car');
});
