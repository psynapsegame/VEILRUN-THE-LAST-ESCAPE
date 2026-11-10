import * as THREE from 'three';
import type { PlayerState } from '../sim/player';
import asset from '../assets/hero.glb';
import { loadGlb } from './glb';
import { loading } from './loading';

export interface RunnerFrame {
  state: PlayerState;
  vy: number;
  lean: number;
  speed: number;
  dashing: boolean;
}

type Anim = 'run' | 'jump' | 'slide' | 'dash' | 'dead';
interface AnimCfg {
  /** Clip of hero.glb it is cut from. */
  src: string;
  loop: boolean;
  /** Cross-fade time into it, seconds. */
  fade: number;
  /** Play only this part of the source clip (seconds). */
  range?: [number, number];
}
const FPS = 30;
const AIR_TIME = 0.62; // the game's jump lasts about this long
/**
 * The Sentinel's animations come from a standard library. Its jump clip has a crouch, a leap and a recovery:
 * only the airborne part (0.49 s -> 1.11 s) is used, since the game's physics provides the take-off.
 * Slide: drops onto his back, legs stretched forward, and holds the pose until the slide ends (clamped).
 * Dash: a forward roll, played fast enough to last as long as the dash.
 */
const ANIMS: Record<Anim, AnimCfg> = {
  run: { src: 'run', loop: true, fade: 0.14 },
  dash: { src: 'roll', loop: false, fade: 0.06 },
  jump: { src: 'jump', loop: false, fade: 0.08, range: [0.49, 1.11] },
  slide: { src: 'slide', loop: false, fade: 0.08, range: [0, 0.9] },
  dead: { src: 'fall', loop: false, fade: 0.08 },
};

function makeClip(src: THREE.AnimationClip, key: Anim, cfg: AnimCfg): THREE.AnimationClip {
  if (cfg.range) return THREE.AnimationUtils.subclip(src, key, Math.round(cfg.range[0] * FPS), Math.round(cfg.range[1] * FPS), FPS);
  const c = src.clone(); // own copy: two states can share a source clip and still cross-fade
  c.name = key;
  return c;
}

/** The Sentinel: a rigged, skinned adventurer driven by cross-faded animation clips. */
export class Runner {
  readonly root = new THREE.Group();
  private pivot = new THREE.Group();
  private mixer: THREE.AnimationMixer | null = null;
  private actions = new Map<Anim, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;
  private anim: Anim | '' = '';
  private pitch = 0;
  private drop = 0;
  private mats: THREE.MeshStandardMaterial[] = [];

  constructor() {
    this.root.add(this.pivot);
  }
  get loaded(): boolean {
    return !!this.mixer;
  }

  load(): Promise<void> {
    return loading.track(this.build());
  }

  private async build(): Promise<void> {
    const gltf = await loadGlb(asset);
    const model = gltf.scene;
    model.rotation.y = Math.PI; // the model faces +Z, the runner runs towards -Z
    model.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.frustumCulled = false; // skinned bounds are unreliable; the runner is always on screen
      const mat = m.material as THREE.MeshStandardMaterial;
      for (const t of [mat.map, mat.normalMap, mat.metalnessMap, mat.roughnessMap]) if (t) t.anisotropy = 4;
      mat.emissive = new THREE.Color(0x56e6ff);
      mat.emissiveIntensity = 0;
      if (!this.mats.includes(mat)) this.mats.push(mat);
    });
    this.pivot.add(model);
    const mixer = new THREE.AnimationMixer(model);
    for (const key of Object.keys(ANIMS) as Anim[]) {
      const cfg = ANIMS[key];
      const src = gltf.animations.find(c => c.name === cfg.src);
      if (!src) throw new Error(`hero.glb: missing clip ${cfg.src}`);
      const a = mixer.clipAction(makeClip(src, key, cfg));
      if (!cfg.loop) {
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
      }
      this.actions.set(key, a);
    }
    this.mixer = mixer;
  }

  update(dt: number, f: RunnerFrame): void {
    if (!this.mixer) return;
    const want: Anim = f.state === 'dead' ? 'dead' : f.dashing && f.state === 'run' ? 'dash' : f.state;
    if (want !== this.anim) {
      const cfg = ANIMS[want];
      const next = this.actions.get(want)!;
      const fade = this.anim === '' ? 0 : this.anim === 'slide' ? Math.max(cfg.fade, 0.22) : cfg.fade; // getting up takes a moment
      let rate = 1;
      if (want === 'jump') rate = (cfg.range![1] - cfg.range![0]) / AIR_TIME;
      else if (want === 'slide') rate = 2; // the drop takes about 0.45 s, then the pose is held
      else if (want === 'dash') rate = 2.3; // 1.27 s of roll in the 0.55 s of the dash
      else if (want === 'dead') rate = 1.7;
      next.reset().setEffectiveWeight(1).setEffectiveTimeScale(rate).fadeIn(fade).play();
      if (this.current && this.current !== next) this.current.fadeOut(fade);
      this.current = next;
      this.anim = want;
    }
    // Stride rate follows ground speed so the feet do not skate.
    if (want === 'run') this.current!.timeScale = 0.85 + (Math.max(f.speed, 11) - 11) / 14 * 0.7;
    this.mixer.update(dt);

    // Body attitude on top of the clips: lean into lane changes, tuck for slides, pitch in the air
    const k = 1 - Math.exp(-dt * 14);
    const pitch = f.state === 'jump' ? (f.vy > 0 ? -0.12 : 0.08) : 0;
    this.pitch += (pitch - this.pitch) * k;
    // Lying down, the body would hover: lower it onto the road while sliding
    this.drop += ((f.state === 'slide' ? -0.12 : 0) - this.drop) * k;
    this.pivot.position.y = this.drop;
    this.pivot.rotation.set(this.pitch, -f.lean * 0.4, -f.lean * 0.28);
    const glow = f.dashing ? 0.28 : 0;
    for (const m of this.mats) m.emissiveIntensity += (glow - m.emissiveIntensity) * k;
  }
}
