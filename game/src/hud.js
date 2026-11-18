// HUD: a circular minimap drawn on canvas (roads, building blocks, the
// player arrow, a pulsing gold objective marker, flashing police blips),
// plus health, cash, ammo, wanted stars, speedometer and subtitles.
export function makeHud() {
  const $ = (id) => document.getElementById(id);
  const el = {
    minimap: $('minimap'),
    healthFill: $('health-fill'),
    healthText: $('health-text'),
    cash: $('cash'),
    ammo: $('ammo'),
    stars: $('stars'),
    speed: $('speed'),
    objective: $('objective'),
    timer: $('timer'),
    subtitle: $('subtitle'),
    toast: $('toast'),
    prompt: $('prompt'),
    wantedFlash: $('wanted-flash'),
  };
  const mctx = el.minimap ? el.minimap.getContext('2d') : null;
  let subtitleT = 0;
  let toastT = 0;

  function setHealth(h, max) {
    const pct = Math.max(0, Math.min(100, (h / max) * 100));
    if (el.healthFill) el.healthFill.style.width = `${pct}%`;
    if (el.healthText) el.healthText.textContent = `${Math.ceil(h)}`;
  }
  function setCash(n) {
    if (el.cash) el.cash.textContent = `$${n.toLocaleString('en-US')}`;
  }
  function setAmmo(mag, reserve) {
    if (el.ammo) el.ammo.textContent = `${mag} / ${reserve}`;
  }
  // Wanted stars: 5 slots, filled gold up to the current heat; 3+ flashes red.
  function setStars(n) {
    if (!el.stars) return;
    el.stars.innerHTML = '';
    for (let i = 0; i < 5; i += 1) {
      const s = document.createElement('span');
      s.className = `star${i < n ? ' lit' : ''}`;
      s.textContent = '★';
      el.stars.appendChild(s);
    }
    if (el.wantedFlash) el.wantedFlash.classList.toggle('hot', n >= 3);
  }
  function setSpeed(kmh) {
    if (el.speed) el.speed.textContent = `${Math.round(kmh)} km/h`;
  }
  function setObjective(text) {
    if (el.objective) el.objective.textContent = text;
  }
  function setTimer(seconds) {
    if (!el.timer) return;
    if (seconds === null || seconds === undefined) {
      el.timer.textContent = '';
      el.timer.classList.remove('urgent');
      return;
    }
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    el.timer.textContent = `${m}:${String(s).padStart(2, '0')}`;
    el.timer.classList.toggle('urgent', seconds <= 15);
  }
  function showSubtitle(text, seconds) {
    if (!el.subtitle) return;
    el.subtitle.textContent = text;
    el.subtitle.classList.add('show');
    subtitleT = seconds || 4;
  }
  function showToast(text) {
    if (!el.toast) return;
    el.toast.textContent = text;
    el.toast.classList.add('show');
    toastT = 3.5;
  }
  function setPrompt(text) {
    if (!el.prompt) return;
    el.prompt.textContent = text || '';
    el.prompt.classList.toggle('show', !!text);
  }

  function drawMinimap(world, t) {
    if (!mctx) return;
    const S = 180;
    const R = S / 2;
    const scale = S / 300; // world spans roughly -150..150
    const cx = world.player.pos.x;
    const cz = world.player.pos.z;
    mctx.clearRect(0, 0, S, S);
    // Clip to a circle.
    mctx.save();
    mctx.beginPath();
    mctx.arc(R, R, R - 2, 0, Math.PI * 2);
    mctx.clip();
    // Sea + land background.
    mctx.fillStyle = '#7ec8e3';
    mctx.fillRect(0, 0, S, S);
    mctx.fillStyle = '#a8b89a';
    mctx.fillRect(0, 0, S, S * 0.86);
    // Sand strip.
    mctx.fillStyle = '#e8d29a';
    mctx.fillRect(0, S * 0.78, S, S * 0.08);
    const toMap = (x, z) => [R + (x - cx) * scale * 1.6, R + (z - cz) * scale * 1.6];
    // Roads.
    mctx.strokeStyle = '#4a4f55';
    mctx.lineWidth = 7;
    for (const r of world.city.ROAD_LINES) {
      const [x1] = toMap(r, 0);
      mctx.beginPath();
      mctx.moveTo(x1, 0);
      mctx.lineTo(x1, S);
      mctx.stroke();
      const [, z1] = toMap(0, r);
      mctx.beginPath();
      mctx.moveTo(0, z1);
      mctx.lineTo(S, z1);
      mctx.stroke();
    }
    // Building blocks.
    mctx.fillStyle = '#8a94a6';
    for (const c of world.city.colliders) {
      const w = (c.x1 - c.x0) * scale * 1.6;
      const h = (c.z1 - c.z0) * scale * 1.6;
      if (w < 2 || h < 2) continue;
      const [mx, mz] = toMap((c.x0 + c.x1) / 2, (c.z0 + c.z1) / 2);
      mctx.fillRect(mx - w / 2, mz - h / 2, w, h);
    }
    // Objective beacon.
    if (world.beaconPos) {
      const [bx, bz] = toMap(world.beaconPos.x, world.beaconPos.z);
      const pulse = 6 + Math.sin(t * 4) * 2;
      mctx.fillStyle = '#ffc93c';
      mctx.beginPath();
      mctx.arc(bx, bz, pulse, 0, Math.PI * 2);
      mctx.fill();
      mctx.strokeStyle = '#fff3c4';
      mctx.lineWidth = 2;
      mctx.stroke();
    }
    // Police blips flash red/blue.
    const cops = world.police ? world.police.cars() : [];
    const flashRed = Math.floor(t * 3) % 2 === 0;
    mctx.fillStyle = flashRed ? '#ff3333' : '#3388ff';
    for (const cop of cops) {
      const [mx, mz] = toMap(cop.pos.x, cop.pos.z);
      mctx.beginPath();
      mctx.arc(mx, mz, 4, 0, Math.PI * 2);
      mctx.fill();
    }
    // Traffic dots.
    mctx.fillStyle = 'rgba(255,255,255,0.85)';
    if (world.traffic) {
      for (const car of world.traffic.cars) {
        const [mx, mz] = toMap(car.pos.x, car.pos.z);
        mctx.fillRect(mx - 1.5, mz - 1.5, 3, 3);
      }
    }
    // Player arrow (centered, rotates with heading).
    mctx.save();
    mctx.translate(R, R);
    mctx.rotate(world.player.heading);
    mctx.fillStyle = '#ffffff';
    mctx.strokeStyle = '#222222';
    mctx.lineWidth = 1.5;
    mctx.beginPath();
    mctx.moveTo(0, -9);
    mctx.lineTo(6, 7);
    mctx.lineTo(0, 3);
    mctx.lineTo(-6, 7);
    mctx.closePath();
    mctx.fill();
    mctx.stroke();
    mctx.restore();
    mctx.restore();
    // Ring.
    mctx.strokeStyle = 'rgba(255,255,255,0.85)';
    mctx.lineWidth = 3;
    mctx.beginPath();
    mctx.arc(R, R, R - 2, 0, Math.PI * 2);
    mctx.stroke();
  }

  function update(dt) {
    if (subtitleT > 0) {
      subtitleT -= dt;
      if (subtitleT <= 0 && el.subtitle) el.subtitle.classList.remove('show');
    }
    if (toastT > 0) {
      toastT -= dt;
      if (toastT <= 0 && el.toast) el.toast.classList.remove('show');
    }
  }

  return {
    setHealth, setCash, setAmmo, setStars, setSpeed, setObjective, setTimer,
    showSubtitle, showToast, setPrompt, drawMinimap, update,
  };
}
