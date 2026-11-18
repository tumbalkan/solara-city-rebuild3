// The Solara City Police Department: a 1–5 star wanted system. Interceptors
// spawn at the city edge, chase the player with flashing light bars, ram to
// stop them, and give up slowly once the player breaks line of sight.
import * as THREE from 'three';
import { makeVehicle, POLICE_DEF } from './vehicles.js';

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function makePolice(scene, world) {
  const cops = [];
  const rng = world.rng;
  let stars = 0;
  let hiddenT = 0;
  let spawnT = 0;

  function spawnCopNear(target) {
    const a = rng() * Math.PI * 2;
    // Cops spawn 45-70 m out: close enough to arrive fast, far enough not to pop in.
    const d = 45 + rng() * 25;
    const x = THREE.MathUtils.clamp(target.x + Math.cos(a) * d, -115, 115);
    const z = THREE.MathUtils.clamp(target.z + Math.sin(a) * d, -115, 115);
    const car = makeVehicle(scene, POLICE_DEF, 0x111111, x, z, rng() * Math.PI * 2);
    cops.push({ car, stuckT: 0 });
  }

  function update(dt, t, player) {
    const target = player.inCar ? player.inCar.pos : player.pos;
    // Spawn pressure scales with stars.
    const want = stars === 0 ? 0 : Math.min(1 + Math.floor(stars / 2), 4);
    spawnT -= dt;
    if (cops.length < want && spawnT <= 0) {
      spawnCopNear(target);
      spawnT = 1.5;
    }
    if (stars === 0) {
      // No heat: cops drive off and despawn.
      for (let i = cops.length - 1; i >= 0; i -= 1) {
        const c = cops[i];
        c.car.update(dt, 0.5, 0, world);
        if (c.car.pos.distanceTo(target) > 90) {
          c.car.dispose();
          cops.splice(i, 1);
        }
      }
      return;
    }
    // Heat decay: stay out of every cop's sight and the stars fall.
    let seen = false;
    for (const c of cops) {
      if (c.car.pos.distanceTo(target) < 55) seen = true;
    }
    if (!seen) {
      hiddenT += dt;
      if (hiddenT > 12) {
        stars = Math.max(0, stars - 1);
        hiddenT = 0;
      }
    } else {
      hiddenT = 0;
    }
    // Chase: steer at the player, ram on contact.
    for (let i = cops.length - 1; i >= 0; i -= 1) {
      const c = cops[i];
      const car = c.car;
      const dx = target.x - car.pos.x;
      const dz = target.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(-dx, -dz);
      const diff = wrapAngle(wantHeading - car.heading);
      const steer = THREE.MathUtils.clamp(diff * 2.5, -1, 1);
      const throttle = dist > 4 ? 1 : 0.4;
      car.brake = false;
      const prev = car.pos.clone();
      car.update(dt, throttle, steer, world);
      car.setFlash(true, t);
      // Ram: shove the player's car and slow it.
      if (dist < 4.2 && player.inCar) {
        const push = 3.2 * dt;
        player.inCar.pos.x += (dx / (dist || 1)) * push * -1;
        player.inCar.pos.z += (dz / (dist || 1)) * push * -1;
        player.inCar.speed *= 0.94;
        if (world.onCrash) world.onCrash(car.pos);
      }
      if (dist < 3 && !player.inCar) {
        player.takeDamage(8 * dt);
      }
      // Stuck against a wall: reverse out.
      if (car.pos.distanceTo(prev) < 0.05 && Math.abs(car.speed) < 1) {
        c.stuckT += dt;
        if (c.stuckT > 1.2) {
          car.update(dt, -0.8, -steer, world);
          if (c.stuckT > 2) c.stuckT = 0;
        }
      } else {
        c.stuckT = 0;
      }
      // Despawn far-away cops so the pack stays near the action.
      if (dist > 160) {
        car.dispose();
        cops.splice(i, 1);
      }
    }
  }

  // Stage cops in formation behind a target (for screenshots): they sit on
  // the road behind the target's heading, light bars flashing.
  function spawnStaged(target, count) {
    for (let i = 0; i < count; i += 1) {
      const back = 8 + i * 10;
      const side = i % 2 === 0 ? -1.5 : 1.5;
      const fx = -Math.sin(target.heading);
      const fz = -Math.cos(target.heading);
      const x = target.pos.x - fx * back + -fz * side;
      const z = target.pos.z - fz * back + fx * side;
      const car = makeVehicle(scene, POLICE_DEF, 0x111111, x, z, target.heading);
      car.speed = 14;
      cops.push({ car, stuckT: 0 });
    }
  }

  return {
    get stars() { return stars; },
    setStars(n) { stars = THREE.MathUtils.clamp(n, 0, 5); hiddenT = 0; },
    addStars(n) { stars = THREE.MathUtils.clamp(stars + n, 0, 5); hiddenT = 0; },
    spawnStaged,
    clear() {
      stars = 0;
      for (const c of cops) c.car.dispose();
      cops.length = 0;
    },
    cars() { return cops.map((c) => c.car); },
    update,
  };
}
