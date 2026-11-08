import { DurableObject } from 'cloudflare:workers';
import { MAX_PLAYERS, validRoom, parsePosition } from './protocol.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') return Response.json({ ok: true, service: 'nomad-multiplayer', version: 1 });
    if (url.pathname !== '/connect') return new Response('Not found', { status: 404 });
    if (request.method !== 'GET' || request.headers.get('Upgrade')?.toLowerCase() !== 'websocket')
      return new Response('WebSocket required', { status: 426 });
    const origins = env.ALLOWED_ORIGINS.split(',');
    if (!origins.includes(request.headers.get('Origin'))) return new Response('Origin not allowed', { status: 403 });
    const room = url.searchParams.get('world') || 'amber-island';
    if (!validRoom(room)) return new Response('Invalid world', { status: 400 });
    return env.WORLDS.getByName(room).fetch(request);
  }
};

// Each world owns its connections. Attachments survive Durable Object hibernation.
export class World extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }
  sockets() { return this.ctx.getWebSockets().filter(ws => ws.readyState === 1); }
  players() {
    return this.sockets().map(ws => ws.deserializeAttachment()?.player).filter(Boolean);
  }
  broadcast(data, except) {
    const message = JSON.stringify(data);
    for (const ws of this.sockets()) if (ws !== except) {
      try { ws.send(message); } catch { /* Close callback handles disconnected clients. */ }
    }
  }
  async fetch() {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    if (this.sockets().length >= MAX_PLAYERS) {
      server.accept();
      server.send(JSON.stringify({ type: 'full', message: 'This island is full (20 players). Try another world.' }));
      server.close(4004, 'World full');
      return new Response(null, { status: 101, webSocket: client });
    }
    const id = crypto.randomUUID();
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id, player: null, tokens: 20, updatedAt: Date.now() });
    server.send(JSON.stringify({ type: 'welcome', id, players: this.players() }));
    return new Response(null, { status: 101, webSocket: client });
  }
  webSocketMessage(ws, message) {
    if (typeof message !== 'string' || message.length > 512) { ws.close(1009, 'Message too large'); return; }
    const position = parsePosition(message);
    if (!position) { ws.close(1008, 'Invalid position'); return; }
    const state = ws.deserializeAttachment();
    const now = Date.now();
    state.tokens = Math.min(20, state.tokens + Math.max(0, now - state.updatedAt) * .015);
    state.updatedAt = now;
    if (state.tokens < 1) { ws.close(1008, 'Too many updates'); return; }
    state.tokens--;
    state.player = { id: state.id, ...position };
    ws.serializeAttachment(state);
    this.broadcast({ type: 'player', player: state.player }, ws);
  }
  remove(ws) {
    const state = ws.deserializeAttachment();
    if (state?.player) {
      ws.serializeAttachment({ ...state, player: null });
      this.broadcast({ type: 'leave', id: state.id }, ws);
    }
  }
  webSocketClose(ws, code) {
    this.remove(ws);
    // Complete the closing handshake, including after hibernation.
    ws.close(code === 1006 || code === 1005 ? 1000 : code, 'Disconnected');
  }
  webSocketError(ws) { this.remove(ws); ws.close(1011, 'Connection error'); }
}
