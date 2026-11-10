import * as THREE from 'three';
import type { Kind } from '../sim/config';
import { Builder, box } from './build';
import { PAL } from './palette';

/**
 * SOLARIS architecture kit. Every piece is built from architectural parts
 * (profiled columns, battered walls, cornices, stairs, dentils) rather than
 * bare boxes. Side pieces are modelled for the left of the road: local +x
 * faces the road, the piece extends towards -x, and y = 0 is road level.
 */
const DEPTH = 8; // the city floor lies this far below the causeway

const cyl = (r: number, h: number, seg = 12) => new THREE.CylinderGeometry(r, r, h, seg);

/** Square frustum (battered wall / tower): w x d at the base, scaled by `taper` at the top. */
function frustum(w: number, d: number, h: number, taper: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(0.7071 * taper, 0.7071, h, 4, 1).toNonIndexed();
  g.rotateY(Math.PI / 4);
  g.scale(w, 1, d);
  g.computeVertexNormals();
  return g;
}

/** Papyrus-style column: plinth, swelling shaft, gold collar, flared bell capital, abacus. */
function column(b: Builder, x: number, z: number, h: number, r: number, y0 = 0, color = PAL.stoneLight): void {
  const p: [number, number][] = [
    [0, 0], [r * 1.3, 0], [r * 1.3, 0.22], [r * 1.08, 0.3], [r * 1.04, 0.5], [r, h * 0.3], [r * 0.93, h * 0.6],
    [r * 0.8, h * 0.8], [r * 0.84, h * 0.83], [r * 1.02, h * 0.89], [r * 1.36, h * 0.97], [r * 1.42, h], [0, h],
  ];
  b.add(new THREE.LatheGeometry(p.map(q => new THREE.Vector2(q[0], q[1])), 14), color, x, y0, z);
  for (const k of [0.755, 0.79]) b.add(cyl(r * 0.86, 0.07 * h * 0.12 + 0.05, 14), PAL.gold, x, y0 + h * k, z);
  b.add(box(r * 2.5, 0.32, r * 2.5), PAL.stone, x, y0 + h + 0.16, z);
}

/** Cavetto cornice crowning a wall of footprint w (x) by d (z), starting at height y. Returns its height. */
function cornice(b: Builder, x: number, y: number, z: number, w: number, d: number): number {
  b.add(box(w + 0.25, 0.22, d + 0.25), PAL.stone, x, y + 0.11, z)
    .add(box(w + 0.6, 0.26, d + 0.6), PAL.stoneLight, x, y + 0.35, z)
    .add(box(w + 1.0, 0.3, d + 1.0), PAL.stone, x, y + 0.63, z)
    .add(box(w + 1.1, 0.1, d + 1.1), PAL.gold, x, y + 0.83, z);
  return 0.88;
}

/** A row of dentil blocks along z on a face looking towards +x. */
function dentils(b: Builder, x: number, y: number, z0: number, len: number, n: number, color = PAL.stoneLight): void {
  const step = len / n;
  for (let i = 0; i < n; i++) b.add(box(0.22, 0.3, step * 0.55), color, x, y, z0 - len / 2 + step * (i + 0.5));
}

/** Staircase climbing away from the road, starting at x0. */
function stairs(b: Builder, x0: number, n: number, rise: number, run: number, width: number, z = 0): void {
  for (let i = 0; i < n; i++) b.add(box(run, rise * (i + 1), width), i % 2 ? PAL.stone : PAL.stoneLight, x0 - run * (i + 0.5), (rise * (i + 1)) / 2, z);
}

/** Platform carrying a side piece, rooted in the city floor far below. */
function platform(b: Builder, depth = 10.5, width = 15): void {
  b.add(box(width, DEPTH, depth), PAL.stoneDark, 3 - width / 2, -DEPTH / 2, 0)
    .add(box(width + 0.3, 0.3, depth + 0.3), PAL.stone, 3 - width / 2, -0.15, 0)
    .add(box(0.2, 0.5, depth + 0.3), PAL.stoneLight, 3.05, -0.55, 0);
  dentils(b, 3.1, -1.1, 0, depth, 12, PAL.stone);
}

