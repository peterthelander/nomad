// Vertical motion uses world height, so walking downhill during a jump does not
// teleport the player down with the terrain. The surface remains the landing floor.
export function createJumpMotion() {
  let height = null;
  let velocity = 0;
  let grounded = true;
  return {
    update(dt, floor, jumpRequested) {
      if (grounded || height === null) height = floor;
      if (jumpRequested && grounded) {
        velocity = 7.8;
        grounded = false;
      }
      if (!grounded) {
        const gravity = 22;
        height += velocity * dt - 0.5 * gravity * dt * dt;
        velocity -= gravity * dt;
        if (height <= floor) {
          height = floor;
          velocity = 0;
          grounded = true;
        }
      }
      return height;
    },
  };
}
