import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Builds one static mesh geometry out of coloured primitives (one draw call per prop). */
export class Builder {
  private parts: THREE.BufferGeometry[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();

  add(geo: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s: number | [number, number, number] = 1): this {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    const sc = typeof s === 'number' ? new THREE.Vector3(s, s, s) : new THREE.Vector3(...s);
    this.m.compose(new THREE.Vector3(x, y, z), this.q.setFromEuler(this.e.set(rx, ry, rz)), sc);
    g.applyMatrix4(this.m);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      // Cheap baked ambient occlusion: darker towards the ground.
      const k = 0.62 + 0.38 * Math.min(1, Math.max(0, g.attributes.position.getY(i) / 2.2));
      col[i * 3] = c.r * k;
      col[i * 3 + 1] = c.g * k;
      col[i * 3 + 2] = c.b * k;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.parts.push(g);
    return this;
  }

  build(): THREE.BufferGeometry {
    const g = mergeGeometries(this.parts, false)!;
    this.parts.forEach(p => p.dispose());
    this.parts = [];
    g.computeBoundingSphere();
    return g;
  }
}

/** Fluted column shaft (shared by several props). */
export const fluted = (r: number, h: number) => new THREE.CylinderGeometry(r * 0.86, r, h, 10, 1);
export const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);

export function canvasTexture(size: number, draw: (c: CanvasRenderingContext2D, s: number) => void): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  draw(cv.getContext('2d')!, size);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
