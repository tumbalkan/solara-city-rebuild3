// Solara City — main entry. Wires the city, Rico, traffic, pedestrians,
// police, combat and missions into one playable loop with a third-person
// camera, pointer-lock mouse aim and a start/pause/death flow.
import * as THREE from 'three';
import { buildCity, mulberry32 } from './city.js';
import { makePlayer } from './player.js';
import { makeVehicle, CAR_DEFS, pickColor } from './vehicles.js';
import { makeTraffic } from './traffic.js';
import { makePedestrians } from './pedestrians.js';
import { makePolice } from './police.js';
import { makeCombat } from './combat.js';
import { makeMissions } from './missions.js';
import { makeHud } from './hud.js';
import { createAudio } from './audio.js';
import { loadSave, saveGame } from './save.js';
import { getShotParam, applyShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const seed = parseInt(params.get('seed') || '7', 10) || 7;
const shotName = getShotParam();
const rng = mulberry32(seed);

// ---- Renderer / scene / camera ----
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

// ---- Save + audio + HUD ----
const save = loadSave();
const audio = createAudio();
const hud = makeHud();
let cash = save.cash;
let started = false;
let paused = false;
let deadT = 0;

// ---- World object shared by every system ----
const city = buildCity(scene, seed);
const world = {
  scene, city, rng, THREE,
  colliders: city.colliders,
  hitsCollider: (x, z, r) => city.hitsCollider(x, z, r),
  audio,
  hud,
  save,
  beaconPos: null,
  game: null,
  onCrash: null,
  onEnemyDown: null,
  player: null,
  police: null,
  combat: null,
  traffic: null,
  addCash(n) {
    cash += n;
    hud.setCash(cash);
  },
  saveProgress() {
    save.cash = cash;
    save.missionsDone = [...missions.state.done];
    saveGame(save);
  },
  spawnMissionCar() {
    const def = CAR_DEFS.find((d) => d.kind === 'sport');
    const spot = city.missionCarSpot;
    const car = makeVehicle(scene, def, 0xc0392b, spot.x, spot.z, Math.PI / 2);
    ownedCars.push(car);
    return car;
  },
  spawnShotCar(kind, color) {
    const def = CAR_DEFS.find((d) => d.kind === (kind || 'sport')) || CAR_DEFS[4];
    const car = makeVehicle(scene, def, color ?? pickColor(def, rng), 0, 0, 0);
    ownedCars.push(car);
    return car;
  },
};

// ---- Actors ----
const player = makePlayer(scene, world, city.playerStart.x, city.playerStart.z);
world.player = player;
const traffic = makeTraffic(scene, world, 14);
world.traffic = traffic;
const peds = makePedestrians(scene, world, 26);
const police = makePolice(scene, world);
world.police = police;
const combat = makeCombat(scene, world);
world.combat = combat;
const missions = makeMissions(scene, world);
world.missions = missions;
const ownedCars = [];

// ---- Input ----
const keys = new Set();
let camYaw = Math.PI;
let camPitch = 0.32;
let aiming = false;
let mouseDown = false;
let lastShot = 0;
let lastCrashSound = 0;
let starCooldown = 0;

const canvas = renderer.domElement;
document.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'KeyR') reload();
  if (e.code === 'KeyF') melee();
  if (e.code === 'KeyM') audio.setMuted(!audio.isMuted());
  if (e.code === 'KeyE') toggleCar();
  if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
});
document.addEventListener('keyup', (e) => keys.delete(e.code));
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas || paused) return;
  camYaw -= e.movementX * 0.0023;
  camPitch = THREE.MathUtils.clamp(camPitch + e.movementY * 0.002, -0.15, 1.1);
});
document.addEventListener('mousedown', (e) => {
  if (!started || paused) return;
  if (e.button === 0) mouseDown = true;
  if (e.button === 2) aiming = true;
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 0) mouseDown = false;
  if (e.button === 2) aiming = false;
});
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas && started && !paused && !shotName) {
    togglePause();
  }
});

