// Story: Rico Vega, a driver-for-hire new to Solara City, takes five jobs
// from Mara, a fixer who runs the boardwalk cafe. Each job is a small state
// machine with a gold beacon marking the objective and dialogue subtitles.
import * as THREE from 'three';

// Key map points: Mara's cafe, her garage, the park pickup, the drop, the safehouse.
const MARA_SPOT = { x: 14, z: 120 };
const GARAGE = { x: 44, z: 90 };
const PARK_PICKUP = { x: 90, z: -90 };
const DROP_POINT = { x: 90, z: 54 };
const SAFEHOUSE = { x: 90, z: -36 };

export const MISSION_DEFS = [
  { id: 0, name: 'First Wheels', reward: 400, brief: 'Mara: "A Falcon GT is parked uptown. Bring it to my garage — quietly."' },
  { id: 1, name: 'The Package', reward: 600, brief: 'Mara: "Pick up the package in the park, drop it eastside. Two minutes."' },
  { id: 2, name: 'Heat Wave', reward: 800, brief: 'Mara: "The cops are onto us. Survive the heat for a minute."' },
  { id: 3, name: 'The Getaway', reward: 1000, brief: 'Mara: "Job went loud. Lose the tail and get to the safehouse."' },
  { id: 4, name: 'Bayfront Showdown', reward: 1500, brief: 'Mara: "The pier gang took my cut. Take the pier back, Rico."' },
];

