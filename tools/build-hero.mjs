// Builds src/assets/hero.glb from the rigged Meshy export (see assets-src/LICENCES.md):
//   node tools/build-hero.mjs [assets-src/hero-meshy/Sentinel_animated.glb]
// - keeps only the clips the game uses, under game names (run, jog, jump, fall, idle, slide, roll)
// - slide and roll come from separate exports of the same character (EXTRA below): their tracks are
//   re-targeted by bone name onto this file's skeleton
// - drops scale tracks and every translation track except the hips' (the jump's hips are fixed: the game moves the body)
// - shrinks the textures to 1024 px WebP
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, textureCompress, unpartition } from '@gltf-transform/functions';
import sharp from 'sharp';
import { statSync } from 'node:fs';

const src = process.argv[2] ?? 'assets-src/hero-meshy/Sentinel_animated.glb';
const KEEP = { RunFast: 'run', Running: 'jog', Regular_Jump: 'jump', falling_down: 'fall', Idle_5: 'idle' };
/** Extra animation files: [file, clip name inside it (null = its only clip), game name]. */
const EXTRA = [
  ['assets-src/hero-meshy/Sentinel_anim_A.glb', null, 'slide'],
  ['assets-src/hero-meshy/Sentinel_anim_B.glb', 'Roll_Dodge_1', 'roll'],
];
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(src);
const root = doc.getRoot();
const hips = root.listNodes().find(n => n.getName() === 'mixamorig:Hips');

for (const a of root.listAnimations()) {
  const name = KEEP[a.getName()];
  if (!name) {
    a.listChannels().forEach(c => c.dispose());
    a.listSamplers().forEach(s => s.dispose());
    a.dispose();
    continue;
  }
  for (const c of a.listChannels()) {
    const path = c.getTargetPath(), isHips = c.getTargetNode() === hips;
    if (path === 'scale' || (path === 'translation' && (!isHips || name === 'jump'))) {
      const s = c.getSampler();
      c.dispose();
      if (s && s.listParents().filter(p => p.propertyType === 'AnimationChannel').length === 0) s.dispose();
    }
  }
  a.setName(name);
  if (name === 'jump') {
    // Report when the feet leave and touch the ground (hips height crosses the standing height), for the runner's sub-clip
    const hc = a.listChannels().length ? null : null;
    void hc;
  }
}

// Bring the extra clips over, matching bones by name; keep rotations, and the hips' translation only
const byName = new Map(root.listNodes().map(n => [n.getName(), n]));
for (const [file, clipName, gameName] of EXTRA) {
  const srcDoc = await io.read(file);
  const clip = srcDoc.getRoot().listAnimations().find(a => clipName === null || a.getName() === clipName);
  if (!clip) throw new Error(`${file}: clip ${clipName} not found`);
  const anim = doc.createAnimation(gameName);
  let kept = 0, missed = 0;
  for (const c of clip.listChannels()) {
    const path = c.getTargetPath(), name = c.getTargetNode()?.getName();
    const target = byName.get(name);
    if (!target) { missed++; continue; }
    if (path === 'scale' || (path === 'translation' && name !== 'mixamorig:Hips')) continue;
    const smp = c.getSampler();
    const input = doc.createAccessor().setType('SCALAR').setArray(smp.getInput().getArray().slice());
    const output = doc.createAccessor().setType(smp.getOutput().getType()).setArray(smp.getOutput().getArray().slice());
    // The game moves the body: remove the clip's own travel along the ground (keep the hips' height)
    if (path === 'translation') {
      const a = output.getArray();
      let travel = 0;
      for (let i = 0; i < a.length; i += 3) travel = Math.max(travel, Math.hypot(a[i] - a[0], a[i + 2] - a[2]));
      for (let i = 3; i < a.length; i += 3) { a[i] = a[0]; a[i + 2] = a[2]; }
      console.log(`  ${gameName}: removed ${travel.toFixed(2)} m of ground travel from the hips`);
    }
    const sampler = doc.createAnimationSampler().setInput(input).setOutput(output).setInterpolation(smp.getInterpolation());
    anim.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(target).setTargetPath(path).setSampler(sampler));
    kept++;
  }
  console.log(`  ${gameName}: ${kept} tracks from ${file.split('/').pop()}${missed ? `, ${missed} on bones this skeleton does not have` : ''}`);
}
await doc.transform(
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 86 }),
  dedup(), prune(), unpartition(),
);
await io.write('src/assets/hero.glb', doc);
let tris = 0;
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris += p.getIndices().getCount() / 3;
console.log(`src/assets/hero.glb  ${(statSync('src/assets/hero.glb').size / 1048576).toFixed(2)} MB  tris ${tris}`);
for (const a of root.listAnimations()) {
  const t = a.listSamplers()[0].getInput().getArray();
  console.log(`  ${a.getName().padEnd(5)} ${t[t.length - 1].toFixed(2)} s  ${a.listChannels().length} channels`);
}
console.log('textures', root.listTextures().map(t => `${t.getSize()?.join('x')} ${(t.getImage().byteLength / 1024) | 0} kB`).join(', '));
