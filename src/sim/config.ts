/** Gameplay tuning. Units: metres, seconds. The simulation never touches rendering. */
export const CFG = {
  laneWidth: 2.2,
  laneChangeTime: 0.13,
  gravity: 39.5,
  jumpVel: 12.25, // apex ~1.9 m, airtime ~0.62 s
  fastFallVel: -24,
  slideTime: 0.65,
  standH: 1.7,
  slideH: 0.7,
  halfW: 0.35,
  halfD: 0.3,
  speedStart: 11,
  speedMax: 34, // asymptote: about 122 km/h
  speedScale: 2600, // distance constant of the speed curve (25 m/s at 2.5 km, 31 m/s at 5 km)
  dashTime: 0.55,
  dashMult: 1.7,
  dashCooldown: 8,
  inputBuffer: 0.14,
  fragmentScore: 10,
  /** Minimum time between two obstacle rows: longest action + human reaction margin. */
  minRowTime: 0.85,
} as const;

export type Kind = 'low' | 'high' | 'full';

/** Collision volumes per obstacle kind (y range, half depth, half width). */
export const OBSTACLE: Record<Kind, { y0: number; y1: number; halfD: number; halfW: number }> = {
  // Fallen pillar: about 0.63 m high and 1.9 m wide in the model
  low: { y0: 0, y1: 0.62, halfD: 0.35, halfW: 0.85 },
  // Sun gate: its beam starts 1.43 m above the road (the runner slides at 0.7 m and stands at 1.7 m)
  high: { y0: 1.4, y1: 3.2, halfD: 0.35, halfW: 0.8 },
  // The guardian idol is about 1 m wide: the collision matches it, with a little margin in the runner's favour
  full: { y0: 0, y1: 3.2, halfD: 0.45, halfW: 0.62 },
};

/** Base running speed for a travelled distance (monotonic, bounded). */
export function speedAt(dist: number): number {
  return CFG.speedStart + (CFG.speedMax - CFG.speedStart) * (1 - Math.exp(-dist / CFG.speedScale));
}

/** Distance over which the difficulty climbs from 0 to 1. */
export const RAMP = 6000;
/** 0..1 difficulty for a travelled distance: a steady climb over the first 6 km. */
export function difficultyAt(dist: number): number {
  return Math.min(1, Math.max(0, dist / RAMP));
}
/** 0..1 extra pressure after the ramp is over: it keeps rising for 4 more km, so the run never plateaus. */
export function pressureAt(dist: number): number {
  return Math.min(1, Math.max(0, (dist - RAMP) / 4000));
}
