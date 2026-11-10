import { describe, expect, it } from 'vitest';
import { COLLAPSE_CELL, collapseSlot, hash, isCollapse } from '../src/view/events';

describe('événements du décor', () => {
  it('les effondrements de colonnes sont rares : au plus un par tranche de 476 m, jamais avant 100 m', () => {
    const found: number[] = [];
    for (let k = 0; k < COLLAPSE_CELL * 400; k++) for (const side of [-1, 1]) if (isCollapse(k, side)) found.push(k);
    expect(found.length).toBe(400); // one per cell, one side only
    expect(Math.min(...found) * 14).toBeGreaterThanOrEqual(100);
    for (let i = 1; i < found.length; i++) expect((found[i] - found[i - 1]) * 14).toBeGreaterThanOrEqual(200);
  });
  it('est déterministe', () => {
    expect(collapseSlot(12)).toEqual(collapseSlot(12));
    expect(hash(5)).toBe(hash(5));
  });
  it('l’espacement moyen est d’environ 476 m', () => {
    const ks = Array.from({ length: 200 }, (_, c) => collapseSlot(c).k);
    const mean = ((ks[199] - ks[0]) * 14) / 199;
    expect(mean).toBeGreaterThan(430);
    expect(mean).toBeLessThan(520);
  });
});
