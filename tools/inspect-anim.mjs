// Lists skins, joints and animations of rigged GLB files:  node tools/inspect-anim.mjs <a.glb> [b.glb ...]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { statSync } from 'node:fs';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const f of process.argv.slice(2)) {
  const root = (await io.read(f)).getRoot();
  let tris = 0;
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
  const skin = root.listSkins()[0];
  const joints = skin?.listJoints().map(j => j.getName()) ?? [];
  console.log(`${f}  ${(statSync(f).size / 1048576).toFixed(1)} MB  tris ${tris}  meshes ${root.listMeshes().length}  skins ${root.listSkins().length}  joints ${joints.length}`);
  console.log('  textures:', root.listTextures().map(t => `${t.getSize()?.join('x')} ${t.getMimeType().replace('image/', '')}`).join(', '));
  for (const a of root.listAnimations()) {
    let dur = 0;
    for (const s of a.listSamplers()) { const t = s.getInput().getArray(); dur = Math.max(dur, t[t.length - 1]); }
    console.log(`  anim "${a.getName()}"  ${dur.toFixed(2)} s  channels ${a.listChannels().length}`);
  }
  if (f === process.argv[2]) console.log('  joints:', joints.slice(0, 70).join(' '));
}
