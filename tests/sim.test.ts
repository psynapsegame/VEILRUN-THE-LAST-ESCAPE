import { describe, expect, it } from 'vitest';
import { CFG, speedAt } from '../src/sim/config';
import { Game } from '../src/sim/game';
import { Player } from '../src/sim/player';
import { TrackGenerator, validateRows, Row } from '../src/sim/track';
import { botStep } from '../src/sim/bot';
import { GestureRecognizer } from '../src/input/gestures';
import { defaultSave, loadSave, recordRun, writeSave } from '../src/save';

const DT = 1 / 120;
const run = (p: Player, s: number) => { for (let t = 0; t < s; t += DT) p.update(DT); };

/** A game whose course is replaced by a single hand-placed row. */
function gameWith(cells: Row['cells'], z = 30): Game {
  const g = new Game(1);
  g.track.rows.length = 0;
  g.track.coins.length = 0;
  g.track.rows.push({ id: 1, z, cells, smashed: [false, false, false], safe: 1 });
  return g;
}
function play(g: Game, until: number, script: (g: Game) => void = () => {}): void {
  while (!g.dead && g.dist < until) { script(g); g.step(DT); }
}

describe('déplacement', () => {
  it('change de voie et reste dans les trois voies', () => {
    const p = new Player();
    expect(p.act('left')).toBe(true);
    expect(p.act('left')).toBe(false);
    run(p, 0.3);
    expect(p.x).toBeCloseTo(-CFG.laneWidth);
    p.act('right'); p.act('right');
    run(p, 0.3);
    expect(p.x).toBeCloseTo(CFG.laneWidth);
    expect(p.act('right')).toBe(false);
  });
  it('saut : apex ~1.9 m, durée ~0.62 s', () => {
    const p = new Player();
    p.act('up');
    let apex = 0, t = 0;
    do { p.update(DT); t += DT; apex = Math.max(apex, p.y); } while (p.state === 'jump');
    expect(apex).toBeGreaterThan(1.8);
    expect(apex).toBeLessThan(2.0);
    expect(t).toBeGreaterThan(0.58);
    expect(t).toBeLessThan(0.68);
  });
  it('glissade : hauteur réduite puis retour à la course', () => {
    const p = new Player();
    p.act('down');
    expect(p.height).toBe(CFG.slideH);
    run(p, CFG.slideTime + 0.05);
    expect(p.state).toBe('run');
    expect(p.height).toBe(CFG.standH);
  });
  it('swipe bas en l’air : plongeon puis glissade', () => {
    const p = new Player();
    p.act('up'); run(p, 0.2); p.act('down');
    let t = 0;
    while (p.state === 'jump') { p.update(DT); t += DT; }
    expect(t).toBeLessThan(0.15);
    expect(p.state).toBe('slide');
  });
  it('saut mis en tampon juste avant l’atterrissage', () => {
    const p = new Player();
    p.act('up'); run(p, 0.55); p.act('up');
    run(p, 0.12);
    expect(p.state).toBe('jump');
    expect(p.vy).toBeGreaterThan(0);
  });
});

