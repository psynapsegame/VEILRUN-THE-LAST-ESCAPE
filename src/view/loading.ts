import * as THREE from 'three';

/** Counts every asset the scene is waiting for, so the splash screen can show real progress. */
class Loading {
  total = 0;
  done = 0;
  track<T>(p: Promise<T>): Promise<T> {
    this.total++;
    return p.finally(() => this.done++);
  }
  get progress(): number {
    return this.total ? this.done / this.total : 0;
  }
  get complete(): boolean {
    return this.total > 0 && this.done >= this.total;
  }
}
export const loading = new Loading();

const loader = new THREE.TextureLoader();
/** Starts loading a texture now; it fills in when ready and is counted in `loading`. */
export function loadTexture(url: string, srgb = true): THREE.Texture {
  loading.total++;
  const t = loader.load(url, () => loading.done++, undefined, () => loading.done++);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
