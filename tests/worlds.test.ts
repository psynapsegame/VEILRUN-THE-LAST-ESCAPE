import { describe, expect, it } from 'vitest';
import { CFG, LASER, SCHEDULE, laserOn, portalNear, portalNearest, speedAt, worldAt } from '../src/sim/config';
import { Game } from '../src/sim/game';
import { botStep } from '../src/sim/bot';
import { TrackGenerator, validateRows, Row } from '../src/sim/track';

const DT = 1 / 120;

describe('portails et mondes', () => {
  it('SOLARIS jusqu’au premier portail, puis les mondes alternent à chaque portail', () => {
    expect(worldAt(0)).toBe(0);
    expect(worldAt(SCHEDULE.first - 1)).toBe(0);
    expect(worldAt(SCHEDULE.first)).toBe(1);
    expect(worldAt(SCHEDULE.first + SCHEDULE.every - 1)).toBe(1);
    expect(worldAt(SCHEDULE.first + SCHEDULE.every)).toBe(0);
    expect(worldAt(SCHEDULE.first + 2 * SCHEDULE.every)).toBe(1);
    expect(worldAt(1e6)).toBeGreaterThanOrEqual(0);
  });
  it('le portail le plus proche et sa zone dégagée', () => {
    expect(portalNearest(0)).toBe(SCHEDULE.first);
    expect(portalNearest(SCHEDULE.first + 900)).toBe(SCHEDULE.first);
    expect(portalNearest(SCHEDULE.first + 1100)).toBe(SCHEDULE.first + SCHEDULE.every);
    expect(portalNear(SCHEDULE.first - SCHEDULE.clear + 1)).toBe(SCHEDULE.first);
    expect(portalNear(SCHEDULE.first - SCHEDULE.clear - 1)).toBe(null);
    expect(portalNear(0)).toBe(null);
  });
  it('aucun obstacle à moins de 32 m d’un portail, sur 100 courses jusqu’à 12 km', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const t = new TrackGenerator(seed * 4099);
      t.generateUntil(12000);
      for (const r of t.rows) expect(portalNear(r.z), `graine ${seed} rangée à ${r.z.toFixed(0)} m`).toBe(null);
    }
  });
  it('une ligne de cristaux traverse chaque portail', () => {
    const t = new TrackGenerator(7);
    t.generateUntil(SCHEDULE.first + 200);
    const through = t.coins.filter(c => Math.abs(c.z - SCHEDULE.first) <= 20);
    expect(through.length).toBeGreaterThanOrEqual(9);
    expect(new Set(through.map(c => c.lane)).size).toBe(1);
  });
  it('chaque rangée porte le monde de sa position', () => {
    const t = new TrackGenerator(11);
    t.generateUntil(9000);
    for (const r of t.rows) expect(r.world).toBe(worldAt(r.z));
  });
  it('les lasers n’existent que dans NEXUS, jamais dans la voie sûre, et sont comptés comme des murs par le validateur', () => {
    let lasers = 0, holes0 = 0, holes1 = 0, rows0 = 0, rows1 = 0;
    for (let seed = 1; seed <= 80; seed++) {
      const t = new TrackGenerator(seed * 977);
      t.generateUntil(9000);
      for (const r of t.rows) {
        const has = (k: string) => r.cells.filter(c => c === k).length;
        if (r.world === 0) { expect(has('laser')).toBe(0); holes0 += has('gap'); rows0++; }
        else { lasers += has('laser'); holes1 += has('gap'); rows1++; }
        expect(r.cells[r.safe]).not.toBe('laser');
        expect(r.cells[r.safe]).not.toBe('full');
      }
    }
    expect(lasers).toBeGreaterThan(100);
    expect(holes1 / rows1).toBeGreaterThan(holes0 / rows0); // NEXUS opens more holes
    const wall: Row = { id: 1, z: 100, cells: ['laser', 'laser', 'laser'], gapLen: 3, world: 1, smashed: [false, false, false], safe: 1 };
    expect(validateRows([wall])).toBe(1);
  });
  it('toujours une route : 300 courses de 30 km avec portails, lasers et trous', () => {
    for (let s = 1; s <= 300; s++) {
      const t = new TrackGenerator(s * 7723);
      t.generateUntil(30000);
      expect(validateRows(t.rows), `graine ${s}`).toBe(0);
    }
  });
  it('le joueur de référence traverse trois portails (jusqu’à 7 km) sur 10 graines', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const g = new Game(seed * 52501);
      while (!g.dead && g.dist < 7000) { botStep(g); g.step(DT); }
      expect(g.dead, `graine ${seed} mort à ${g.dist.toFixed(0)} m`).toBe(false);
    }
  });
});

