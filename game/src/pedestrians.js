// Pedestrians: varied people strolling the sidewalks — different skin tones,
// clothes, hair and hats, some with bags, a few walking dogs — who panic and
// run with their arms up when shots ring out nearby.
import * as THREE from 'three';
import { buildPerson } from './player.js';

function buildDog() {
  const g = new THREE.Group();
  const coat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.55), coat);
  body.position.y = 0.32;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.22), coat);
  head.position.set(0, 0.45, -0.32);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.25), coat);
  tail.position.set(0, 0.42, 0.38);
  tail.rotation.x = -0.6;
  for (const [lx, lz] of [[-0.08, -0.18], [0.08, -0.18], [-0.08, 0.18], [0.08, 0.18]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.06), coat);
    leg.position.set(lx, 0.11, lz);
    g.add(leg);
  }
  g.add(body, head, tail);
  return { group: g, tail };
}

export function makePedestrians(scene, world, count) {
  const peds = [];
  const rng = world.rng;
  const lines = world.city.ROAD_LINES;
  for (let i = 0; i < count; i += 1) {
    const hasDog = rng() < 0.15;
    const hasBag = !hasDog && rng() < 0.3;
    const rig = buildPerson({
      scale: 0.9 + rng() * 0.2,
      hat: rng() < 0.25 ? [0xd64545, 0x2e86c1, 0xf1c40f][Math.floor(rng() * 3)] : null,
      shades: rng() < 0.2,
      bag: hasBag ? 0x6d4c41 : null,
    });
    scene.add(rig.group);
    const road = lines[Math.floor(rng() * lines.length)];
    const along = -108 + rng() * 216;
    const side = rng() < 0.5 ? -7.4 : 7.4;
    const vertical = rng() < 0.5;
    const dog = hasDog ? buildDog() : null;
    if (dog) scene.add(dog.group);
    peds.push({
      rig,
      pos: new THREE.Vector3(vertical ? road + side : along, 0, vertical ? along : road + side),
      heading: rng() * Math.PI * 2,
      vertical,
      side,
      speed: 1.2 + rng() * 0.8,
      phase: rng() * 6,
      fleeT: 0,
      fleeDir: new THREE.Vector3(),
      dog,
    });
  }


  function updatePet(p, t) {
    const pet = p['dog'];
    if (!pet) return;
    pet.group.position.set(p.pos.x - Math.sin(p.heading) * 1.4, 0, p.pos.z - Math.cos(p.heading) * 1.4);
    pet.group.rotation.y = p.heading;
    pet.tail.rotation.x = -0.6 + Math.sin(t * 8) * 0.4;
  }

  function update(dt, t, danger) {
    for (const p of peds) {
      if (danger && p.fleeT <= 0) {
        const dd = Math.hypot(p.pos.x - danger.x, p.pos.z - danger.z);
        if (dd < 26) {
          p.fleeT = 5 + rng() * 3;
          p.fleeDir.set(p.pos.x - danger.x, 0, p.pos.z - danger.z).normalize();
        }
      }
      let speed = p.speed;
      if (p.fleeT > 0) {
        p.fleeT -= dt;
        speed = 6.5;
        p.heading = Math.atan2(p.fleeDir.x, p.fleeDir.z);
        p.rig.setFlee();
      } else {
        if (rng() < dt * 0.06) {
          p.vertical = !p.vertical;
        }
        const targetHeading = p.vertical ? (p.side > 0 ? Math.PI : 0) : (p.side > 0 ? Math.PI / 2 : -Math.PI / 2);
        let dh = targetHeading - p.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        p.heading += dh * Math.min(1, dt * 3);
      }
      const nx = p.pos.x + Math.sin(p.heading) * speed * dt;
      const nz = p.pos.z + Math.cos(p.heading) * speed * dt;
      if (Math.abs(nx) < 122 && Math.abs(nz) < 122 && !world.hitsCollider(nx, nz, 0.5)) {
        p.pos.x = nx;
        p.pos.z = nz;
      } else {
        p.heading += Math.PI / 2;
      }
      p.phase += dt * (3 + speed * 1.6);
      p.rig.setWalk(p.phase, p.fleeT > 0 ? 1 : 0.7, false);
      p.rig.group.position.copy(p.pos);
      p.rig.group.rotation.y = p.heading;
      updatePet(p, t);
    }
  }

  return { peds, update };
}
