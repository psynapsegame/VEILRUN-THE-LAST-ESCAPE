// Prepares a sculpted statue (e.g. from Meshy) for mobile:
//   node tools/build-statue.mjs <in.glb> <out.glb> <target triangles> [texture size] [texture quality] [--rx=deg] [--ry=deg] [--rz=deg] [--err=0.08]
// - simplifies the mesh with UV/normal-aware error metrics (detail lives in the normal map)
// - optionally turns it (--rx/--ry/--rz, degrees, applied in that order) before placing it
// - re-centres it: origin at the middle of the base, y = 0 on the ground
// - shrinks the textures to WebP
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, textureCompress, unpartition } from '@gltf-transform/functions';
import { MeshoptSimplifier as S } from 'meshoptimizer';
import sharp from 'sharp';
import { statSync } from 'node:fs';

const args = process.argv.slice(2);
const rot = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => a.slice(2).split('=')).map(([k, v]) => [k, (Number(v) * Math.PI) / 180]));
const [src, dst, target, texSize = '1024', texQ = '86'] = args.filter(a => !a.startsWith('--'));
/** Rotate a flat xyz array in place by the --rx, --ry, --rz angles. */
function turn(a) {
  for (let i = 0; i < a.length; i += 3) {
    let [x, y, z] = [a[i], a[i + 1], a[i + 2]], t;
    if (rot.rx) { t = y * Math.cos(rot.rx) - z * Math.sin(rot.rx); z = y * Math.sin(rot.rx) + z * Math.cos(rot.rx); y = t; }
    if (rot.ry) { t = x * Math.cos(rot.ry) + z * Math.sin(rot.ry); z = -x * Math.sin(rot.ry) + z * Math.cos(rot.ry); x = t; }
    if (rot.rz) { t = x * Math.cos(rot.rz) - y * Math.sin(rot.rz); y = x * Math.sin(rot.rz) + y * Math.cos(rot.rz); x = t; }
    a[i] = x; a[i + 1] = y; a[i + 2] = z;
  }
}
await S.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(src);
const root = doc.getRoot();
let before = 0, after = 0;

for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
  const posA = prim.getAttribute('POSITION'), norA = prim.getAttribute('NORMAL'), uvA = prim.getAttribute('TEXCOORD_0');
  const idxA = prim.getIndices();
  const pos = posA.getArray(), nor = norA.getArray(), uv = uvA.getArray();
  const indices = Uint32Array.from(idxA.getArray());
  before += indices.length / 3;
  // Attributes the error metric must preserve: normals (soft edges) and UVs (so the baked maps stay aligned)
  const n = pos.length / 3, attr = new Float32Array(n * 5);
  for (let i = 0; i < n; i++) attr.set([nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2], uv[i * 2], uv[i * 2 + 1]], i * 5);
  const [simp] = S.simplifyWithAttributes(indices, pos, 3, attr, 5, [0.35, 0.35, 0.35, 1.2, 1.2], null, Number(target) * 3, (args.find(a => a.startsWith('--err='))?.slice(6) ?? 0.08), []);
  const [remap, unique] = S.compactMesh(simp);
  after += simp.length / 3;
  for (const sem of prim.listSemantics()) {
    const acc = prim.getAttribute(sem), e = acc.getElementSize(), old = acc.getArray();
    const out = new old.constructor(unique * e);
    for (let i = 0; i < n; i++) {
      const j = remap[i];
      if (j === 0xffffffff) continue;
      for (let k = 0; k < e; k++) out[j * e + k] = old[i * e + k];
    }
    acc.setArray(out);
  }
  idxA.setArray(unique < 65536 ? Uint16Array.from(simp) : simp);
  if (rot.rx || rot.ry || rot.rz) {
    turn(posA.getArray());
    turn(prim.getAttribute('NORMAL').getArray());
    const tan = prim.getAttribute('TANGENT');
    if (tan) { const t = tan.getArray(), xyz = new Float32Array(t.length / 4 * 3); for (let i = 0; i < t.length / 4; i++) xyz.set(t.subarray(i * 4, i * 4 + 3), i * 3); turn(xyz); for (let i = 0; i < t.length / 4; i++) t.set(xyz.subarray(i * 3, i * 3 + 3), i * 4); }
  }
  // Origin: middle of the base footprint, ground at y = 0
  const p = posA.getArray();
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[i + k]); hi[k] = Math.max(hi[k], p[i + k]); }
  const c = [(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2];
  for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) p[i + k] -= c[k];
  posA.setArray(p);
  console.log('extents', hi.map((v, k) => (v - lo[k]).toFixed(3)).join(' x '));
}
await doc.transform(
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [Number(texSize), Number(texSize)], quality: Number(texQ) }),
  dedup(), prune(), unpartition(),
);
await io.write(dst, doc);
console.log(`${src}: ${before} -> ${after} triangles, ${(statSync(src).size / 1048576).toFixed(1)} MB -> ${(statSync(dst).size / 1048576).toFixed(2)} MB`);
