// Vehicles for Solara City: every car is assembled from parts — body, cabin,
// hood, spinning wheels with hubcaps, glass, lights, mirrors, bumpers — so
// each of the six body styles reads as a distinct car at a glance.
import * as THREE from 'three';

export const CAR_DEFS = [
  { name: 'Sprat', kind: 'hatch', len: 3.4, wid: 1.7, bodyH: 0.62, cabH: 0.52, top: 24, accel: 11, grip: 2.4, colors: [0xe8b93e, 0x7fb3d5, 0xd96c4f, 0x9b59b6] },
  { name: 'Meridian', kind: 'sedan', len: 4.4, wid: 1.85, bodyH: 0.6, cabH: 0.55, top: 30, accel: 13, grip: 2.6, colors: [0xc0c8d0, 0x2e4053, 0x7d3c98, 0x1a5276] },
  { name: 'Bravado', kind: 'suv', len: 4.6, wid: 1.95, bodyH: 0.85, cabH: 0.7, top: 27, accel: 12, grip: 2.2, colors: [0x5d6d7e, 0x935116, 0x1e8449, 0xbdc3c7] },
  { name: 'Rancher', kind: 'pickup', len: 5.0, wid: 1.95, bodyH: 0.75, cabH: 0.6, top: 26, accel: 12, grip: 2.3, colors: [0x922b21, 0x2c3e50, 0xd4ac0d, 0x5d6d7e] },
  { name: 'Falcon GT', kind: 'sport', len: 4.3, wid: 1.95, bodyH: 0.5, cabH: 0.42, top: 40, accel: 18, grip: 3.1, colors: [0xc0392b, 0xf1c40f, 0x2471a3, 0x111111] },
  { name: 'Caravan', kind: 'van', len: 4.9, wid: 2.0, bodyH: 1.05, cabH: 0.75, top: 22, accel: 9, grip: 2.0, colors: [0xeaf2f8, 0x7f8c8d, 0x2e86c1, 0xca6f1e] },
];
export const POLICE_DEF = { name: 'Interceptor', kind: 'police', len: 4.5, wid: 1.9, bodyH: 0.62, cabH: 0.55, top: 36, accel: 16, grip: 3.0, colors: [0x111111] };

// Materials are cached by color so identical paint jobs share one material.
const matCache = new Map();
function mat(color, opts) {
  const key = `${color}|${opts ? JSON.stringify(opts) : ''}`;
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.35, ...(opts || {}) }));
  }
  return matCache.get(key);
}
const glassMat = new THREE.MeshStandardMaterial({ color: 0x1a2e3d, roughness: 0.12, metalness: 0.85 });
const tireMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.95, metalness: 0 });
const hubMat = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.3, metalness: 0.8 });
const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.25, metalness: 0.9 });

function box(w, h, d, material, x, y, z, ry) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  if (ry) m.rotation.y = ry;
  m.castShadow = true;
  return m;
}

// Build one wheel: dark tire cylinder + silver hubcap disc, spun around X.
function buildWheel(radius, width) {
  const g = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 18), tireMat);
  tire.rotation.z = Math.PI / 2;
  tire.castShadow = true;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.55, radius * 0.55, width + 0.02, 12), hubMat);
  hub.rotation.z = Math.PI / 2;
  g.add(tire, hub);
  return g;
}

