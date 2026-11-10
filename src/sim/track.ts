import { CFG, Kind, difficultyAt, speedAt } from './config';
import { Rng } from './rng';

export interface Row {
  id: number;
  z: number;
  /** One cell per lane (index 0..2 = lanes -1..1). */
  cells: (Kind | null)[];
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
 * that lane passable, the safe lane moves at most one lane per row, and rows are
 * spaced by time (not distance) so the reaction window never shrinks with speed.
 */
export class TrackGenerator {
  readonly rows: Row[] = [];
  readonly coins: Coin[] = [];
  private rng: Rng;
  private nextZ = 45; // first obstacle distance: gives the player time to settle
  private safe = 1;
  private nextId = 1;

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
    const d = difficultyAt(z);
    const prevSafe = this.safe;
    const roll = r.next();
    if (roll < 0.3) this.safe = Math.max(0, this.safe - 1);
    else if (roll < 0.6) this.safe = Math.min(2, this.safe + 1);

    const cells: (Kind | null)[] = [null, null, null];
    const pAction = 0.25 + 0.4 * d; // chance the safe lane still demands a jump/slide
    const pBlock = 0.4 + 0.4 * d; // chance a side lane is obstructed
    for (let l = 0; l < 3; l++) {
      if (l === this.safe) {
        if (r.next() < pAction) cells[l] = r.next() < 0.5 ? 'low' : 'high';
      } else if (r.next() < pBlock) {
        const k = r.next();
        cells[l] = k < 0.5 ? 'full' : k < 0.75 ? 'low' : 'high';
      }
    }
    this.rows.push({ id: this.nextId++, z, cells, smashed: [false, false, false], safe: this.safe });

    // Fragments lead the eye towards the safe lane, then follow the required move.
    const safeCell = cells[this.safe];
    for (let k = 4; k >= 1; k--) {
      const lane = k >= 3 ? prevSafe : this.safe;
      this.coins.push({ z: z - k * 2, lane, y: 1, taken: false });
    }
    this.coins.push({ z, lane: this.safe, y: safeCell === 'low' ? 2.1 : safeCell === 'high' ? 0.45 : 1, taken: false });

    const gapTime = 1.5 - 0.6 * d + r.next() * 0.3; // 1.5..1.8 s early, 0.9..1.2 s late
    this.nextZ = z + speedAt(z) * Math.max(CFG.minRowTime, gapTime);
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
      if (row.cells[l] === 'full') continue;
      for (let m = 0; m < 3; m++) if (reach[m] && Math.abs(l - m) <= shifts) next[l] = true;
    }
    if (!next.some(Boolean)) return row.id;
    reach = next;
    prevZ = row.z;
  }
  return 0;
}
