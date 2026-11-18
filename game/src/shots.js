// Screenshot staging: `?shot=<name>` puts the game into a composed scene
// for the entry screenshots — skyline, Rico close-up, driving, police chase.
// Staged scenes for the entry screenshots; each one composes a single frame.
export const SHOT_NAMES = ['skyline', 'rico', 'drive', 'chase'];

export function getShotParam() {
  try {
    const q = new URLSearchParams(window.location.search);
    const s = q.get('shot');
    return SHOT_NAMES.includes(s) ? s : null;
  } catch {
    return null;
  }
}

export function applyShot(world, name) {
  const g = world.game;
  if (!g) return;
  const player = world.player;
  const THREE = world.THREE;
  // No mission beacon in any staged shot — it would cut across the frame.
  if (world.missions) world.missions.suppressBeacon();
  if (name === 'skyline') {
    // High wide shot over downtown toward the bay.
    g.cameraOverride = {
      pos: new THREE.Vector3(-40, 55, -150),
      look: new THREE.Vector3(10, 8, 60),
    };
    g.hideHud = true;
  } else if (name === 'rico') {
    // Rico on the boardwalk, camera low and close, beach + umbrellas behind.
    // He faces the camera so his sunglasses, jacket and pistol read clearly.
    player.pos.set(10, 0, 124);
    player.heading = -2.0;
    player.group.position.copy(player.pos);
    player.group.rotation.y = player.heading;
    player.rig.setWalk(0.6, 0.4, false);
    g.cameraOverride = {
      pos: new THREE.Vector3(8.2, 1.8, 121.8),
      look: new THREE.Vector3(10, 1.25, 124),
    };
    g.hideHud = true;
  } else if (name === 'drive') {
    // Rico driving the Falcon GT down the main avenue, camera tracking close.
    const car = world.spawnShotCar('sport', 0xf1c40f);
    player.enterCar(car);
    car.pos.set(0, 0, 30);
    car.heading = Math.PI;
    car.speed = 16;
    car.group.position.copy(car.pos);
    car.group.rotation.y = car.heading;
    g.cameraOverride = {
      follow: car,
      followOffset: { x: -6, y: 2.6, z: 6.5 },
    };
    g.hideHud = true;
  } else if (name === 'chase') {
    // Police chase: Rico in a red sedan, two interceptors staged on his tail.
    // Camera tracks from the west side of the road — no lamp poles there.
    const car = world.spawnShotCar('sedan', 0xc0392b);
    player.enterCar(car);
    car.pos.set(-36, 0, -20);
    car.heading = Math.PI;
    car.speed = 18;
    car.group.position.copy(car.pos);
    car.group.rotation.y = car.heading;
    world.police.setStars(3);
    world.police.spawnStaged(car, 2);
    // Camera trails on the road centreline 24 m behind the pursuit: both
    // interceptors sit between the lens and the red sedan, light bars
    // facing the camera.
    g.cameraOverride = {
      follow: car,
      followOffset: { x: 0, y: 5, z: -24 },
    };
    g.hideHud = true;
  }
}