function obelisk(b: Builder, x: number, z: number, h: number, w: number, y0 = 0): void {
  b.add(box(w * 2.2, 0.5, w * 2.2), PAL.stoneDark, x, y0 + 0.25, z)
    .add(box(w * 1.7, 0.5, w * 1.7), PAL.stone, x, y0 + 0.75, z)
    .add(frustum(w, w, h, 0.62), PAL.stoneLight, x, y0 + 1 + h / 2, z)
    .add(frustum(w * 0.66, w * 0.66, 0.12, 1), PAL.gold, x, y0 + 1 + h * 0.86, z)
    .add(frustum(w * 0.62, w * 0.62, w * 0.9, 0.02), PAL.gold, x, y0 + 1 + h + w * 0.45, z);
}

function palm(b: Builder, x: number, z: number, h: number, lean: number, y0 = 0): void {
  const n = 7;
  let px = x, py = y0;
  for (let i = 0; i < n; i++) {
    const seg = h / n, a = lean * (i / n);
    b.add(new THREE.CylinderGeometry(0.2 - i * 0.012, 0.25 - i * 0.012, seg * 1.08, 8), i % 2 ? PAL.trunk : PAL.trunkDark, px + Math.sin(a) * seg * 0.5, py + seg * 0.5, z, 0, 0, -a);
    px += Math.sin(a) * seg;
    py += Math.cos(a) * seg;
  }
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2, droop = 1.75 + (i % 3) * 0.12;
    b.add(new THREE.ConeGeometry(0.5, 3.6, 4), i % 2 ? PAL.leaf : PAL.leafLight, px + Math.cos(a) * 1.45, py - 0.15 - (i % 3) * 0.2, z + Math.sin(a) * 1.45, 0, -a, -droop, [1, 1, 0.14]);
  }
  b.add(new THREE.SphereGeometry(0.36, 8, 6), PAL.trunkDark, px, py, z);
}

/** Great brazier; returns nothing, the flame halo is added by the scene at y = 5.2. */
function brazier(b: Builder, x: number, z: number): void {
  b.add(box(2.4, 0.5, 2.4), PAL.stoneDark, x, 0.25, z).add(box(1.8, 0.5, 1.8), PAL.stone, x, 0.75, z);
  const stem: [number, number][] = [[0, 0], [0.55, 0], [0.42, 0.3], [0.3, 1.2], [0.36, 2.2], [0.5, 2.6], [0, 2.6]];
  b.add(new THREE.LatheGeometry(stem.map(q => new THREE.Vector2(q[0], q[1])), 12), PAL.stoneLight, x, 1, z);
  const bowl: [number, number][] = [[0, 0], [0.5, 0], [1.1, 0.35], [1.45, 0.85], [1.35, 0.9], [0, 0.45]];
  b.add(new THREE.LatheGeometry(bowl.map(q => new THREE.Vector2(q[0], q[1])), 16), PAL.gold, x, 3.6, z);
  b.add(new THREE.ConeGeometry(0.75, 1.9, 7), PAL.fire, x, 5.1, z).add(new THREE.ConeGeometry(0.4, 1.3, 6), PAL.ember, x + 0.1, 5.0, z + 0.05);
}

/** Where a cloth banner hangs: top-centre position, size, facing (rotation about Y) and colour index. */
export type Anchor = [x: number, y: number, z: number, w: number, h: number, ry: number, colour: number];
const ROAD = Math.PI / 2; // facing the road

/** A free-standing column that can topple (collapse set pieces). */
export function columnGeometry(): THREE.BufferGeometry {
  const b = new Builder();
  column(b, 0, 0, 6.8, 0.55);
  return b.build();
}

/** Index of the bridge pier in `sideProps().geos`; the pieces before it are the city blocks. */
export const BRIDGE = 9;
/** City blocks that carry something fragile (statues) and never host a collapsing column. */
export const NO_COLLAPSE = new Set([7, 8]);

/** Rectangles of the painted decal sheet (src/assets/art/frescoes.webp): mural on top, carved frieze below. */
const MURAL = [0, 0.5, 1, 1] as const;
const FRIEZE = [0, 0, 1, 0.5] as const;

/**
 * Where the sculpted statues stand. `index` is the piece in `sideProps().geos` (or in `farBuildings()` when
 * `far`); x, y, z are in the piece's local frame (+x towards the road); statues face +z, towards the runner.
 */
export interface StatuePlacement {
  id: 'colossus' | 'sphinx';
  far: boolean;
  index: number;
  x: number;
  y: number;
  z: number;
  scale: number;
  ry: number;
}
export const STATUES: StatuePlacement[] = [
  { id: 'colossus', far: false, index: 4, x: -4.2, y: 0.9, z: 0, scale: 7, ry: 0.3 },
  { id: 'sphinx', far: false, index: 8, x: -1.7, y: 0.82, z: 0, scale: 4.8, ry: 0.12 },
  { id: 'colossus', far: true, index: 2, x: 0, y: 4.9, z: 0, scale: 12.5, ry: 0.3 },
];

