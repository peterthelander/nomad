import { createAtmosphere } from './atmosphere.js?v=158cea607e0f';
import { createWorld } from './world.js?v=a35ed567c5f4';
import { createMultiplayer } from './multiplayer.js?v=e358d27081fb';
import { MULTIPLAYER_URL } from './config.js?v=0d93ac67fb24';
import { createControls } from './controls.js?v=a282344236b9';
const enter = document.querySelector('#enter'),
  error = document.querySelector('#error');
try {
  const THREE = await import(
    'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js'
  );
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#8ecbe8');
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(
    Math.min(
      devicePixelRatio,
      matchMedia('(pointer: coarse)').matches ? 1.5 : 2,
    ),
  );
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  document.body.prepend(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(
    65,
    innerWidth / innerHeight,
    0.1,
    1800,
  );
  camera.rotation.order = 'YXZ';
  const EYE = 2.2;
  const { ground, heightTexture } = createWorld(THREE, scene);
  const atmosphere = createAtmosphere(
    THREE,
    scene,
    renderer,
    camera,
    heightTexture,
  );
  camera.position.set(165, ground(165, 180) + EYE, 180);
  camera.rotation.set(-0.03, 0.62, 0);
  const controls = createControls(renderer.domElement, (dx, dy) => {
    camera.rotation.y -= dx;
    camera.rotation.x = THREE.MathUtils.clamp(
      camera.rotation.x - dy,
      -1.48,
      1.48,
    );
  });
  const multiplayer = createMultiplayer({
    THREE,
    scene,
    camera,
    ground,
    endpoint: MULTIPLAYER_URL,
  });
  enter.disabled = false;
  enter.innerHTML = 'ENTER THE WILDERNESS <span>↗</span>';
  const clock = new THREE.Clock();
  let elapsed = 0;
  const positionLabel = document.querySelector('#position'),
    compass = document.querySelector('#compass');
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;
    if (controls.playing) {
      const { forward, side, running } = controls.movement;
      const len = Math.max(1, Math.hypot(forward, side)),
        speed = ((running ? 20 : 10) * dt) / len,
        yaw = camera.rotation.y;
      const nx = THREE.MathUtils.clamp(
          camera.position.x +
            (side * Math.cos(yaw) - forward * Math.sin(yaw)) * speed,
          -470,
          470,
        ),
        nz = THREE.MathUtils.clamp(
          camera.position.z +
            (-side * Math.sin(yaw) - forward * Math.cos(yaw)) * speed,
          -470,
          470,
        );
      if (ground(nx, nz) > 1) {
        camera.position.x = nx;
        camera.position.z = nz;
      }
      camera.position.y = ground(camera.position.x, camera.position.z) + EYE;
    }
    atmosphere.update(elapsed);
    positionLabel.textContent = `ELEV. ${Math.round(camera.position.y - EYE)} M`;
    const degrees =
      ((THREE.MathUtils.radToDeg(-camera.rotation.y) % 360) + 360) % 360;
    compass.textContent = `${['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(degrees / 45) % 8]}   ·   ${Math.round(degrees).toString().padStart(3, '0')}°`;
    multiplayer.update(dt, controls.playing);
    renderer.render(scene, camera);
  });
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
} catch (e) {
  console.error(e);
  enter.textContent = 'UNABLE TO START';
  error.textContent =
    'The 3D scene could not load. Check your internet connection and WebGL support, then refresh.';
}
