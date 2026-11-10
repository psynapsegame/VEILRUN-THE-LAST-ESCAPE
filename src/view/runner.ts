import * as THREE from 'three';
import type { PlayerState } from '../sim/player';

// Joint angle sets: thighL, kneeL, thighR, kneeR, shoulderL, elbowL, shoulderR, elbowR, spine
type Pose = number[];
const P_RISE: Pose = [1.25, -1.7, -0.5, -0.9, -1.0, 0.9, 2.3, 0.5, -0.15];
const P_FALL: Pose = [0.5, -0.6, 0.1, -0.5, 2.5, 0.3, 2.2, 0.3, -0.05];
const P_SLIDE: Pose = [0.35, -0.1, 1.0, -1.5, -1.0, 0.4, 0.5, 1.0, -0.55];
const P_DEAD: Pose = [0.7, -1.1, -0.3, -0.5, 2.6, 0.4, -1.9, 0.6, 0.3];

const SUIT = 0x2b2152;
const ARMOR = 0x14111d;
const GOLD = 0xe0a84a;
const CYAN = 0x56e6ff;
const VIOLET = 0x9257ff;

export interface RunnerFrame {
  state: PlayerState;
  vy: number;
  lean: number;
  speed: number;
  dashing: boolean;
}

/**
 * The Veilrunner: an articulated procedural character. Poses are blended with
 * damped weights so run / jump / slide / fall flow into each other.
 */
export class Runner {
  readonly root = new THREE.Group();
  private body = new THREE.Group();
  private spine = new THREE.Group();
  private head = new THREE.Group();
  private joints: THREE.Object3D[] = [];
  private scarf: THREE.Group[] = [];
  private glow: THREE.MeshStandardMaterial;
  private phase = 0;
  private w = { run: 1, air: 0, slide: 0, dead: 0 };
  private rise = 0;
  private t = 0;
  private cur: Pose = new Array(9).fill(0);