// Assemble a full car mesh from its definition. Returns the group plus the
// parts the physics loop animates (wheels, lights, light bar).
export function buildCarMesh(def, color) {
  const g = new THREE.Group();
  const paint = mat(color, { roughness: 0.35, metalness: 0.55 });
  const darkPaint = mat(0x141414, { roughness: 0.4, metalness: 0.5 });
  const L = def.len;
  const W = def.wid;
  const bodyY = 0.55 + def.bodyH / 2 - 0.28;
  const isPolice = def.kind === 'police';
  const isPickup = def.kind === 'pickup';
  const isVan = def.kind === 'van';
  const isSport = def.kind === 'sport';

  // Main body shell.
  const body = box(W, def.bodyH, L, isPolice ? darkPaint : paint, 0, bodyY, 0);
  g.add(body);
  // Hood slope: a thin rotated panel over the front third.
  const hood = box(W * 0.94, 0.07, L * 0.28, isPolice ? darkPaint : paint, 0, bodyY + def.bodyH / 2 + 0.01, -L * 0.36);
  hood.rotation.x = isSport ? -0.16 : -0.07;
  g.add(hood);
  // Cabin: shorter than the body, set back; a van's cabin is the whole top.
  const cabLen = isVan ? L * 0.82 : isPickup ? L * 0.34 : L * 0.48;
  const cabZ = isVan ? L * 0.02 : isPickup ? -L * 0.2 : L * 0.06;
  const cab = box(W * 0.88, def.cabH, cabLen, isPolice ? mat(0xf2f2f2, { roughness: 0.35, metalness: 0.4 }) : paint, 0, bodyY + def.bodyH / 2 + def.cabH / 2, cabZ);
  g.add(cab);
  // Windshield + rear glass: angled dark planes on the cabin ends.
  const shield = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.8, def.cabH * 0.9), glassMat);
  shield.position.set(0, bodyY + def.bodyH / 2 + def.cabH / 2, cabZ - cabLen / 2 - 0.01);
  shield.rotation.x = -0.28;
  shield.rotation.y = Math.PI;
  g.add(shield);
  const rearGlass = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.8, def.cabH * 0.85), glassMat);
  rearGlass.position.set(0, bodyY + def.bodyH / 2 + def.cabH / 2, cabZ + cabLen / 2 + 0.01);
  rearGlass.rotation.x = 0.22;
  g.add(rearGlass);
  // Side glass strips.
  for (const side of [-1, 1]) {
    const sideGlass = box(0.02, def.cabH * 0.62, cabLen * 0.86, glassMat, side * (W * 0.44 + 0.01), bodyY + def.bodyH / 2 + def.cabH / 2, cabZ);
    g.add(sideGlass);
  }
  // Pickup bed: open box with side walls at the rear.
  if (isPickup) {
    const bedZ = L * 0.3;
    const bedLen = L * 0.36;
    g.add(box(W * 0.9, 0.05, bedLen, darkPaint, 0, bodyY + def.bodyH / 2 - 0.12, bedZ));
    for (const side of [-1, 1]) g.add(box(0.06, 0.32, bedLen, paint, side * (W / 2 - 0.03), bodyY + def.bodyH / 2 + 0.05, bedZ));
    g.add(box(W * 0.9, 0.32, 0.06, paint, 0, bodyY + def.bodyH / 2 + 0.05, bedZ + bedLen / 2));
  }
  // Sport spoiler.
  if (isSport) {
    g.add(box(0.08, 0.16, 0.08, darkPaint, -W * 0.36, bodyY + def.bodyH / 2 + 0.08, L * 0.44));
    g.add(box(0.08, 0.16, 0.08, darkPaint, W * 0.36, bodyY + def.bodyH / 2 + 0.08, L * 0.44));
    g.add(box(W * 0.92, 0.05, 0.3, darkPaint, 0, bodyY + def.bodyH / 2 + 0.18, L * 0.44));
  }
  // Bumpers, grille, mirrors, plate.
  g.add(box(W * 0.96, 0.16, 0.1, darkPaint, 0, 0.34, -L / 2 - 0.02));
  g.add(box(W * 0.96, 0.16, 0.1, darkPaint, 0, 0.34, L / 2 + 0.02));
  g.add(box(W * 0.5, 0.14, 0.04, chromeMat, 0, bodyY + 0.05, -L / 2 - 0.03));
  for (const side of [-1, 1]) {
    g.add(box(0.06, 0.1, 0.16, darkPaint, side * (W / 2 + 0.04), bodyY + def.bodyH / 2 + 0.08, -L * 0.22));
  }
  g.add(box(0.34, 0.12, 0.02, mat(0xf5f5f5, { roughness: 0.6, metalness: 0.1 }), 0, 0.42, -L / 2 - 0.08));

  // Headlights (emissive warm) and taillights (emissive red).
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6c9, emissive: 0xffedb0, emissiveIntensity: 0.9, roughness: 0.3 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xaa1111, emissive: 0xcc0000, emissiveIntensity: 0.7, roughness: 0.3 });
  const headlights = [];
  const taillights = [];
  for (const side of [-1, 1]) {
    const h = box(0.34, 0.13, 0.05, headMat, side * (W * 0.32), bodyY + 0.1, -L / 2 - 0.03);
    const t = box(0.3, 0.11, 0.05, tailMat, side * (W * 0.32), bodyY + 0.1, L / 2 + 0.03);
    g.add(h, t);
    headlights.push(h);
    taillights.push(t);
  }

  // Police livery: white doors + roof light bar with alternating beacons.
  let lightBar = null;
  if (isPolice) {
    for (const side of [-1, 1]) {
      g.add(box(0.03, def.bodyH * 0.62, L * 0.34, mat(0xf2f2f2, { roughness: 0.4 }), side * (W / 2 + 0.005), bodyY, L * 0.02));
    }
    const bar = new THREE.Group();
    const redLens = new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 2.2 });
    const blueLens = new THREE.MeshStandardMaterial({ color: 0x2266ff, emissive: 0x0044ff, emissiveIntensity: 2.2 });
    const red = box(0.42, 0.14, 0.2, redLens, -0.24, 0, 0);
    const blue = box(0.42, 0.14, 0.2, blueLens, 0.24, 0, 0);
    bar.add(box(0.95, 0.06, 0.24, darkPaint, 0, -0.08, 0), red, blue);
    bar.position.set(0, bodyY + def.bodyH / 2 + def.cabH + 0.1, cabZ);
    g.add(bar);
    lightBar = { redLens, blueLens };
  }

  // Wheels: radius scales with body style; front pair steers.
  const wheelR = isSport ? 0.36 : isVan || def.kind === 'suv' ? 0.4 : 0.33;
  const wheelX = W / 2 - 0.02;
  const wheelZ = L * 0.32;
  const wheels = [];
  const frontWheels = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * wheelX, wheelR, sz * wheelZ);
    const wheel = buildWheel(wheelR, 0.26);
    pivot.add(wheel);
    g.add(pivot);
    wheels.push({ pivot, spin: wheel });
    if (sz < 0) frontWheels.push(pivot);
  }

  return { group: g, wheels, frontWheels, headMat, tailMat, lightBar, wheelR };
}

