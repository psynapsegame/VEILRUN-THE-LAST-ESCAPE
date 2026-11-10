import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CFG, GAP } from '../sim/config';
import type { Row } from '../sim/track';

/** Holes cut into the road at the same time (rows are visible about 125 m ahead). */
export const GAP_N = 20;

/** Rectangles [xMin, xMax, zMin, zMax] of the holes, in scene coordinates, shared by every material that is cut. */
export const makeHoleUniform = (): { value: Float32Array } => ({ value: new Float32Array(GAP_N * 4) });

/** The road and its inlays discard every fragment inside a hole, so what lies below shows through. */
export function cutHoles(mat: THREE.Material, uniform: { value: Float32Array }): void {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uGaps = uniform;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vGapXZ;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGapXZ = (modelMatrix * vec4(position, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec2 vGapXZ;\nuniform vec4 uGaps[${GAP_N}];`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        for (int i = 0; i < ${GAP_N}; i++) { vec4 g = uGaps[i]; if (vGapXZ.x > g.x && vGapXZ.x < g.y && vGapXZ.y > g.z && vGapXZ.y < g.w) discard; }`);
  };
}

/** One open box (unit length, stretched to the hole's length): the edges that give the causeway its thickness. */
export function makeLipGeometry(): THREE.BufferGeometry {
  const D = 1.7, H = GAP.halfW;
  const parts = [
    new THREE.PlaneGeometry(2 * H, D).translate(0, -D / 2, 0.5), // far edge
    new THREE.PlaneGeometry(2 * H, D).translate(0, -D / 2, -0.5), // near edge
    new THREE.PlaneGeometry(1, D).rotateY(Math.PI / 2).translate(-H, -D / 2, 0), // sides
    new THREE.PlaneGeometry(1, D).rotateY(Math.PI / 2).translate(H, -D / 2, 0),
  ];
  for (const g of parts) {
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1.6, uv.getY(i) * 1.2);
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(0.45), 3));
  }
  return mergeGeometries(parts.map(g => g.toNonIndexed()))!;
}

/** Fill this frame's hole rectangles and stand a lip mesh around each one. */
export function fillHoles(uniform: { value: Float32Array }, lips: THREE.Mesh[], rows: Row[], dist: number): void {
  const R = uniform.value;
  R.fill(0);
  let n = 0;
  for (const row of rows) {
    const zc = dist - row.z; // scene z: negative ahead of the runner
    if (zc > 14) continue;
    if (zc < -125) break;
    for (let l = 0; l < 3; l++) {
      if (row.cells[l] !== 'gap' || n >= GAP_N) continue;
      const cx = (l - 1) * CFG.laneWidth;
      R[n * 4] = cx - GAP.halfW; R[n * 4 + 1] = cx + GAP.halfW;
      R[n * 4 + 2] = zc - row.gapLen / 2; R[n * 4 + 3] = zc + row.gapLen / 2;
      const lip = lips[n];
      lip.visible = true;
      lip.position.set(cx, 0, zc);
      lip.scale.set(1, 1, row.gapLen);
      n++;
    }
  }
  for (let i = n; i < lips.length; i++) lips[i].visible = false;
}
