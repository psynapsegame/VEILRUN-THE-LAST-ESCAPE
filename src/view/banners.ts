import * as THREE from 'three';
import type { Anchor } from './kit';

const COLOURS = [0x6f3cc4, 0xb5432e, 0x1f9a94]; // violet, red, teal
const MAX = 96;

/** Every cloth banner of the scene in one instanced draw call, waving in a vertex shader. */
export class Banners {
  readonly mesh: THREE.InstancedMesh;
  private time = { value: 0 };
  private n = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);
  private col = COLOURS.map(c => new THREE.Color(c));

  constructor() {
    const geo = new THREE.PlaneGeometry(1, 1, 3, 9);
    geo.translate(0, -0.5, 0); // hangs from y = 0 down to y = -1
    const phase = new Float32Array(MAX);
    for (let i = 0; i < MAX; i++) phase[i] = Math.random() * 6.283;
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
    const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.9 });
    mat.onBeforeCompile = sh => {
      sh.uniforms.uTime = this.time;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nattribute float aPhase;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float wg = -position.y;                       // 0 at the pole, 1 at the free edge
          float wv = sin(uTime * 2.4 + aPhase + wg * 4.5) + 0.5 * sin(uTime * 4.1 + aPhase * 1.7 + wg * 8.0);
          transformed.z += wv * 0.5 * wg * wg / max(length(instanceMatrix[1].xyz) * 0.25, 1.0) + 0.25 * wg * wg;
          transformed.x += sin(uTime * 1.6 + aPhase * 1.3 + wg * 3.0) * 0.05 * wg;
          // Gold hem and border stripes
          vColor.rgb = mix(vColor.rgb, vec3(1.0, 0.72, 0.25), step(0.9, wg) * 0.9 + step(0.42, abs(position.x)) * 0.9);`);
    };
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX);
    this.mesh.setColorAt(0, this.col[0]); // allocate per-instance colours before the first compile
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }

  begin(dt: number): void {
    this.time.value += dt;
    this.n = 0;
  }

  /** Hang one banner. `mirror` is -1 for pieces mirrored to the right of the road. */
  add(a: Anchor, ox: number, oz: number, mirror: number): void {
    if (this.n >= MAX) return;
    this.q.setFromAxisAngle(this.up, a[5] * mirror);
    this.m.compose(this.p.set(ox + a[0] * mirror, a[1], oz + a[2]), this.q, this.s.set(a[3], a[4], 1));
    this.mesh.setMatrixAt(this.n, this.m);
    this.mesh.setColorAt(this.n, this.col[a[6]]);
    this.n++;
  }

  end(): void {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
