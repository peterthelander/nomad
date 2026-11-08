import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createControls } from '../controls.js';
class Target {
  constructor() {
    this.events = {};
    this.style = {};
  }
  addEventListener(name, fn) {
    (this.events[name] ??= []).push(fn);
  }
  async fire(name, event = {}) {
    for (const fn of this.events[name] ?? [])
      await fn({ preventDefault() {}, ...event });
  }
  setPointerCapture() {}
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 124, height: 124 };
  }
}
test('a hybrid device can switch between mouse lock and simultaneous thumb controls', async () => {
  const doc = new Target(),
    nodes = {};
  doc.querySelector = (s) => (nodes[s] ??= new Target());
  doc.body = { classList: { toggle() {} } };
  globalThis.document = doc;
  globalThis.matchMedia = () => ({ matches: false });
  const win = new Target();
  globalThis.addEventListener = win.addEventListener.bind(win);
  let locks = 0,
    look = 0;
  const canvas = new Target();
  canvas.requestPointerLock = async () => locks++;
  const controls = createControls(canvas, (x, y) => (look += x + y));
  await nodes['#enter'].fire('pointerdown', { pointerType: 'mouse' });
  await nodes['#enter'].fire('click');
  assert.equal(locks, 1);
  assert.equal(controls.playing, false);
  doc.pointerLockElement = canvas;
  await doc.fire('pointerlockchange');
  assert.equal(controls.playing, true);
  await win.fire('keydown', { code: 'Space', repeat: false });
  assert.equal(controls.consumeJump(), true);
  assert.equal(controls.consumeJump(), false);
  await win.fire('keydown', { code: 'Space', repeat: true });
  assert.equal(
    controls.consumeJump(),
    false,
    'Holding Space does not repeat jumps',
  );

  doc.pointerLockElement = null;
  await doc.fire('pointerlockchange');
  assert.equal(controls.playing, false);
  await nodes['#enter'].fire('pointerdown', { pointerType: 'touch' });
  await nodes['#enter'].fire('click');
  assert.equal(locks, 1);
  assert.equal(controls.playing, true);
  await nodes['#joystick'].fire('pointerdown', {
    pointerId: 1,
    clientX: 62,
    clientY: 20,
  });
  await nodes['#look-zone'].fire('pointerdown', {
    pointerId: 2,
    clientX: 200,
    clientY: 100,
  });
  await nodes['#look-zone'].fire('pointermove', {
    pointerId: 2,
    clientX: 220,
    clientY: 100,
  });
  assert.ok(controls.movement.forward > 0.9);
  await nodes['#jump'].fire('pointerdown');
  assert.equal(controls.consumeJump(), true, 'Touch button requests a jump');
  assert.ok(
    controls.movement.forward > 0.9,
    'Jumping does not interrupt joystick',
  );

  assert.ok(look > 0);
  await nodes['#joystick'].fire('pointercancel', { pointerId: 1 });
  assert.equal(controls.movement.forward, 0);
  await nodes['#pause'].fire('click');
  assert.equal(controls.playing, false);
  await nodes['#enter'].fire('pointerdown', { pointerType: 'mouse' });
  await nodes['#enter'].fire('click');
  assert.equal(locks, 2);
});
