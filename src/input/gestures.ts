import type { Action } from '../sim/player';

/**
 * Touch gesture recogniser, independent from the DOM so it can be unit-tested.
 * A swipe fires as soon as the finger has travelled `threshold` px (no need to
 * lift), then re-arms from the current point so swipes can be chained.
 */
export class GestureRecognizer {
  threshold = 28;
  tapSlop = 14;
  tapTime = 0.25;
  doubleTapTime = 0.32;
  doubleTapDist = 60;
  private id: number | null = null;
  private ox = 0;
  private oy = 0;
  private sx = 0;
  private sy = 0;
  private t0 = 0;
  private swiped = false;
  private lastTapT = -1;
  private lastTapX = 0;
  private lastTapY = 0;

  /** Scale thresholds to the screen (CSS px). */
  resize(w: number, h: number): void {
    this.threshold = Math.max(18, Math.min(40, Math.min(w, h) * 0.055));
  }

  down(id: number, x: number, y: number, t: number): void {
    if (this.id !== null) return; // extra fingers are ignored
    this.id = id;
    this.ox = this.sx = x;
    this.oy = this.sy = y;
    this.t0 = t;
    this.swiped = false;
  }

  move(id: number, x: number, y: number): Action | null {
    if (id !== this.id) return null;
    const dx = x - this.ox;
    const dy = y - this.oy;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    if (Math.max(ax, ay) < this.threshold) return null;
    this.ox = x;
    this.oy = y;
    this.swiped = true;
    return ax > ay ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
  }

  up(id: number, x: number, y: number, t: number): Action | null {
    if (id !== this.id) return null;
    this.id = null;
    if (this.swiped || t - this.t0 > this.tapTime) return null;
    if (Math.hypot(x - this.sx, y - this.sy) > this.tapSlop) return null;
    const isDouble =
      t - this.lastTapT <= this.doubleTapTime &&
      Math.hypot(x - this.lastTapX, y - this.lastTapY) <= this.doubleTapDist;
    if (isDouble) {
      this.lastTapT = -1;
      return 'power';
    }
    this.lastTapT = t;
    this.lastTapX = x;
    this.lastTapY = y;
    return null;
  }

  cancel(id: number): void {
    if (id === this.id) this.id = null;
  }
}
