export const MAX_PLAYERS = 20;
export function validRoom(value) {
  return typeof value === 'string' && /^[a-z0-9-]{1,48}$/.test(value);
}
export function parsePosition(message) {
  if (typeof message !== 'string' || message.length > 512) return null;
  try {
    const p = JSON.parse(message);
    if (
      p.type !== 'move' ||
      !['x', 'y', 'z', 'yaw'].every((k) => Number.isFinite(p[k]))
    )
      return null;
    if (Math.abs(p.x) > 470 || Math.abs(p.z) > 470 || p.y < 0 || p.y > 150)
      return null;
    return {
      x: p.x,
      y: p.y,
      z: p.z,
      yaw: Math.atan2(Math.sin(p.yaw), Math.cos(p.yaw)),
    };
  } catch {
    return null;
  }
}
