import { CFG, Kind, SCHEDULE, difficultyAt, gapLength, portalNear, pressureAt, speedAt, worldAt } from './config';
import { Rng } from './rng';
import { HOLES_FROM, WORLDS, pickBlocker } from './worlds';

export interface Row {
  id: number;
  z: number;
  /** One cell per lane (index 0..2 = lanes -1..1). */
  cells: (Kind | null)[];
  /** Length (m) of the holes of this row. */
  gapLen: number;
  /** 0 = SOLARIS, 1 = NEXUS: decides how the row is dressed and which traps it uses. */
  world: number;
  /** Cells destroyed by a dash. */
  smashed: boolean[];
  /** Lane index the generator guarantees to be survivable. */
  safe: number;
}

export interface Coin {
  z: number;
  lane: number; // index 0..2
  y: number;
  taken: boolean;
}

/**
 * Procedural course generator. It walks a "safe lane" forward: every row keeps
 * that lane passable, and rows are spaced by time (not distance) so the reaction
 * window never shrinks with speed. Difficulty climbs with the distance run and never plateaus:
 *   - the time between rows shrinks from 1.6-1.9 s to the minimum (0.87 s) over 6 km
 *   - side lanes are blocked more often, the safe lane demands a jump or a slide more often
 *   - from 400 m, "bursts" of 2-5 rows at the tightest spacing, followed by a breather
 *   - the safe lane may jump two lanes at once when the gap allows two lane changes
 *   - after a jump comes a slide (and the reverse) more often than not
 *   - past 6 km, bursts get longer and more frequent for another 4 km
 */
export class TrackGenerator {
  readonly rows: Row[] = [];
  readonly coins: Coin[] = [];
  private rng: Rng;
  private nextZ = 45; // first obstacle distance: gives the player time to settle
  private safe = 1;
  private nextId = 1;
  /** Time (s) between the previous row and the next one, as scheduled when the previous row was made. */
  private gapBefore = 3;
  private burstLeft = 0;
  private breather = false;
  private lastAction: Kind | null = null;

  constructor(seed: number) {
    this.rng = new Rng(seed);
  }

  generateUntil(z: number): void {
    while (this.nextZ < z) this.addRow();
  }

  /** Drop everything the player has left behind. */
  cullBefore(z: number): void {
    while (this.rows.length && this.rows[0].z < z) this.rows.shift();
    while (this.coins.length && this.coins[0].z < z) this.coins.shift();
  }

