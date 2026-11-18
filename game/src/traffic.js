// Traffic: AI cars that cruise the road graph on the right-hand side, stop
// at red lights, and slow down for the car ahead — the city feels alive
// even when the player is just watching the street.
import * as THREE from 'three';
import { makeVehicle, CAR_DEFS, pickColor } from './vehicles.js';

function angleTo(dx, dz) {
  // Vehicle forward is (-sin h, -cos h), so the heading that points at
  // (dx, dz) is atan2(-dx, -dz).
  return Math.atan2(-dx, -dz);
}
function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function makeTraffic(scene, world, count) {
  const cars = [];
  const rng = world.rng;
  for (let i = 0; i < count; i += 1) {
    const node = world.city.nodes[Math.floor(rng() * world.city.nodes.length)];
    const def = CAR_DEFS[Math.floor(rng() * CAR_DEFS.length)];
    const car = makeVehicle(scene, def, pickColor(def, rng), node.x + (rng() - 0.5) * 6, node.z + (rng() - 0.5) * 6, rng() * Math.PI * 2);
    const from = world.city.nearestNode(car.pos.x, car.pos.z);
    const nbs = world.city.neighbors(from);
    cars.push({
      car,
      from,
      to: nbs[Math.floor(rng() * nbs.length)],
      cruise: 9 + rng() * 5,
      wait: 0,
    });
  }

  function update(dt, others) {
    for (const t of cars) {
      const c = t.car;
      const target = world.city.nodes[t.to];
      // Drive on the right: offset the target to the right of travel.
      const dx = target.x - world.city.nodes[t.from].x;
      const dz = target.z - world.city.nodes[t.from].z;
      const len = Math.hypot(dx, dz) || 1;
      const rx = -dz / len;
      const rz = dx / len;
      const tx = target.x + rx * 2.4;
      const tz = target.z + rz * 2.4;
      const ddx = tx - c.pos.x;
      const ddz = tz - c.pos.z;
      const dist = Math.hypot(ddx, ddz);
      if (dist < 4) {
        t.from = t.to;
        const nbs = world.city.neighbors(t.to).filter((n) => n !== t.from);
        const pool = nbs.length ? nbs : world.city.neighbors(t.to);
        t.to = pool[Math.floor(rng() * pool.length)];
        continue;
      }
      // Red light: stop before the intersection.
      const light = world.city.lightStateAt(target.x, target.z);
      let throttle = 0.55;
      if ((light === 'red' || light === 'yellow') && dist < 16) throttle = 0;
      // Car ahead: ease off.
      if (others) {
        for (const o of others) {
          if (o === c) continue;
          const ox = o.pos.x - c.pos.x;
          const oz = o.pos.z - c.pos.z;
          const od = Math.hypot(ox, oz);
          if (od < 9 && od > 0.01) {
            const ahead = (-Math.sin(c.heading) * ox + -Math.cos(c.heading) * oz) / od;
            if (ahead > 0.7) { throttle = 0; break; }
          }
        }
      }
      const want = angleTo(ddx, ddz);
      const diff = wrapAngle(want - c.heading);
      const steer = THREE.MathUtils.clamp(diff * 2.2, -1, 1);
      if (c.speed > t.cruise) throttle = 0;
      c.brake = throttle === 0 && c.speed > 1;
      c.update(dt, throttle, steer, world);
    }
  }

  return { cars: cars.map((t) => t.car), update };
}
