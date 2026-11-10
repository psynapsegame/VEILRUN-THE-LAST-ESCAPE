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
  speedMax: 25,
  speedScale: 1400, // distance constant of the speed curve
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

/** 0..1 difficulty for a travelled distance. */
export function difficultyAt(dist: number): number {
  return Math.min(1, Math.max(0, dist / 2500));
}
