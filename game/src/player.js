// People of Solara City: Rico Vega and every pedestrian are built from the
// same articulated rig — a skinned-looking low-poly figure with a head, hair,
// sunglasses, jacket, belt, swinging arms and a procedural walk cycle — so
// the streets read as populated by people, not boxes.
import * as THREE from 'three';

const skinTones = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac, 0xa0663a];
const hairColors = [0x1a1a1a, 0x3b2a1a, 0x6b4423, 0x8a8a8a, 0xd4a017, 0x4a2c0a];
const shirtColors = [0xd64545, 0x3a7bd5, 0x2ecc71, 0xf39c12, 0x9b59b6, 0xeaf2f8, 0x1abc9c, 0xe74c3c];
const pantsColors = [0x2c3e50, 0x5d6d7e, 0x6e2c00, 0x1a1a1a, 0x7f8c8d, 0x34495e];

function std(color, rough) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough ?? 0.75, metalness: 0.05 });
}
function part(w, h, d, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
// Sphere part (heads, hands): 14x12 segments stay smooth without costing much.
function ball(r, material, x, y, z, sx, sy, sz) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 12), material);
  m.position.set(x, y, z);
  if (sx) m.scale.set(sx, sy, sz);
  m.castShadow = true;
  return m;
}

// Build one articulated person. Options pick the look; joints are pivots so
// the walk cycle can swing limbs around hip/shoulder points.
export function buildPerson(opts) {
  const o = opts || {};
  const skin = std(o.skin ?? skinTones[Math.floor(Math.random() * skinTones.length)]);
  const hairM = std(o.hair ?? hairColors[Math.floor(Math.random() * hairColors.length)], 0.9);
  const shirt = std(o.shirt ?? shirtColors[Math.floor(Math.random() * shirtColors.length)], 0.8);
  const jacket = std(o.jacket ?? 0x2e4053, 0.7);
  const pants = std(o.pants ?? pantsColors[Math.floor(Math.random() * pantsColors.length)], 0.85);
  const shoeM = std(0x1c1c1c, 0.5);
  const scale = o.scale ?? 1;
  const g = new THREE.Group();
  const S = 1; // height unit scale; figure is ~1.8 units tall

  // Hips + belt.
  const hips = part(0.42, 0.16, 0.24, pants, 0, 0.98 * S, 0);
  g.add(hips);
  g.add(part(0.44, 0.06, 0.26, std(0x141414, 0.4), 0, 1.07 * S, 0));

  // Torso: jacket shell (slightly tapered via a 4-sided cylinder) over a shirt.
  const torso = new THREE.Group();
  torso.position.y = 1.1 * S;
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.26, 0.52, 4), jacket);
  shell.rotation.y = Math.PI / 4;
  shell.scale.z = 0.62;
  shell.position.y = 0.26;
  shell.castShadow = true;
  torso.add(shell);
  torso.add(part(0.2, 0.34, 0.05, shirt, 0, 0.3, 0.14)); // shirt V at the chest
  torso.add(part(0.24, 0.05, 0.05, shirt, 0, 0.52, 0.13)); // collar
  g.add(torso);

  // Head group: skull, hair cap, sunglasses, nose.
  const head = new THREE.Group();
  head.position.y = 1.68 * S;
  head.add(ball(0.16, skin, 0, 0.06, 0, 0.92, 1.05, 0.95));
  const hairStyle = o.hairStyle ?? Math.floor(Math.random() * 3);
  if (hairStyle === 0) {
    head.add(ball(0.165, hairM, 0, 0.12, -0.01, 0.95, 0.7, 0.98)); // cropped cap
  } else if (hairStyle === 1) {
    head.add(part(0.3, 0.09, 0.3, hairM, 0, 0.19, 0)); // flat top
    head.add(part(0.32, 0.06, 0.1, hairM, 0, 0.14, -0.13)); // back
  } else {
    head.add(ball(0.17, hairM, 0, 0.1, -0.03, 1, 0.85, 1)); // longer hair
    head.add(part(0.1, 0.22, 0.08, hairM, 0, -0.02, -0.15)); // ponytail
  }
  if (o.hat) {
    const hatM = std(o.hat, 0.85);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.1, 12), hatM);
    crown.position.y = 0.22;
    crown.castShadow = true;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.02, 12), hatM);
    brim.position.y = 0.18;
    head.add(crown, brim);
  }
  if (o.shades) {
    const lens = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.15, metalness: 0.6 });
    head.add(part(0.09, 0.06, 0.03, lens, -0.07, 0.07, 0.14));
    head.add(part(0.09, 0.06, 0.03, lens, 0.07, 0.07, 0.14));
    head.add(part(0.06, 0.02, 0.02, lens, 0, 0.07, 0.14));
  }
  head.add(part(0.04, 0.05, 0.04, skin, 0, 0.02, 0.16)); // nose
  g.add(head);

  // Arms: shoulder pivot -> upper arm -> elbow pivot -> forearm -> hand.
  function arm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.28, 1.56 * S, 0);
    const upper = part(0.13, 0.34, 0.14, jacket, 0, -0.17, 0);
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.34;
    const fore = part(0.11, 0.3, 0.12, skin, 0, -0.15, 0);
    const hand = ball(0.07, skin, 0, -0.34, 0);
    elbow.add(fore, hand);
    shoulder.add(elbow);
    g.add(shoulder);
    return { shoulder, elbow, hand };
  }
  // Legs: hip pivot -> thigh -> knee pivot -> shin -> shoe.
  function leg(side) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.12, 0.94 * S, 0);
    const thigh = part(0.16, 0.44, 0.18, pants, 0, -0.22, 0);
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.44;
    const shin = part(0.14, 0.42, 0.15, pants, 0, -0.21, 0);
    const shoe = part(0.15, 0.09, 0.3, shoeM, 0, -0.44, 0.05);
    knee.add(shin, shoe);
    hip.add(knee);
    g.add(hip);
    return { hip, knee };
  }
  const armL = arm(-1);
  const armR = arm(1);
  const legL = leg(-1);
  const legR = leg(1);

  // Pistol, held in the right hand, hidden until armed.
  const gun = new THREE.Group();
  const gunMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.35, metalness: 0.7 });
  gun.add(part(0.05, 0.09, 0.06, gunMat, 0, 0, 0));
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 8), gunMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.03, -0.12);
  gun.add(barrel);
  gun.position.set(0, -0.36, -0.02);
  gun.visible = false;
  armR.elbow.add(gun);

  // Optional bag (pedestrians).
  let bag = null;
  if (o.bag) {
    bag = part(0.2, 0.26, 0.1, std(o.bag, 0.9), -0.3, 1.15, 0.05);
    g.add(bag);
  }

  g.scale.setScalar(scale);
  const rig = {
    group: g, head, torso, armL, armR, legL, legR, gun,
    // Procedural walk cycle: limbs swing in opposition, torso bobs slightly.
    setWalk(phase, amount, aiming) {
      const s = Math.sin(phase);
      const c = Math.sin(phase + Math.PI);
      const swing = 0.65 * amount;
      legL.hip.rotation.x = s * swing;
      legR.hip.rotation.x = c * swing;
      legL.knee.rotation.x = Math.max(0, -c) * 0.9 * amount;
      legR.knee.rotation.x = Math.max(0, -s) * 0.9 * amount;
      if (aiming) {
        armR.shoulder.rotation.x = -Math.PI / 2 + 0.12;
        armR.elbow.rotation.x = 0;
        armL.shoulder.rotation.x = -0.5;
        armL.elbow.rotation.x = -0.9;
      } else {
        armL.shoulder.rotation.x = c * swing * 0.8;
        armR.shoulder.rotation.x = s * swing * 0.8;
        armL.elbow.rotation.x = -0.25 * amount;
        armR.elbow.rotation.x = -0.25 * amount;
      }
      g.position.y = Math.abs(Math.sin(phase)) * 0.04 * amount;
      torso.rotation.z = Math.sin(phase) * 0.03 * amount;
    },
    setIdle(t) {
      const b = Math.sin(t * 1.6) * 0.02;
      torso.position.y = 1.1 * S + b;
      armL.shoulder.rotation.x = Math.sin(t * 1.6) * 0.03;
      armR.shoulder.rotation.x = -Math.sin(t * 1.6) * 0.03;
      legL.hip.rotation.x = 0;
      legR.hip.rotation.x = 0;
      legL.knee.rotation.x = 0;
      legR.knee.rotation.x = 0;
    },
    setFlee() {
      armL.shoulder.rotation.x = -2.6;
      armR.shoulder.rotation.x = -2.6;
      armL.shoulder.rotation.z = 0.5;
      armR.shoulder.rotation.z = -0.5;
    },
  };
  return rig;
}

