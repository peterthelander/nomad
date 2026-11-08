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
    STEP = SIZE / SEG;
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
    const slope =
      Math.hypot(
        height(x + 2, z) - height(x - 2, z),
        height(x, z + 2) - height(x, z - 2),
      ) / 4;
    const variation = noise(x * 0.09, z * 0.09);
    color.set('#70a34b').lerp(new THREE.Color('#3e853f'), variation * 0.65);
    color.lerp(
      new THREE.Color('#a0ac62'),
      THREE.MathUtils.smoothstep(h, 28, 60) * 0.65,
    );
    color.lerp(
      new THREE.Color('#d9c58e'),
      1 - THREE.MathUtils.smoothstep(h, 2.4, 7),
    );
    color.lerp(
      new THREE.Color('#89938b'),
      Math.max(
        THREE.MathUtils.smoothstep(slope, 0.6, 1.5),
        THREE.MathUtils.smoothstep(h, 53, 72),
      ),
    );
    color.lerp(
      new THREE.Color('#eef3e9'),
      THREE.MathUtils.smoothstep(h, 70, 82),
    );
    color.multiplyScalar(0.94 + variation * 0.12);
    colors.push(color.r, color.g, color.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      flatShading: false,
    }),
  );
  terrain.receiveShadow = true;
  // Fine-scale color variation gives the ground texture without a downloaded image.
  terrain.material.onBeforeCompile = (shader) => {
    shader.vertexShader =
      'varying vec3 terrainPosition;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nterrainPosition=position;',
    );
    shader.fragmentShader =
      `varying vec3 terrainPosition;
      float groundHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float groundNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(groundHash(i),groundHash(i+vec2(1,0)),f.x),mix(groundHash(i+vec2(0,1)),groundHash(i+1.),f.x),f.y);}
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      float grain=groundNoise(terrainPosition.xz*3.5);
      diffuseColor.rgb*=.95+grain*.10;`,
    );
  };
  scene.add(terrain);
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

  const pixels = new Uint16Array(heights.length);
  for (let i = 0; i < heights.length; i++)
    pixels[i] = THREE.DataUtils.toHalfFloat(heights[i]);
  const heightTexture = new THREE.DataTexture(
    pixels,
    SEG + 1,
    SEG + 1,
    THREE.RedFormat,
    THREE.HalfFloatType,
  );
  heightTexture.minFilter = heightTexture.magFilter = THREE.LinearFilter;
  heightTexture.needsUpdate = true;

  // Layered crowns share geometry and materials, keeping the forest instanced.
  const trunkGeo = new THREE.CylinderGeometry(0.24, 0.55, 6, 9);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: '#735439',
    roughness: 1,
  });
  const pineMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 1,
  });
  const oakMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.95,
  });
  const parts = [];
  for (let tier = 0; tier < 3; tier++) {
    const cone = new THREE.ConeGeometry(
      3.5 - tier * 0.72,
      5.6 - tier * 0.7,
      12,
      3,
    );
    cone.translate(0, 4.4 + tier * 2.25, 0);
    const vertices = cone.attributes.position;
    for (let j = 0; j < vertices.count; j++) {
      const x = vertices.getX(j),
        z = vertices.getZ(j),
        y = vertices.getY(j);
      const scale = 1 + Math.sin(Math.atan2(z, x) * 5 + y * 1.7) * 0.085;
      vertices.setXYZ(j, x * scale, y, z * scale);
    }
    cone.computeVertexNormals();
    parts.push(cone.toNonIndexed());
    cone.dispose();
  }
  const pineGeo = new THREE.BufferGeometry();
  for (const attr of ['position', 'normal', 'uv']) {
    const values = parts.flatMap((part) =>
      Array.from(part.attributes[attr].array),
    );
    pineGeo.setAttribute(
      attr,
      new THREE.Float32BufferAttribute(
        values,
        parts[0].attributes[attr].itemSize,
      ),
    );
  }
  parts.forEach((part) => part.dispose());
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, 650);
  const pines = new THREE.InstancedMesh(pineGeo, pineMat, 650);
  const crowns = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 1),
    oakMat,
    650 * 3,
  );
  const rocks = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 1),
    new THREE.MeshStandardMaterial({ color: '#92998e', roughness: 1 }),
    220,
  );
  const dummy = new THREE.Object3D(),
    tint = new THREE.Color();
  let ti = 0,
    pi = 0,
    ci = 0,
    ri = 0;
  for (let i = 0; i < 5000 && (ti < 650 || ri < 220); i++) {
    const x = (hash(i, 1) - 0.5) * 850,
      z = (hash(i, 2) - 0.5) * 850,
      h = ground(x, z);
    const slope = Math.max(
      Math.abs(ground(x + 3, z) - h),
      Math.abs(ground(x, z + 3) - h),
    );
    if (h > 6 && h < 57 && slope < 2 && ti < 650) {
      const scale = 0.6 + hash(i, 3) * 0.9,
        yaw = hash(i, 4) * Math.PI * 2;
      dummy.position.set(x, h + 3 * scale, z);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      trunks.setMatrixAt(ti++, dummy.matrix);
      if (hash(i, 8) > 0.34 || h > 38) {
        dummy.position.set(x, h, z);
        dummy.updateMatrix();
        pines.setMatrixAt(pi, dummy.matrix);
        tint.setHSL(
          0.3 + hash(i, 9) * 0.055,
          0.35 + hash(i, 10) * 0.16,
          0.23 + hash(i, 11) * 0.11,
        );
        pines.setColorAt(pi++, tint);
      } else {
        for (let j = 0; j < 3; j++) {
          const angle = yaw + j * 2.1;
          dummy.position.set(
            x + Math.cos(angle) * 1.3 * scale,
            h + (6.3 + j * 0.75) * scale,
            z + Math.sin(angle) * 1.3 * scale,
          );
          dummy.rotation.set(0.1 * j, yaw, 0.08 * j);
          dummy.scale.set(3.1 * scale, 2.7 * scale, 2.9 * scale);
          dummy.updateMatrix();
          crowns.setMatrixAt(ci, dummy.matrix);
          tint.setHSL(
            0.24 + hash(i, j + 20) * 0.09,
            0.43,
            0.33 + hash(i, j + 30) * 0.1,
          );
          crowns.setColorAt(ci++, tint);
        }
      }
    } else if (h > 3 && h < 76 && ri < 220) {
      const scale = 1 + hash(i, 5) * 2.5;
      dummy.position.set(x, h + 0.4 * scale, z);
      dummy.rotation.set(hash(i, 6), hash(i, 7) * 6, 0);
      dummy.scale.set(scale, scale * 0.7, scale * 0.85);
      dummy.updateMatrix();
      rocks.setMatrixAt(ri++, dummy.matrix);
    }
  }
  trunks.count = ti;
  pines.count = pi;
  crowns.count = ci;
  rocks.count = ri;
  for (const mesh of [trunks, pines, crowns, rocks]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
  return { ground, heightTexture };
}