/** Roadside pieces. `fire[i]` is the flame height of piece i (0 = none), `banners[i]` its cloth anchors. */
export function sideProps(): { geos: THREE.BufferGeometry[]; fire: number[]; banners: Anchor[][] } {
  const geos: THREE.BufferGeometry[] = [];
  const fire: number[] = [];
  const banners: Anchor[][] = [];
  const push = (b: Builder, f = 0, a: Anchor[] = []) => { geos.push(b.build()); fire.push(f); banners.push(a); };

  { // 0: colonnade in front of a temple wall
    const b = new Builder();
    platform(b);
    for (const z of [-3.6, 0, 3.6]) column(b, 0.4, z, 7.2, 0.6);
    b.add(box(1.7, 0.9, 10), PAL.stoneLight, 0.4, 7.97, 0);
    dentils(b, 1.3, 8.1, 0, 9.6, 16);
    cornice(b, 0.4, 8.42, 0, 1.7, 10);
    b.add(frustum(2.2, 10.4, 9.3, 0.9), PAL.stone, -4.2, 4.65, 0);
    b.add(box(0.3, 4.6, 2.4), PAL.shadow, -3.12, 2.3, 0).add(box(0.5, 0.5, 3.2), PAL.stoneLight, -3.05, 4.85, 0).add(box(0.52, 0.12, 3.4), PAL.gold, -3.05, 5.16, 0);
    cornice(b, -4.2, 9.3, 0, 2, 9.4);
    b.add(box(3.6, 0.5, 9.6), PAL.stoneDark, -1.9, 8.2, 0); // roof slab between colonnade and wall
    b.panel(-3.14, 6.55, 0, 9.2, 2.3, MURAL);
    push(b, 0, [[1.3, 7.4, -1.8, 1.3, 3.9, ROAD, 2], [1.3, 7.4, 1.8, 1.3, 3.9, ROAD, 2]]);
  }
  { // 1: great brazier flanked by small obelisks
    const b = new Builder();
    platform(b);
    brazier(b, 0, 0);
    obelisk(b, -1.5, -4, 4.2, 0.8);
    obelisk(b, -1.5, 4, 4.2, 0.8);
    b.add(box(0.8, 3.6, 10), PAL.stone, -5.5, 1.8, 0);
    dentils(b, -5.05, 3.4, 0, 9.6, 14);
    cornice(b, -5.5, 3.6, 0, 0.8, 10);
    b.panel(-5.07, 1.65, 0, 8.8, 2.2, FRIEZE);
    push(b, 5.2);
  }
  { // 2: grand staircase rising to a portico
    const b = new Builder();
    platform(b, 10.5, 17);
    stairs(b, 1.6, 9, 0.34, 0.62, 8.4);
    b.add(box(8.5, 3.06, 10.4), PAL.stone, -8.2, 1.53, 0);
    for (const z of [-4.6, 4.6]) b.add(box(5.8, 3.4, 0.9), PAL.stoneDark, -1.3, 1.7, z).add(box(1.3, 0.5, 1.3), PAL.gold, 1.2, 3.65, z);
    for (const z of [-3.3, -1.1, 1.1, 3.3]) column(b, -5.4, z, 6.4, 0.52, 3.06);
    b.add(box(1.5, 0.8, 9.2), PAL.stoneLight, -5.4, 10.18, 0);
    cornice(b, -5.4, 10.58, 0, 1.5, 9.2);
    b.add(frustum(2.4, 10.2, 10.5, 0.9), PAL.stone, -9.6, 8.3, 0);
    b.add(box(0.3, 4.4, 2.2), PAL.shadow, -8.42, 5.26, 0);
    b.add(new THREE.CylinderGeometry(1.2, 1.2, 0.2, 20), PAL.gold, -8.5, 10.4, 0, 0, 0, Math.PI / 2);
    cornice(b, -9.6, 13.55, 0, 2.2, 9.2);
    push(b, 0, [[-8.35, 12.4, -3.3, 2.0, 6.0, ROAD, 0], [-8.35, 12.4, 3.3, 2.0, 6.0, ROAD, 0]]);
  }
  { // 3: tall obelisk before a low sanctuary wall
    const b = new Builder();
    platform(b);
    obelisk(b, -0.4, 0, 11, 1.5);
    b.add(box(1, 3, 10), PAL.stone, -5, 1.5, 0);
    dentils(b, -4.45, 2.75, 0, 9.6, 14);
    cornice(b, -5, 3, 0, 1, 10);
    for (const z of [-3.6, 3.6]) column(b, -2.6, z, 3.4, 0.4);
    b.panel(-4.47, 1.5, 0, 8.8, 2.2, FRIEZE);
    push(b);
  }
  { // 4: seated colossus
    const b = new Builder();
    platform(b);
    b.add(box(8.8, 0.8, 10.2), PAL.stoneDark, -4.2, 0.4, 0).add(box(9, 0.14, 10.4), PAL.gold, -4.2, 0.85, 0);
    for (const z of [-4.8, 4.8]) b.add(box(0.6, 0.5, 0.6), PAL.stone, 0.45, 0.25, z); // plinth corners towards the road
    push(b);
  }
  { // 5: palm garden with planters
    const b = new Builder();
    platform(b);
    palm(b, -0.2, -3, 7.5, 0.5);
    palm(b, -2.6, 2.4, 9, -0.35);
    palm(b, -5.2, -1.2, 6.5, 0.25);
    for (const [px, pz, r] of [[0.6, 2.6, 0.9], [-3.8, -3.6, 1.1], [-1.2, 0, 0.7]] as const) {
      b.add(cyl(r + 0.25, 0.5, 12), PAL.stone, px, 0.25, pz).add(cyl(r + 0.32, 0.1, 12), PAL.gold, px, 0.52, pz);
      b.add(new THREE.SphereGeometry(r, 10, 7), PAL.leaf, px, 0.75, pz, 0, 0, 0, [1, 0.6, 1]);
    }
    push(b);
  }
  { // 6: ruins — broken columns and fallen blocks
    const b = new Builder();
    platform(b);
    column(b, 0.2, -3.8, 6.8, 0.58);
    for (const [px, pz, h] of [[0.2, 0, 2.6], [0.2, 3.8, 4.1], [-3, -2, 1.5]] as const) {
      b.add(box(1.6, 0.25, 1.6), PAL.stone, px, 0.12, pz).add(new THREE.CylinderGeometry(0.5, 0.58, h, 14), PAL.stoneLight, px, 0.25 + h / 2, pz);
    }
    b.add(new THREE.CylinderGeometry(0.5, 0.56, 3, 14), PAL.stoneLight, -2.6, 0.55, 2.6, 0, 0.5, Math.PI / 2)
      .add(box(1.3, 0.9, 1.1), PAL.stoneDark, -1.6, 0.45, -4.2, 0.1, 0.6, 0.15)
      .add(box(0.9, 0.6, 0.8), PAL.stone, -4.4, 0.3, 0.2, 0, 1, 0.2)
      .add(box(2.4, 0.7, 1.2), PAL.stoneLight, -4.6, 0.6, -3.4, 0.25, 0.3, 0);
    push(b);
  }
  { // 7: no platform — a watch tower rising from the city floor, with open views on both sides
    const b = new Builder();
    b.add(frustum(5.6, 5.6, DEPTH + 13, 0.78), PAL.stone, -1.5, (13 - DEPTH) / 2, 0);
    b.add(box(4.9, 0.3, 4.9), PAL.gold, -1.5, 7.2, 0);
    cornice(b, -1.5, 13, 0, 4.2, 4.2);
    for (const [px, pz] of [[-3.2, -1.7], [-3.2, 1.7], [0.2, -1.7], [0.2, 1.7]] as const) column(b, px, pz, 3, 0.3, 13.88);
    b.add(frustum(5, 5, 1.6, 0.05), PAL.gold, -1.5, 18, 0);
    push(b, 0, [[1.05, 12.4, 0, 2.3, 7.0, ROAD, 0]]);
  }
  { // 8: sphinx terrace — a guardian on a plinth before a battered wall
    const b = new Builder();
    platform(b);
    b.add(box(5.4, 0.7, 10.2), PAL.stoneDark, -1.7, 0.35, 0).add(box(5.6, 0.12, 10.4), PAL.gold, -1.7, 0.76, 0);
    b.add(frustum(1.6, 10.2, 7.5, 0.9), PAL.stone, -7.4, 3.75, 0);
    dentils(b, -6.6, 7.2, 0, 9.6, 14);
    cornice(b, -7.4, 7.5, 0, 1.4, 9.4);
    for (const z of [-4.4, 4.4]) obelisk(b, -4.9, z, 4.2, 0.55);
    push(b, 0, [[-6.55, 6.8, -2.6, 1.4, 4.2, ROAD, 0], [-6.55, 6.8, 2.6, 1.4, 4.2, ROAD, 2]]);
  }
  { // 9 (BRIDGE): piers carrying the causeway over the void, with lamp obelisks
    const b = new Builder();
    for (const z of [-5, 5]) {
      b.add(frustum(2.6, 2.6, DEPTH + 0.5, 0.8), PAL.stone, 2.3, (0.5 - DEPTH) / 2, z).add(box(2.5, 0.25, 2.5), PAL.gold, 2.3, 0.62, z);
      obelisk(b, 2.3, z, 2.8, 0.5, 0.7);
    }
    b.add(box(1.5, 1.4, 10), PAL.stoneDark, 2.3, -1.6, 0).add(box(1.7, 0.2, 10), PAL.stoneLight, 2.3, -0.8, 0);
    push(b);
  }
  return { geos, fire, banners };
}

