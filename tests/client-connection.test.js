import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMultiplayer } from '../multiplayer.js';

class Target {
  constructor() {
    this.events = {};
  }
  addEventListener(name, fn) {
    (this.events[name] ??= []).push(fn);
  }
  fire(name, event = {}) {
    for (const fn of this.events[name] ?? []) fn(event);
  }
}
class Socket extends Target {
  static OPEN = 1;
  static instances = [];
  constructor() {
    super();
    this.readyState = 0;
    this.bufferedAmount = 0;
    this.sent = [];
    Socket.instances.push(this);
  }
  send(data) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 2;
  } // Deliberately never emits close: simulates a stalled connection.
  welcome() {
    this.readyState = 1;
    this.fire('message', {
      data: JSON.stringify({ type: 'welcome', id: 'test-player', players: [] }),
    });
  }
}
class Resource {
  dispose() {}
}
class Vector {
  constructor(x = 0, y = 0, z = 0) {
    this.set(x, y, z);
  }
  set(x, y, z) {
    Object.assign(this, { x, y, z });
    return this;
  }
}

test('stalled sockets reconnect, stale events are ignored, and idle frames do not flood updates', (t) => {
  let now = 0;
  t.mock.method(performance, 'now', () => now);
  const previous = {
    document: globalThis.document,
    location: globalThis.location,
    WebSocket: globalThis.WebSocket,
    addEventListener: globalThis.addEventListener,
  };
  t.after(() => Object.assign(globalThis, previous));
  const nodes = new Map();
  const doc = new Target();
  doc.querySelector = (s) => {
    if (!nodes.has(s)) nodes.set(s, new Target());
    return nodes.get(s);
  };
  doc.hidden = false;
  Object.assign(globalThis, {
    document: doc,
    location: { href: 'https://example.com/?world=test' },
    WebSocket: Socket,
    addEventListener() {},
  });
  Socket.instances = [];
  const THREE = {
    CylinderGeometry: Resource,
    SphereGeometry: Resource,
    BoxGeometry: Resource,
    MeshStandardMaterial: Resource,
    Vector3: Vector,
  };
  const camera = { position: new Vector(165, 30, 180), rotation: { y: 0 } };
  const client = createMultiplayer({
    THREE,
    scene: {},
    camera,
    ground: () => 30,
    endpoint: 'https://example.com',
  });
  client.update(0.016, true);
  assert.equal(Socket.instances.length, 1);
  now = 46000;
  client.update(0.016, true);
  now = 48000;
  client.update(0.016, true);
  assert.equal(
    Socket.instances.length,
    2,
    'Pending handshake cannot block retries forever',
  );
  const old = Socket.instances[0],
    active = Socket.instances[1];
  active.welcome();
  old.fire('close', { code: 1006 }); // Must not clear the current session.
  client.update(0.016, true);
  assert.equal(
    active.sent.filter((s) => s.includes('"type":"move"')).length,
    1,
  );
  for (let i = 0; i < 100; i++) {
    now += 100;
    client.update(0.016, true);
  }
  assert.equal(
    active.sent.filter((s) => s.includes('"type":"move"')).length,
    1,
    'Idle positions are not retransmitted',
  );
  assert.doesNotThrow(() => active.fire('message', { data: 'null' }));
  assert.doesNotThrow(() =>
    active.fire('message', { data: '{"type":"player","player":null}' }),
  );
  now += 46000;
  client.update(0.016, true);
  now += 2000;
  client.update(0.016, true);
  assert.equal(
    Socket.instances.length,
    3,
    'Open but silent connection is replaced without waiting for close',
  );
  doc.hidden = true;
  doc.fire('visibilitychange');
  assert.equal(Socket.instances[2].readyState, 2);
  now += 60000;
  client.update(0.016, true);
  assert.equal(Socket.instances.length, 3, 'Hidden page stays disconnected');
});
