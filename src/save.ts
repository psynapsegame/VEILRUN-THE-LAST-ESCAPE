/** Local save. Versioned and behind a storage interface so a cloud backend can be added later. */
export interface SaveData {
  v: 1;
  best: number;
  bestDist: number;
  fragments: number;
  runs: number;
  muted: boolean;
}
export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

const KEY = 'veilrun.save';
export const defaultSave = (): SaveData => ({ v: 1, best: 0, bestDist: 0, fragments: 0, runs: 0, muted: false });

export function loadSave(store: KV | null): SaveData {
  const d = defaultSave();
  try {
    const raw = store?.getItem(KEY);
    if (!raw) return d;
    const o = JSON.parse(raw);
    if (!o || o.v !== 1) return d;
    for (const k of ['best', 'bestDist', 'fragments', 'runs'] as const)
      if (Number.isFinite(o[k]) && o[k] >= 0) d[k] = Math.floor(o[k]);
    d.muted = o.muted === true;
  } catch {
    /* corrupted or unavailable storage: start clean */
  }
  return d;
}

export function writeSave(store: KV | null, d: SaveData): boolean {
  try {
    store?.setItem(KEY, JSON.stringify(d));
    return !!store;
  } catch {
    return false;
  }
}

/** Fold a finished run into the save. Returns true on a new record. */
export function recordRun(d: SaveData, score: number, dist: number, fragments: number): boolean {
  d.runs++;
  d.fragments += fragments;
  d.bestDist = Math.max(d.bestDist, Math.floor(dist));
  if (score > d.best) {
    d.best = score;
    return true;
  }
  return false;
}
