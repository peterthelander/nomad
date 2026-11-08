export function createWorld(THREE, scene) {
  // Seeded value noise keeps terrain, decoration and collision reproducible.
  function hash(x, z) {
    let n = Math.sin(x * 127.1 + z * 311.7 + 47.3) * 43758.5453;
    return n - Math.floor(n);
  }
  function noise(x, z) {
    const a = Math.floor(x),
      b = Math.floor(z);
    let u = x - a,
      v = z - b;
    u = u * u * (3 - 2 * u);
    v = v * v * (3 - 2 * v);
    return THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(hash(a, b), hash(a + 1, b), u),
      THREE.MathUtils.lerp(hash(a, b + 1), hash(a + 1, b + 1), u),
      v,
    );
  }
  const SIZE = 1000,
    SEG = 240,
    STEP = SIZE / SEG,
    SEA = 0;
  function height(x, z) {
    const r = Math.hypot(x / 440, z / 400);
    return (
      9 +
      noise(x * 0.004, z * 0.004) * 57 +
      noise(x * 0.012, z * 0.012) * 22 +
      noise(x * 0.034, z * 0.034) * 4 -
      65 * Math.pow(r, 3.1) +
      22 * Math.exp(-((x + 90) ** 2 + (z + 100) ** 2) / 19000)
    );
  }
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position,
    heights = new Float32Array(pos.count),
    colors = [];
  const color = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i),
      z = pos.getZ(i),
      h = height(x, z);
    heights[i] = h;
    pos.setY(i, h);
    if (h < 3.5) color.set('#c9b98a');
    else if (h < 36) color.set('#7b9163');
    else if (h < 58) color.set('#8a9278');
    else if (h < 72) color.set('#9c9e91');
    else color.set('#e3e1ce');
    color.multiplyScalar(0.91 + hash(x, z) * 0.15);
    colors.push(color.r, color.g, color.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  scene.add(
    new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 1,
        flatShading: true,
      }),
    ),
  );
  // Sample the actual mesh triangles, so the eye follows the rendered surface.
  function ground(x, z) {
    let gx = THREE.MathUtils.clamp((x + SIZE / 2) / STEP, 0, SEG - 0.00001),
      gz = THREE.MathUtils.clamp((z + SIZE / 2) / STEP, 0, SEG - 0.00001),
      ix = Math.floor(gx),
      iz = Math.floor(gz),
      u = gx - ix,
      v = gz - iz;
    let a = heights[iz * (SEG + 1) + ix],
      b = heights[(iz + 1) * (SEG + 1) + ix],
      c = heights[(iz + 1) * (SEG + 1) + ix + 1],
      d = heights[iz * (SEG + 1) + ix + 1];
    return u + v <= 1
      ? a + (d - a) * u + (b - a) * v
      : c + (b - c) * (1 - u) + (d - c) * (1 - v);
  }
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(5000, 5000),
    new THREE.MeshStandardMaterial({
      color: '#558f96',
      transparent: true,
      opacity: 0.86,
      roughness: 0.36,
      metalness: 0.25,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = SEA;
  scene.add(water);
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.65, 5, 5),
    leafGeo = new THREE.ConeGeometry(4, 10, 6);
  const trunkMat = new THREE.MeshStandardMaterial({
      color: '#655e46',
      flatShading: true,
    }),
    leafMat = new THREE.MeshStandardMaterial({
      color: '#3f6655',
      flatShading: true,
    });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, 650),
    leaves = new THREE.InstancedMesh(leafGeo, leafMat, 650),
    rocks = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({ color: '#9b9e8b', flatShading: true }),
      220,
    );
  let ti = 0,
    ri = 0;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 5000 && (ti < 650 || ri < 220); i++) {
    const x = (hash(i, 1) - 0.5) * 850,
      z = (hash(i, 2) - 0.5) * 850,
      h = ground(x, z),
      slope = Math.max(
        Math.abs(ground(x + 3, z) - h),
        Math.abs(ground(x, z + 3) - h),
      );
    if (h > 6 && h < 57 && slope < 2 && ti < 650) {
      const s = 0.6 + hash(i, 3) * 0.9;
      dummy.position.set(x, h + 2.5 * s, z);
      dummy.rotation.set(0, hash(i, 4) * 6.28, 0);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      trunks.setMatrixAt(ti, dummy.matrix);
      dummy.position.y = h + 8 * s;
      dummy.updateMatrix();
      leaves.setMatrixAt(ti++, dummy.matrix);
    } else if (h > 3 && h < 76 && ri < 220) {
      const s = 1 + hash(i, 5) * 2.5;
      dummy.position.set(x, h + 0.4 * s, z);
      dummy.rotation.set(hash(i, 6), hash(i, 7) * 6, 0);
      dummy.scale.set(s, s * 0.7, s * 0.85);
      dummy.updateMatrix();
      rocks.setMatrixAt(ri++, dummy.matrix);
    }
  }
  trunks.count = leaves.count = ti;
  rocks.count = ri;
  scene.add(trunks, leaves, rocks);
  // Warm distant sun; no image assets or texture downloads.
  const sunDisc = new THREE.Mesh(
    new THREE.SphereGeometry(22, 24, 16),
    new THREE.MeshBasicMaterial({ color: '#fff0ca', fog: false }),
  );
  sunDisc.position.set(-650, 270, -750);
  scene.add(sunDisc);

  return { ground, water };
}
