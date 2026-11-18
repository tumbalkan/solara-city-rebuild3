// Solara City: a sun-soaked coastal city built from procedural parts.
// Districts — a glass downtown, brick apartments, shophouses with awnings,
// a residential quarter of pitched-roof houses, a park, a beachfront
// boardwalk and a marina pier — sit on a 7x7 street grid with traffic
// lights, crosswalks, trees, props and parked cars.
import * as THREE from 'three';
import { buildCarMesh, CAR_DEFS, pickColor } from './vehicles.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Merge many small colored primitives into one mesh (few draw calls).
function makeMerger() {
  const positions = [];
  const normals = [];
  const colors = [];
  const tmpColor = new THREE.Color();
  function push(geo, matrix, color) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    g.applyMatrix4(matrix);
    const pos = g.attributes.position.array;
    const nor = g.attributes.normal.array;
    tmpColor.set(color);
    for (let i = 0; i < pos.length; i += 1) {
      positions.push(pos[i]);
      normals.push(nor[i]);
      colors.push(i % 3 === 0 ? tmpColor.r : i % 3 === 1 ? tmpColor.g : tmpColor.b);
    }
    g.dispose();
    geo.dispose();
  }
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3(1, 1, 1);
  function xform(x, y, z, rx, ry, rz) {
    e.set(rx || 0, ry || 0, rz || 0);
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(x, y, z), q, s);
    return m;
  }
  return {
    box(w, h, d, x, y, z, color, ry, rx, rz) {
      push(new THREE.BoxGeometry(w, h, d), xform(x, y, z, rx, ry, rz), color);
    },
    cyl(rt, rb, h, seg, x, y, z, color, rx, rz) {
      push(new THREE.CylinderGeometry(rt, rb, h, seg || 8), xform(x, y, z, rx, 0, rz), color);
    },
    sph(r, x, y, z, color, sx, sy, sz) {
      const geo = new THREE.SphereGeometry(r, 10, 8);
      const mm = new THREE.Matrix4().compose(
        new THREE.Vector3(x, y, z),
        new THREE.Quaternion(),
        new THREE.Vector3(sx || 1, sy || 1, sz || 1),
      );
      push(geo, mm, color);
    },
    cone(r, h, seg, x, y, z, color, ry) {
      push(new THREE.ConeGeometry(r, h, seg || 4), xform(x, y, z, 0, ry, 0), color);
    },
    build(material) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      const mesh = new THREE.Mesh(geo, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      // Flush: later adds go into a fresh mesh, never duplicating this one.
      positions.length = 0;
      normals.length = 0;
      colors.length = 0;
      return mesh;
    },
  };
}

export const ROAD_LINES = [-108, -72, -36, 0, 36, 72, 108];
export const BLOCK_CENTERS = [-90, -54, -18, 18, 54, 90];
const ROAD_W = 12;
const BLOCK = 24;

