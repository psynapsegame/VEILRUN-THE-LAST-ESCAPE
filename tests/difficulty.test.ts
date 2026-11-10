import { describe, expect, it } from 'vitest';
import { CFG, RAMP, difficultyAt, portalNearest, pressureAt, speedAt } from '../src/sim/config';
import { Game } from '../src/sim/game';
import { botStep } from '../src/sim/bot';
import { TrackGenerator, validateRows, Row } from '../src/sim/track';

const DT = 1 / 120;
const SEEDS = Array.from({ length: 60 }, (_, i) => (i + 1) * 7331);

interface Window { gap: number; action: number; blocked: number; perMin: number; tight: number; cross: number }
/** Averages over many courses of what a player faces between `a` and `b` metres. */
function window(a: number, b: number): Window {
  let gaps = 0, n = 0, act = 0, blocked = 0, tight = 0, cross = 0;
  for (const seed of SEEDS) {
    const t = new TrackGenerator(seed);
    t.generateUntil(b + 50);
    const rows = t.rows;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (r.z < a || r.z >= b) continue;
      const P = portalNearest(r.z);
      if (rows[i - 1].z < P && P <= r.z) continue; // the free stretch around a portal is not a spacing choice
      const gap = (r.z - rows[i - 1].z) / speedAt(r.z);
      gaps += gap; n++;
      if (r.cells[r.safe]) act++;
      blocked += r.cells.filter((c, l) => l !== r.safe && c).length;
      if (gap < 0.95) tight++;
      if (Math.abs(r.safe - rows[i - 1].safe) === 2) cross++;
    }
  }
  return { gap: gaps / n, action: act / n, blocked: blocked / n / 2, perMin: (60 * n) / gaps, tight: tight / n, cross: cross / n };
}

describe('montée de la difficulté', () => {
  const w = [window(0, 500), window(1500, 2500), window(3500, 4500), window(6000, 7000), window(9000, 10000)];
  if (process.env.SHOW_STATS) console.table(w.map((x, i) => ({ fenetre: ['0-500 m', '1,5-2,5 km', '3,5-4,5 km', '6-7 km', '9-10 km'][i], 'écart s': +x.gap.toFixed(2), 'obstacles/min': Math.round(x.perMin), 'action %': Math.round(x.action * 100), 'voies bloquées %': Math.round(x.blocked * 100), 'rafales %': Math.round(x.tight * 100) })));

  it('le temps entre deux obstacles diminue sur toute la course', () => {
    for (let i = 1; i < w.length; i++) expect(w[i].gap, `fenêtre ${i}`).toBeLessThan(w[i - 1].gap);
  });
  it('les obstacles arrivent de plus en plus souvent (par minute de course)', () => {
    for (let i = 1; i < w.length; i++) expect(w[i].perMin, `fenêtre ${i}`).toBeGreaterThan(w[i - 1].perMin);
    expect(w[4].perMin).toBeGreaterThan(w[0].perMin * 1.5);
  });
  it('la voie sûre exige de plus en plus souvent une action, les voies voisines sont de plus en plus bloquées', () => {
    expect(w[4].action).toBeGreaterThan(w[0].action + 0.35);
    expect(w[4].blocked).toBeGreaterThan(w[0].blocked + 0.25);
    for (let i = 1; i < 4; i++) expect(w[i].action).toBeGreaterThanOrEqual(w[i - 1].action - 0.02);
  });
  it('les séries rapprochées (rafales) apparaissent après 400 m et s’intensifient', () => {
    expect(w[0].tight).toBeLessThan(0.2);
    expect(w[4].tight).toBeGreaterThan(w[0].tight + 0.3);
  });
  it('les traversées de deux voies d’un coup n’arrivent qu’après 500 m, et seulement quand l’écart le permet', () => {
    expect(window(0, 500).cross).toBe(0);
    for (let i = 1; i < w.length; i++) expect(w[i].cross, `fenêtre ${i}`).toBeGreaterThan(0.02);
  });
  it('la difficulté ne plafonne pas : la pression continue de monter après 6 km', () => {
    expect(difficultyAt(RAMP)).toBe(1);
    expect(pressureAt(RAMP)).toBe(0);
    expect(pressureAt(RAMP + 2000)).toBeCloseTo(0.5);
    expect(pressureAt(RAMP + 4000)).toBe(1);
    expect(w[4].perMin).toBeGreaterThan(w[3].perMin);
    expect(w[4].gap).toBeLessThan(w[3].gap - 0.04);
    expect(w[4].perMin).toBeGreaterThan(w[3].perMin * 1.05);
  });
  it('la vitesse augmente régulièrement et dépasse nettement l’ancien plafond de 25 m/s', () => {
    for (const [a, b] of [[0, 500], [500, 1500], [1500, 3000], [3000, 6000]]) expect(speedAt(b)).toBeGreaterThan(speedAt(a) + 1.5);
    expect(speedAt(2500)).toBeGreaterThan(24);
    expect(speedAt(5000)).toBeGreaterThan(29);
    expect(speedAt(1e7)).toBeLessThanOrEqual(CFG.speedMax);
  });
});

describe('la course reste jouable à toute difficulté', () => {
  it('300 graines × 30 km : toujours une route (même avec rafales et traversées)', () => {
    for (let s = 1; s <= 300; s++) {
      const t = new TrackGenerator(s * 6151);
      t.generateUntil(30000);
      expect(validateRows(t.rows as Row[]), `graine ${s}`).toBe(0);
    }
  });
  it('le joueur de référence survit à 12 km (rafales, vitesse > 30 m/s) sur 12 graines', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const g = new Game(seed * 31337);
      while (!g.dead && g.dist < 12000) { botStep(g); g.step(DT); }
      expect(g.dead, `graine ${seed} mort à ${g.dist.toFixed(0)} m`).toBe(false);
    }
  });
  it('un joueur qui ne fait rien meurt vite, de plus en plus vite sur les courses difficiles', () => {
    const die = (start: number) => {
      let total = 0;
      for (let seed = 1; seed <= 20; seed++) {
        const g = new Game(seed * 977);
        g.dist = start; g.track.cullBefore(start - 30);
        const t0 = g.dist;
        while (!g.dead && g.dist < start + 3000) g.step(DT);
        total += g.dist - t0;
      }
      return total / 20;
    };
    expect(die(0)).toBeLessThan(250);
    expect(die(6000)).toBeLessThan(die(0));
  });
});
