import { afterEach, describe, expect, it } from 'vitest';
import { SCHEDULE } from '../src/sim/config';
import { TrackGenerator } from '../src/sim/track';

/**
 * Golden fingerprints of the generated courses. They guard the determinism contract: a refactor of the
 * generator (for example turning worlds into data) must not change a single row for an existing seed.
 * If a gameplay change is intentional, regenerate the values with `UPDATE_GOLDEN=1 npm test` and say so in the commit.
 */
function fingerprint(seed: number, length: number): string {
  const g = new TrackGenerator(seed);
  g.generateUntil(length);
  let h = 2166136261;
  const mix = (s: string) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } };
  for (const r of g.rows) mix(`${r.id}|${r.z.toFixed(6)}|${r.cells.join(',')}|${r.gapLen.toFixed(6)}|${r.world}|${r.safe};`);
  for (const c of g.coins) mix(`${c.z.toFixed(6)}|${c.lane}|${c.y};`);
  return `${g.rows.length}:${h.toString(16)}`;
}

const saved = { ...SCHEDULE };
afterEach(() => Object.assign(SCHEDULE, saved));

const SEEDS = [1, 2, 3, 42, 2024];
const compute = (): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const s of SEEDS) out[`default:${s}`] = fingerprint(s, 12000);
  Object.assign(SCHEDULE, { first: 300, every: 500 }); // many portals: both worlds are exercised early and often
  for (const s of SEEDS) out[`dense:${s}`] = fingerprint(s, 12000);
  return out;
};

const GOLDEN: Record<string, string> = {
  'default:1': '374:3dc59ea9', 'default:2': '379:570249bf', 'default:3': '380:6e274eb9', 'default:42': '376:1385887b', 'default:2024': '377:e7d6499b',
  'dense:1': '349:6ce4679', 'dense:2': '349:cd459fd5', 'dense:3': '352:542f7975', 'dense:42': '347:69962956', 'dense:2024': '351:67d9f597',
};

describe('courses générées : empreintes de référence', () => {
  it('ne changent pas pour une graine donnée', () => {
    const now = compute();
    if (process.env.UPDATE_GOLDEN) console.log(JSON.stringify(now, null, 2));
    expect(now).toEqual(GOLDEN);
  });
});

import { WORLDS, pickBlocker } from '../src/sim/worlds';
describe('fiches de monde', () => {
  it('sont cohérentes : seuils croissants jusqu à 1, ids uniques', () => {
    expect(new Set(WORLDS.map(w => w.id)).size).toBe(WORLDS.length);
    for (const w of WORLDS) {
      let last = 0;
      for (const b of w.blockers) { expect(b.upTo).toBeGreaterThan(last); last = b.upTo; }
      expect(last).toBe(1);
      expect(w.holeOnSafe).toBeGreaterThanOrEqual(0);
      expect(w.holeOnSafe).toBeLessThanOrEqual(1);
    }
  });
  it('pas de trou dans les premiers mètres', () => {
    for (const w of WORLDS) expect(pickBlocker(w, 0.999, 50)).not.toBe('gap');
  });
});
