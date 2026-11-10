import type { Kind } from './config';

/**
 * A world is data: which traps its generator may place and how often. The generator, the portal schedule and
 * the audio/UI read this table, so adding a world means adding an entry here (plus its look in src/view),
 * not branching the generator. Gameplay-relevant rules only: nothing here knows about rendering.
 */
export interface WorldDef {
  /** Stable identifier (saves, collection, missions). */
  readonly id: string;
  /** Name shown on the announcement banner. */
  readonly name: string;
  /**
   * What fills a blocked side lane: a draw k in [0,1) picks the first entry whose cumulative threshold is above k.
   * Entries with a `minZ` are replaced by `fallback` before that distance (holes never appear in the first metres).
   */
  readonly blockers: readonly { upTo: number; kind: Kind }[];
  /** Chance that a jump on the safe lane is a hole rather than a low barrier (after `HOLES_FROM` metres). */
  readonly holeOnSafe: number;
  /** Multiplier of the chance of a full-width chasm row. */
  readonly chasm: number;
}

/** First distance (m) at which holes may appear. */
export const HOLES_FROM = 120;
/** Blocker used instead of a hole before HOLES_FROM. */
export const EARLY_FALLBACK: Kind = 'full';

export const WORLDS: readonly WorldDef[] = [
  {
    id: 'solaris', name: 'SOLARIS',
    blockers: [{ upTo: 0.45, kind: 'full' }, { upTo: 0.65, kind: 'low' }, { upTo: 0.85, kind: 'high' }, { upTo: 1, kind: 'gap' }],
    holeOnSafe: 0.4, chasm: 1,
  },
  {
    id: 'nexus', name: 'NEXUS',
    // Half of the walls become blinking lasers, and more holes open
    blockers: [{ upTo: 0.25, kind: 'full' }, { upTo: 0.55, kind: 'laser' }, { upTo: 0.7, kind: 'low' }, { upTo: 0.85, kind: 'high' }, { upTo: 1, kind: 'gap' }],
    holeOnSafe: 0.55, chasm: 1.6,
  },
];

/** Picks what fills a blocked side lane in `world`, given a uniform draw `k` and the distance `z`. */
export function pickBlocker(world: WorldDef, k: number, z: number): Kind {
  for (const b of world.blockers) {
    if (k < b.upTo) return b.kind === 'gap' && z <= HOLES_FROM ? EARLY_FALLBACK : b.kind;
  }
  return world.blockers[world.blockers.length - 1].kind;
}