describe('collisions', () => {
  it('obstacle bas : mortel sans saut, franchi avec saut', () => {
    const a = gameWith([null, 'low', null]); play(a, 40); expect(a.dead).toBe(true);
    const b = gameWith([null, 'low', null]);
    play(b, 40, g => { if (30 - g.dist < 3.3 && g.player.state === 'run' && g.dist < 30) g.act('up'); });
    expect(b.dead).toBe(false);
  });
  it('obstacle haut : mortel debout ou en sautant, franchi en glissant', () => {
    const a = gameWith([null, 'high', null]); play(a, 40); expect(a.dead).toBe(true);
    const j = gameWith([null, 'high', null]);
    play(j, 40, g => { if (30 - g.dist < 3.3 && g.player.state === 'run') g.act('up'); });
    expect(j.dead).toBe(true);
    const b = gameWith([null, 'high', null]);
    play(b, 40, g => { if (30 - g.dist < 3 && g.player.state === 'run' && g.dist < 30) g.act('down'); });
    expect(b.dead).toBe(false);
  });
  it('obstacle plein : évité par changement de voie uniquement', () => {
    const a = gameWith([null, 'full', null]);
    play(a, 40, g => { if (g.dist > 26 && g.player.state === 'run') g.act('up'); });
    expect(a.dead).toBe(true);
    const b = gameWith([null, 'full', null]);
    let done = false;
    play(b, 40, g => { if (!done && g.dist > 22) { g.act('left'); done = true; } });
    expect(b.dead).toBe(false);
  });
  it('aucun effet tunnel à très grand pas de temps', () => {
    const g = gameWith(['full', 'full', 'full']);
    while (!g.dead && g.dist < 60) g.step(0.25);
    expect(g.dead).toBe(true);
  });
  it('le dash détruit l’obstacle puis se recharge', () => {
    const g = gameWith(['full', 'full', 'full']);
    let done = false;
    play(g, 40, x => { if (!done && x.dist > 25) { x.act('power'); done = true; } });
    expect(g.dead).toBe(false);
    expect(g.track.rows.length === 0 || g.track.rows[0].smashed[1]).toBe(true);
    expect(g.dashCooldown).toBeGreaterThan(0);
    g.act('power');
    expect(g.dashing).toBe(false);
  });
  it('fragments collectés et comptés dans le score', () => {
    const g = gameWith([null, null, null], 500);
    g.track.coins.push({ z: 20, lane: 1, y: 1, taken: false }, { z: 22, lane: 0, y: 1, taken: false });
    play(g, 30);
    expect(g.fragments).toBe(1);
    expect(g.score).toBe(Math.floor(g.dist) + CFG.fragmentScore);
  });
});

describe('génération de parcours', () => {
  it('déterministe pour une même graine', () => {
    const a = new TrackGenerator(42), b = new TrackGenerator(42), c = new TrackGenerator(43);
    a.generateUntil(3000); b.generateUntil(3000); c.generateUntil(3000);
    expect(JSON.stringify(a.rows)).toBe(JSON.stringify(b.rows));
    expect(JSON.stringify(a.rows)).not.toBe(JSON.stringify(c.rows));
  });
  it('toujours jouable : 200 graines × 20 km validés', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const t = new TrackGenerator(seed * 7919);
      t.generateUntil(20000);
      expect(validateRows(t.rows), `graine ${seed}`).toBe(0);
      for (const r of t.rows) expect(r.cells[r.safe]).not.toBe('full');
    }
  });
  it('le validateur détecte un mur infranchissable', () => {
    const t = new TrackGenerator(5);
    t.generateUntil(600);
    t.rows[3].cells = ['full', 'full', 'full'];
    expect(validateRows(t.rows)).toBe(t.rows[3].id);
  });
  it('fenêtre de réaction préservée à toute vitesse', () => {
    const t = new TrackGenerator(9);
    t.generateUntil(20000);
    for (let i = 1; i < t.rows.length; i++) {
      const dt = (t.rows[i].z - t.rows[i - 1].z) / speedAt(t.rows[i].z);
      expect(dt).toBeGreaterThanOrEqual(CFG.minRowTime - 1e-6);
    }
  });
  it('un joueur de référence survit 6 km sur 25 graines (simulation complète)', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const g = new Game(seed * 104729);
      while (!g.dead && g.dist < 6000) { botStep(g); g.step(DT); }
      expect(g.dead, `graine ${seed} mort à ${g.dist.toFixed(0)} m`).toBe(false);
      expect(g.fragments).toBeGreaterThan(100);
      expect(g.track.rows.length).toBeLessThan(40); // culling keeps memory bounded
    }
  });
  it('la vitesse croît et reste bornée', () => {
    expect(speedAt(0)).toBe(CFG.speedStart);
    expect(speedAt(1000)).toBeGreaterThan(speedAt(100));
    expect(speedAt(1e7)).toBeLessThanOrEqual(CFG.speedMax);
  });
});

