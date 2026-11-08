// Input is independent of rendering: touch movement and keyboard movement share axes.
export function createControls(canvas, onLook) {
  // Capability hints set the initial UI; the actual input selects the controls.
  let touchMode = matchMedia('(pointer: coarse)').matches;
  document.body.classList.toggle('touch-mode', touchMode);
  const enter = document.querySelector('#enter');
  const error = document.querySelector('#error');
  const joystick = document.querySelector('#joystick');
  const stick = document.querySelector('#stick');
  const lookZone = document.querySelector('#look-zone');
  const keys = new Set();
  let playing = false, movePointer = null, lookPointer = null;
  let forward = 0, side = 0, lastX = 0, lastY = 0;

  function reset() {
    keys.clear();
    forward = side = 0;
    movePointer = lookPointer = null;
    stick.style.transform = 'translate(0px, 0px)';
  }
  function setPlaying(value) {
    playing = value;
    reset();
    document.body.classList.toggle('playing', playing);
    if (!playing) enter.innerHTML = 'CONTINUE EXPLORING <span>↗</span>';
  }
  function pause() {
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    setPlaying(false);
  }
  function setInputMode(useTouch) {
    touchMode = useTouch;
    reset();
    document.body.classList.toggle('touch-mode', touchMode);
    error.textContent = '';
    document.querySelector('.hint').textContent = touchMode
      ? 'LEFT THUMB TO MOVE · RIGHT THUMB TO LOOK'
      : 'CLICK TO EXPLORE · WASD TO MOVE · MOUSE TO LOOK';
  }
  function useTouchControls() { setInputMode(true); }
  setInputMode(touchMode);
  // Hybrid laptops have both touch and a mouse. Follow the input used to start.
  enter.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') setInputMode(true);
    else if (e.pointerType === 'mouse' || e.pointerType === 'pen') setInputMode(false);
  });
  enter.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') setInputMode(false);
  });
  document.querySelector('#use-touch').addEventListener('click', () => {
    useTouchControls();
    setPlaying(true);
  });
  enter.addEventListener('click', async () => {
    error.textContent = '';
    if (touchMode) { setPlaying(true); return; }
    try { await canvas.requestPointerLock(); }
    catch { error.textContent = 'Mouse capture was blocked. Open this page in a browser tab and click again.'; }
  });
  document.querySelector('#pause').addEventListener('click', pause);
  document.addEventListener('pointerlockchange', () => {
    if (!touchMode) setPlaying(document.pointerLockElement === canvas);
  });
  document.addEventListener('pointerlockerror', () => {
    if (!touchMode) error.textContent = 'Mouse capture is unavailable here. Open the page in a desktop browser tab.';
  });
  document.addEventListener('mousemove', e => {
    if (playing && !touchMode && document.pointerLockElement === canvas)
      onLook(e.movementX * .002, e.movementY * .002);
  });
  addEventListener('keydown', e => {
    if (e.code === 'Escape' && playing) { pause(); return; }
    if (playing && ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) {
      e.preventDefault(); keys.add(e.code);
    }
  });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', pause);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  addEventListener('resize', reset);

  function updateStick(e) {
    const rect = joystick.getBoundingClientRect();
    const radius = rect.width * .32;
    let x = (e.clientX - rect.left - rect.width / 2) / radius;
    let y = (e.clientY - rect.top - rect.height / 2) / radius;
    const length = Math.hypot(x, y);
    if (length > 1) { x /= length; y /= length; }
    // A small dead zone prevents accidental drifting with a resting thumb.
    const magnitude = Math.min(length, 1);
    const strength = Math.max(0, (magnitude - .12) / .88);
    side = magnitude ? x / magnitude * strength : 0;
    forward = magnitude ? -y / magnitude * strength : 0;
    stick.style.transform = `translate(${x * radius}px, ${y * radius}px)`;
  }
  joystick.addEventListener('pointerdown', e => {
    if (!playing || movePointer !== null) return;
    e.preventDefault(); movePointer = e.pointerId;
    joystick.setPointerCapture(e.pointerId); updateStick(e);
  });
  joystick.addEventListener('pointermove', e => { if (e.pointerId === movePointer) updateStick(e); });
  function releaseMove(e) {
    if (e.pointerId !== movePointer) return;
    movePointer = null; forward = side = 0;
    stick.style.transform = 'translate(0px, 0px)';
  }
  for (const event of ['pointerup','pointercancel','lostpointercapture']) joystick.addEventListener(event, releaseMove);
  lookZone.addEventListener('pointerdown', e => {
    if (!playing || lookPointer !== null) return;
    e.preventDefault(); lookPointer = e.pointerId;
    lastX = e.clientX; lastY = e.clientY;
    lookZone.setPointerCapture(e.pointerId);
  });
  lookZone.addEventListener('pointermove', e => {
    if (e.pointerId !== lookPointer) return;
    onLook((e.clientX-lastX)*.004, (e.clientY-lastY)*.004);
    lastX = e.clientX; lastY = e.clientY;
  });
  function releaseLook(e) { if (e.pointerId === lookPointer) lookPointer = null; }
  for (const event of ['pointerup','pointercancel','lostpointercapture']) lookZone.addEventListener(event, releaseLook);
  return {
    get playing() { return playing; },
    get movement() {
      return {
        forward: forward + Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown')),
        side: side + Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')),
        running: keys.has('ShiftLeft') || keys.has('ShiftRight')
      };
    }
  };
}
