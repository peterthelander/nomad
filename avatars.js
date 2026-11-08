// Shared primitive geometry keeps each explorer small and entirely procedural.
export function createAvatarFactory(THREE) {
  let shared;
  const geometryCache = new Map();
  function resources() {
    if (shared) return shared;
    const material = (color, roughness = 0.9) =>
      new THREE.MeshStandardMaterial({ color, roughness });
    shared = {
      sphere: new THREE.SphereGeometry(1, 12, 8),
      cylinder: new THREE.CylinderGeometry(1, 1, 1, 12),
      torso: new THREE.CylinderGeometry(1, 0.83, 1, 12),
      box: new THREE.BoxGeometry(1, 1, 1),
      boots: material('#3e342c'),
      trousers: material('#38484d'),
      leather: material('#6c4b31'),
      pack: material('#697951'),
      roll: material('#b7ad87'),
      hat: material('#b5a079'),
      dark: material('#322d29'),
      white: material('#eee8d6'),
      brass: material('#cfb36b', 0.45),
    };
    return shared;
  }
  const coats = ['#bf854b', '#4f929e', '#aa6759', '#788b50', '#85799d'];
  const skinTones = ['#ddb18b', '#b58059', '#8c5b40', '#e7c5a2', '#c99a72'];
  return function createAvatar(id) {
    const r = resources();
    const seed = [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0);
    const jacket = new THREE.MeshStandardMaterial({
      color: coats[seed % coats.length],
      roughness: 0.95,
    });
    const skin = new THREE.MeshStandardMaterial({
      color: skinTones[(seed >>> 4) % skinTones.length],
      roughness: 0.85,
    });
    const group = new THREE.Group();
    const torso = new THREE.Group();
    group.add(torso);
    function mesh(parent, geometry, material, position, scale) {
      const item = new THREE.Mesh(geometry, material);
      item.position.set(...position);
      item.scale.set(...scale);
      item.castShadow = true;
      item.receiveShadow = true;
      parent.add(item);
      return item;
    }
    mesh(torso, r.torso, jacket, [0, 1.28, 0], [0.31, 0.64, 0.2]);
    mesh(torso, r.sphere, r.trousers, [0, 0.96, 0], [0.25, 0.15, 0.17]);
    mesh(torso, r.cylinder, r.leather, [0, 1.0, 0], [0.265, 0.055, 0.18]);
    mesh(torso, r.box, r.brass, [0, 1.01, -0.187], [0.08, 0.06, 0.018]);
    // Jacket seams, pockets, and backpack straps establish scale at close range.
    mesh(torso, r.box, r.leather, [0, 1.3, -0.202], [0.012, 0.53, 0.012]);
    for (const side of [-1, 1]) {
      mesh(
        torso,
        r.box,
        jacket,
        [side * 0.15, 1.22, -0.205],
        [0.15, 0.14, 0.024],
      );
      mesh(
        torso,
        r.box,
        r.leather,
        [side * 0.22, 1.4, -0.185],
        [0.043, 0.4, 0.025],
      );
      mesh(
        torso,
        r.box,
        r.brass,
        [side * 0.22, 1.29, -0.205],
        [0.05, 0.035, 0.015],
      );
    }
    mesh(torso, r.sphere, r.pack, [0, 1.31, 0.27], [0.3, 0.36, 0.19]);
    mesh(torso, r.sphere, r.leather, [0, 1.17, 0.41], [0.22, 0.15, 0.06]);
    const bedroll = mesh(
      torso,
      r.cylinder,
      r.roll,
      [0, 1.68, 0.3],
      [0.11, 0.67, 0.11],
    );
    bedroll.rotation.z = Math.PI / 2;
    for (const x of [-0.21, 0.21]) {
      const tie = mesh(
        torso,
        r.cylinder,
        r.leather,
        [x, 1.68, 0.3],
        [0.116, 0.035, 0.116],
      );
      tie.rotation.z = Math.PI / 2;
    }
    const head = new THREE.Group();
    head.position.y = 1.64;
    torso.add(head);
    mesh(head, r.cylinder, skin, [0, 0, 0], [0.085, 0.12, 0.085]);
    mesh(head, r.sphere, skin, [0, 0.19, -0.015], [0.19, 0.235, 0.185]);
    for (const side of [-1, 1]) {
      mesh(
        head,
        r.sphere,
        skin,
        [side * 0.19, 0.18, -0.005],
        [0.042, 0.065, 0.04],
      );
      mesh(
        head,
        r.sphere,
        r.white,
        [side * 0.07, 0.23, -0.182],
        [0.038, 0.026, 0.015],
      );
      mesh(
        head,
        r.sphere,
        r.dark,
        [side * 0.07, 0.23, -0.195],
        [0.016, 0.019, 0.008],
      );
      mesh(
        head,
        r.box,
        r.dark,
        [side * 0.07, 0.28, -0.175],
        [0.065, 0.016, 0.012],
      );
    }
    mesh(head, r.sphere, skin, [0, 0.17, -0.191], [0.035, 0.052, 0.038]);
    mesh(head, r.box, r.leather, [0, 0.075, -0.169], [0.065, 0.012, 0.012]);
    mesh(head, r.cylinder, r.hat, [0, 0.4, 0], [0.285, 0.035, 0.25]);
    mesh(head, r.sphere, r.hat, [0, 0.44, 0], [0.205, 0.12, 0.18]);
    mesh(head, r.cylinder, r.leather, [0, 0.43, 0], [0.207, 0.035, 0.181]);

    const arms = [],
      legs = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(side * 0.35, 1.51, 0);
      torso.add(arm);
      arm.rotation.z = side * 0.09;
      mesh(arm, r.sphere, jacket, [0, -0.06, 0], [0.125, 0.17, 0.13]);
      mesh(arm, r.cylinder, jacket, [0, -0.21, 0], [0.09, 0.3, 0.095]);
      const elbow = new THREE.Group();
      elbow.position.y = -0.35;
      arm.add(elbow);
      mesh(elbow, r.cylinder, jacket, [0, -0.12, 0], [0.075, 0.24, 0.08]);
      mesh(elbow, r.cylinder, r.leather, [0, -0.245, 0], [0.078, 0.045, 0.082]);
      mesh(elbow, r.sphere, skin, [0, -0.31, -0.01], [0.074, 0.095, 0.065]);
      arms.push({ pivot: arm, elbow });
      const leg = new THREE.Group();
      leg.position.set(side * 0.145, 0.96, 0);
      group.add(leg);
      mesh(leg, r.cylinder, r.trousers, [0, -0.2, 0], [0.105, 0.4, 0.115]);
      const knee = new THREE.Group();
      knee.position.y = -0.4;
      leg.add(knee);
      mesh(knee, r.sphere, r.trousers, [0, 0, 0], [0.1, 0.105, 0.105]);
      mesh(knee, r.cylinder, r.trousers, [0, -0.17, 0], [0.085, 0.34, 0.09]);
      mesh(knee, r.sphere, r.boots, [0, -0.43, -0.055], [0.115, 0.13, 0.19]);
      mesh(knee, r.box, r.dark, [0, -0.52, -0.055], [0.22, 0.045, 0.33]);
      legs.push({ pivot: leg, knee });
    }
    // Bake static parts sharing a material into one mesh per joint. Reuse the
    // baked geometry for every player; only clothing/skin materials vary.
    const joints = [];
    group.traverse((node) => {
      if (node.isGroup) joints.push(node);
    });
    joints.forEach((joint, jointIndex) => {
      const batches = new Map();
      for (const child of joint.children)
        if (child.isMesh) {
          if (!batches.has(child.material)) batches.set(child.material, []);
          batches.get(child.material).push(child);
        }
      let batchIndex = 0;
      for (const [material, parts] of batches) {
        const key = `${jointIndex}:${batchIndex++}`;
        if (parts.length < 2) continue;
        let geometry = geometryCache.get(key);
        if (!geometry) {
          const arrays = { position: [], normal: [], uv: [] };
          for (const part of parts) {
            part.updateMatrix();
            const baked = part.geometry.index
              ? part.geometry.toNonIndexed()
              : part.geometry.clone();
            baked.applyMatrix4(part.matrix);
            for (const attribute of Object.keys(arrays))
              arrays[attribute].push(...baked.attributes[attribute].array);
            baked.dispose();
          }
          geometry = new THREE.BufferGeometry();
          for (const [attribute, values] of Object.entries(arrays))
            geometry.setAttribute(
              attribute,
              new THREE.Float32BufferAttribute(
                values,
                attribute === 'uv' ? 2 : 3,
              ),
            );
          geometryCache.set(key, geometry);
        }
        for (const part of parts) joint.remove(part);
        const combined = new THREE.Mesh(geometry, material);
        combined.castShadow = combined.receiveShadow = true;
        joint.add(combined);
      }
    });
    let phase = (seed % 100) * 0.1,
      stride = 0;
    return {
      group,
      animate(dt, speed) {
        const amount = Math.min(speed / 7, 1);
        stride += (amount - stride) * (1 - Math.exp(-dt * 10));
        phase += Math.min(speed, 22) * dt * 1.8;
        for (let i = 0; i < 2; i++) {
          const swing = Math.sin(phase + i * Math.PI);
          legs[i].pivot.rotation.x = swing * 0.48 * stride;
          legs[i].knee.rotation.x = Math.max(0, -swing) * 0.65 * stride;
          arms[i].pivot.rotation.x = -swing * 0.36 * stride;
          arms[i].elbow.rotation.x = -0.13 - Math.max(0, swing) * 0.18 * stride;
        }
        torso.position.y = Math.abs(Math.sin(phase)) * 0.035 * stride;
        torso.rotation.z = Math.sin(phase) * 0.025 * stride;
        head.rotation.y = Math.sin(phase * 0.35) * 0.025 * stride;
      },
      dispose() {
        jacket.dispose();
        skin.dispose();
      },
    };
  };
}