/** Monumental gateway spanning the road: two battered pylon towers, a lintel and a winged sun. */
export function gateGeometry(): THREE.BufferGeometry {
  const b = new Builder();
  for (const s of [-1, 1]) {
    b.add(frustum(5.4, 3.4, DEPTH + 14, 0.8), PAL.stone, s * 8, (14 - DEPTH) / 2, 0);
    cornice(b, s * 8, 14, 0, 4.2, 2.6);
    b.add(box(4.9, 0.4, 3.1), PAL.gold, s * 8, 4.4, 0);
    b.add(cyl(0.12, 11, 6), PAL.gold, s * 9.6, 16.5, 1.9);
    b.add(box(1.5, 0.25, 0.3), PAL.gold, s * 5.9, 9.75, 1.8);
  }
  b.add(box(11.6, 2.4, 2.6), PAL.stoneLight, 0, 11.2, 0);
  cornice(b, 0, 12.4, 0, 11.2, 2.4);
  b.add(new THREE.CylinderGeometry(1.25, 1.25, 0.3, 24), PAL.gold, 0, 11.2, 1.4, Math.PI / 2);
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) b.add(box(1.5, 0.28 - i * 0.03, 0.12), PAL.gold, s * (2 + i * 0.3), 11.5 - i * 0.26, 1.4, 0, 0, s * 0.08);
  return b.build();
}

