import { WORLDS } from './worlds';

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

/**
 * 'gap' is a hole in the causeway: jump over it, or fall.
 * 'laser' is a blinking laser grid (NEXUS): lethal only while it is on, and the dash passes through it.
 * The others are solid obstacles.
 */
export type Kind = 'low' | 'high' | 'full' | 'gap' | 'laser';
export type SolidKind = 'low' | 'high' | 'full';

/** Collision volumes per obstacle kind (y range, half depth, half width). */
export const OBSTACLE: Record<SolidKind, { y0: number; y1: number; halfD: number; halfW: number }> = {
  // Fallen pillar: about 0.63 m high and 1.9 m wide in the model
  low: { y0: 0, y1: 0.62, halfD: 0.35, halfW: 0.85 },
  // Sun gate: its beam starts 1.43 m above the road (the runner slides at 0.7 m and stands at 1.7 m)
  high: { y0: 1.4, y1: 3.2, halfD: 0.35, halfW: 0.8 },
  // The guardian idol is about 1 m wide: the collision matches it, with a little margin in the runner's favour
  full: { y0: 0, y1: 3.2, halfD: 0.45, halfW: 0.62 },
};

/** Laser grid: on for 1.25 s every 2.2 s, a different phase per row. It never sits in the safe lane. */
export const LASER = { period: 2.2, on: 1.25, halfD: 0.25, halfW: 0.95 };
export function laserOn(row: { id: number }, time: number): boolean {
  return (time + row.id * 0.61) % LASER.period < LASER.on;
}

/**
 * Dimensional portals. The first one is at `first` metres, then one every `every` metres; each one switches
 * between SOLARIS (world 0) and NEXUS (world 1). No obstacle within `clear` metres of a portal.
 * (`?portal=300` in the address bar moves the first portal closer, for testing.)
 */
export const SCHEDULE = { first: 1500, every: 2000, clear: 32 };
/** Which world a given distance belongs to. */
export function worldAt(z: number): number {
  return z < SCHEDULE.first ? 0 : (Math.floor((z - SCHEDULE.first) / SCHEDULE.every) + 1) % WORLDS.length;
}
/** Position of the portal nearest to `z`. */
export function portalNearest(z: number): number {
  return SCHEDULE.first + Math.max(0, Math.round((z - SCHEDULE.first) / SCHEDULE.every)) * SCHEDULE.every;
}
/** The portal at `z` +- margin (default: the clear zone), or null. */
export function portalNear(z: number, margin = SCHEDULE.clear): number | null {
  const p = portalNearest(z);
  return Math.abs(z - p) < margin ? p : null;
}

/** A hole is 2 m wide (a lane is 2.2 m) and the runner falls when he is on the ground over it. */
export const GAP = { halfW: 1.0, edge: 0.15 };
/**
 * Length (m) of a hole at a given speed: a quarter of a second of running, so a jump (0.62 s in the air)
 * always leaves a 0.37 s window to take off, at any speed.
 */
export function gapLength(speed: number): number {
  return Math.min(7, Math.max(2.6, 0.25 * speed));
}

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
