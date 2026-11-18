// Progress saving for Solara City: cash, finished missions and best wanted
// level persist in localStorage so a session picks up where it left off.
const KEY = 'solara-city-save-v1';

export function defaultSave() {
  return { cash: 250, missionsDone: [], bestWanted: 0, playCount: 0 };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const data = JSON.parse(raw);
    const clean = defaultSave();
    if (typeof data.cash === 'number') clean.cash = data.cash;
    if (Array.isArray(data.missionsDone)) clean.missionsDone = data.missionsDone.filter((x) => typeof x === 'number');
    if (typeof data.bestWanted === 'number') clean.bestWanted = data.bestWanted;
    if (typeof data.playCount === 'number') clean.playCount = data.playCount;
    return clean;
  } catch {
    return defaultSave();
  }
}

export function saveGame(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      cash: data.cash | 0,
      missionsDone: data.missionsDone || [],
      bestWanted: data.bestWanted | 0,
      playCount: data.playCount | 0,
    }));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}
