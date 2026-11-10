import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Builds one static mesh geometry out of coloured primitives (one draw call per prop). */
/** Material slots of a built prop: 0 masonry, 1 gold, 2 glowing, 3 plain (plants, wood), 4 painted panels. */
export type Slot = 0 | 1 | 2 | 3 | 4;

export class Builder {
  /** Decides which material slot a palette colour belongs to. */
  static classify: (color: number) => Slot = () => 0;
  private parts: THREE.BufferGeometry[][] = [[], [], [], [], []];
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
    // World-space (box-projected) UVs so one stone texture tiles evenly on every prop.
    const P = g.attributes.position, N = g.attributes.normal, uv = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const ax = Math.abs(N.getX(i)), ay = Math.abs(N.getY(i)), az = Math.abs(N.getZ(i));
      const u = ay >= ax && ay >= az ? [P.getX(i), P.getZ(i)] : ax >= az ? [P.getZ(i), P.getY(i)] : [P.getX(i), P.getY(i)];
      uv[i * 2] = u[0] * 0.5;
      uv[i * 2 + 1] = u[1] * 0.5;
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.parts[Builder.classify(color)].push(g);
    return this;
  }

  /**
   * Flat painted panel facing +x (towards the road), centred at (x, y, z), `w` long along z and `h` high.
   * `uv` is the rectangle [u0, v0, u1, v1] of the decal sheet it shows.
   */
  panel(x: number, y: number, z: number, w: number, h: number, uv: readonly [number, number, number, number]): this {
    const g = new THREE.PlaneGeometry(w, h).toNonIndexed();
    const t = g.attributes.uv;
    for (let i = 0; i < t.count; i++) t.setXY(i, uv[0] + t.getX(i) * (uv[2] - uv[0]), uv[1] + t.getY(i) * (uv[3] - uv[1]));
    g.rotateY(Math.PI / 2);
    g.translate(x, y, z);
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
    this.parts[4].push(g);
    return this;
  }

  build(): THREE.BufferGeometry {
    const slots: number[] = [];
    const merged: THREE.BufferGeometry[] = [];
    this.parts.forEach((ps, slot) => {
      if (!ps.length) return;
      merged.push(mergeGeometries(ps, false)!);
      slots.push(slot);
      ps.forEach(p => p.dispose());
    });
    const g = mergeGeometries(merged, true)!;
    g.groups.forEach((grp, i) => (grp.materialIndex = slots[i]));
    this.parts = [[], [], [], [], []];
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

/** Soft radial sprite used for halos. */
export function glowTexture(): THREE.CanvasTexture {
  return canvasTexture(64, (c, s) => {
    const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
  });
}
