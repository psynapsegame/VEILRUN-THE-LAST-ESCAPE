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
    // World-space (box-projected) UVs so one stone texture tiles evenly on every prop.
    const P = g.attributes.position, N = g.attributes.normal, uv = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const ax = Math.abs(N.getX(i)), ay = Math.abs(N.getY(i)), az = Math.abs(N.getZ(i));
      const u = ay >= ax && ay >= az ? [P.getX(i), P.getZ(i)] : ax >= az ? [P.getZ(i), P.getY(i)] : [P.getX(i), P.getY(i)];
      uv[i * 2] = u[0] * 0.5;
      uv[i * 2 + 1] = u[1] * 0.5;
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
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

/** Tileable masonry texture (2 m per tile) multiplied over vertex colours. */
export function stoneTexture(): THREE.CanvasTexture {
  const t = canvasTexture(256, (c, s) => {
    c.fillStyle = '#f2f2f2';
    c.fillRect(0, 0, s, s);
    for (let i = 0; i < 1800; i++) {
      const v = Math.random() < 0.5 ? 255 : 120;
      c.fillStyle = `rgba(${v},${v},${v},${Math.random() * 0.12})`;
      c.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 6, 1 + Math.random() * 3);
    }
    for (let r = 0; r < 4; r++) {
      const y = r * 64;
      c.fillStyle = 'rgba(60,40,30,0.55)';
      c.fillRect(0, y, s, 3);
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.fillRect(0, y + 3, s, 2);
      for (let k = 0; k < 2; k++) {
        const x = (k * 128 + (r % 2) * 64) % s;
        c.fillStyle = 'rgba(60,40,30,0.5)';
        c.fillRect(x, y, 3, 64);
        c.fillStyle = 'rgba(255,255,255,0.3)';
        c.fillRect(x + 3, y, 2, 64);
      }
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
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
