import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validRoom, parsePosition } from '../server/protocol.js';

test('shared links accept bounded room names only', () => {
  for (const room of ['amber-island', 'island-123', 'a']) assert.equal(validRoom(room), true);
  for (const room of ['', '../secret', 'a'.repeat(49), '<script>', null]) assert.equal(validRoom(room), false);
});
test('movement ignores supplied identity and normalizes facing', () => {
  const p = parsePosition(JSON.stringify({ type: 'move', id: 'spoofed', x: 1, y: 2.2, z: 3, yaw: 10 }));
  assert.deepEqual(Object.keys(p), ['x','y','z','yaw']);
  assert.ok(Math.abs(p.yaw) <= Math.PI);
});
test('malformed, oversized, nonfinite and out-of-world positions are rejected', () => {
  const valid = { type: 'move', x: 0, y: 2.2, z: 0, yaw: 0 };
  assert.equal(parsePosition('{'), null);
  assert.equal(parsePosition(new ArrayBuffer(10)), null);
  assert.equal(parsePosition(' '.repeat(513)), null);
  for (const patch of [{x:471},{z:-471},{y:-1},{y:151},{yaw:null},{x:'0'},{type:'other'}])
    assert.equal(parsePosition(JSON.stringify({ ...valid, ...patch })), null);
});
