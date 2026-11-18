// Synthesized sound for Solara City: every effect is built from Web Audio
// oscillators and filtered noise, so the game ships no audio files at all.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineNodes = null;
  let sirenNodes = null;
  let sirenTimer = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function noiseBuffer(seconds) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    gain.gain.setValueAtTime(vol || 0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noiseHit(dur, filterFreq, vol, type) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(dur + 0.05);
    const filter = ctx.createBiquadFilter();
    filter.type = type || 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  return {
    resume() { ensure(); },
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.5;
    },
    isMuted() { return muted; },
    click() { blip(880, 0.06, 'triangle', 0.15, 660); },
    shot() {
      noiseHit(0.16, 1800, 0.5);
      blip(160, 0.12, 'square', 0.25, 50);
    },
    melee() { noiseHit(0.1, 500, 0.35); },
    reload() { blip(1200, 0.05, 'square', 0.12); setTimeout(() => blip(900, 0.05, 'square', 0.12), 90); },
    pickup() { blip(660, 0.09, 'sine', 0.25); setTimeout(() => blip(990, 0.12, 'sine', 0.25), 90); },
    cash() {
      blip(1046, 0.08, 'triangle', 0.2);
      setTimeout(() => blip(1318, 0.08, 'triangle', 0.2), 80);
      setTimeout(() => blip(1568, 0.14, 'triangle', 0.22), 160);
    },
    missionStart() {
      blip(392, 0.15, 'triangle', 0.25);
      setTimeout(() => blip(523, 0.15, 'triangle', 0.25), 150);
      setTimeout(() => blip(659, 0.25, 'triangle', 0.25), 300);
    },
    missionDone() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.18, 'triangle', 0.25), i * 120));
    },
    crash() { noiseHit(0.3, 300, 0.6); blip(70, 0.25, 'sine', 0.4, 40); },
    horn() { blip(370, 0.25, 'sawtooth', 0.15, 370); },
    engineStart() { blip(60, 0.4, 'sawtooth', 0.2, 120); },
    engine(on, speedNorm) {
      if (!ensure()) return;
      if (!on) {
        if (engineNodes) {
          try { engineNodes.osc.stop(); } catch { /* already stopped */ }
          engineNodes = null;
        }
        return;
      }
      if (!engineNodes) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        const gain = ctx.createGain();
        gain.gain.value = 0.06;
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        osc.start();
        engineNodes = { osc, filter, gain };
      }
      const s = Math.min(1, Math.max(0, speedNorm || 0));
      engineNodes.osc.frequency.setTargetAtTime(55 + s * 130, ctx.currentTime, 0.08);
      engineNodes.filter.frequency.setTargetAtTime(350 + s * 900, ctx.currentTime, 0.08);
      engineNodes.gain.gain.setTargetAtTime(muted ? 0 : 0.05 + s * 0.05, ctx.currentTime, 0.08);
    },
    siren(on, dt) {
      if (!ensure()) return;
      if (!on) {
        if (sirenNodes) {
          try { sirenNodes.osc.stop(); } catch { /* already stopped */ }
          sirenNodes = null;
        }
        return;
      }
      if (!sirenNodes) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        const gain = ctx.createGain();
        gain.gain.value = 0.05;
        osc.connect(gain);
        gain.connect(master);
        osc.start();
        sirenNodes = { osc, gain };
      }
      sirenTimer += dt || 0.016;
      const hi = Math.floor(sirenTimer / 0.45) % 2 === 0;
      sirenNodes.osc.frequency.setTargetAtTime(hi ? 950 : 720, ctx.currentTime, 0.03);
    },
  };
}