  constructor() {
    const suit = new THREE.MeshStandardMaterial({ color: SUIT, roughness: 0.7, metalness: 0.1 });
    const armor = new THREE.MeshStandardMaterial({ color: ARMOR, roughness: 0.45, metalness: 0.5 });
    const gold = new THREE.MeshStandardMaterial({ color: GOLD, roughness: 0.3, metalness: 0.85, emissive: 0x5a3a08 });
    const scarfMat = new THREE.MeshStandardMaterial({ color: VIOLET, roughness: 0.8, emissive: 0x3a1a8a, side: THREE.DoubleSide });
    this.glow = new THREE.MeshStandardMaterial({ color: CYAN, emissive: CYAN, emissiveIntensity: 1.6 });

    const limb = (r: number, len: number, mat: THREE.Material, taper = 0.8) => {
      const g = new THREE.CylinderGeometry(r, r * taper, len, 10, 1);
      g.translate(0, -len / 2, 0);
      const m = new THREE.Mesh(g, mat);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
      m.add(cap);
      return m;
    };
    const ball = (r: number, mat: THREE.Material, sx = 1, sy = 1, sz = 1) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat);
      m.scale.set(sx, sy, sz);
      return m;
    };

    this.root.add(this.body);
    this.body.position.y = 0.9;

    // Pelvis + belt
    this.body.add(ball(0.17, armor, 1.1, 0.75, 0.85));
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.028, 6, 18), gold);
    belt.rotation.x = Math.PI / 2;
    belt.scale.z = 1;
    belt.position.y = 0.07;
    this.body.add(belt);

    // Torso
    this.spine.position.y = 0.05;
    this.body.add(this.spine);
    const prof = [[0.13, 0], [0.16, 0.08], [0.19, 0.27], [0.225, 0.42], [0.2, 0.5], [0.09, 0.57]].map(p => new THREE.Vector2(p[0], p[1]));
    const torso = new THREE.Mesh(new THREE.LatheGeometry(prof, 14), suit);
    torso.scale.z = 0.72;
    this.spine.add(torso);
    const plate = ball(0.17, armor, 1.05, 0.9, 0.5);
    plate.position.set(0, 0.36, -0.07);
    this.spine.add(plate);
    const core = ball(0.045, this.glow, 1, 1, 0.5);
    core.position.set(0, 0.38, -0.155);
    this.spine.add(core);
    for (const s of [-1, 1]) {
      const pad = ball(0.105, gold, 1.15, 0.7, 1.05);
      pad.position.set(s * 0.25, 0.49, 0);
      pad.rotation.z = -s * 0.35;
      this.spine.add(pad);
    }

    // Head: hooded mask with a glowing visor
    this.head.position.y = 0.6;
    this.spine.add(this.head);
    const neck = limb(0.06, 0.1, armor, 1);
    neck.position.y = 0.05;
    this.head.add(neck);
    const skull = ball(0.135, armor, 0.95, 1.08, 1);
    skull.position.y = 0.15;
    this.head.add(skull);
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.165, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), suit);
    hood.position.set(0, 0.16, 0.025);
    hood.rotation.x = 0.35;
    hood.scale.set(1, 1.05, 1.15);
    this.head.add(hood);
    const visor = new THREE.Mesh(new THREE.TorusGeometry(0.118, 0.022, 6, 14, Math.PI * 0.9), this.glow);
    visor.position.set(0, 0.155, -0.02);
    visor.rotation.set(Math.PI / 2, 0, Math.PI * 1.05);
    this.head.add(visor);

    // Arms
    for (const s of [-1, 1]) {
      const sh = new THREE.Group();
      sh.position.set(s * 0.255, 0.46, 0);
      sh.rotation.z = s * 0.12;
      const upper = limb(0.06, 0.3, suit);
      const el = new THREE.Group();
      el.position.y = -0.3;
      const fore = limb(0.052, 0.27, armor);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.052, 0.07, 10), gold);
      cuff.position.y = -0.17;
      const hand = ball(0.055, armor, 0.9, 1.2, 0.9);
      hand.position.y = -0.31;
      el.add(fore, cuff, hand);
      sh.add(upper, el);
      this.spine.add(sh);
      this.joints[s < 0 ? 4 : 6] = sh;
      this.joints[s < 0 ? 5 : 7] = el;
    }

    // Legs
    for (const s of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(s * 0.1, -0.04, 0);
      const thigh = limb(0.085, 0.43, suit, 0.75);
      const knee = new THREE.Group();
      knee.position.y = -0.43;
      const shin = limb(0.066, 0.4, armor, 0.72);
      const guard = ball(0.07, gold, 0.9, 1.3, 0.7);
      guard.position.set(0, -0.02, -0.03);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.25), armor);
      foot.position.set(0, -0.41, -0.06);
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.104, 0.02, 0.254), this.glow);
      sole.position.set(0, -0.45, -0.06);
      knee.add(shin, guard, foot, sole);
      hip.add(thigh, knee);
      this.body.add(hip);
      this.joints[s < 0 ? 0 : 2] = hip;
      this.joints[s < 0 ? 1 : 3] = knee;
    }
    this.joints[8] = this.spine;

    // Scarf: a chain of cloth segments trailing behind the neck
    let parent: THREE.Object3D = this.spine;
    for (let i = 0; i < 7; i++) {
      const seg = new THREE.Group();
      seg.position.set(0, i === 0 ? 0.55 : 0, i === 0 ? 0.1 : 0.17);
      const w = 0.2 - i * 0.018;
      const cloth = new THREE.Mesh(new THREE.BoxGeometry(w, 0.012, 0.18), scarfMat);
      cloth.position.z = 0.085;
      seg.add(cloth);
      parent.add(seg);
      this.scarf.push(seg);
      parent = seg;
    }
  }

  update(dt: number, f: RunnerFrame): void {
    this.t += dt;
    const k = 1 - Math.exp(-dt * 16);
    const target = { run: 0, air: 0, slide: 0, dead: 0 };
    target[f.state === 'jump' ? 'air' : f.state] = 1;
    const w = this.w;
    w.run += (target.run - w.run) * k;
    w.air += (target.air - w.air) * k;
    w.slide += (target.slide - w.slide) * k;
    w.dead += (target.dead - w.dead) * (1 - Math.exp(-dt * 9));
    this.rise += ((f.vy > -2 ? 1 : 0) - this.rise) * (1 - Math.exp(-dt * 10));

    // Stride frequency follows speed so feet never visibly skate.
    const sp = Math.min(1.4, f.speed / 18);
    if (f.state !== 'dead') this.phase += dt * (7.5 + 6.5 * sp) * (f.dashing ? 1.5 : 1);
    const p = this.phase;
    const amp = 0.75 + 0.3 * sp;
    const run: Pose = [
      amp * Math.sin(p), -(0.25 + 1.35 * Math.max(0, Math.cos(p - 0.5))),
      amp * Math.sin(p + Math.PI), -(0.25 + 1.35 * Math.max(0, Math.cos(p + Math.PI - 0.5))),
      -amp * 0.95 * Math.sin(p), 1.25 + 0.35 * Math.sin(p),
      amp * 0.95 * Math.sin(p), 1.25 - 0.35 * Math.sin(p),
      -0.2 - 0.12 * sp,
    ];
    const sum = w.run + w.air + w.slide + w.dead || 1;
    for (let i = 0; i < 9; i++) {
      const air = P_FALL[i] + (P_RISE[i] - P_FALL[i]) * this.rise;
      this.cur[i] = (run[i] * w.run + air * w.air + P_SLIDE[i] * w.slide + P_DEAD[i] * w.dead) / sum;
      this.joints[i].rotation.x = this.cur[i];
    }
    const bob = Math.abs(Math.sin(p)) * 0.07 * w.run;
    const tilt = (-0.1 * w.run - 0.12 * w.air * this.rise + 1.15 * w.slide + 1.45 * w.dead) / sum;
    this.body.rotation.x = tilt;
    this.body.position.y = (0.88 * (w.run + w.air) + 0.3 * w.slide + 0.26 * w.dead) / sum + bob;
    this.body.rotation.z = -f.lean * 0.38;
    this.body.rotation.y = -f.lean * 0.3 + Math.sin(p) * 0.12 * w.run;
    this.head.rotation.x = (0.1 * w.run + 0.55 * w.slide - 0.1 * w.air) / sum;

    const flow = Math.min(1, f.speed / 20);
    for (let i = 0; i < this.scarf.length; i++) {
      const wave = Math.sin(this.t * (9 + 4 * flow) - i * 0.8) * (0.12 + 0.16 * flow);
      this.scarf[i].rotation.x = (i === 0 ? 0.5 - 0.6 * flow - tilt - this.cur[8] : 0.06) + wave;
      this.scarf[i].rotation.y = Math.sin(this.t * 5 - i) * 0.12 - (i === 0 ? f.lean * 0.6 : 0);
    }
    this.glow.emissiveIntensity = f.dashing ? 4 : 1.5 + Math.sin(this.t * 4) * 0.25;
  }
}
