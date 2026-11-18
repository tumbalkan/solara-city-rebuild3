// Combat: hitscan pistol fire with a muzzle flash and tracer, a melee swing,
// and the Bayfront gang — five armed enemies who guard the pier and shoot
// back when Rico gets close.
import * as THREE from 'three';
import { buildPerson } from './player.js';

export function makeCombat(scene, world) {
  const enemies = [];
  const tracers = [];
  const muzzle = new THREE.PointLight(0xffcc66, 0, 12);
  scene.add(muzzle);
  let muzzleT = 0;
  let dangerPos = null;
  let dangerT = 0;

  function spawnGang() {
    const spots = [
      [0, 176, 0], [-4, 184, 0.4], [4, 184, -0.4], [-5, 192, 0.8], [5, 192, -0.8],
    ];
    for (const [x, z, h] of spots) {
      const rig = buildPerson({
        skin: 0xe0ac69, hair: 0x1a1a1a, hairStyle: 1, shades: true,
        shirt: 0x1a1a1a, jacket: 0x8e1616, pants: 0x1a1a1a, scale: 1,
      });
      rig.gun.visible = true;
      rig.group.position.set(x, 0, z);
      rig.group.rotation.y = h;
      scene.add(rig.group);
      enemies.push({
        rig, pos: new THREE.Vector3(x, 0, z), heading: h,
        health: 60, alive: true, shootT: 1 + Math.random() * 2, home: new THREE.Vector3(x, 0, z),
      });
    }
  }

  function tracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
    scene.add(line);
    tracers.push({ line, t: 0.09 });
  }

  function shootAt(shooterPos, targetPos, damage, shooter) {
    tracer(shooterPos, targetPos);
    muzzle.position.copy(shooterPos);
    muzzle.intensity = 14;
    muzzleT = 0.06;
    dangerPos = shooterPos.clone();
    dangerT = 1.2;
    if (shooter === 'player') {
      // Hit the nearest enemy within a cone of the shot line.
      const dir = targetPos.clone().sub(shooterPos).normalize();
      let best = null;
      let bestD = Infinity;
      for (const e of enemies) {
        if (!e.alive) continue;
        const toE = new THREE.Vector3(e.pos.x, 1.1, e.pos.z).sub(shooterPos);
        const along = toE.dot(dir);
        if (along < 0 || along > 60) continue;
        const perp = toE.clone().addScaledVector(dir, -along).length();
        if (perp < 1.1 && along < bestD) { best = e; bestD = along; }
      }
      if (best) {
        best.health -= damage;
        if (best.health <= 0) {
          best.alive = false;
          best.rig.group.rotation.x = -Math.PI / 2;
          best.rig.group.position.y = 0.25;
          if (world.onEnemyDown) world.onEnemyDown(best);
        }
      }
      return best;
    }
    return null;
  }

  function update(dt, player) {
    muzzleT -= dt;
    if (muzzleT <= 0) muzzle.intensity = 0;
    dangerT -= dt;
    if (dangerT <= 0) dangerPos = null;
    for (let i = tracers.length - 1; i >= 0; i -= 1) {
      tracers[i].t -= dt;
      if (tracers[i].t <= 0) {
        scene.remove(tracers[i].line);
        tracers[i].line.geometry.dispose();
        tracers.splice(i, 1);
      }
    }
    // Gang AI: hold the pier, shoot Rico when he comes in range.
    for (const e of enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(player.pos.x - e.pos.x, player.pos.z - e.pos.z);
      e.shootT -= dt;
      if (d < 38 && e.shootT <= 0) {
        e.shootT = 0.9 + Math.random() * 0.9;
        const from = new THREE.Vector3(e.pos.x, 1.35, e.pos.z);
        const to = new THREE.Vector3(player.pos.x + (Math.random() - 0.5) * 1.5, 1.2, player.pos.z + (Math.random() - 0.5) * 1.5);
        tracer(from, to);
        muzzle.position.copy(from);
        muzzle.intensity = 10;
        muzzleT = 0.05;
        if (Math.random() < 0.45) player.takeDamage(6);
        e.heading = Math.atan2(player.pos.x - e.pos.x, player.pos.z - e.pos.z);
        e.rig.group.rotation.y = e.heading;
        e.rig.setWalk(0, 0, true);
        if (world.audio) world.audio.shot();
      } else if (d >= 38) {
        e.rig.setIdle(performance.now() / 1000);
      }
    }
  }

  return {
    enemies,
    spawnGang,
    shootAt,
    update,
    get danger() { return dangerPos; },
    aliveCount() { return enemies.filter((e) => e.alive).length; },
    reset() {
      for (const e of enemies) {
        e.alive = true;
        e.health = 60;
        e.rig.group.rotation.x = 0;
        e.rig.group.position.y = 0;
        e.rig.group.position.copy(e.home);
        e.pos.copy(e.home);
      }
    },
  };
}