describe('gestes tactiles', () => {
  const mk = () => { const r = new GestureRecognizer(); r.resize(390, 844); return r; };
  it('swipe déclenché pendant le mouvement, dans les 4 directions', () => {
    const r = mk();
    r.down(1, 100, 100, 0); expect(r.move(1, 110, 100)).toBe(null); expect(r.move(1, 140, 104)).toBe('right');
    expect(r.up(1, 140, 104, 0.1)).toBe(null);
    r.down(1, 100, 100, 1); expect(r.move(1, 60, 95)).toBe('left'); r.up(1, 60, 95, 1.1);
    r.down(1, 100, 100, 2); expect(r.move(1, 104, 60)).toBe('up'); r.up(1, 104, 60, 2.1);
    r.down(1, 100, 100, 3); expect(r.move(1, 96, 140)).toBe('down'); r.up(1, 96, 140, 3.1);
  });
  it('swipes enchaînés sans lever le doigt', () => {
    const r = mk();
    r.down(1, 100, 100, 0);
    expect(r.move(1, 140, 100)).toBe('right');
    expect(r.move(1, 142, 50)).toBe('up');
  });
  it('un long swipe ne change que d’une seule voie', () => {
    const r = mk();
    r.down(1, 40, 400, 0);
    const out = [];
    for (let x = 50; x <= 380; x += 10) out.push(r.move(1, x, 400));
    expect(out.filter(Boolean)).toEqual(['right']);
    r.up(1, 380, 400, 0.2);
    r.down(1, 300, 400, 1);
    expect(r.move(1, 260, 400)).toBe('left'); // a new touch swipes again
  });
  it('un tremblement ou un appui simple ne déclenche rien', () => {
    const r = mk();
    r.down(1, 100, 100, 0); expect(r.move(1, 106, 95)).toBe(null); expect(r.up(1, 106, 95, 0.1)).toBe(null);
  });
  it('double-tap = pouvoir ; taps lents ou éloignés ignorés', () => {
    const r = mk();
    r.down(1, 100, 100, 0); r.up(1, 100, 100, 0.05);
    r.down(1, 104, 102, 0.2); expect(r.up(1, 104, 102, 0.25)).toBe('power');
    r.down(1, 100, 100, 1); r.up(1, 100, 100, 1.05);
    r.down(1, 100, 100, 1.6); expect(r.up(1, 100, 100, 1.65)).toBe(null);
    r.down(1, 300, 600, 3); r.up(1, 300, 600, 3.05);
    r.down(1, 100, 100, 3.2); expect(r.up(1, 100, 100, 3.25)).toBe(null);
  });
  it('un second doigt est ignoré', () => {
    const r = mk();
    r.down(1, 100, 100, 0); r.down(2, 200, 200, 0);
    expect(r.move(2, 300, 200)).toBe(null);
    expect(r.move(1, 60, 100)).toBe('left');
  });
});

describe('sauvegarde', () => {
  const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };
  it('aller-retour et record', () => {
    const s = mem(); const d = defaultSave();
    expect(recordRun(d, 500, 400, 10)).toBe(true);
    expect(recordRun(d, 300, 450, 5)).toBe(false);
    expect(writeSave(s, d)).toBe(true);
    expect(loadSave(s)).toEqual({ v: 1, best: 500, bestDist: 450, fragments: 15, runs: 2, muted: false });
  });
  it('données corrompues ou stockage indisponible : valeurs par défaut', () => {
    const s = mem(); s.setItem('veilrun.save', '{oops');
    expect(loadSave(s)).toEqual(defaultSave());
    s.setItem('veilrun.save', '{"v":1,"best":-5,"fragments":"x"}');
    expect(loadSave(s)).toEqual(defaultSave());
    expect(loadSave(null)).toEqual(defaultSave());
    expect(writeSave({ getItem: () => null, setItem: () => { throw new Error('quota'); } }, defaultSave())).toBe(false);
  });
});
