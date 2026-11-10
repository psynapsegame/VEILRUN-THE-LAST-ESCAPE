import { CFG, GAP, LASER, OBSTACLE, laserOn, speedAt } from './config';
import { Action, Player } from './player';
import { Coin, Row, TrackGenerator } from './track';

export type GameEvent =
  | { t: 'jump' | 'land' | 'slide' | 'lane' | 'dash' | 'death' | 'dashReady' }
  | { t: 'coin'; coin: Coin }
  | { t: 'smash'; row: Row; lane: number };

/** One run of LA FUITE. Pure simulation: deterministic for a seed and an input sequence. */
export class Game {
  readonly player = new Player();
  readonly track: TrackGenerator;
  dist = 0;
  speed: number = CFG.speedStart;
  fragments = 0;
  dashLeft = 0;
  dashCooldown = 0;
  time = 0;
  /** True when the run ended by falling into a hole (the body keeps falling: see settle). */
  fell = false;
  /** Events since the last drain; the view and audio consume them. */
  readonly events: GameEvent[] = [];

  constructor(readonly seed: number) {
    this.track = new TrackGenerator(seed);
    this.track.generateUntil(160);
  }

  get dead(): boolean {
    return this.player.state === 'dead';
  }
  get dashing(): boolean {
    return this.dashLeft > 0;
  }
  get score(): number {
    return Math.floor(this.dist) + this.fragments * CFG.fragmentScore;
  }

  act(a: Action): void {
    if (this.dead) return;
    if (a === 'power') {
      if (this.dashCooldown <= 0) {
        this.dashLeft = CFG.dashTime;
        this.dashCooldown = CFG.dashCooldown;
        this.events.push({ t: 'dash' });
      }
      return;
    }
    if (this.player.act(a) && (a === 'left' || a === 'right')) this.events.push({ t: 'lane' });
  }

  /** After a fall into a hole, keeps the body falling while the end-of-run screen comes up. */
  settle(dt: number): void {
    if (!this.fell) return;
    const p = this.player;
    p.vy -= 26 * dt;
    p.y = Math.max(-14, p.y + p.vy * dt);
  }

  /** Is the runner on the ground over the hole in lane `l` of `row`? */
  private overGap(row: { z: number; gapLen: number }, l: number): boolean {
    const p = this.player;
    return (
      p.y <= 0.06 &&
      Math.abs(p.x - (l - 1) * CFG.laneWidth) < GAP.halfW &&
      this.dist > row.z - row.gapLen / 2 + GAP.edge &&
      this.dist < row.z + row.gapLen / 2 - GAP.edge
    );
  }

  step(dt: number): void {
    if (this.dead) return;
    const p = this.player;
    this.time += dt;
    if (this.dashLeft > 0) this.dashLeft -= dt;
    if (this.dashCooldown > 0) {
      this.dashCooldown -= dt;
      if (this.dashCooldown <= 0) this.events.push({ t: 'dashReady' });
    }
    this.speed = speedAt(this.dist) * (this.dashing ? CFG.dashMult : 1);
    const prev = this.dist;
    this.dist += this.speed * dt;
    p.update(dt);
    if (p.justJumped) this.events.push({ t: 'jump' });
    if (p.justLanded) this.events.push({ t: 'land' });
    if (p.justSlid) this.events.push({ t: 'slide' });

    // Obstacles: swept along z so a fast frame can never tunnel through one.
    for (const row of this.track.rows) {
      if (row.z > this.dist + 4) break;
      for (let l = 0; l < 3; l++) {
        const kind = row.cells[l];
        if (!kind || row.smashed[l]) continue;
        if (kind === 'gap') {
          if (this.overGap(row, l)) {
            p.state = 'dead';
            p.vy = -1;
            this.fell = true;
            this.events.push({ t: 'death' });
            return;
          }
          continue;
        }
        if (kind === 'laser') {
          const near = row.z + LASER.halfD >= prev - CFG.halfD && row.z - LASER.halfD <= this.dist + CFG.halfD;
          if (near && !this.dashing && laserOn(row, this.time) && Math.abs(p.x - (l - 1) * CFG.laneWidth) < LASER.halfW + CFG.halfW) {
            p.state = 'dead';
            this.events.push({ t: 'death' });
            return;
          }
          continue;
        }
        const o = OBSTACLE[kind];
        if (row.z + o.halfD < prev - CFG.halfD || row.z - o.halfD > this.dist + CFG.halfD) continue;
        if (Math.abs(p.x - (l - 1) * CFG.laneWidth) >= o.halfW + CFG.halfW) continue;
        if (p.y >= o.y1 || p.y + p.height <= o.y0) continue;
        if (this.dashing) {
          row.smashed[l] = true;
          this.events.push({ t: 'smash', row, lane: l });
        } else {
          p.state = 'dead';
          this.events.push({ t: 'death' });
          return;
        }
      }
    }

    for (const c of this.track.coins) {
      if (c.z > this.dist + 1) break;
      if (c.taken || c.z < prev - 0.8) continue;
      if (Math.abs(p.x - (c.lane - 1) * CFG.laneWidth) > 1 || Math.abs(c.y - (p.y + p.height * 0.5)) > 1.15) continue;
      c.taken = true;
      this.fragments++;
      this.events.push({ t: 'coin', coin: c });
    }

    this.track.cullBefore(this.dist - 25);
    this.track.generateUntil(this.dist + 160);
  }
}
