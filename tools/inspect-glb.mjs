// Prints what matters for a mobile game about a GLB: triangles, textures, extents, materials.
//   node tools/inspect-glb.mjs <file.glb>
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { statSync } from 'node:fs';

const f = process.argv[2];
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(f);
const root = doc.getRoot();
let tris = 0, verts = 0;
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
  tris += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
  verts += p.getAttribute('POSITION').getCount();
}
const b = { min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] };
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
  const a = p.getAttribute('POSITION');
  for (let i = 0; i < 3; i++) { b.min[i] = Math.min(b.min[i], a.getMin([0, 0, 0])[i]); b.max[i] = Math.max(b.max[i], a.getMax([0, 0, 0])[i]); }
}
console.log(f, (statSync(f).size / 1048576).toFixed(1), 'MB');
console.log('meshes', root.listMeshes().length, 'tris', tris, 'verts', verts);
console.log('extents', b.max.map((v, i) => (v - b.min[i]).toFixed(2)).join(' x '), 'min y', b.min[1].toFixed(2), 'center', b.max.map((v, i) => ((v + b.min[i]) / 2).toFixed(2)).join(','));
for (const t of root.listTextures()) console.log('texture', t.getName() || '(unnamed)', t.getMimeType(), t.getSize()?.join('x'), (t.getImage().byteLength / 1048576).toFixed(2), 'MB');
for (const m of root.listMaterials()) console.log('material', m.getName(), 'base', m.getBaseColorFactor().map(v => v.toFixed(2)).join(','), 'metal', m.getMetallicFactor(), 'rough', m.getRoughnessFactor(), 'maps', ['BaseColor', 'Normal', 'MetallicRoughness', 'Occlusion', 'Emissive'].filter(k => m[`get${k}Texture`]()).join('+'), 'ext', m.listExtensions?.().map(e => e.extensionName).join(',') || '');
console.log('extensions', root.listExtensionsUsed().map(e => e.extensionName).join(',') || 'none', 'animations', root.listAnimations().length, 'skins', root.listSkins().length);
