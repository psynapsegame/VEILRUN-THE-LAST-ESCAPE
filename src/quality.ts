/**
 * Decides when to move between graphics tiers (0 = best … max = lightest).
 * Learnt from the first on-device test: the resolution was cut during loading and never came back.
 *  - nothing is measured during a warm-up (loading screen, shader compilation, run start, right after a change);
 *  - a tier is dropped only after 2.5 s of sustained slow frames, one step at a time;
 *  - a better tier is tried again after 25 s of smooth frames, and never again if it failed within 15 s.
 */
export class QualityGovernor {
  tier: number;
  /** Best (lowest) tier still worth trying: raised when an attempt at a better tier did not hold. */
  best = 0;
  private ema = 16.7;
  private slow = 0;
  private fast = 0;
  private warm: number;
  private sinceUp = 1e9;

  constructor(readonly maxTier: number, start: number, warmup = 3) {
    this.tier = Math.min(maxTier, Math.max(0, start));
    this.warm = warmup;
  }
  /** Smoothed frame time in ms. */
  get ms(): number {
    return this.ema;
  }
  /** Ignore the next `seconds` of frames. */
  rewarm(seconds = 3): void {
    this.warm = Math.max(this.warm, seconds);
    this.slow = this.fast = 0;
    this.ema = 16.7;
  }
  /** Feed one frame: `ms` its duration, `dt` the same in seconds. Returns the new tier when it changed. */
  frame(ms: number, dt: number): number | null {
    this.sinceUp += dt;
    if (this.warm > 0) {
      this.warm -= dt;
      return null;
    }
    this.ema += (Math.min(ms, 60) - this.ema) * 0.06;
    if (this.ema > 20.5) { this.slow += dt; this.fast = 0; }
    else if (this.ema < 17.4) { this.fast += dt; this.slow = 0; }
    else this.slow = this.fast = 0;
    if (this.slow > 2.5 && this.tier < this.maxTier) {
      if (this.sinceUp < 15) this.best = this.tier + 1; // the tier we just tried does not hold
      this.tier++;
      this.rewarm();
      return this.tier;
    }
    if (this.fast > 25 && this.tier > this.best) {
      this.tier--;
      this.sinceUp = 0;
      this.rewarm();
      return this.tier;
    }
    return null;
  }
}
