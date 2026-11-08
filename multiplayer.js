import { createAvatarFactory } from './avatars.js?v=5ee7401ff403';
export function createMultiplayer({ THREE, scene, camera, ground, endpoint }) {
  const status = document.querySelector('#network-status');
  const roomLabel = document.querySelector('#world-name');
  const invite = document.querySelector('#invite');
  const params = new URL(location.href).searchParams;
  const candidate = params.get('world') || 'amber-island';
  const room = /^[a-z0-9-]{1,48}$/.test(candidate) ? candidate : 'amber-island';
  roomLabel.textContent = room;
  const players = new Map();
  let socket,
    selfId,
    retryAt = 0,
    failures = 0,
    blocked = false,
    connecting = false;
  let lastSent = null,
    lastSendTime = 0,
    lastReceive = 0,
    spawned = false;
  let nextHeartbeat = 0;
  const createAvatar = createAvatarFactory(THREE);
  const targetPosition = new THREE.Vector3();
  function hashId(id) {
    return [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0);
  }
  function setStatus(message) {
    status.textContent = message;
  }
  function updateCount() {
    setStatus(`${players.size + 1} / 20 explorers online`);
  }
  function label(id) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(25,44,43,.75)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.font = '24px sans-serif';
    ctx.fillStyle = '#fff6df';
    ctx.textAlign = 'center';
    ctx.fillText(`Wanderer ${id.slice(0, 4)}`, 128, 40);
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, depthWrite: false }),
    );
    sprite.position.y = 2.7;
    sprite.scale.set(2.8, 0.7, 1);
    return sprite;
  }
  function upsert(p) {
    if (
      !p ||
      p.id === selfId ||
      typeof p.id !== 'string' ||
      !['x', 'y', 'z', 'yaw'].every((k) => Number.isFinite(p[k]))
    )
      return;
    let avatar = players.get(p.id);
    if (!avatar) {
      const explorer = createAvatar(p.id);
      const { group } = explorer;
      const tag = label(p.id);
      group.add(tag);
      scene.add(group);
      group.position.set(p.x, p.y - 2.2, p.z);
      group.rotation.y = p.yaw;
      avatar = { ...explorer, tag, target: p };
      players.set(p.id, avatar);
      updateCount();
    }
    avatar.target = p;
  }
  function remove(id) {
    const a = players.get(id);
    if (!a) return;
    scene.remove(a.group);
    a.dispose();
    a.tag.material.map.dispose();
    a.tag.material.dispose();
    players.delete(id);
  }
  function clear() {
    for (const id of [...players.keys()]) remove(id);
  }
  invite.addEventListener('click', async () => {
    const url = new URL(location.href);
    url.search = '';
    url.searchParams.set('world', room);
    try {
      await navigator.clipboard.writeText(url.href);
      invite.textContent = 'LINK COPIED';
    } catch {
      window.prompt('Copy this island invitation:', url.href);
    }
    setTimeout(() => (invite.textContent = 'INVITE FRIENDS ↗'), 2500);
  });
  document.querySelector('#new-world').addEventListener('click', () => {
    const url = new URL(location.href);
    url.search = '';
    url.searchParams.set('world', `island-${crypto.randomUUID().slice(0, 8)}`);
    location.href = url.href;
  });
  function dropConnection(retry) {
    // Detach first: a late close/message from the old socket must not affect its replacement.
    const old = socket;
    socket = null;
    selfId = null;
    connecting = false;
    clear();
    if (retry && !blocked) {
      retryAt =
        performance.now() +
        Math.min(30000, 1000 * 2 ** Math.min(failures++, 5)) +
        Math.random() * 500;
      setStatus('Connection lost · reconnecting…');
    }
    try {
      old?.close(retry ? 4000 : 1000, retry ? 'Reconnecting' : 'Page hidden');
    } catch {
      /* Some browsers reject closing a pending handshake. */
    }
  }
  function connect() {
    if (!endpoint || blocked || connecting) return;
    connecting = true;
    setStatus('Connecting to island…');
    const url = new URL('/connect', endpoint);
    url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:';
    url.searchParams.set('world', room);
    let ws;
    try {
      ws = new WebSocket(url);
    } catch {
      dropConnection(true);
      return;
    }
    socket = ws;
    lastReceive = performance.now();
    ws.addEventListener('message', (event) => {
      if (socket !== ws) return;
      lastReceive = performance.now();
      if (event.data === 'pong') return;
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (!msg || typeof msg !== 'object') return;
      if (
        msg.type === 'welcome' &&
        typeof msg.id === 'string' &&
        Array.isArray(msg.players)
      ) {
        connecting = false;
        failures = 0;
        selfId = msg.id;
        clear();
        if (!spawned) {
          const angle = (hashId(selfId) / 0xffffffff) * Math.PI * 2;
          camera.position.x = 165 + Math.cos(angle) * 9;
          camera.position.z = 180 + Math.sin(angle) * 9;
          camera.position.y =
            ground(camera.position.x, camera.position.z) + 2.2;
          spawned = true;
        }
        for (const p of msg.players) upsert(p);
        lastSent = null;
        nextHeartbeat = 0;
        updateCount();
      } else if (msg.type === 'player') upsert(msg.player);
      else if (msg.type === 'leave') {
        remove(msg.id);
        updateCount();
      } else if (msg.type === 'full') {
        blocked = true;
        setStatus(
          typeof msg.message === 'string'
            ? msg.message
            : 'This island is full. Try another world.',
        );
      }
    });
    ws.addEventListener('close', (event) => {
      if (socket !== ws) return;
      if (event.code === 4004) {
        blocked = true;
        setStatus('This island is full. Try another world.');
      }
      dropConnection(true);
    });
    ws.addEventListener('error', () => {
      /* close schedules a retry; solo exploration stays available. */
    });
  }
  function disconnect() {
    dropConnection(false);
    if (!blocked) setStatus('Paused · reconnect when exploring');
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) disconnect();
  });
  addEventListener('pagehide', disconnect);
  setStatus(
    endpoint
      ? 'Enter to join this island'
      : 'Solo exploration · multiplayer setup pending',
  );
  return {
    update(dt, playing) {
      const now = performance.now();
      if (endpoint && !document.hidden && playing && !socket && now >= retryAt)
        connect();
      if (socket && now - lastReceive > 45000) {
        dropConnection(true);
      }
      if (socket?.readyState === WebSocket.OPEN && selfId) {
        if (now >= nextHeartbeat) {
          socket.send('ping');
          nextHeartbeat = now + 10000;
        }
        const p = {
          type: 'move',
          x: camera.position.x,
          y: camera.position.y,
          z: camera.position.z,
          yaw: camera.rotation.y,
        };
        // Send only changed positions, at most 10 times/sec. Idle sockets can hibernate.
        if (
          now - lastSendTime >= 100 &&
          (!lastSent ||
            Math.abs(p.x - lastSent.x) +
              Math.abs(p.z - lastSent.z) +
              Math.abs(p.y - lastSent.y) +
              Math.abs(p.yaw - lastSent.yaw) >
              0.015)
        ) {
          if (socket.bufferedAmount < 4096) {
            socket.send(JSON.stringify(p));
            lastSent = p;
            lastSendTime = now;
          }
        }
      }
      for (const a of players.values()) {
        const alpha = 1 - Math.exp(-dt * 12);
        targetPosition.set(a.target.x, a.target.y - 2.2, a.target.z);
        const previousX = a.group.position.x,
          previousZ = a.group.position.z;
        a.group.position.lerp(targetPosition, alpha);
        a.group.rotation.y +=
          Math.atan2(
            Math.sin(a.target.yaw - a.group.rotation.y),
            Math.cos(a.target.yaw - a.group.rotation.y),
          ) * alpha;
        const speed =
          Math.hypot(
            a.group.position.x - previousX,
            a.group.position.z - previousZ,
          ) / Math.max(dt, 0.001);
        a.animate(dt, speed);
      }
    },
  };
}
