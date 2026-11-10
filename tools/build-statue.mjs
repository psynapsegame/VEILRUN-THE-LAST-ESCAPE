// Prepares a sculpted statue (e.g. from Meshy) for mobile:
//   node tools/build-statue.mjs <in.glb> <out.glb> <target triangles> [texture size] [texture quality]
// - simplifies the mesh with UV/normal-aware error metrics (detail lives in the normal map)
// - re-centres it: origin at the middle of the base, y = 0 on the ground
// - shrinks the textures to WebP
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, textureCompress, unpartition } from '@gltf-transform/functions';
import { MeshoptSimplifier as S } from 'meshoptimizer';
import sharp from 'sharp';
import { statSync } from 'node:fs';

const [, , src, dst, target, texSize = '1024', texQ = '86'] = process.argv;
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
  const [simp] = S.simplifyWithAttributes(indices, pos, 3, attr, 5, [0.35, 0.35, 0.35, 1.2, 1.2], null, Number(target) * 3, 0.08, []);
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