function allCars() {
  return [...traffic.cars, ...police.cars(), ...ownedCars];
}
function nearestCar(pos, maxD) {
  let best = null;
  let bd = maxD;
  for (const car of allCars()) {
    if (car.dead) continue;
    const d = Math.hypot(car.pos.x - pos.x, car.pos.z - pos.z);
    if (d < bd) { best = car; bd = d; }
  }
  return best;
}
function toggleCar() {
  if (!started || paused || player.dead) return;
  if (player.inCar) {
    player.exitCar();
    audio.click();
    return;
  }
  const car = nearestCar(player.pos, 4.2);
  if (car) {
    player.enterCar(car);
    audio.engineStart();
    // Stealing a traffic car draws heat.
    if (traffic.cars.includes(car) && starCooldown <= 0) {
      police.addStars(1);
      starCooldown = 8;
    }
    const idx = traffic.cars.indexOf(car);
    if (idx >= 0) traffic.cars.splice(idx, 1);
    if (!ownedCars.includes(car)) ownedCars.push(car);
  }
}
function reload() {
  if (player.inCar || player.ammo >= 12 || player.reserve <= 0) return;
  const need = 12 - player.ammo;
  const take = Math.min(need, player.reserve);
  player.ammo += take;
  player.reserve -= take;
  audio.reload();
}
function melee() {
  if (!started || paused || player.inCar) return;
  audio.melee();
  for (const e of combat.enemies) {
    if (!e.alive) continue;
    const d = Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z);
    if (d < 2.6) {
      e.health -= 25;
      if (e.health <= 0) {
        e.alive = false;
        e.rig.group.rotation.x = -Math.PI / 2;
        e.rig.group.position.y = 0.25;
      }
    }
  }
}
function shoot(now) {
  if (player.ammo <= 0) {
    audio.click();
    reload();
    return;
  }
  player.ammo -= 1;
  const from = player.muzzlePos();
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const to = from.clone().addScaledVector(dir, 60);
  combat.shootAt(from, to, 34, 'player');
  audio.shot();
  if (starCooldown <= 0) {
    police.addStars(1);
    starCooldown = 8;
  }
  lastShot = now;
}

function togglePause() {
  if (!started || shotName) return;
  paused = !paused;
  document.getElementById('pause-screen').classList.toggle('hidden', !paused);
  if (!paused) canvas.requestPointerLock();
}

// ---- Screens ----
const startScreen = document.getElementById('start-screen');
const playBtn = document.getElementById('play-btn');
function startGame() {
  started = true;
  startScreen.classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  audio.resume();
  if (!shotName) canvas.requestPointerLock();
  hud.showSubtitle('Mara: "Rico! Boardwalk cafe. First job\'s waiting."', 6);
  hud.setObjective('Go to Mara at the boardwalk cafe.');
  hud.setCash(cash);
  hud.setHealth(player.health, player.maxHealth);
  hud.setAmmo(player.ammo, player.reserve);
  hud.setStars(0);
}
if (playBtn) playBtn.addEventListener('click', startGame);

world.onCrash = (pos) => {
  const now = performance.now() / 1000;
  if (now - lastCrashSound > 0.5) {
    audio.crash();
    lastCrashSound = now;
  }
};
world.onEnemyDown = () => {
  hud.showToast('Gang member down');
};

// ---- Camera rig ----
const camTarget = new THREE.Vector3();
const camPos = new THREE.Vector3();
function updateCamera(dt) {
  if (world.game && world.game.cameraOverride) {
    const ov = world.game.cameraOverride;
    if (ov.follow) {
      const f = ov.follow;
      const off = ov.followOffset || { x: 7.5, y: 3.4, z: 8 };
      camPos.set(f.pos.x + off.x, off.y, f.pos.z + off.z);
      camera.position.lerp(camPos, Math.min(1, dt * 3));
      camera.lookAt(f.pos.x, 1.2, f.pos.z);
    } else {
      camera.position.copy(ov.pos);
      camera.lookAt(ov.look);
    }
    return;
  }
  const focus = player.inCar ? player.inCar.pos : player.pos;
  const dist = player.inCar ? 9.5 : aiming ? 4.2 : 7.2;
  const height = player.inCar ? 3.4 : 2.2 + camPitch * 2.2;
  const cy = player.inCar ? player.inCar.heading + Math.PI : camYaw;
  const offX = -Math.sin(cy) * Math.cos(camPitch) * dist;
  const offZ = Math.cos(cy) * Math.cos(camPitch) * dist;
  camPos.set(focus.x + offX, focus.y + height, focus.z + offZ);
  if (camPos.y < 1.2) camPos.y = 1.2;
  camera.position.lerp(camPos, Math.min(1, dt * 8));
  camTarget.set(focus.x, focus.y + 1.6, focus.z);
  camera.lookAt(camTarget);
}