export function makeMissions(scene, world) {
  // Gold beacon: a glowing pillar + a spinning ring at the objective.
  const beacon = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 30, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffc93c, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  pillar.position.y = 15;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.6, 0.16, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xffc93c }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.4;
  beacon.add(pillar, ring);
  beacon.visible = false;
  scene.add(beacon);

  const state = {
    active: null, // { def, stage, timer, targetCar }
    done: new Set(world.save.missionsDone || []),
    maraBeacon: true,
    suppressBeacon: false,
  };

  function setBeacon(x, z, visible) {
    if (state.suppressBeacon) {
      beacon.visible = false;
      return;
    }
    beacon.position.set(x, 0, z);
    beacon.visible = visible;
  }

  function startMission(def) {
    state.active = { def, stage: 0, timer: 0, targetCar: null };
    state.maraBeacon = false;
    world.hud.showSubtitle(`${def.name} — ${def.brief}`, 6);
    world.hud.setObjective(def.name);
    world.audio.missionStart();
    if (def.id === 0) {
      // The Falcon GT waits at the uptown spot.
      const car = world.spawnMissionCar();
      state.active.targetCar = car;
      setBeacon(car.pos.x, car.pos.z, true);
      world.hud.showSubtitle('Steal the Falcon GT, then deliver it to the garage.', 5);
    } else if (def.id === 1) {
      setBeacon(PARK_PICKUP.x, PARK_PICKUP.z, true);
      state.active.timer = 120;
    } else if (def.id === 2) {
      world.police.setStars(3);
      state.active.timer = 60;
      setBeacon(playerPos().x, playerPos().z, false);
      world.hud.showSubtitle('Survive! Stay alive until the heat dies down.', 5);
    } else if (def.id === 3) {
      world.police.setStars(2);
      setBeacon(SAFEHOUSE.x, SAFEHOUSE.z, true);
      state.active.timer = 180;
    } else if (def.id === 4) {
      world.combat.spawnGang();
      setBeacon(0, 186, true);
      world.hud.showSubtitle('Clear the pier. Five of them. No backup.', 5);
    }
  }

  function playerPos() {
    return world.player.inCar ? world.player.inCar.pos : world.player.pos;
  }

  function complete() {
    const def = state.active.def;
    state.done.add(def.id);
    world.addCash(def.reward);
    world.hud.showToast(`${def.name} complete — $${def.reward}`);
    world.hud.showSubtitle(`Mara: "Clean work, Rico. $${def.reward} is yours."`, 5);
    world.audio.missionDone();
    state.active = null;
    state.maraBeacon = true;
    setBeacon(MARA_SPOT.x, MARA_SPOT.z, true);
    world.hud.setObjective(state.done.size >= 5 ? 'All jobs done — Solara is yours.' : 'Return to Mara at the boardwalk cafe.');
    world.saveProgress();
  }

  function fail(reason) {
    const def = state.active.def;
    world.hud.showToast(`Job failed: ${reason}`);
    world.hud.showSubtitle(`Mara: "${reason} Come back when you're ready."`, 5);
    if (def.id === 2 || def.id === 3) world.police.setStars(0);
    state.active = null;
    state.maraBeacon = true;
    setBeacon(MARA_SPOT.x, MARA_SPOT.z, true);
    world.hud.setObjective('Return to Mara at the boardwalk cafe.');
  }

  function nextMission() {
    for (const def of MISSION_DEFS) {
      if (!state.done.has(def.id)) return def;
    }
    return null;
  }

  function update(dt, t) {
    beacon.rotation.y += dt * 0.8;
    ring.scale.setScalar(1 + Math.sin(t * 3) * 0.08);
    const pp = playerPos();
    if (!state.active) {
      const next = nextMission();
      if (!next) {
        setBeacon(MARA_SPOT.x, MARA_SPOT.z, false);
        return;
      }
      setBeacon(MARA_SPOT.x, MARA_SPOT.z, true);
      if (Math.hypot(pp.x - MARA_SPOT.x, pp.z - MARA_SPOT.z) < 5) {
        startMission(next);
      }
      return;
    }
    const m = state.active;
    const def = m.def;
    if (def.id === 0) {
      if (m.stage === 0) {
        // Stage 0: get in the Falcon.
        if (world.player.inCar === m.targetCar) {
          m.stage = 1;
          setBeacon(GARAGE.x, GARAGE.z, true);
          world.hud.showSubtitle('Now get it to the garage — in one piece.', 4);
        } else {
          setBeacon(m.targetCar.pos.x, m.targetCar.pos.z, true);
        }
      } else if (Math.hypot(pp.x - GARAGE.x, pp.z - GARAGE.z) < 7 && world.player.inCar === m.targetCar) {
        complete();
      }
    } else if (def.id === 1) {
      m.timer -= dt;
      if (m.timer <= 0) { fail('Too slow — the buyer walked.'); return; }
      world.hud.setTimer(Math.ceil(m.timer));
      if (m.stage === 0) {
        if (Math.hypot(pp.x - PARK_PICKUP.x, pp.z - PARK_PICKUP.z) < 5) {
          m.stage = 1;
          setBeacon(DROP_POINT.x, DROP_POINT.z, true);
          world.hud.showSubtitle('Package secured. Eastside drop — go!', 4);
          world.audio.pickup();
        }
      } else if (Math.hypot(pp.x - DROP_POINT.x, pp.z - DROP_POINT.z) < 6) {
        world.hud.setTimer(null);
        complete();
      }
    } else if (def.id === 2) {
      m.timer -= dt;
      world.hud.setTimer(Math.ceil(m.timer));
      if (world.player.dead) { world.hud.setTimer(null); fail('You went down.'); return; }
      if (m.timer <= 0) {
        world.hud.setTimer(null);
        world.police.setStars(0);
        complete();
      }
    } else if (def.id === 3) {
      m.timer -= dt;
      if (m.timer <= 0) { fail('The cops boxed you in.'); return; }
      world.hud.setTimer(Math.ceil(m.timer));
      const nearHouse = Math.hypot(pp.x - SAFEHOUSE.x, pp.z - SAFEHOUSE.z) < 8;
      if (nearHouse && world.police.stars === 0) {
        world.hud.setTimer(null);
        complete();
      }
    } else if (def.id === 4) {
      if (world.combat.aliveCount() === 0) {
        complete();
      }
    }
  }

  return {
    state,
    update,
    nextMission,
    MARA_SPOT,
    setBeacon,
    startMission,
    beaconPos() {
      return beacon.visible ? { x: beacon.position.x, z: beacon.position.z } : null;
    },
    suppressBeacon() {
      state.suppressBeacon = true;
      beacon.visible = false;
    },
    forceStart(id) {
      const def = MISSION_DEFS.find((d) => d.id === id);
      if (def) startMission(def);
    },
  };
}
