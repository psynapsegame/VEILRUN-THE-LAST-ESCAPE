// Prepares the runner model from the CC0 KayKit Adventurers pack:
//   node tools/trim-runner.mjs <path to Rogue_Hooded.glb>
// Keeps only the animations the game uses, drops weapons, writes src/assets/runner.glb.
import { NodeIO } from '@gltf-transform/core';
import { prune, resample, dedup } from '@gltf-transform/functions';

const KEEP = new Set((process.argv[3] || 'Running_A,Jump_Idle,Death_A,Sit_Floor_Pose,Idle').split(','));
const DROP_NODES = new Set(['Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable']);
const io = new NodeIO();
const doc = await io.read(process.argv[2]);
const root = doc.getRoot();
for (const a of root.listAnimations()) {
  if (KEEP.has(a.getName())) continue;
  a.listChannels().forEach(c => c.dispose());
  a.listSamplers().forEach(s => s.dispose());
  a.dispose();
}
for (const n of root.listNodes()) if (DROP_NODES.has(n.getName())) n.dispose();
await doc.transform(resample(), dedup(), prune());
const out = process.argv[4] || 'src/assets/runner.glb';
await io.write(out, doc);
console.log(out, root.listAnimations().map(a => a.getName()).join(', '));