// A drivable vehicle: arcade physics, AABB collision, wheel animation.
export function makeVehicle(scene, def, color, x, z, heading) {
  const built = buildCarMesh(def, color);
  scene.add(built.group);
  const v = {
    def,
    mesh: built,
    group: built.group,
    pos: new THREE.Vector3(x, 0, z),
    heading: heading || 0,
    speed: 0,
    steer: 0,
    radius: Math.max(def.len, def.wid) * 0.55,
    brake: false,
    dead: false,
    update(dt, throttle, steerInput, world) {
      const top = def.top;
      const accel = throttle >= 0 ? def.accel * throttle : def.accel * 1.6 * throttle;
      v.speed += accel * dt;
      if (throttle === 0) v.speed *= Math.pow(0.4, dt);
      if (v.speed > top) v.speed = top;
      if (v.speed < -top * 0.35) v.speed = -top * 0.35;
      const steerTarget = (steerInput || 0) * 0.55;
      v.steer += (steerTarget - v.steer) * Math.min(1, dt * 8);
      const spd = v.speed;
      if (Math.abs(spd) > 0.05) {
        // Nose points along local -Z, so forward is (-sin h, -cos h); a
        // positive steer (D key) turns right, which decreases the heading.
        v.heading -= (v.steer * spd * dt * def.grip) / Math.max(6, Math.abs(spd) * 0.9);
      }
      const nx = v.pos.x - Math.sin(v.heading) * spd * dt;
      const nz = v.pos.z - Math.cos(v.heading) * spd * dt;
      const r = def.wid * 0.5 + 0.15;
      let blocked = false;
      if (world && world.colliders) {
        for (const c of world.colliders) {
          if (nx + r > c.x0 && nx - r < c.x1 && nz + r > c.z0 && nz - r < c.z1) { blocked = true; break; }
        }
      }
      if (blocked) {
        if (Math.abs(v.speed) > 8 && world && world.onCrash) world.onCrash(v.pos);
        v.speed *= -0.25;
      } else {
        v.pos.x = nx;
        v.pos.z = nz;
      }
      v.group.position.copy(v.pos);
      v.group.rotation.y = v.heading;
      const spin = (v.speed * dt) / built.wheelR;
      for (const w of built.wheels) w.spin.rotation.x -= spin;
      for (const f of built.frontWheels) f.rotation.y = v.steer;
      built.tailMat.emissiveIntensity = v.brake ? 2.4 : 0.7;
      return v;
    },
    setFlash(on, t) {
      if (!built.lightBar) return;
      const phase = Math.floor((t || 0) * 6) % 2 === 0;
      built.lightBar.redLens.emissiveIntensity = on && phase ? 3.2 : 0.15;
      built.lightBar.blueLens.emissiveIntensity = on && !phase ? 3.2 : 0.15;
    },
    dispose() {
      scene.remove(built.group);
      v.dead = true;
    },
  };
  v.group.position.copy(v.pos);
  v.group.rotation.y = v.heading;
  return v;
}

export function pickColor(def, rng) {
  return def.colors[Math.floor(rng() * def.colors.length)];
}
