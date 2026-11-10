import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { loadEnvironment } from './materials';
import { CFG, Kind } from '../sim/config';
import type { GameEvent } from '../sim/game';
import type { Player } from '../sim/player';
import type { Coin, Row } from '../sim/track';
import { box, canvasTexture } from './build';
import { Particles } from './particles';
import { Runner } from './runner';
import { obstacleGeometry } from './kit';
import { PAL, SUN_DIR, Solaris } from './solaris';
import type { Statues } from './statues';

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
  private composer: EffectComposer;
  private post = true;
  /** Quality-control camera [x, y, z, lookX, lookY, lookZ, fov]; null in play. Set only by automated tests. */
  freeCam: number[] | null = null;
  private rays!: ShaderPass;
  /** Called on heavy impacts in the scenery (for sound). */
  onRumble: (() => void) | null = null;
  private debris: THREE.InstancedMesh;
  private deb = { p: new Float32Array(48 * 3), v: new Float32Array(48 * 3), life: new Float32Array(48), head: 0 };
  private eul = new THREE.Euler();
  private sc = new THREE.Vector3();
  private shadow: THREE.Mesh;
  private parts = new Particles();
  private pools = new Map<Kind, THREE.Mesh[]>();
  /** Every pooled mesh of the 'full' obstacle, so the sculpted idol can replace the provisional model. */
  private fullMeshes: THREE.Mesh[] = [];
  private idol: { geo: THREE.BufferGeometry; lod: THREE.BufferGeometry } | null = null;
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
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.info.autoReset = false;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.8;
    this.env = new Solaris(this.scene);
    void loadEnvironment(this.renderer).then(env => {
      this.scene.environment = env;
      this.scene.environmentIntensity = 0.9;
    });
    // Post-processing (higher tiers only): soft bloom on bright sources, then a warm/cool grade
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // Light shafts: bright sky is smeared away from the sun, so buildings cut visible rays (top tier only)
    this.rays = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, sun: { value: new THREE.Vector2(0.4, 0.6) }, amt: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 sun; uniform float amt; varying vec2 vUv;
        void main(){ vec4 base = texture2D(tDiffuse, vUv); vec2 d = sun - vUv; vec2 st = d * (0.9 / 14.0);
          vec2 uv = vUv + st * fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
          vec3 acc = vec3(0.0); float w = 1.0;
          for (int i = 0; i < 14; i++) { vec3 s = texture2D(tDiffuse, uv).rgb; acc += min(s, vec3(4.0)) * smoothstep(1.35, 2.8, max(s.r, max(s.g, s.b))) * w; w *= 0.94; uv += st; }
          gl_FragColor = vec4(base.rgb + acc * (amt / 14.0) * (1.0 - smoothstep(0.15, 1.0, length(d))), base.a); }`,
    });
    this.composer.addPass(this.rays);
    this.env.onImpact = (x, z) => {
      if (z > -45) this.shake = Math.max(this.shake, 0.35);
      void x;
      this.onRumble?.();
    };
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.7, 0.92));
    this.composer.addPass(new OutputPass());
    this.composer.addPass(new ShaderPass({
      uniforms: { tDiffuse: { value: null } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
        void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; float l = dot(c, vec3(0.299, 0.587, 0.114));
          c = mix(vec3(l), c, 1.12);                                   // saturation
          c = (c - 0.5) * 1.06 + 0.5;                                  // contrast
          c += mix(vec3(-0.012, 0.0, 0.02), vec3(0.02, 0.008, -0.02), smoothstep(0.15, 0.75, l)); // cool shadows, warm lights
          gl_FragColor = vec4(c, 1.0); }`,
    }));
    void this.runner.load();

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
    this.shadow.visible = false;
    this.scene.add(this.shadow);
    this.scene.add(this.parts.points);

    const mat = this.env.mats;
    const halo = (color: number, x: number, y: number, z: number, size: number) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.env.glow, color, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      sp.position.set(x, y, z);
      sp.scale.setScalar(size);
      return sp;
    };
    for (const k of KINDS) {
      const geo = obstacleGeometry(k);
      const pool: THREE.Mesh[] = [];
      for (let i = 0; i < 16; i++) {
        const m = new THREE.Mesh(geo, mat);
        m.visible = false;
        m.castShadow = true;
        if (k === 'high') m.add(halo(PAL.cyan, 0, 2.4, 0.1, 1.9));
        if (k === 'full') {
          m.add(halo(PAL.cyan, 0, 2.86, 0.42, 0.8));
          this.fullMeshes.push(m);
        }
        this.scene.add(m);
        pool.push(m);
      }
      this.pools.set(k, pool);
    }

    void this.env.statuesReady.then(st => this.useIdol(st, halo));

    this.coins = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(0.3),
      new THREE.MeshStandardMaterial({ color: 0xffd060, emissive: 0xb8641a, emissiveIntensity: 1.1, metalness: 0.7, roughness: 0.25, flatShading: true, fog: false }),
      MAX_COINS,
    );
    this.coins.frustumCulled = false;
    this.scene.add(this.coins);
    // Rubble chunks thrown when an obstacle is smashed
    this.debris = new THREE.InstancedMesh(box(0.42, 0.34, 0.38), this.env.curbMaterial, 48);
    this.debris.frustumCulled = false;
    this.debris.castShadow = true;
    this.debris.count = 48;
    this.m4.makeScale(0, 0, 0);
    for (let i = 0; i < 48; i++) this.debris.setMatrixAt(i, this.m4);
    this.scene.add(this.debris);
    this.resize();
  }

  resize(): void {
    const c = this.renderer.domElement;
    const w = c.clientWidth || window.innerWidth;
    const h = c.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.baseFov = w < h ? 64 : 52;
    this.camera.updateProjectionMatrix();
  }

  /**
   * The guardian idol replaces the provisional 'full' obstacle. It stands 2.7 m tall on its stepped pedestal,
   * inside the 1.6 x 0.9 m collision volume, and faces the runner. Far rows use a very light version.
   */
  private useIdol(st: Statues, halo: (color: number, x: number, y: number, z: number, size: number) => THREE.Sprite): void {
    const S = 1.4;
    this.idol = { geo: st.idol.geometry, lod: st.idolLod.geometry };
    for (const m of this.fullMeshes) {
      m.geometry = st.idol.geometry;
      m.material = st.idol.material;
      m.scale.setScalar(S);
      for (const c of [...m.children]) m.remove(c);
      m.add(halo(PAL.cyan, 0, 1.8, 0.18, 0.6)); // the turquoise gem on the forehead (model units: scaled with the mesh)
    }
  }

  /** Step render resolution down/up (adaptive quality). Returns the new pixel ratio. */
  setQuality(level: number): number {
    this.quality = Math.max(0, Math.min(this.ratios.length - 1, level));
    this.renderer.setPixelRatio(this.ratios[this.quality]);
    // Lower tiers trade the real-time shadow map for a blob shadow
    this.post = this.quality < 2;
    this.rays.enabled = this.quality === 0;
    const shadows = this.quality < 2;
    this.env.sun.castShadow = shadows;
    this.shadow.visible = !shadows;
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
        for (let i = 0; i < 14; i++) {
          const d = this.deb, j = d.head * 3;
          d.p[j] = (ev.lane - 1) * CFG.laneWidth + (Math.random() - 0.5) * 1.2;
          d.p[j + 1] = 0.3 + Math.random() * 2.4;
          d.p[j + 2] = -0.8;
          d.v[j] = (Math.random() - 0.5) * 9;
          d.v[j + 1] = 3 + Math.random() * 7;
          d.v[j + 2] = -(4 + Math.random() * 10);
          d.life[d.head] = 1.6;
          d.head = (d.head + 1) % 48;
        }
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
    this.env.update(s.dist, dt, this.parts);

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
      for (const m of ms) {
        if (!m) continue;
        m.position.z = z;
        if (this.idol && m.userData.kind === 'full') m.geometry = z < -62 ? this.idol.lod : this.idol.geo;
      }
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
      this.parts.emit(p.x + (Math.random() - 0.5) * 0.7, 0.08, 0.55, (Math.random() - 0.5) * 2, 1 + Math.random() * 1.5, 0, 1, 0.75, 0.4, 0.35, 5);
    if (s.dashing)
      for (let i = 0; i < 3; i++)
        this.parts.emit(p.x + (Math.random() - 0.5) * 0.7, p.y + 0.3 + Math.random() * 1.3, 0.2, 0, 0, 0, 0.3, 0.85, 1, 0.35);
    // Golden dust hanging in the air, and sand blown across the causeway
    if (Math.random() < dt * 30)
      this.parts.emit((Math.random() - 0.5) * 18, 0.5 + Math.random() * 7, -20 - Math.random() * 70, 0.3, 0.15, 0, 0.9, 0.7, 0.38, 3.5);
    if (Math.random() < dt * 22)
      this.parts.emit(-6, 0.1 + Math.random() * 0.5, -8 - Math.random() * 45, 3 + Math.random() * 3, 0.2, 0, 0.5, 0.4, 0.26, 2.2);
    this.parts.update(dt, scroll);
    const d = this.deb;
    for (let i = 0; i < 48; i++) {
      if (d.life[i] <= 0) continue;
      const j = i * 3;
      d.life[i] -= dt;
      d.v[j + 1] -= 28 * dt;
      d.p[j] += d.v[j] * dt;
      d.p[j + 1] += d.v[j + 1] * dt;
      d.p[j + 2] += d.v[j + 2] * dt + scroll;
      if (d.p[j + 1] < 0.15) { d.p[j + 1] = 0.15; d.v[j + 1] *= -0.35; d.v[j] *= 0.6; d.v[j + 2] *= 0.6; }
      const sz = d.life[i] <= 0 ? 0 : Math.min(1, d.life[i] * 3) * (0.6 + (i % 5) * 0.2);
      this.q.setFromEuler(this.eul.set(d.life[i] * 7 + i, d.life[i] * 5, i));
      this.m4.compose(this.v.set(d.p[j], d.p[j + 1], d.p[j + 2]), this.q, this.sc.set(sz, sz, sz));
      this.debris.setMatrixAt(i, this.m4);
    }
    this.debris.instanceMatrix.needsUpdate = true;

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
    this.camera.position.set(this.camX + sx, 3.3 + this.camY + sy, 5.4 - speedF * 0.4);
    this.camera.lookAt(this.camX * 0.9 + p.x * 0.12, 1.25 + this.camY * 0.6, -8);
    this.camera.rotation.z += -p.lean * 0.035;
    const fov = this.baseFov + speedF * 7 + this.fovKick * 9 + (s.dashing ? 5 : 0);
    if (Math.abs(fov - this.camera.fov) > 0.05) {
      this.camera.fov += (fov - this.camera.fov) * (1 - Math.exp(-dt * 6));
      this.camera.updateProjectionMatrix();
    }
    if (this.freeCam) {
      const f = this.freeCam;
      this.camera.position.set(f[0], f[1], f[2]);
      this.camera.lookAt(f[3], f[4], f[5]);
      this.camera.fov = f[6];
      this.camera.updateProjectionMatrix();
    }
    if (this.post && this.rays.enabled) {
      this.v.copy(SUN_DIR).multiplyScalar(500).add(this.camera.position).project(this.camera);
      const ahead = this.v.z < 1 && Math.abs(this.v.x) < 1.6 && Math.abs(this.v.y) < 1.6;
      (this.rays.uniforms.sun.value as THREE.Vector2).set(this.v.x * 0.5 + 0.5, this.v.y * 0.5 + 0.5);
      this.rays.uniforms.amt.value = ahead ? 0.3 : 0;
    }
    this.renderer.info.reset(); // manual reset so the counters cover every pass of the frame
    if (this.post) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}
export { PAL };
