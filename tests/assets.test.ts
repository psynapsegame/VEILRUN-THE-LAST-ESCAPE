import { describe, expect, it } from 'vitest';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { readdirSync, statSync } from 'node:fs';

/** Mobile budgets: a regression here means a phone-unfriendly asset slipped into the game. */
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
async function stats(file: string) {
  const root = (await io.read(file)).getRoot();
  let tris = 0;
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris += p.getIndices()!.getCount() / 3;
  const maxTex = Math.max(0, ...root.listTextures().map(t => Math.max(...(t.getSize() ?? [0]))));
  return { tris, maxTex, clips: root.listAnimations().map(a => a.getName()), size: statSync(file).size };
}

describe('budget des ressources 3D', () => {
  it('le héros : ≤ 20 000 triangles, textures ≤ 1024 px, animations de jeu présentes', async () => {
    const h = await stats('src/assets/hero.glb');
    expect(h.tris).toBeLessThanOrEqual(20000);
    expect(h.maxTex).toBeLessThanOrEqual(1024);
    for (const c of ['run', 'jump', 'fall']) expect(h.clips).toContain(c);
    expect(h.size).toBeLessThan(2.5 * 1048576);
  });
  it.each(['colosse', 'sphinx', 'tete', 'brasero', 'idole', 'palmier', 'pylone', 'porte', 'pilier'])('la statue %s : ≤ 12 000 triangles, textures ≤ 1024 px, ≤ 1,5 Mo', async name => {
    const s = await stats(`src/assets/statues/${name}.glb`);
    expect(s.tris).toBeLessThanOrEqual(12000);
    expect(s.maxTex).toBeLessThanOrEqual(1024);
    expect(s.size).toBeLessThan(1.5 * 1048576);
  });
  it.each(['idole_lod', 'porte_lod', 'pilier_lod'])('la version lointaine %s : ≤ 2 500 triangles', async name => {
    const s = await stats(`src/assets/statues/${name}.glb`);
    expect(s.tris).toBeLessThanOrEqual(2500);
  });
  it('le cristal de fragment : ≤ 200 triangles (des dizaines à l’écran)', async () => {
    expect((await stats('src/assets/statues/cristal.glb')).tris).toBeLessThanOrEqual(200);
  });
  it('les images 2D livrées restent légères (≤ 300 Ko chacune)', () => {
    for (const f of readdirSync('src/assets/art')) expect(statSync(`src/assets/art/${f}`).size, f).toBeLessThan(300 * 1024);
  });
  it('les textures et le ciel de SOLARIS ≤ 1 Mo au total', () => {
    const total = readdirSync('src/assets/solaris').reduce((n, f) => n + statSync(`src/assets/solaris/${f}`).size, 0);
    expect(total).toBeLessThan(1048576);
  });
});
