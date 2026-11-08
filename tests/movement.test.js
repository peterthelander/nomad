import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createJumpMotion } from '../movement.js';
test('jump rises, cannot double jump, and lands exactly on the terrain', () => {
  const motion = createJumpMotion();
  const floor = 22.2,
    dt = 1 / 120;
  let peak = floor,
    height = motion.update(dt, floor, true);
  assert.ok(height > floor);
  for (let i = 0; i < 70; i++) {
    height = motion.update(dt, floor, true);
    peak = Math.max(peak, height);
  }
  assert.ok(
    peak > floor + 1.2 && peak < floor + 1.5,
    'Midair requests must not add height',
  );
  for (let i = 0; i < 120; i++) height = motion.update(dt, floor, false);
  assert.equal(height, floor);
  assert.ok(motion.update(dt, floor, true) > floor, 'Can jump after landing');
});
test('grounded players follow slopes; an airborne player falls toward a lower surface', () => {
  const motion = createJumpMotion();
  assert.equal(motion.update(0.016, 20, false), 20);
  assert.equal(motion.update(0.016, 22, false), 22);
  const height = motion.update(0.016, 22, true);
  assert.ok(motion.update(0.016, 12, false) > height);
  let landed;
  for (let i = 0; i < 180; i++) landed = motion.update(1 / 60, 12, false);
  assert.equal(landed, 12);
});
