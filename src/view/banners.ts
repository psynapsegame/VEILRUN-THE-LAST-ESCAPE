import * as THREE from 'three';
import bannersUrl from '../assets/art/banners.webp';
import type { Anchor } from './kit';
import { loadTexture } from './loading';

const MAX = 96;
const TILES = 3; // violet sun, crimson eye, turquoise winged disc

/** Every cloth banner of the scene in one instanced draw call: embroidered cloth waving in a vertex shader. */
export class Banners {
  readonly mesh: THREE.InstancedMesh;
  private time = { value: 0 };
  private n = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);
  private tile = new Float32Array(MAX);
  private tileAttr: THREE.InstancedBufferAttribute;

  constructor() {
    const geo = new THREE.PlaneGeometry(1, 1, 3, 9);
    geo.translate(0, -0.5, 0); // hangs from y = 0 down to y = -1
    const phase = new Float32Array(MAX);
    for (let i = 0; i < MAX; i++) phase[i] = Math.random() * 6.283;
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
    this.tileAttr = new THREE.InstancedBufferAttribute(this.tile, 1);
    this.tileAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aTile', this.tileAttr);
    const map = loadTexture(bannersUrl);
    map.anisotropy = 4;
    // A little self-light keeps the dyes vivid when the cloth hangs in shade
    const mat = new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: 0.32, side: THREE.DoubleSide, roughness: 0.9, alphaTest: 0.5 });
    mat.onBeforeCompile = sh => {
      sh.uniforms.uTime = this.time;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nattribute float aPhase;\nattribute float aTile;')
        .replace('#include <uv_vertex>', `#include <uv_vertex>
          vMapUv = vec2(vMapUv.x / ${TILES}.0 + aTile / ${TILES}.0, vMapUv.y);`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float wg = -position.y;                       // 0 at the pole, 1 at the free edge
          float wv = sin(uTime * 2.4 + aPhase + wg * 4.5) + 0.5 * sin(uTime * 4.1 + aPhase * 1.7 + wg * 8.0);
          transformed.z += wv * 0.5 * wg * wg / max(length(instanceMatrix[1].xyz) * 0.25, 1.0) + 0.25 * wg * wg;
          transformed.x += sin(uTime * 1.6 + aPhase * 1.3 + wg * 3.0) * 0.05 * wg;`);
    };
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX);
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
    this.tile[this.n] = a[6];
    this.n++;
  }

  end(): void {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.tileAttr.needsUpdate = true;
  }
}
