/** Small deterministic hash in [0, 1): the same slot always gets the same answer. */
export function hash(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/** Slots per collapse cell: 34 slots of 14 m = 476 m. */
export const COLLAPSE_CELL = 34;

/**
 * A collapsing column is a set piece, not a habit: at most ONE per cell of 476 m, on one side of the road,
 * never in the first 100 m. (It also needs a suitable piece of scenery, so some cells have none.)
 */
export function collapseSlot(cell: number): { k: number; side: -1 | 1 } {
  return { k: cell * COLLAPSE_CELL + 8 + Math.floor(hash(cell * 7 + 1) * 18), side: hash(cell * 7 + 2) < 0.5 ? -1 : 1 };
}

export function isCollapse(k: number, side: number): boolean {
  const e = collapseSlot(Math.floor(k / COLLAPSE_CELL));
  return e.k === k && e.side === side;
}
