import { test } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';

const base = process.env.NOMAD_TEST_URL;
function client(room) {
  const url = new URL('/connect', base);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('world', room);
  const ws = new WebSocket(url, { origin: 'https://peterthelander.github.io' });
  const queue = [], waiting = [];
  ws.on('message', raw => {
    const value = raw.toString() === 'pong' ? 'pong' : JSON.parse(raw);
    const waiter = waiting.shift();
    if (waiter) waiter(value); else queue.push(value);
  });
  // Errors fail pending expectations through their timeout, without uncaught events.
  ws.on('error', () => {});
  return { ws, next() {
    if (queue.length) return Promise.resolve(queue.shift());
    return new Promise((resolve,reject) => {
      const timer=setTimeout(()=>reject(Error('Timed out waiting for multiplayer message')),5000);
      waiting.push(value=>{clearTimeout(timer);resolve(value)});
    });
  }};
}
const move = (x=165) => JSON.stringify({ type:'move',x,y:30,z:180,yaw:.5 });

test('real WebSocket clients join, see movement, stay in separate rooms, and leave', {skip:!base,timeout:20000}, async t => {
  const room=`test-${Date.now()}`;
  const a=client(room),b=client(room),other=client(`${room}-other`);
  t.after(()=>[a,b,other].forEach(c=>c.ws.terminate()));
  const wa=await a.next(),wb=await b.next(),wo=await other.next();
  assert.equal(wa.type,'welcome');assert.notEqual(wa.id,wb.id);assert.deepEqual(wo.players,[]);
  a.ws.send(move());const seen=await b.next();assert.equal(seen.type,'player');assert.equal(seen.player.id,wa.id);
  b.ws.send(move(170));assert.equal((await a.next()).player.x,170);
  a.ws.send('ping');assert.equal(await a.next(),'pong');
  // A late joiner receives the current state, not only subsequent movement.
  const late=client(room);t.after(()=>late.ws.terminate());
  assert.equal((await late.next()).players.length,2);
  other.ws.send('ping');assert.equal(await other.next(),'pong','Other world must not receive movement');
  a.ws.close(1000);const left=await b.next();assert.deepEqual(left,{type:'leave',id:wa.id});
});

test('full rooms reject the 21st player with an explicit message', {skip:!base,timeout:20000}, async t => {
  const room=`capacity-${Date.now()}`,clients=[];
  t.after(()=>clients.forEach(c=>c.ws.terminate()));
  for(let i=0;i<20;i++){const c=client(room);clients.push(c);assert.equal((await c.next()).type,'welcome')}
  const extra=client(room);clients.push(extra);assert.equal((await extra.next()).type,'full');
});

test('invalid movement closes the connection', {skip:!base,timeout:10000}, async t => {
  const c=client(`invalid-${Date.now()}`);t.after(()=>c.ws.terminate());await c.next();
  const closed=new Promise(resolve=>c.ws.once('close',resolve));
  c.ws.send('{"type":"move","x":99999}');assert.equal(await closed,1008);
});
