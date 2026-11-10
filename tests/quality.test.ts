import { describe, expect, it } from 'vitest';
import { QualityGovernor } from '../src/quality';

/** Feeds `seconds` of frames of `ms` each; returns every tier change in order. */
function feed(g: QualityGovernor, seconds: number, ms: number): number[] {
  const out: number[] = [];
  for (let t = 0; t < seconds; t += ms / 1000) {
    const c = g.frame(ms, ms / 1000);
    if (c !== null) out.push(c);
  }
  return out;
}

describe('réglage automatique de la qualité', () => {
  it('ne mesure rien pendant le chargement (la résolution ne chute pas au démarrage)', () => {
    const g = new QualityGovernor(4, 1, 6);
    expect(feed(g, 5.5, 80)).toEqual([]);
    expect(g.tier).toBe(1);
  });
  it('un accroc isolé ne change rien', () => {
    const g = new QualityGovernor(4, 1, 0);
    feed(g, 2, 16.7);
    expect(g.frame(220, 0.22)).toBe(null);
    expect(feed(g, 10, 16.7)).toEqual([]);
  });
  it('une lenteur durable baisse d’un seul cran, puis laisse le temps de juger', () => {
    const g = new QualityGovernor(4, 1, 0);
    expect(feed(g, 6, 33)).toEqual([2]);
  });
  it('ne descend jamais sous le niveau le plus léger', () => {
    const g = new QualityGovernor(4, 1, 0);
    feed(g, 120, 40);
    expect(g.tier).toBe(4);
  });
  it('remonte après 25 s de fluidité', () => {
    const g = new QualityGovernor(4, 3, 0);
    expect(feed(g, 20, 16.7)).toEqual([]);
    expect(feed(g, 12, 16.7)).toEqual([2]);
  });
  it('un niveau meilleur qui ne tient pas est abandonné pour la session (pas de va-et-vient)', () => {
    const g = new QualityGovernor(4, 2, 0);
    expect(feed(g, 28, 16.7)).toEqual([1]);
    expect(feed(g, 4.5, 33)).toEqual([2]); // too heavy: back to tier 2, and fluid again from there
    expect(g.best).toBe(2);
    expect(feed(g, 120, 16.7)).toEqual([]);
    expect(g.tier).toBe(2);
  });
  it('ne remonte pas au-delà du niveau 0', () => {
    const g = new QualityGovernor(4, 0, 0);
    expect(feed(g, 120, 16.7)).toEqual([]);
  });
});
