// Builds src/assets/hero.glb from the CC0 Quaternius sources (see assets-src/LICENCES.md):
//   node tools/build-hero.mjs <Male_Ranger.gltf> <UAL1_Standard.glb> <UAL2_Standard.glb>
// - merges the selected animation clips onto the outfit's own skeleton
// - keeps bone rotations only (plus pelvis/root motion) so the outfit keeps its proportions
// - simplifies meshes and shrinks textures for mobile
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments, prune, dedup, resample, weld, simplify, textureCompress, unpartition } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const CLIPS = ['Idle_Loop', 'Sprint_Loop', 'Jump_Start', 'Jump_Loop', 'Jump_Land', 'Slide_Loop', 'Roll', 'Hit_Knockback', 'Death01'];
const [, , heroPath, ...animPaths] = process.argv;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(heroPath);
const root = doc.getRoot();
const bones = new Map();
for (const j of root.listSkins()[0].listJoints()) bones.set(j.getName(), j);
const heroNodes = new Set(root.listNodes());

for (const p of animPaths) {
  const src = await io.read(p);
  for (const a of src.getRoot().listAnimations()) {
    if (CLIPS.includes(a.getName())) continue;
    a.listChannels().forEach(c => c.dispose());
    a.listSamplers().forEach(s => s.dispose());
    a.dispose();
  }
  mergeDocuments(doc, src);
}
for (const a of root.listAnimations()) {
  for (const c of a.listChannels()) {
    const name = c.getTargetNode()?.getName();
    const bone = bones.get(name);
    const path = c.getTargetPath();
    const keep = bone && (path === 'rotation' || (path === 'translation' && (name === 'pelvis' || name === 'root')));
    if (!keep) { const s = c.getSampler(); c.dispose(); if (s && s.listParents().length <= 2) s.dispose(); continue; }
    c.setTargetNode(bone);
  }
}
// Drop the animation libraries' mannequins: everything that is not part of the hero.
for (const n of root.listNodes()) if (!heroNodes.has(n)) n.dispose();
for (const s of root.listScenes().slice(1)) s.dispose();
for (const s of root.listSkins().slice(1)) s.dispose();

await MeshoptSimplifier.ready;
await doc.transform(
  resample(),
  weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio: 0.5, error: 0.002 }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 82 }),
  dedup(),
  prune(),
  unpartition(),
);

const out = 'src/assets/hero.glb';
await io.write(out, doc);
let tris = 0;
for (const m of root.listMeshes()) for (const pr of m.listPrimitives()) tris += pr.getIndices().getCount() / 3;
console.log(out, 'tris', tris, 'clips', root.listAnimations().map(a => `${a.getName()}(${a.listChannels().length})`).join(' '));
console.log('textures', root.listTextures().map(t => `${t.getName()} ${t.getSize()?.join('x')} ${(t.getImage().byteLength / 1024) | 0}kB`).join(', '));
