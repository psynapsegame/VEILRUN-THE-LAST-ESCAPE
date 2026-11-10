import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { PlayerState } from '../sim/player';
import asset from '../assets/runner.glb';

export interface RunnerFrame {
  state: PlayerState;
  vy: number;
  lean: number;
  speed: number;
  dashing: boolean;
}

const CLIP: Record<PlayerState, string> = { run: 'Running_A', jump: 'Jump_Idle', slide: 'Sit_Floor_Pose', dead: 'Death_A' };

/**
 * Repaints the model's colour atlas: the pack's green cloth becomes the
 * Veilrunner's violet. Costumes will reuse this with other palettes.
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
  for (let i = 0; i < d.data.length; i += 4) {
    col.setRGB(d.data[i] / 255, d.data[i + 1] / 255, d.data[i + 2] / 255).getHSL(hsl);
    if (hsl.h > 0.25 && hsl.h < 0.55 && hsl.s > 0.2) {
      col.setHSL(hue + (hsl.h - 0.4) * 0.25, Math.min(1, hsl.s * 0.9), hsl.l * 0.92);
      d.data[i] = col.r * 255;
      d.data[i + 1] = col.g * 255;
      d.data[i + 2] = col.b * 255;
    }
  }
  c.putImageData(d, 0, 0);
  const out = new THREE.CanvasTexture(cv);
  out.flipY = false;
  out.colorSpace = THREE.SRGBColorSpace;
  out.magFilter = tex.magFilter;
  out.minFilter = tex.minFilter;
  return out;
}

/** The Veilrunner: a rigged, skinned character driven by blended animation clips. */
export class Runner {
  readonly root = new THREE.Group();
  private pivot = new THREE.Group();
  private mixer: THREE.AnimationMixer | null = null;
  private actions = new Map<string, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;
  private state: PlayerState | '' = '';
  private tilt = 0;
  private drop = 0;
  private mats: THREE.MeshStandardMaterial[] = [];

  constructor() {
    this.root.add(this.pivot);
  }

  async load(): Promise<void> {
    const buf =
      typeof asset === 'string'
        ? await (await fetch(asset)).arrayBuffer()
        : (asset.buffer.slice(asset.byteOffset, asset.byteOffset + asset.byteLength) as ArrayBuffer);
    const gltf = await new GLTFLoader().parseAsync(buf, '');
    const model = gltf.scene;
    model.rotation.y = Math.PI; // the model faces +Z, the runner runs towards -Z
    model.scale.setScalar(0.72);
    const done = new Map<THREE.Texture, THREE.Texture>();
    model.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.frustumCulled = false; // skinned bounds are unreliable; the runner is always on screen
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat.map) {
        if (!done.has(mat.map)) done.set(mat.map, recolor(mat.map, 0.73));
        mat.map = done.get(mat.map)!;
      }
      mat.roughness = 0.65;
      mat.emissive = new THREE.Color(0x56e6ff);
      mat.emissiveIntensity = 0;
      if (!this.mats.includes(mat)) this.mats.push(mat);
    });
    this.pivot.add(model);
    this.mixer = new THREE.AnimationMixer(model);
    for (const clip of gltf.animations) {
      const a = this.mixer.clipAction(clip);
      if (clip.name !== 'Running_A' && clip.name !== 'Jump_Idle' && clip.name !== 'Idle') {
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
      }
      this.actions.set(clip.name, a);
    }
  }

  update(dt: number, f: RunnerFrame): void {
    if (!this.mixer) return;
    if (f.state !== this.state) {
      const next = this.actions.get(CLIP[f.state])!;
      const fade = f.state === 'dead' ? 0.06 : this.state === '' ? 0 : 0.11;
      next.reset().setEffectiveWeight(1).fadeIn(fade).play();
      if (this.current && this.current !== next) this.current.fadeOut(fade);
      this.current = next;
      this.state = f.state;
    }
    if (f.state === 'run') this.current!.timeScale = (0.95 + f.speed / 22) * (f.dashing ? 1.4 : 1);
    this.mixer.update(dt);

    // Body attitude on top of the clips: lean into lane changes, tuck for slides, pitch in the air
    const k = 1 - Math.exp(-dt * 14);
    const tilt = f.state === 'slide' ? 0.85 : f.state === 'jump' ? (f.vy > 0 ? -0.22 : 0.12) : f.state === 'run' ? -0.1 - f.speed * 0.006 : 0;
    this.tilt += (tilt - this.tilt) * k;
    this.drop += ((f.state === 'slide' ? 1 : 0) - this.drop) * k;
    this.pivot.rotation.set(this.tilt, -f.lean * 0.45, -f.lean * 0.3);
    this.pivot.position.set(0, this.drop * 0.12, this.drop * 0.35);
    const glow = f.dashing ? 0.9 : 0;
    for (const m of this.mats) m.emissiveIntensity += (glow - m.emissiveIntensity) * k;
  }
}
