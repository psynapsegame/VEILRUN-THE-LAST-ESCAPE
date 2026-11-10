import { CFG } from './config';

export type Action = 'left' | 'right' | 'up' | 'down' | 'power';
export type PlayerState = 'run' | 'jump' | 'slide' | 'dead';

/** Runner body: lane position, vertical motion and the run/jump/slide state machine. */
export class Player {
  lane = 0; // -1, 0, 1 (target lane)
  x = 0;
  y = 0;
  vy = 0;
  state: PlayerState = 'run';
  slideLeft = 0;
  /** -1..1 lateral velocity hint, used by the view for leaning. */
  lean = 0;
  private fromX = 0;
  private laneT = 1;
  private jumpBuf = 0;
  private slideBuf = 0;
  /** Set for one update when the corresponding thing happened. */
  justJumped = false;
  justLanded = false;
  justSlid = false;

  get height(): number {
    return this.state === 'slide' ? CFG.slideH : CFG.standH;
  }
  get grounded(): boolean {
    return this.state === 'run' || this.state === 'slide';
  }

  /** Returns true when the action changed something (used for feedback). */
  act(a: Action): boolean {
    if (this.state === 'dead') return false;
    switch (a) {
      case 'left':
      case 'right': {
        const target = this.lane + (a === 'left' ? -1 : 1);
        if (target < -1 || target > 1) return false;
        this.lane = target;
        this.fromX = this.x;
        this.laneT = 0;
        return true;
      }
      case 'up':
        if (this.grounded) this.startJump();
        else this.jumpBuf = CFG.inputBuffer;
        return true;
      case 'down':
        if (this.state === 'jump') {
          this.vy = Math.min(this.vy, CFG.fastFallVel);
          this.slideBuf = 0.4; // dive then slide on landing
        } else this.startSlide();
        return true;
    }
    return false;
  }

  update(dt: number): void {
    this.justJumped = this.justLanded = this.justSlid = false;
    if (this.state === 'dead') return;

    const targetX = this.lane * CFG.laneWidth;
    if (this.laneT < 1) {
      this.laneT = Math.min(1, this.laneT + dt / CFG.laneChangeTime);
      const e = this.laneT * this.laneT * (3 - 2 * this.laneT);
      const nx = this.fromX + (targetX - this.fromX) * e;
      this.lean = Math.max(-1, Math.min(1, (nx - this.x) / dt / 18));
      this.x = nx;
    } else {
      this.x = targetX;
      this.lean = 0;
    }

    this.jumpBuf -= dt;
    this.slideBuf -= dt;

    if (this.state === 'jump') {
      this.vy -= CFG.gravity * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0;
        this.vy = 0;
        this.state = 'run';
        this.justLanded = true;
        if (this.slideBuf > 0) this.startSlide();
        else if (this.jumpBuf > 0) this.startJump();
      }
    } else if (this.state === 'slide') {
      this.slideLeft -= dt;
      if (this.slideLeft <= 0) this.state = 'run';
    }
  }

  private startJump(): void {
    this.state = 'jump';
    this.vy = CFG.jumpVel;
    this.jumpBuf = 0;
    this.justJumped = true;
  }
  private startSlide(): void {
    this.state = 'slide';
    this.slideLeft = CFG.slideTime;
    this.slideBuf = 0;
    this.justSlid = true;
  }
}
