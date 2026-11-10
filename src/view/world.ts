import * as THREE from 'three';
import { CFG, Kind } from '../sim/config';
import type { GameEvent } from '../sim/game';
import type { Player } from '../sim/player';
import type { Coin, Row } from '../sim/track';
import { canvasTexture } from './build';
import { Particles } from './particles';
import { Runner } from './runner';
import { PAL, Solaris, obstacleGeometry } from './solaris';

/** What the renderer needs from a run (the Game satisfies it; so does the menu's idle scene). */
export interface ViewState {
  dist: number;
  speed: number;
  player: Player;
  dashing: boolean;
  track: { rows: Row[]; coins: Coin[] };
}

const KINDS: Kind[] = ['low', 'high', 'full'];
const MAX_COINS = 96;
const VIEW_DIST = 150;

export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(62, 1, 0.1, 600);
  private env: Solaris;
  private runner = new Runner();
  private shadow: THREE.Mesh;
  private parts = new Particles();
  private pools = new Map<Kind, THREE.Mesh[]>();
  private live = new Map<number, (THREE.Mesh | null)[]>();
  private coins: THREE.InstancedMesh;
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private one = new THREE.Vector3(1, 1, 1);
  private yAxis = new THREE.Vector3(0, 1, 0);
  private camX = 0;
  private camY = 0;
  private shake = 0;
  private fovKick = 0;
  private t = 0;
  private lastDist = 0;
  private baseFov = 62;
  /** Current render scale steps (device pixel ratio caps), highest first. */
  private ratios: number[];
  quality = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.ratios = [dpr, Math.min(dpr, 1.5), 1, 0.75].filter((r, i, a) => i === 0 || r < a[i - 1]);
    this.renderer.setPixelRatio(this.ratios[0]);
    this.env = new Solaris(this.scene);

    this.scene.add(this.runner.root);
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 1.5),
      new THREE.MeshBasicMaterial({
        transparent: true, depthWrite: false, opacity: 0.55,
        map: canvasTexture(64, (c, s) => {
          const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
          g.addColorStop(0, 'rgba(20,5,30,1)');
          g.addColorStop(1, 'rgba(20,5,30,0)');
          c.fillStyle = g;
          c.fillRect(0, 0, s, s);
        }),
      }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.02;
    this.scene.add(this.shadow);
    this.scene.add(this.parts.points);

    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    for (const k of KINDS) {
      const geo = obstacleGeometry(k);
      const pool: THREE.Mesh[] = [];
      for (let i = 0; i < 16; i++) {
        const m = new THREE.Mesh(geo, mat);
        m.visible = false;
        this.scene.add(m);
        pool.push(m);
      }
      this.pools.set(k, pool);
    }

    this.coins = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(0.3),
      new THREE.MeshStandardMaterial({ color: 0xffd060, emissive: 0xb8641a, emissiveIntensity: 1.1, metalness: 0.7, roughness: 0.25, flatShading: true, fog: false }),
      MAX_COINS,
    );
    this.coins.frustumCulled = false;
    this.scene.add(this.coins);
    this.resize();
  }

  resize(): void {
    const c = this.renderer.domElement;
    const w = c.clientWidth || window.innerWidth;
    const h = c.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.baseFov = w < h ? 64 : 52;
    this.camera.updateProjectionMatrix();
  }

  /** Step render resolution down/up (adaptive quality). Returns the new pixel ratio. */
  setQuality(level: number): number {
    this.quality = Math.max(0, Math.min(this.ratios.length - 1, level));
    this.renderer.setPixelRatio(this.ratios[this.quality]);
    this.resize();
    return this.ratios[this.quality];
  }
  get maxQuality(): number {
    return this.ratios.length - 1;
  }

  /** Forget every pooled obstacle (new run). */
  reset(): void {
    for (const [, ms] of this.live) for (const m of ms) if (m) m.visible = false;
    for (const [id, ms] of this.live) { this.release(ms); this.live.delete(id); }
    this.lastDist = 0;
    this.shake = 0;
  }
  private release(ms: (THREE.Mesh | null)[]): void {
    for (let l = 0; l < 3; l++) {
      const m = ms[l];
      if (!m) continue;
      m.visible = false;
      this.pools.get(m.userData.kind)!.push(m);
    }
  }

  handle(ev: GameEvent, s: ViewState): void {
    const p = s.player;
    const P = this.parts;
    switch (ev.t) {
      case 'coin':
        P.burst(7, (ev.coin.lane - 1) * CFG.laneWidth, ev.coin.y, 0, 3.5, 1, 0.75, 0.25, 0.4);
        break;
      case 'land':
        P.burst(8, p.x, 0.1, 0, 2.5, 0.9, 0.7, 0.45, 0.45, 4);
        break;
      case 'jump':
        P.burst(5, p.x, 0.1, 0, 2, 0.9, 0.7, 0.45, 0.35, 4);
        break;
      case 'dash':
        this.fovKick = 1;
        P.burst(24, p.x, 1, 0, 6, 0.35, 0.9, 1, 0.5);
        break;
      case 'smash': {
        const ms = this.live.get(ev.row.id);
        const m = ms?.[ev.lane];
        if (m && ms) { m.visible = false; this.pools.get(m.userData.kind)!.push(m); ms[ev.lane] = null; }
        P.burst(34, (ev.lane - 1) * CFG.laneWidth, 1.2, -1, 9, 1, 0.8, 0.5, 0.8, 14);
        P.burst(12, (ev.lane - 1) * CFG.laneWidth, 1.2, -1, 6, 0.6, 0.4, 1, 0.6);
        this.shake = 0.5;
        break;
      }
      case 'death':
        this.shake = 1;
        P.burst(40, p.x, 1, -0.4, 8, 1, 0.55, 0.3, 0.9, 10);
        P.burst(16, p.x, 1, -0.4, 5, 0.6, 0.4, 1, 0.8);
        break;
    }
  }

  render(dt: number, s: ViewState): void {
    this.t += dt;
    const p = s.player;
    const scroll = s.dist - this.lastDist;
    this.lastDist = s.dist;
    this.env.update(s.dist);

    // Obstacles: bind pooled meshes to the rows in view
    for (const row of s.track.rows) {
      if (row.z - s.dist > VIEW_DIST) break;
      let ms = this.live.get(row.id);
      if (!ms) {
        ms = [null, null, null];
        for (let l = 0; l < 3; l++) {
          const kind = row.cells[l];
          if (!kind || row.smashed[l]) continue;
          const m = this.pools.get(kind)!.pop();
          if (!m) continue;
          m.userData.kind = kind;
          m.position.x = (l - 1) * CFG.laneWidth;
          m.visible = true;
          ms[l] = m;
        }
        this.live.set(row.id, ms);
      }
      const z = s.dist - row.z;
      for (const m of ms) if (m) m.position.z = z;
    }
    for (const [id, ms] of this.live) {
      const m = ms[0] || ms[1] || ms[2];
      if (!m || m.position.z > 14) { this.release(ms); this.live.delete(id); }
    }

    // Fragments
    let n = 0;
    for (const c of s.track.coins) {
      const z = s.dist - c.z;
      if (z < -VIEW_DIST || n >= MAX_COINS) break;
      if (c.taken || z > 6) continue;
      this.q.setFromAxisAngle(this.yAxis, this.t * 3 + c.z * 0.4);
      this.m4.compose(this.v.set((c.lane - 1) * CFG.laneWidth, c.y + Math.sin(this.t * 4 + c.z) * 0.08, z), this.q, this.one);
      this.coins.setMatrixAt(n++, this.m4);
    }
    this.coins.count = n;
    this.coins.instanceMatrix.needsUpdate = true;

    // Runner
    this.runner.root.position.set(p.x, p.y, 0);
    this.runner.update(dt, { state: p.state, vy: p.vy, lean: p.lean, speed: s.speed, dashing: s.dashing });
    this.shadow.position.x = p.x;
    const sh = 1 / (1 + p.y * 0.7);
    this.shadow.scale.setScalar(sh);

    // Ambient effects
    if (p.state === 'run' && Math.random() < dt * 28)
      this.parts.emit(p.x + (Math.random() - 0.5) * 0.3, 0.08, 0.2, (Math.random() - 0.5) * 0.8, 0.8 + Math.random(), 0, 0.55, 0.42, 0.28, 0.4, 2);
    if (p.state === 'slide' && Math.random() < dt * 90)
      this.parts.emit(p.x + (Math.random() - 0.5) * 0.5, 0.08, -0.3, (Math.random() - 0.5) * 2, 1 + Math.random() * 1.5, 0, 1, 0.75, 0.4, 0.35, 5);
    if (s.dashing)
      for (let i = 0; i < 3; i++)
        this.parts.emit(p.x + (Math.random() - 0.5) * 0.7, p.y + 0.3 + Math.random() * 1.3, 0.2, 0, 0, 0, 0.3, 0.85, 1, 0.35);
    if (Math.random() < dt * 14)
      this.parts.emit((Math.random() - 0.5) * 16, 0.5 + Math.random() * 6, -30 - Math.random() * 60, 0, 0.2, 0, 1, 0.8, 0.45, 3.5);
    this.parts.update(dt, scroll);

    // Camera: trails the runner, widens with speed, dips for slides
    const k = 1 - Math.exp(-dt * 9);
    this.camX += (p.x * 0.62 - this.camX) * k;
    const ty = p.y * 0.42 - (p.state === 'slide' ? 0.45 : 0);
    this.camY += (ty - this.camY) * (1 - Math.exp(-dt * 7));
    this.shake = Math.max(0, this.shake - dt * 2.4);
    this.fovKick = Math.max(0, this.fovKick - dt * 1.6);
    const sx = (Math.random() - 0.5) * this.shake * 0.5;
    const sy = (Math.random() - 0.5) * this.shake * 0.5;
    const speedF = Math.min(1, Math.max(0, (s.speed - CFG.speedStart) / (CFG.speedMax - CFG.speedStart)));
    this.camera.position.set(this.camX + sx, 3.25 + this.camY + sy, 5.6 - speedF * 0.5);
    this.camera.lookAt(this.camX * 0.9 + p.x * 0.12, 1.5 + this.camY * 0.6, -7);
    this.camera.rotation.z += -p.lean * 0.035;
    const fov = this.baseFov + speedF * 7 + this.fovKick * 9 + (s.dashing ? 5 : 0);
    if (Math.abs(fov - this.camera.fov) > 0.05) {
      this.camera.fov += (fov - this.camera.fov) * (1 - Math.exp(-dt * 6));
      this.camera.updateProjectionMatrix();
    }
    this.renderer.render(this.scene, this.camera);
  }
}
export { PAL };
