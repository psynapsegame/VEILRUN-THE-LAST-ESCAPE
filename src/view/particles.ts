import * as THREE from 'three';
import { canvasTexture } from './build';

/** Fixed-size additive particle pool: a ring buffer, zero allocation while running. */
export class Particles {
  readonly points: THREE.Points;
  private n: number;
  private pos: Float32Array;
  private col: Float32Array;
  private vel: Float32Array;
  private base: Float32Array;
  private life: Float32Array;
  private max: Float32Array;
  private grav: Float32Array;
  /** 1 for ambient dust: it fades in as it is born and fades out before it reaches the camera. */
  private amb: Float32Array;
  private head = 0;

  constructor(n = 360) {
    this.n = n;
    this.pos = new Float32Array(n * 3).fill(-999);
    this.col = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.base = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.max = new Float32Array(n).fill(1);
    this.grav = new Float32Array(n);
    this.amb = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const map = canvasTexture(64, (c, s) => {
      const gr = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.4, 'rgba(255,255,255,0.45)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gr;
      c.fillRect(0, 0, s, s);
    });
    this.points = new THREE.Points(g, new THREE.PointsMaterial({
      size: 0.3, map, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    }));
    this.points.frustumCulled = false;
  }

  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, r: number, g: number, b: number, life: number, gravity = 0, ambient = false): void {
    const i = this.head;
    this.head = (i + 1) % this.n;
    const j = i * 3;
    this.pos[j] = x; this.pos[j + 1] = y; this.pos[j + 2] = z;
    this.vel[j] = vx; this.vel[j + 1] = vy; this.vel[j + 2] = vz;
    this.base[j] = r; this.base[j + 1] = g; this.base[j + 2] = b;
    this.life[i] = this.max[i] = life;
    this.grav[i] = gravity;
    this.amb[i] = ambient ? 1 : 0;
  }

  burst(count: number, x: number, y: number, z: number, speed: number, r: number, g: number, b: number, life: number, gravity = 0): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * 6.283, u = Math.random() * 2 - 1, s = speed * (0.4 + Math.random() * 0.6), q = Math.sqrt(1 - u * u);
      this.emit(x, y, z, Math.cos(a) * q * s, Math.abs(u) * s, Math.sin(a) * q * s, r, g, b, life * (0.6 + Math.random() * 0.4), gravity);
    }
  }

  /** `scroll` moves every particle towards the camera as the runner advances. */
  update(dt: number, scroll: number): void {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      const j = i * 3;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.pos[j + 1] = -999; continue; }
      this.vel[j + 1] -= this.grav[i] * dt;
      this.pos[j] += this.vel[j] * dt;
      this.pos[j + 1] += this.vel[j + 1] * dt;
      this.pos[j + 2] += this.vel[j + 2] * dt + scroll;
      let f = this.life[i] / this.max[i];
      if (this.amb[i]) f = Math.min(f, (1 - f) * 3, Math.max(0, (-this.pos[j + 2] - 6) / 14)); // soft in, soft out, never a blob in front of the lens
      this.col[j] = this.base[j] * f; this.col[j + 1] = this.base[j + 1] * f; this.col[j + 2] = this.base[j + 2] * f;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}