// Rico Vega, the player: on-foot movement, car entry/exit, aiming.
export function makePlayer(scene, world, startX, startZ) {
  const rig = buildPerson({
    skin: 0xc68642, hair: 0x1a1a1a, hairStyle: 0, shades: true,
    shirt: 0xf5f5f5, jacket: 0x1e8449, pants: 0x2c3e50, scale: 1,
  });
  scene.add(rig.group);
  const p = {
    rig,
    group: rig.group,
    pos: new THREE.Vector3(startX, 0, startZ),
    heading: Math.PI,
    speed: 0,
    walkPhase: 0,
    health: 100,
    maxHealth: 100,
    ammo: 12,
    reserve: 48,
    armed: true,
    aiming: false,
    inCar: null,
    dead: false,
    update(dt, input, t) {
      if (p.inCar) {
        p.group.visible = false;
        p.pos.copy(p.inCar.pos);
        p.heading = p.inCar.heading;
        return;
      }
      p.group.visible = true;
      const sprint = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
      const maxSpeed = sprint ? 9.5 : 5.2;
      let mx = 0;
      let mz = 0;
      if (input.keys.has('KeyW')) mz -= 1;
      if (input.keys.has('KeyS')) mz += 1;
      if (input.keys.has('KeyA')) mx -= 1;
      if (input.keys.has('KeyD')) mx += 1;
      const moving = mx !== 0 || mz !== 0;
      // Movement is relative to the camera yaw so W always walks away.
      const cy = input.camYaw || 0;
      let wx = 0;
      let wz = 0;
      if (moving) {
        const len = Math.hypot(mx, mz);
        mx /= len;
        mz /= len;
        wx = mx * Math.cos(cy) - mz * Math.sin(cy);
        wz = mx * Math.sin(cy) + mz * Math.cos(cy);
        const targetHeading = Math.atan2(wx, wz);
        let dh = targetHeading - p.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        p.heading += dh * Math.min(1, dt * 12);
      }
      p.speed += ((moving ? maxSpeed : 0) - p.speed) * Math.min(1, dt * 10);
      const nx = p.pos.x + Math.sin(p.heading) * p.speed * dt;
      const nz = p.pos.z + Math.cos(p.heading) * p.speed * dt;
      if (!world.hitsCollider(nx, p.pos.z, 0.5)) p.pos.x = nx;
      if (!world.hitsCollider(p.pos.x, nz, 0.5)) p.pos.z = nz;
      p.walkPhase += dt * (4 + p.speed * 1.4);
      const amount = Math.min(1, p.speed / 5);
      p.aiming = input.aiming && p.armed;
      if (amount > 0.05) rig.setWalk(p.walkPhase, amount, p.aiming);
      else rig.setIdle(t);
      rig.gun.visible = p.armed;
      // Lean into the turn a touch.
      rig.group.rotation.z = THREE.MathUtils.clamp(-p.speed * 0.004 * (input.strafe || 0), -0.08, 0.08);
      p.group.position.copy(p.pos);
      p.group.rotation.y = p.heading;
    },
    enterCar(car) {
      p.inCar = car;
      p.group.visible = false;
    },
    exitCar() {
      if (!p.inCar) return;
      const car = p.inCar;
      p.inCar = null;
      const side = 1;
      p.pos.set(car.pos.x + Math.cos(car.heading) * 2.2 * side, 0, car.pos.z - Math.sin(car.heading) * 2.2 * side);
      p.group.visible = true;
      p.group.position.copy(p.pos);
    },
    takeDamage(n) {
      p.health = Math.max(0, p.health - n);
      if (p.health <= 0) p.dead = true;
    },
    healFull() {
      p.health = p.maxHealth;
      p.dead = false;
    },
    muzzlePos() {
      return new THREE.Vector3(p.pos.x + Math.sin(p.heading) * 0.5, 1.35, p.pos.z + Math.cos(p.heading) * 0.5);
    },
  };
  p.group.position.copy(p.pos);
  p.group.rotation.y = p.heading;
  return p;
}

export { skinTones, hairColors, shirtColors, pantsColors };
