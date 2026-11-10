import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { PlayerState } from '../sim/player';
import asset from '../assets/hero.glb';

export interface RunnerFrame {
  state: PlayerState;
  vy: number;
  lean: number;
  speed: number;
  dashing: boolean;
}

type Anim = 'run' | 'jump' | 'slide' | 'dash' | 'dead';
/** Clip, playback rate, looping, cross-fade time into it. */
const ANIMS: Record<Anim, { clip: string; rate: number; loop: boolean; fade: number }> = {
  run: { clip: 'Sprint_Loop', rate: 1, loop: true, fade: 0.14 },
  jump: { clip: 'Jump_Loop', rate: 1, loop: true, fade: 0.09 },
  slide: { clip: 'Slide_Loop', rate: 1, loop: true, fade: 0.1 },
  dash: { clip: 'Roll', rate: 2.6, loop: false, fade: 0.06 },
  dead: { clip: 'Death01', rate: 1.6, loop: false, fade: 0.08 },
};

/**
 * Repaints the outfit's colour map: the pack's green cloth becomes the
 * Veilrunner's teal, which reads clearly against SOLARIS sandstone.
 * Costumes will reuse this with other palettes.
 */
function recolor(tex: THREE.Texture, hue: number): THREE.Texture {
  const img = tex.image as CanvasImageSource & { width: number; height: number };
  const cv = document.createElement('canvas');
  cv.width = img.width;
  cv.height = img.height;
  const c = cv.getContext('2d')!;
  c.drawImage(img, 0, 0);
  const d = c.getImageData(0, 0, cv.width, cv.height);
  const col = new THREE.Color();
  const hsl = { h: 0, s: 0, l: 0 };
  let changed = 0;
  for (let i = 0; i < d.data.length; i += 4) {
    col.setRGB(d.data[i] / 255, d.data[i + 1] / 255, d.data[i + 2] / 255).getHSL(hsl);
    if (hsl.h > 0.19 && hsl.h < 0.47 && hsl.s > 0.18) {
      col.setHSL(hue + (hsl.h - 0.33) * 0.2, Math.min(1, hsl.s * 1.05), Math.min(1, hsl.l * 1.12));
      d.data[i] = col.r * 255;
      d.data[i + 1] = col.g * 255;
      d.data[i + 2] = col.b * 255;
      changed++;
    }
  }
  if (!changed) return tex;
  c.putImageData(d, 0, 0);
  const out = new THREE.CanvasTexture(cv);
  out.flipY = false;
  out.colorSpace = THREE.SRGBColorSpace;
  out.wrapS = tex.wrapS;
  out.wrapT = tex.wrapT;
  out.anisotropy = 4;
  return out;
}

/** The Veilrunner: a rigged, skinned adventurer driven by cross-faded animation clips. */
export class Runner {
  readonly root = new THREE.Group();
  private pivot = new THREE.Group();
  private mixer: THREE.AnimationMixer | null = null;
  private actions = new Map<Anim, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;
  private anim: Anim | '' = '';
  private pitch = 0;
  private mats: THREE.MeshStandardMaterial[] = [];

  constructor() {
    this.root.add(this.pivot);
  }
  get loaded(): boolean {
    return !!this.mixer;
  }

  async load(): Promise<void> {
    const buf =
      typeof asset === 'string'
        ? await (await fetch(asset)).arrayBuffer()
        : (asset.buffer.slice(asset.byteOffset, asset.byteOffset + asset.byteLength) as ArrayBuffer);
    const gltf = await new GLTFLoader().parseAsync(buf, '');
    const model = gltf.scene;
    model.rotation.y = Math.PI; // the model faces +Z, the runner runs towards -Z
    model.scale.setScalar(0.95);
    const done = new Map<THREE.Texture, THREE.Texture>();
    model.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.frustumCulled = false; // skinned bounds are unreliable; the runner is always on screen
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat.map) {
        if (!done.has(mat.map)) done.set(mat.map, recolor(mat.map, 0.5));
        mat.map = done.get(mat.map)!;
      }
      mat.emissive = new THREE.Color(0x56e6ff);
      mat.emissiveIntensity = 0;
      if (!this.mats.includes(mat)) this.mats.push(mat);
    });
    this.pivot.add(model);
    const mixer = new THREE.AnimationMixer(model);
    for (const key of Object.keys(ANIMS) as Anim[]) {
      const cfg = ANIMS[key];
      const clip = gltf.animations.find(c => c.name === cfg.clip);
      if (!clip) throw new Error(`hero.glb: missing clip ${cfg.clip}`);
      const a = mixer.clipAction(clip);
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
      const fade = this.anim === '' ? 0 : cfg.fade;
      next.reset().setEffectiveWeight(1).setEffectiveTimeScale(cfg.rate).fadeIn(fade).play();
      if (this.current && this.current !== next) this.current.fadeOut(fade);
      this.current = next;
      this.anim = want;
    }
    // Stride rate follows ground speed so the feet do not skate.
    if (want === 'run') this.current!.timeScale = 0.72 + f.speed / 32;
    this.mixer.update(dt);

    const k = 1 - Math.exp(-dt * 14);
    const pitch = f.state === 'jump' ? (f.vy > 0 ? -0.16 : 0.1) : 0;
    this.pitch += (pitch - this.pitch) * k;
    this.pivot.rotation.set(this.pitch, -f.lean * 0.4, -f.lean * 0.28);
    const glow = f.dashing ? 0.28 : 0;
    for (const m of this.mats) m.emissiveIntensity += (glow - m.emissiveIntensity) * k;
  }
}