  private addRow(): void {
    const r = this.rng;
    const z = this.nextZ;
    // A dimensional portal: the stretch around it is free, with a line of crystals leading through the ring
    const portal = portalNear(z);
    if (portal !== null) {
      for (let k = -20; k <= 20; k += 4) this.coins.push({ z: portal + k, lane: 1, y: 1, taken: false });
      this.nextZ = portal + SCHEDULE.clear;
      this.gapBefore = 3;
      this.burstLeft = 0;
      this.breather = false;
      this.lastAction = null;
      return;
    }
    const w = worldAt(z);
    const world = WORLDS[w];
    const d = difficultyAt(z);
    const h = pressureAt(z);
    const prevSafe = this.safe;

    // Where the safe lane goes: stay, one lane over, or (when two lane changes fit in the gap) across the road
    const roll = r.next();
    const canCross = this.gapBefore >= 1.08 && z > 500 && (prevSafe === 0 || prevSafe === 2);
    if (canCross && r.next() < 0.1 + 0.3 * d) this.safe = 2 - prevSafe;
    else if (roll < 0.3) this.safe = Math.max(0, this.safe - 1);
    else if (roll < 0.6) this.safe = Math.min(2, this.safe + 1);

    const cells: (Kind | null)[] = [null, null, null];
    const pAction = 0.2 + 0.65 * d; // chance the safe lane still demands a jump/slide
    const pBlock = 0.35 + 0.5 * d; // chance a side lane is obstructed
    for (let l = 0; l < 3; l++) {
      if (l === this.safe) {
        if (r.next() < pAction) {
          // After a jump comes a slide (and the reverse) more often than not: no rhythm to settle into
          // 'low' and 'gap' are both jumps, 'high' is the slide
          const jump = (): Kind => (z > HOLES_FROM && r.next() < world.holeOnSafe ? 'gap' : 'low');
          const lastJump = this.lastAction === 'low' || this.lastAction === 'gap';
          cells[l] = this.lastAction && r.next() < 0.65 ? (lastJump ? 'high' : jump()) : r.next() < 0.5 ? jump() : 'high';
        }
      } else if (r.next() < pBlock) {
        cells[l] = pickBlocker(world, r.next(), z);
      }
    }
    // Now and then the whole causeway is open: a chasm to jump, in any lane
    if (z > 600 && r.next() < (0.04 + 0.08 * d) * world.chasm) { cells[0] = cells[1] = cells[2] = 'gap'; }
    this.lastAction = cells[this.safe] as Kind | null;
    this.rows.push({ id: this.nextId++, z, cells, gapLen: gapLength(speedAt(z)), world: w, smashed: [false, false, false], safe: this.safe });

    // Fragments lead the eye towards the safe lane, then follow the required move.
    const safeCell = cells[this.safe];
    for (let k = 4; k >= 1; k--) {
      const lane = k >= 3 ? prevSafe : this.safe;
      this.coins.push({ z: z - k * 2, lane, y: 1, taken: false });
    }
    this.coins.push({ z, lane: this.safe, y: safeCell === 'low' || safeCell === 'gap' ? 2.1 : safeCell === 'high' ? 0.45 : 1, taken: false });

    // Spacing in seconds: a steady squeeze, with bursts at the tightest spacing and breathers after them
    const tight = CFG.minRowTime * 1.02; // a hair above the minimum: speed grows a little between two rows
    let gap: number;
    if (this.burstLeft > 0) {
      gap = tight + r.next() * 0.1 * (1 - d) + (1 - d) * 0.25;
      this.burstLeft--;
      this.breather = this.burstLeft === 0;
    } else if (this.breather) {
      gap = 1.9 - 0.5 * d + r.next() * 0.3 - 0.5 * h; // breathers shrink too once the ramp is over
      this.breather = false;
    } else {
      gap = 1.6 - 0.73 * d + r.next() * (0.3 - 0.2 * d);
      if (z > 400 && r.next() < 0.1 + 0.3 * d + 0.35 * h) this.burstLeft = 2 + (r.next() < 0.3 + 0.4 * d ? 1 : 0) + (r.next() < 0.5 * h + 0.2 * d ? 1 : 0) + (h > 0.5 && r.next() < 0.4 ? 1 : 0);
    }
    gap = Math.max(tight, gap);
    this.gapBefore = gap;
    this.nextZ = z + speedAt(z) * gap;
  }
}

/**
 * Independent structural validation used by the tests: proves a route exists
 * through `rows` given how many lanes a runner can cross between two rows.
 * Returns the id of the first impossible row, or 0 when the course is playable.
 */
export function validateRows(rows: Row[]): number {
  let reach = [true, true, true];
  let prevZ = -Infinity;
  for (const row of rows) {
    const dt = (row.z - prevZ) / speedAt(row.z);
    if (dt < CFG.minRowTime - 1e-6) return row.id;
    // Time left after recovering from the previous action, spent on lane changes.
    const shifts = Math.min(2, Math.floor((dt - CFG.slideTime) / (CFG.laneChangeTime + 0.07)));
    const next = [false, false, false];
    for (let l = 0; l < 3; l++) {
      if (row.cells[l] === 'full' || row.cells[l] === 'laser') continue; // a laser may be on: count it as a wall
      for (let m = 0; m < 3; m++) if (reach[m] && Math.abs(l - m) <= shifts) next[l] = true;
    }
    if (!next.some(Boolean)) return row.id;
    reach = next;
    prevZ = row.z;
  }
  return 0;
}