// ---- Screenshot staging ----
world.game = { cameraOverride: null, hideHud: false };
if (shotName) {
  started = true;
  startScreen.classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  applyShot(world, shotName);
  if (world.game.hideHud) document.getElementById('hud').classList.add('hidden');
}

// ---- Main loop ----
const clock = new THREE.Clock();
let elapsed = 0;
let frame = 0;
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const now = performance.now() / 1000;
  elapsed += dt;
  frame += 1;
  if (frame === 3) window.__solaraReady = true;
  if (!started || paused) {
    renderer.render(scene, camera);
    return;
  }
  starCooldown = Math.max(0, starCooldown - dt);

  // Player.
  const input = { keys, camYaw, aiming: aiming && !player.inCar, strafe: (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0) };
  if (aiming && !player.inCar) {
    // Face where the camera looks while aiming.
    player.heading = Math.atan2(Math.sin(camYaw), -Math.cos(camYaw));
  }
  if (!player.dead) player.update(dt, input, elapsed);

  // Shooting.
  if (mouseDown && !player.inCar && !player.dead && now - lastShot > 0.22) {
    shoot(now);
  }

  // Driving.
  if (player.inCar) {
    const car = player.inCar;
    const throttle = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 0.7 : 0);
    const steer = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    car.brake = keys.has('Space');
    if (car.brake) car.speed *= Math.pow(0.05, dt);
    car.update(dt, throttle, steer, world);
    audio.engine(true, Math.abs(car.speed) / car.def.top);
    hud.setSpeed(Math.abs(car.speed) * 3.6);
  } else {
    audio.engine(false, 0);
    hud.setSpeed(0);
  }

  // Shot-mode autopilot: keep the staged car rolling.
  if (shotName === 'drive' || shotName === 'chase') {
    if (player.inCar) {
      const car = player.inCar;
      if (car.speed < 16) car.update(dt, 0.7, 0, world);
      else car.update(dt, 0.2, 0, world);
      if (Math.abs(car.pos.z) > 110) {
        car.pos.z = car.pos.z > 0 ? -100 : 100;
      }
    }
  }

  // Systems.
  city.update(dt);
  traffic.update(dt, allCars());
  peds.update(dt, elapsed, combat.danger);
  police.update(dt, elapsed, player);
  combat.update(dt, player);
  missions.update(dt, elapsed);
  hud.update(dt);

  // Beacon position for the minimap.
  world.beaconPos = missions.beaconPos();

  // Death + respawn.
  if (player.dead && deadT <= 0) {
    deadT = 2.5;
    document.getElementById('dead-screen').classList.remove('hidden');
    if (document.pointerLockElement) document.exitPointerLock();
  }
  if (deadT > 0) {
    deadT -= dt;
    if (deadT <= 0) {
      document.getElementById('dead-screen').classList.add('hidden');
      player.healFull();
      player.pos.set(city.playerStart.x, 0, city.playerStart.z);
      player.group.position.copy(player.pos);
      if (player.inCar) player.inCar = null;
      player.group.visible = true;
      police.clear();
      cash = Math.max(0, cash - 50);
      hud.setCash(cash);
      hud.showSubtitle('You woke up at the boardwalk. $50 lighter.', 5);
      if (!shotName) canvas.requestPointerLock();
    }
  }

  // HUD values.
  hud.setHealth(player.health, player.maxHealth);
  hud.setAmmo(player.ammo, player.reserve);
  hud.setStars(police.stars);
  audio.siren(police.stars > 0, dt);
  if (frame % 2 === 0) hud.drawMinimap(world, elapsed);

  // Car prompt.
  if (!player.inCar && !player.dead) {
    const near = nearestCar(player.pos, 4.2);
    hud.setPrompt(near ? `Press E — drive the ${near.def.name}` : '');
  } else {
    hud.setPrompt(player.inCar ? 'Press E — get out' : '');
  }

  updateCamera(dt);
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Test hooks for the playtest harness.
window.__solara = {
  player, world, city, police, combat, missions, traffic, peds, renderer,
  get cash() { return cash; },
  startGame,
};

animate();