function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#1f5fa8');
  grad.addColorStop(0.45, '#6fb1e0');
  grad.addColorStop(0.72, '#bcd9ee');
  grad.addColorStop(0.88, '#ffe3b0');
  grad.addColorStop(1, '#ffc98a');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene, seed) {
  const rng = mulberry32(seed || 1);
  const colliders = [];
  const matte = makeMerger();
  const glass = makeMerger();
  const litWindows = [];
  const darkWindows = [];
  const trafficLights = [];
  const boats = [];
  const clouds = [];
  const birds = [];
  let waterMat = null;
  let foam = null;

  const addCollider = (x0, z0, x1, z1) => colliders.push({ x0, z0, x1, z1 });

  // ---- Sky, sun, fog ----
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(420, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false }),
  );
  scene.add(dome);
  scene.fog = new THREE.Fog(0xcfe4f2, 180, 420);
  const sun = new THREE.DirectionalLight(0xfff0c8, 2.6);
  sun.position.set(140, 190, 90);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -160;
  sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160;
  sun.shadow.camera.bottom = -160;
  sun.shadow.camera.far = 600;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);
  scene.add(new THREE.HemisphereLight(0xbdd8ff, 0x9a8a6a, 0.85));

  // ---- Ground: base, roads, sidewalks, markings ----
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(360, 400),
    new THREE.MeshStandardMaterial({ color: 0x9aa08a, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 20);
  ground.receiveShadow = true;
  scene.add(ground);

  const roadMat = new THREE.MeshStandardMaterial({ color: 0x3a3f44, roughness: 0.95 });
  for (const r of ROAD_LINES) {
    const vRoad = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, 252), roadMat);
    vRoad.rotation.x = -Math.PI / 2;
    vRoad.position.set(r, 0, 0);
    vRoad.receiveShadow = true;
    scene.add(vRoad);
    const hRoad = new THREE.Mesh(new THREE.PlaneGeometry(252, ROAD_W), roadMat);
    hRoad.rotation.x = -Math.PI / 2;
    hRoad.position.set(0, 0, r);
    hRoad.receiveShadow = true;
    scene.add(hRoad);
  }
  // Sidewalk frames around every block.
  const walkMat = new THREE.MeshStandardMaterial({ color: 0xb9b3a4, roughness: 1 });
  for (const bx of BLOCK_CENTERS) {
    for (const bz of BLOCK_CENTERS) {
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK + 4, BLOCK + 4), walkMat);
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(bx, 0.02, bz);
      walk.receiveShadow = true;
      scene.add(walk);
    }
  }
  // Center dashes + crosswalks (merged white paint).
  for (const r of ROAD_LINES) {
    for (let d = -120; d <= 120; d += 8) {
      if (ROAD_LINES.some((o) => Math.abs(d - o) < 9)) continue;
      matte.box(0.3, 0.02, 3, r, 0.04, d, 0xf5f0dc);
      matte.box(3, 0.02, 0.3, d, 0.04, r, 0xf5f0dc);
    }
  }
  for (const rx of ROAD_LINES) {
    for (const rz of ROAD_LINES) {
      for (let i = -2; i <= 2; i += 1) {
        matte.box(0.9, 0.02, 3.4, rx + i * 1.9, 0.04, rz - 7.6, 0xfafafa);
        matte.box(3.4, 0.02, 0.9, rx + 7.6, 0.04, rz + i * 1.9, 0xfafafa);
      }
    }
  }

  // ---- Buildings ----
  const towerGlass = [0x7fb2d9, 0x5dade2, 0x85c1e9, 0xaed6f1];
  const brickCols = [0x9b5a48, 0x8a4b3a, 0xa9715a, 0x7e5109];
  const condoCols = [0xe8e4da, 0xd5d8dc, 0xf2e8d5, 0xcfd8dc];
  const awningCols = [0xd64545, 0x2e86c1, 0x28b463, 0xf39c12, 0x8e44ad];
  let tallest = null;

  function windowsFor(x, z, w, d, h, floors) {
    const cols = Math.max(2, Math.floor(w / 2.6));
    const floorH = h / floors;
    for (let f = 0; f < floors; f += 1) {
      const y = 2.2 + f * floorH + floorH * 0.25;
      if (y > h - 1) break;
      for (let c = 0; c < cols; c += 1) {
        const off = -w / 2 + ((c + 0.5) * w) / cols;
        for (const [dx, dz, ry] of [[0, -d / 2 - 0.06, Math.PI], [0, d / 2 + 0.06, 0]]) {
          const lit = rng() < 0.32;
          (lit ? litWindows : darkWindows).push([x + off * (dz === 0 ? 0 : 1) + dx, y, z + dz, ry]);
        }
      }
      const sideCols = Math.max(2, Math.floor(d / 2.6));
      for (let c = 0; c < sideCols; c += 1) {
        const off = -d / 2 + ((c + 0.5) * d) / sideCols;
        for (const [dx, ry] of [[-w / 2 - 0.06, -Math.PI / 2], [w / 2 + 0.06, Math.PI / 2]]) {
          const lit = rng() < 0.32;
          (lit ? litWindows : darkWindows).push([x + dx, y, z + off, ry]);
        }
      }
    }
  }

  function rooftop(x, z, w, d, h) {
    const n = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i += 1) {
      matte.box(1.4 + rng(), 0.9, 1.4 + rng(), x + (rng() - 0.5) * w * 0.6, h + 0.45, z + (rng() - 0.5) * d * 0.6, 0x8a8f96);
    }
    if (rng() < 0.5) {
      // Water tower: legs + tank + cone roof.
      const tx = x + (rng() - 0.5) * w * 0.5;
      const tz = z + (rng() - 0.5) * d * 0.5;
      for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        matte.box(0.18, 2.2, 0.18, tx + lx, h + 1.1, tz + lz, 0x5d4037);
      }
      matte.cyl(1.5, 1.5, 2.2, 10, tx, h + 3.3, tz, 0x8d6e63);
      matte.cone(1.7, 1.0, 10, tx, h + 4.9, tz, 0x6d4c41);
    }
    if (rng() < 0.4) {
      matte.cyl(0.06, 0.06, 4 + rng() * 3, 5, x + (rng() - 0.5) * w * 0.5, h + 2.5, z + (rng() - 0.5) * d * 0.5, 0x666666);
    }
  }

  function buildTower(bx, bz) {
    const w = 16 + rng() * 4;
    const d = 16 + rng() * 4;
    const floors = 10 + Math.floor(rng() * 9);
    const h = floors * 3.1;
    const col = towerGlass[Math.floor(rng() * towerGlass.length)];
    glass.box(w, h, d, bx, h / 2, bz, col);
    glass.box(w * 0.7, 2.2, d * 0.7, bx, h + 1.1, bz, 0x4a5a6a);
    // Ground-floor lobby: darker glass band + entry canopy.
    glass.box(w + 0.4, 3.4, d + 0.4, bx, 1.7, bz, 0x2c4a63);
    matte.box(w * 0.4, 0.25, 3, bx, 3.6, bz - d / 2 - 1.2, 0x37474f);
    windowsFor(bx, bz, w, d, h, floors);
    rooftop(bx, bz, w, d, h);
    addCollider(bx - w / 2, bz - d / 2, bx + w / 2, bz + d / 2);
    if (!tallest || h > tallest.h) tallest = { x: bx, z: bz, h, w, d };
  }

  function buildApartment(bx, bz) {
    const col = brickCols[Math.floor(rng() * brickCols.length)];
    const floors = 4 + Math.floor(rng() * 3);
    const h = floors * 3;
    const w = 11;
    const d = 17;
    const dx = rng() < 0.5 ? -5.5 : 5.5;
    for (const side of [-1, 1]) {
      const x = bx + side * 5.5;
      matte.box(w, h, d, x, h / 2, bz, col);
      matte.box(w + 0.6, 0.4, d + 0.6, x, h + 0.2, bz, 0x6d4c41);
      // Balconies: staggered slabs with rails on the street face.
      for (let f = 1; f < floors; f += 1) {
        const by = 1.5 + f * 3;
        for (let c = -1; c <= 1; c += 1) {
          if ((f + c) % 2 === 0) continue;
          matte.box(2.2, 0.15, 1.1, x + c * 3.2, by, bz - d / 2 - 0.5, 0xd7dbdd);
          matte.box(2.2, 0.7, 0.08, x + c * 3.2, by + 0.45, bz - d / 2 - 1.0, 0x5d6d7e);
        }
      }
      windowsFor(x, bz, w, d, h, floors);
      rooftop(x, bz, w, d, h);
      addCollider(x - w / 2, bz - d / 2, x + w / 2, bz + d / 2);
    }
    void dx;
  }

  function buildShophouse(bx, bz) {
    const floors = 2 + Math.floor(rng() * 2);
    const h = 3.4 + (floors - 1) * 3;
    for (let i = -1; i <= 1; i += 1) {
      const x = bx + i * 7.4;
      const col = condoCols[Math.floor(rng() * condoCols.length)];
      matte.box(7, h, 15, x, h / 2, bz, col);
      // Storefront: big glass panel + awning + sign strip.
      glass.box(6.4, 2.6, 0.2, x, 1.5, bz - 7.6, 0x9fc8e8);
      const awn = awningCols[Math.floor(rng() * awningCols.length)];
      matte.box(6.8, 0.12, 2.0, x, 3.1, bz - 8.4, awn, 0, 0.28);
      matte.box(6.8, 0.9, 0.3, x, 4.0, bz - 7.65, awn);
      // Sign "text": small bright blocks on the strip.
      for (let s = 0; s < 5; s += 1) {
        matte.box(0.5 + rng() * 0.5, 0.4, 0.1, x - 2.6 + s * 1.25, 4.0, bz - 7.85, 0xffffff);
      }
      // Upper windows.
      for (let f = 1; f < floors; f += 1) {
        for (const wx of [-2.2, 0, 2.2]) {
          const lit = rng() < 0.3;
          (lit ? litWindows : darkWindows).push([x + wx, 3.4 + f * 3, bz - 7.56, Math.PI]);
        }
      }
      rooftop(x, bz, 7, 15, h);
      addCollider(x - 3.5, bz - 7.5, x + 3.5, bz + 7.5);
    }
  }

  function buildHouse(bx, bz) {
    const cols = [0xf5e6c8, 0xdde8f0, 0xf0d5c0, 0xe8f0dd];
    for (const [ox, oz] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) {
      if (rng() < 0.15) continue; // occasional empty yard
      const x = bx + ox;
      const z = bz + oz;
      const col = cols[Math.floor(rng() * cols.length)];
      const w = 8;
      const d = 8;
      const h = 4.4;
      matte.box(w, h, d, x, h / 2, z, col);
      // Pyramid roof.
      matte.cone(6.4, 2.6, 4, x, h + 1.3, z, 0x8a4b3a, Math.PI / 4);
      // Door + windows + porch.
      matte.box(1.2, 2.2, 0.15, x, 1.1, z - d / 2 - 0.05, 0x6d4c41);
      matte.box(3, 0.15, 1.6, x, 0.1, z - d / 2 - 0.8, 0xc9b896);
      for (const wx of [-2.4, 2.4]) {
        const lit = rng() < 0.35;
        (lit ? litWindows : darkWindows).push([x + wx, 2.4, z - d / 2 - 0.06, Math.PI]);
      }
      // Yard hedge + a leafy tree.
      matte.box(7, 0.7, 0.5, x, 0.35, z + d / 2 + 1.2, 0x2e7d32);
      addCollider(x - w / 2, z - d / 2, x + w / 2, z + d / 2);
    }
  }

  // Park block: grass, pond, trees, benches.
  function buildPark(bx, bz) {
    const lawn = new THREE.Mesh(
      new THREE.CircleGeometry(13, 24),
      new THREE.MeshStandardMaterial({ color: 0x5da85a, roughness: 1 }),
    );
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(bx, 0.06, bz);
    lawn.receiveShadow = true;
    scene.add(lawn);
    const pond = new THREE.Mesh(
      new THREE.CircleGeometry(4.5, 20),
      new THREE.MeshStandardMaterial({ color: 0x4a90c2, roughness: 0.15, metalness: 0.4 }),
    );
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(bx - 4, 0.08, bz + 3);
    scene.add(pond);
    for (let i = 0; i < 7; i += 1) {
      const a = rng() * Math.PI * 2;
      const r = 5 + rng() * 7;
      leafyTree(bx + Math.cos(a) * r, bz + Math.sin(a) * r);
    }
    for (let i = 0; i < 3; i += 1) {
      const a = rng() * Math.PI * 2;
      const x = bx + Math.cos(a) * 9;
      const z = bz + Math.sin(a) * 9;
      matte.box(1.8, 0.1, 0.5, x, 0.5, z, 0x8d6e63, a);
      matte.box(0.12, 0.5, 0.45, x - 0.7, 0.25, z, 0x4e342e);
      matte.box(0.12, 0.5, 0.45, x + 0.7, 0.25, z, 0x4e342e);
    }
  }

  function leafyTree(x, z) {
    const trunkH = 2.2 + rng() * 1.2;
    matte.cyl(0.16, 0.24, trunkH, 6, x, trunkH / 2, z, 0x6d4c41);
    const greens = [0x2e7d32, 0x388e3c, 0x43a047, 0x689f38];
    const gcol = greens[Math.floor(rng() * greens.length)];
    matte.sph(1.6 + rng() * 0.9, x, trunkH + 1.2, z, gcol, 1, 0.85, 1);
    matte.sph(1.1 + rng() * 0.6, x + 0.9, trunkH + 0.6, z + 0.5, gcol, 1, 0.8, 1);
    addCollider(x - 0.4, z - 0.4, x + 0.4, z + 0.4);
  }

  function palmTree(x, z) {
    const trunkH = 4 + rng() * 2.5;
    matte.cyl(0.14, 0.2, trunkH, 6, x, trunkH / 2, z, 0x8d6e63, 0, (rng() - 0.5) * 0.2);
    const top = trunkH;
    for (let i = 0; i < 7; i += 1) {
      const a = (i / 7) * Math.PI * 2;
      matte.box(0.5, 0.05, 2.6, x + Math.cos(a) * 1.1, top + 0.3, z + Math.sin(a) * 1.1, 0x2e7d32, -a, 0.5);
    }
    matte.sph(0.35, x, top + 0.3, z, 0x6d4c41);
    addCollider(x - 0.4, z - 0.4, x + 0.4, z + 0.4);
  }

  // ---- Assign archetypes per block ----
  for (const bx of BLOCK_CENTERS) {
    for (const bz of BLOCK_CENTERS) {
      if (bx === 90 && bz === -90) { buildPark(bx, bz); continue; }
      const downtown = bx >= -54 && bx <= 18 && bz >= -90 && bz <= -18;
      const residential = bz >= 18;
      if (downtown) buildTower(bx, bz);
      else if (residential) buildHouse(bx, bz);
      else if (rng() < 0.5) buildApartment(bx, bz);
      else buildShophouse(bx, bz);
    }
  }
  // Helipad on the tallest tower.
  if (tallest) {
    matte.cyl(4.2, 4.2, 0.25, 20, tallest.x, tallest.h + 2.35, tallest.z, 0x37474f);
    matte.box(0.5, 0.06, 3.2, tallest.x - 1.1, tallest.h + 2.5, tallest.z, 0xffffff);
    matte.box(0.5, 0.06, 3.2, tallest.x + 1.1, tallest.h + 2.5, tallest.z, 0xffffff);
    matte.box(2.7, 0.06, 0.5, tallest.x, tallest.h + 2.5, tallest.z, 0xffffff);
  }

  // Flush merged building/detail meshes.
  const matteMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05 });
  const glassMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.18, metalness: 0.65 });
  scene.add(matte.build(matteMat));
  scene.add(glass.build(glassMat));

  // ---- Windows (instanced) ----
  function windowMesh(list, material) {
    if (list.length === 0) return null;
    const geo = new THREE.PlaneGeometry(1.35, 1.7);
    const mesh = new THREE.InstancedMesh(geo, material, list.length);
    const mtx = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const eul = new THREE.Euler();
    const scl = new THREE.Vector3(1, 1, 1);
    list.forEach(([x, y, z, ry], i) => {
      pos.set(x, y, z);
      eul.set(0, ry, 0);
      quat.setFromEuler(eul);
      mtx.compose(pos, quat, scl);
      mesh.setMatrixAt(i, mtx);
    });
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }
  const litMat = new THREE.MeshStandardMaterial({ color: 0xffd98a, emissive: 0xffb84d, emissiveIntensity: 1.4, roughness: 0.4 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x2a4258, roughness: 0.15, metalness: 0.7 });
  const lit = windowMesh(litWindows, litMat);
  const dark = windowMesh(darkWindows, darkMat);
  if (lit) scene.add(lit);
  if (dark) scene.add(dark);

  // ---- Street props (merged into a second matte pass) ----
  const props = makeMerger();
  const lampHeads = [];
  for (const r of ROAD_LINES) {
    for (let d = -108; d <= 108; d += 36) {
      // Street lamp: pole + curved arm + head.
      props.cyl(0.09, 0.12, 6.5, 6, r + 6.4, 3.25, d, 0x37474f);
      props.box(0.12, 0.12, 1.6, r + 6.4, 6.4, d - 0.7, 0x37474f);
      props.box(0.5, 0.18, 0.9, r + 6.4, 6.35, d - 1.4, 0xfff8d6);
      lampHeads.push([r + 6.4, 6.35, d - 1.4]);
      // Fire hydrant + trash can + bench, sprinkled along the walk.
      if (rng() < 0.6) {
        props.cyl(0.16, 0.2, 0.7, 8, r - 6.6, 0.35, d + 8, 0xc62828);
        props.sph(0.18, r - 6.6, 0.78, d + 8, 0xc62828);
      }
      if (rng() < 0.5) props.cyl(0.32, 0.28, 0.8, 8, r + 6.6, 0.4, d + 14, 0x2e7d32);
    }
  }
  // Street signs at a few corners.
  for (const [sx, sz, label] of [[-36, -36, 0], [36, 36, 1], [0, -72, 2], [-72, 72, 3]]) {
    props.cyl(0.06, 0.06, 3.2, 6, sx + 6.8, 1.6, sz + 6.8, 0x78909c);
    props.box(1.6, 0.5, 0.06, sx + 6.8, 3.0, sz + 6.8, 0x1b5e20);
    props.box(1.1, 0.12, 0.02, sx + 6.8, 3.05, sz + 6.75, 0xffffff);
    void label;
  }
  // Bus stop shelter on the main avenue.
  props.box(0.12, 2.4, 0.12, -7.2, 1.2, -20, 0x37474f);
  props.box(0.12, 2.4, 0.12, -7.2, 1.2, -16, 0x37474f);
  props.box(0.14, 2.4, 4.4, -7.2, 1.2, -18, 0x5dade2);
  props.box(1.6, 0.12, 4.6, -6.6, 2.5, -18, 0x2e86c1);
  props.box(1.4, 0.1, 3.6, -6.9, 0.55, -18, 0x8d6e63);
  scene.add(props.build(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.15 })));

  // ---- Traffic lights at four major intersections ----
  const lightDefs = [[0, 0], [-36, -36], [36, 36], [0, -72]];
  for (const [lx, lz] of lightDefs) {
    const pole = new THREE.Group();
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.6, metalness: 0.4 });
    const poleMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 5.4, 8), poleMat);
    poleMesh.position.y = 2.7;
    poleMesh.castShadow = true;
    pole.add(poleMesh);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 3.4), poleMat);
    arm.position.set(0, 5.2, -1.5);
    pole.add(arm);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.3, 0.4), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 }));
    head.position.set(0, 4.6, -3.0);
    head.castShadow = true;
    pole.add(head);
    const lensGeo = new THREE.SphereGeometry(0.17, 10, 8);
    const redM = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff0000, emissiveIntensity: 0.1 });
    const yelM = new THREE.MeshStandardMaterial({ color: 0x554400, emissive: 0xffcc00, emissiveIntensity: 0.1 });
    const grnM = new THREE.MeshStandardMaterial({ color: 0x003300, emissive: 0x00ff44, emissiveIntensity: 0.1 });
    const red = new THREE.Mesh(lensGeo, redM);
    red.position.set(0, 5.0, -3.22);
    const yel = new THREE.Mesh(lensGeo, yelM);
    yel.position.set(0, 4.6, -3.22);
    const grn = new THREE.Mesh(lensGeo, grnM);
    grn.position.set(0, 4.2, -3.22);
    pole.add(red, yel, grn);
    pole.position.set(lx + 6.8, 0, lz + 6.8);
    scene.add(pole);
    trafficLights.push({ x: lx, z: lz, phase: rng() * 20, redM, yelM, grnM, state: 'green' });
  }

  // ---- Trees along the avenues and beach ----
  for (let i = 0; i < 26; i += 1) {
    const r = ROAD_LINES[Math.floor(rng() * ROAD_LINES.length)];
    const d = -108 + Math.floor(rng() * 13) * 18;
    if (Math.abs(d) < 6) continue;
    if (rng() < 0.5) leafyTree(r + 7.2, d);
    else leafyTree(r - 7.2, d);
  }
  for (let x = -120; x <= 120; x += 14) {
    if (rng() < 0.75) palmTree(x + (rng() - 0.5) * 4, 122 + rng() * 3);
  }
  // Flush the trees into their own merged mesh (build() clears the merger).
  scene.add(matte.build(matteMat));

  // ---- Beach, boardwalk, pier, water, boats ----
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(340, 34),
    new THREE.MeshStandardMaterial({ color: 0xe8d29a, roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, 139);
  sand.receiveShadow = true;
  scene.add(sand);
  const boardwalk = new THREE.Mesh(
    new THREE.BoxGeometry(240, 0.2, 6),
    new THREE.MeshStandardMaterial({ color: 0xa9825a, roughness: 0.9 }),
  );
  boardwalk.position.set(0, 0.1, 124);
  boardwalk.receiveShadow = true;
  scene.add(boardwalk);
  for (let x = -114; x <= 114; x += 6) {
    matte.box(0.12, 0.04, 6, x, 0.22, 124, 0x8d6e63);
  }
  // Beach umbrellas + towels.
  const umbrellaCols = [0xe74c3c, 0x3498db, 0xf1c40f, 0x2ecc71, 0xe67e22];
  for (let i = 0; i < 9; i += 1) {
    const ux = -110 + rng() * 220;
    const uz = 132 + rng() * 14;
    const col = umbrellaCols[Math.floor(rng() * umbrellaCols.length)];
    matte.cyl(0.05, 0.05, 2.2, 5, ux, 1.1, uz, 0xeeeeee);
    matte.cone(1.7, 0.8, 8, ux, 2.5, uz, col);
    matte.box(1.0, 0.04, 2.0, ux + 1.6, 0.08, uz + 0.6, col);
  }
  // Lifeguard tower.
  const lg = new THREE.Group();
  const lgMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.8 });
  const lgRed = new THREE.MeshStandardMaterial({ color: 0xd32f2f, roughness: 0.8 });
  for (const [lx, lz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.6, 0.18), lgMat);
    leg.position.set(lx, 1.8, lz);
    lg.add(leg);
  }
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.2, 2.6), lgMat);
  cabin.position.y = 4.7;
  cabin.castShadow = true;
  lg.add(cabin);
  const lgRoof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.2, 4), lgRed);
  lgRoof.position.y = 6.4;
  lgRoof.rotation.y = Math.PI / 4;
  lg.add(lgRoof);
  const lgWin = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.9), new THREE.MeshStandardMaterial({ color: 0x1a2e3d, roughness: 0.15, metalness: 0.7 }));
  lgWin.position.set(0, 4.9, 1.32);
  lg.add(lgWin);
  lg.position.set(28, 0, 136);
  scene.add(lg);
  addCollider(26.4, 134.4, 29.6, 137.6);

  // Pier: low deck on posts (deck top near ground level so Rico and the gang
  // walk on it, not through it), railings, end platform + shack.
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x9a7b55, roughness: 0.95 });
  const pierDeck = new THREE.Mesh(new THREE.BoxGeometry(7, 0.3, 62), pierMat);
  pierDeck.position.set(0, 0.15, 157);
  pierDeck.castShadow = true;
  pierDeck.receiveShadow = true;
  scene.add(pierDeck);
  for (let z = 128; z <= 186; z += 8) {
    for (const px of [-3, 3]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 2.2, 8), new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 1 }));
      post.position.set(px, -0.6, z);
      scene.add(post);
    }
  }
  for (const px of [-3.4, 3.4]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 62), pierMat);
    rail.position.set(px, 0.75, 157);
    scene.add(rail);
  }
  const platform = new THREE.Mesh(new THREE.BoxGeometry(14, 0.3, 12), pierMat);
  platform.position.set(0, 0.15, 192);
  platform.castShadow = true;
  scene.add(platform);
  const shack = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 4), new THREE.MeshStandardMaterial({ color: 0x4a90c2, roughness: 0.8 }));
  shack.position.set(-3.4, 1.8, 192);
  shack.castShadow = true;
  scene.add(shack);
  const shackRoof = new THREE.Mesh(new THREE.ConeGeometry(4.2, 1.6, 4), new THREE.MeshStandardMaterial({ color: 0xd32f2f, roughness: 0.8 }));
  shackRoof.position.set(-3.4, 4.1, 192);
  shackRoof.rotation.y = Math.PI / 4;
  scene.add(shackRoof);
  addCollider(-6, 186, 6, 198);
  addCollider(-3.4 - 2.5, 190, -3.4 + 2.5, 194);

  // Water + foam strip.
  waterMat = new THREE.MeshStandardMaterial({ color: 0x2e7fb8, roughness: 0.25, metalness: 0.35, transparent: true, opacity: 0.92 });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(360, 120), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.05, 210);
  scene.add(water);
  foam = new THREE.Mesh(
    new THREE.PlaneGeometry(340, 2.2),
    new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, roughness: 1 }),
  );
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(0, 0.09, 150);
  scene.add(foam);

  // Boats bobbing in the bay.
  const boatCols = [0xffffff, 0xffd54f, 0x4fc3f7, 0xef5350];
  for (let i = 0; i < 5; i += 1) {
    const bg = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 6.5), new THREE.MeshStandardMaterial({ color: boatCols[i % boatCols.length], roughness: 0.5 }));
    hull.position.y = 0.4;
    hull.castShadow = true;
    const bow = new THREE.Mesh(new THREE.ConeGeometry(1.55, 1.6, 4), hull.material);
    bow.rotation.x = Math.PI / 2;
    bow.rotation.y = Math.PI / 4;
    bow.scale.set(1, 1, 0.7);
    bow.position.set(0, 0.4, -3.8);
    const cabinB = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.0, 2.2), new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.6 }));
    cabinB.position.set(0, 1.3, 0.6);
    bg.add(hull, bow, cabinB);
    const bx = -120 + i * 55 + rng() * 20;
    const bz = 168 + rng() * 40;
    bg.position.set(bx, 0, bz);
    bg.rotation.y = rng() * Math.PI * 2;
    scene.add(bg);
    boats.push({ group: bg, phase: rng() * Math.PI * 2, baseY: 0 });
  }
  scene.add(matte.build(matteMat));

  // ---- Parked cars along curbs ----
  const parkedSpots = [
    [-30, -102, 0], [42, -66, Math.PI], [-66, -30, 0], [66, 6, Math.PI],
    [-6, 42, 0], [30, 78, Math.PI], [-102, 30, 0], [102, -42, Math.PI],
  ];
  for (const [px, pz, ph] of parkedSpots) {
    const def = CAR_DEFS[Math.floor(rng() * CAR_DEFS.length)];
    const built = buildCarMesh(def, pickColor(def, rng));
    built.group.position.set(px, 0, pz);
    built.group.rotation.y = ph;
    scene.add(built.group);
    addCollider(px - 1.2, pz - 2.4, px + 1.2, pz + 2.4);
  }

  // ---- Clouds + birds ----
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.92 });
  for (let i = 0; i < 12; i += 1) {
    const cg = new THREE.Group();
    const puffs = 3 + Math.floor(rng() * 3);
    for (let j = 0; j < puffs; j += 1) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(4 + rng() * 5, 10, 8), cloudMat);
      puff.scale.y = 0.45;
      puff.position.set(j * 5 - puffs * 2.2, rng() * 1.5, rng() * 3);
      cg.add(puff);
    }
    cg.position.set(-180 + rng() * 360, 70 + rng() * 40, -160 + rng() * 320);
    scene.add(cg);
    clouds.push({ group: cg, speed: 0.6 + rng() * 0.8 });
  }
  const birdMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a, side: THREE.DoubleSide });
  for (let i = 0; i < 9; i += 1) {
    const bg = new THREE.Group();
    const wingGeo = new THREE.BufferGeometry();
    wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.9, 0.12, -0.35, 0.9, 0.12, 0.35], 3));
    wingGeo.computeVertexNormals();
    const wl = new THREE.Mesh(wingGeo, birdMat);
    const wr = new THREE.Mesh(wingGeo, birdMat);
    wr.rotation.y = Math.PI;
    bg.add(wl, wr);
    bg.userData.wings = [wl, wr];
    scene.add(bg);
    birds.push({ group: bg, cx: (rng() - 0.5) * 200, cz: (rng() - 0.5) * 200, r: 30 + rng() * 40, h: 40 + rng() * 30, a: rng() * Math.PI * 2, sp: 0.12 + rng() * 0.15 });
  }

  // ---- Road graph for traffic ----
  const nodes = [];
  const nodeIndex = new Map();
  for (const x of ROAD_LINES) {
    for (const z of ROAD_LINES) {
      nodeIndex.set(`${x},${z}`, nodes.length);
      nodes.push({ x, z });
    }
  }
  function nearestNode(x, z) {
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < nodes.length; i += 1) {
      const d = (nodes[i].x - x) ** 2 + (nodes[i].z - z) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  function neighbors(i) {
    const n = nodes[i];
    const out = [];
    for (const [dx, dz] of [[36, 0], [-36, 0], [0, 36], [0, -36]]) {
      const j = nodeIndex.get(`${n.x + dx},${n.z + dz}`);
      if (j !== undefined) out.push(j);
    }
    return out;
  }

  function lightStateAt(x, z) {
    for (const L of trafficLights) {
      if (Math.abs(L.x - x) < 10 && Math.abs(L.z - z) < 10) return L.state;
    }
    return 'green';
  }

  function hitsCollider(x, z, r) {
    for (const c of colliders) {
      if (x + r > c.x0 && x - r < c.x1 && z + r > c.z0 && z - r < c.z1) return true;
    }
    return false;
  }

  let elapsed = 0;
  function update(dt) {
    elapsed += dt;
    // Traffic lights: 20s cycle, offset per light.
    for (const L of trafficLights) {
      const t = (elapsed + L.phase) % 20;
      let state = 'green';
      if (t < 8) state = 'green';
      else if (t < 10) state = 'yellow';
      else state = 'red';
      L.state = state;
      L.redM.emissiveIntensity = state === 'red' ? 2.4 : 0.1;
      L.yelM.emissiveIntensity = state === 'yellow' ? 2.4 : 0.1;
      L.grnM.emissiveIntensity = state === 'green' ? 2.4 : 0.1;
    }
    for (const c of clouds) {
      c.group.position.x += c.speed * dt;
      if (c.group.position.x > 220) c.group.position.x = -220;
    }
    for (const b of birds) {
      b.a += b.sp * dt;
      const x = b.cx + Math.cos(b.a) * b.r;
      const z = b.cz + Math.sin(b.a) * b.r;
      b.group.position.set(x, b.h + Math.sin(elapsed * 0.7 + b.a) * 2, z);
      b.group.rotation.y = -b.a;
      const flap = Math.sin(elapsed * 10 + b.a * 5) * 0.5;
      b.group.userData.wings[0].rotation.z = flap;
      b.group.userData.wings[1].rotation.z = -flap;
    }
    if (waterMat) waterMat.opacity = 0.9 + Math.sin(elapsed * 0.5) * 0.04;
    if (foam) foam.position.z = 150 + Math.sin(elapsed * 0.6) * 1.2;
    for (const bt of boats) {
      bt.group.position.y = Math.sin(elapsed * 0.8 + bt.phase) * 0.18;
      bt.group.rotation.z = Math.sin(elapsed * 0.6 + bt.phase) * 0.03;
    }
  }

  return {
    colliders, trafficLights, nodes, nodeIndex, nearestNode, neighbors,
    lightStateAt, hitsCollider, update, tallest,
    ROAD_LINES, BLOCK_CENTERS,
    playerStart: { x: 8, z: 118 },
    pierEnd: { x: 0, z: 192 },
    missionCarSpot: { x: -36, z: -102 },
  };
}