describe('laser clignotant', () => {
  const laserGame = (z = 40): Game => {
    const g = new Game(1);
    g.track.rows.length = 0; g.track.coins.length = 0;
    g.track.rows.push({ id: 3, z, cells: [null, 'laser', null], gapLen: 3, world: 1, smashed: [false, false, false], safe: 0 });
    return g;
  };
  /** Runs until `z`; `time0` is the game clock when the runner starts. */
  const run = (g: Game, time0: number, until = 60): void => {
    g.time = time0;
    while (!g.dead && g.dist < until) g.step(DT);
  };
  const arrival = (z: number): number => z / 11; // 11 m/s at the start, nearly constant over 40 m

  it('le rythme : allumé 1,25 s sur 2,2 s, avec un décalage propre à chaque rangée', () => {
    const row = { id: 3 };
    let on = 0;
    for (let t = 0; t < LASER.period * 100; t += 0.01) if (laserOn(row, t)) on++;
    expect(on / (LASER.period * 100 * 100)).toBeCloseTo(LASER.on / LASER.period, 1);
    const states = [1, 2, 3, 4, 5, 6].map(id => laserOn({ id }, 0));
    expect(states).toContain(true);
    expect(states).toContain(false); // neighbouring rows do not blink in unison
  });
  it('allumé quand on arrive : mort', () => {
    const g = laserGame();
    let start = 0;
    for (let t = 0; t < LASER.period; t += 0.01) if (laserOn({ id: 3 }, t + arrival(40))) { start = t; break; }
    run(g, start + 0.1);
    expect(g.dead).toBe(true);
    expect(g.fell).toBe(false);
  });
  it('éteint quand on arrive : on passe en courant, comme dans une porte', () => {
    const g = laserGame();
    let start = -1;
    for (let t = 0; t < LASER.period; t += 0.01) if (!laserOn({ id: 3 }, t + arrival(40) - 0.3) && !laserOn({ id: 3 }, t + arrival(40) + 0.3)) { start = t; break; }
    expect(start).toBeGreaterThanOrEqual(0);
    run(g, start);
    expect(g.dead).toBe(false);
  });
  it('allumé mais en plein dash : on traverse sans le détruire', () => {
    let crossedOn = 0;
    for (let off = 0; off < LASER.period; off += 0.15) {
      const g = laserGame();
      g.time = off;
      let dashed = false, onWhileInside = false;
      while (!g.dead && g.dist < 60) {
        if (!dashed && g.dist > 33) { g.act('power'); dashed = true; }
        g.step(DT);
        if (Math.abs(g.dist - 40) < 0.4 && g.dashing && laserOn({ id: 3 }, g.time)) onWhileInside = true;
      }
      if (onWhileInside) { crossedOn++; expect(g.dead, `décalage ${off.toFixed(2)}`).toBe(false); }
    }
    expect(crossedOn).toBeGreaterThan(3);
  });
  it('allumé : on le contourne en changeant de voie', () => {
    const g = laserGame();
    let start = 0;
    for (let t = 0; t < LASER.period; t += 0.01) if (laserOn({ id: 3 }, t + arrival(40))) { start = t; break; }
    g.time = start + 0.1;
    let done = false;
    while (!g.dead && g.dist < 60) { if (!done && g.dist > 25) { g.act('left'); done = true; } g.step(DT); }
    expect(g.dead).toBe(false);
  });
  it('une voie voisine reste libre', () => {
    const g = laserGame();
    g.track.rows[0].cells = ['laser', null, 'laser'];
    let start = 0;
    for (let t = 0; t < LASER.period; t += 0.01) if (laserOn({ id: 3 }, t + arrival(40))) { start = t; break; }
    run(g, start);
    expect(g.dead).toBe(false);
    expect(CFG.laneWidth).toBeGreaterThan(LASER.halfW + CFG.halfW); // a grid never reaches the next lane's runner
    void speedAt;
  });
});