/** Cloth on the gateway: long banners on the pylons, pennants on the masts. */
export const GATE_BANNERS: Anchor[] = [
  [-5.9, 9.8, 1.85, 2.0, 6.0, 0, 1], [5.9, 9.8, 1.85, 2.0, 6.0, 0, 1],
  [-10.5, 21.8, 1.9, 1.5, 4.5, 0, 0], [10.5, 21.8, 1.9, 1.5, 4.5, 0, 0],
];

/** Second-row monuments rising from the city floor (never reached). */
export function farBuildings(): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  { // stepped pyramid-temple
    const b = new Builder();
    let y = -DEPTH;
    for (let i = 0; i < 5; i++) {
      const w = 30 - i * 5.2, h = 7.5;
      b.add(frustum(w, w * 0.8, h, 0.9), i % 2 ? PAL.stone : PAL.stoneDark, 0, y + h / 2, 0);
      b.add(box(w * 0.92, 0.5, w * 0.74), PAL.stoneLight, 0, y + h + 0.1, 0);
      y += h;
    }
    b.add(frustum(4.2, 4.2, 5, 0.03), PAL.gold, 0, y + 2.5, 0);
    stairs(b, 16, 14, 2.1, 1.1, 5);
    out.push(b.build());
  }
  { // hypostyle hall
    const b = new Builder();
    b.add(frustum(20, 26, DEPTH + 16, 0.92), PAL.stoneDark, -3, (16 - DEPTH) / 2, 0);
    for (const z of [-9, -4.5, 0, 4.5, 9]) column(b, 8.6, z, 16, 1.3, -2);
    b.add(box(4, 2.4, 24), PAL.stoneLight, 8.6, 15.6, 0);
    cornice(b, 2, 16.8, 0, 26, 26);
    b.add(box(22, 3, 22), PAL.stone, -2, -DEPTH + 1.5 + 6, 0);
    out.push(b.build());
  }
  { // giant colossus on a terraced base
    const b = new Builder();
    b.add(frustum(18, 18, DEPTH + 4, 0.86), PAL.stoneDark, 0, (4 - DEPTH) / 2, 0);
    cornice(b, 0, 4, 0, 15, 15);
    out.push(b.build());
  }
  { // twin obelisks and a pylon
    const b = new Builder();
    b.add(frustum(8, 22, DEPTH + 20, 0.82), PAL.stone, -4, (20 - DEPTH) / 2, 0);
    cornice(b, -4, 20, 0, 6, 17.6);
    b.add(box(0.5, 10, 5), PAL.shadow, 0.1, 3, 0);
    for (const z of [-7, 7]) obelisk(b, 8, z, 24, 2.6, -DEPTH + 6);
    b.add(box(10, 6, 22), PAL.stoneDark, 6, -DEPTH + 3, 0);
    out.push(b.build());
  }
  return out;
}

