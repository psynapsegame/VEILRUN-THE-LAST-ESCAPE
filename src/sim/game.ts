import { CFG, OBSTACLE, speedAt } from './config';
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
      if (row.z > this.dist + 2) break;
      for (let l = 0; l < 3; l++) {
        const kind = row.cells[l];
        if (!kind || row.smashed[l]) continue;
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