/** Obstacle models. Visual extents match the collision volumes in sim/config. */
export function obstacleGeometry(kind: Kind): THREE.BufferGeometry {
  const b = new Builder();
  if (kind === 'low') {
    // Toppled column: jump over it
    b.add(new THREE.CylinderGeometry(0.4, 0.45, 1.5, 14), PAL.stoneLight, -0.1, 0.45, 0, 0, 0, Math.PI / 2);
    b.add(new THREE.CylinderGeometry(0.58, 0.42, 0.34, 14), PAL.stone, 0.78, 0.45, 0, 0, 0, Math.PI / 2);
    for (const x of [-0.6, 0.35]) b.add(cyl(0.47, 0.08, 14), PAL.gold, x, 0.45, 0, 0, 0, Math.PI / 2);
    b.add(box(0.55, 0.32, 0.5), PAL.stoneDark, -0.7, 0.16, 0.5, 0, 0.5, 0.1).add(box(0.3, 0.22, 0.34), PAL.stone, 0.3, 0.11, -0.52, 0, 0.9, 0);
  } else if (kind === 'high') {
    // Low lintel charged with Veil energy: slide beneath it
    for (const s of [-1, 1]) {
      b.add(box(0.2, 1.15, 0.36), PAL.stoneDark, s * 0.93, 0.575, 0).add(box(0.3, 0.14, 0.46), PAL.gold, s * 0.93, 1.1, 0);
      b.add(box(0.16, 1.3, 0.26), PAL.stone, s * 0.93, 2.4, 0);
    }
    b.add(box(2.16, 0.6, 0.56), PAL.stoneLight, 0, 1.47, 0).add(box(2.2, 0.09, 0.6), PAL.gold, 0, 1.2, 0).add(box(2.2, 0.09, 0.6), PAL.gold, 0, 1.77, 0);
    b.add(new THREE.TorusGeometry(0.52, 0.1, 8, 20), PAL.gold, 0, 2.4, 0)
      .add(new THREE.CylinderGeometry(0.4, 0.4, 0.07, 16), PAL.cyan, 0, 2.4, 0, Math.PI / 2)
      .add(box(2.1, 0.16, 0.34), PAL.stoneDark, 0, 3.02, 0);
  } else {
    // Guardian idol: no way through, change lane
    b.add(box(1.7, 0.3, 1.1), PAL.stoneDark, 0, 0.15, 0).add(box(1.4, 0.3, 0.95), PAL.stone, 0, 0.45, 0).add(box(1.44, 0.07, 0.99), PAL.gold, 0, 0.62, 0);
    b.add(frustum(1.05, 0.75, 1.5, 0.8), PAL.stoneLight, 0, 1.4, 0);
    b.add(box(1.2, 0.36, 0.7), PAL.stone, 0, 2.2, 0.02);
    for (const s of [-1, 1]) b.add(box(0.95, 0.2, 0.22), PAL.stoneLight, s * 0.1, 1.8 + s * 0.08, 0.4, 0, 0, s * 0.5);
    b.add(box(0.9, 0.12, 0.72), PAL.gold, 0, 2.42, 0.02);
    b.add(new THREE.SphereGeometry(0.34, 12, 9), PAL.stoneLight, 0, 2.78, 0);
    b.add(frustum(0.95, 0.6, 0.95, 0.6), PAL.stone, 0, 2.78, -0.1);
    b.add(new THREE.CylinderGeometry(0.25, 0.25, 0.06, 14), PAL.gold, 0, 2.76, 0.32, Math.PI / 2);
    b.add(new THREE.OctahedronGeometry(0.1), PAL.cyan, 0, 2.86, 0.37);
    b.add(frustum(0.5, 0.5, 0.3, 0.05), PAL.gold, 0, 3.24, -0.05);
  }
  return b.build();
}
