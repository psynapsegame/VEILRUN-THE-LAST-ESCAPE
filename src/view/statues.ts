import * as THREE from 'three';
import colosseAsset from '../assets/statues/colosse.glb';
import sphinxAsset from '../assets/statues/sphinx.glb';
import headAsset from '../assets/statues/tete.glb';
import brazierAsset from '../assets/statues/brasero.glb';
import idolAsset from '../assets/statues/idole.glb';
import idolLodAsset from '../assets/statues/idole_lod.glb';
import palmAsset from '../assets/statues/palmier.glb';
import pylonAsset from '../assets/statues/pylone.glb';
import crystalAsset from '../assets/statues/cristal.glb';
import gateAsset from '../assets/statues/porte.glb';
import gateLodAsset from '../assets/statues/porte_lod.glb';
import pillarAsset from '../assets/statues/pilier.glb';
import pillarLodAsset from '../assets/statues/pilier_lod.glb';
import colossusLodAsset from '../assets/statues/colosse_lod.glb';
import sphinxLodAsset from '../assets/statues/sphinx_lod.glb';
import headLodAsset from '../assets/statues/tete_lod.glb';
import brazierLodAsset from '../assets/statues/brasero_lod.glb';
import palmLodAsset from '../assets/statues/palmier_lod.glb';
import pylonLodAsset from '../assets/statues/pylone_lod.glb';
import { loadGlb } from './glb';
import { loading } from './loading';

/** A sculpted statue prepared by tools/build-statue.mjs: origin at the middle of its base, y = 0 on the ground. */
export interface Statue {
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
}
export interface Statues {
  colossus: Statue;
  sphinx: Statue;
  head: Statue;
  brazier: Statue;
  /** The guardian idol (obstacle), at full detail and as a very light version for the far rows. */
  idol: Statue;
  idolLod: Statue;
  palm: Statue;
  pylon: Statue;
  /** Fragment crystal: simple faceted prism, upright (its texture is not used). */
  crystal: Statue;
  /** The sun gate ('high' obstacle) and the fallen pillar ('low' obstacle), full detail and far versions. */
  gate: Statue;
  gateLod: Statue;
  pillar: Statue;
  pillarLod: Statue;
  /** Very light versions (400-800 triangles) shown beyond a distance: only their geometry is used. */
  lod: { colossus: THREE.BufferGeometry; sphinx: THREE.BufferGeometry; head: THREE.BufferGeometry; brazier: THREE.BufferGeometry; palm: THREE.BufferGeometry; pylon: THREE.BufferGeometry };
}

async function one(asset: string | Uint8Array): Promise<Statue> {
  const gltf = await loadGlb(asset);
  const meshes: THREE.Mesh[] = [];
  gltf.scene.traverse(o => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
  });
  if (!meshes.length) throw new Error('statue: no mesh in file');
  const mesh = meshes[0];
  mesh.updateWorldMatrix(true, false);
  const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
  const material = mesh.material as THREE.MeshStandardMaterial;
  for (const t of [material.map, material.normalMap, material.metalnessMap, material.roughnessMap]) if (t) t.anisotropy = 4;
  return { geometry, material };
}

export function loadStatues(): Promise<Statues> {
  const main = [colosseAsset, sphinxAsset, headAsset, brazierAsset, idolAsset, idolLodAsset, palmAsset, pylonAsset, crystalAsset, gateAsset, gateLodAsset, pillarAsset, pillarLodAsset];
  const far = [colossusLodAsset, sphinxLodAsset, headLodAsset, brazierLodAsset, palmLodAsset, pylonLodAsset];
  return loading.track(
    Promise.all([Promise.all(main.map(one)), Promise.all(far.map(one))]).then(([m, f]) => ({
      colossus: m[0], sphinx: m[1], head: m[2], brazier: m[3], idol: m[4], idolLod: m[5], palm: m[6], pylon: m[7], crystal: m[8],
      gate: m[9], gateLod: m[10], pillar: m[11], pillarLod: m[12],
      lod: { colossus: f[0].geometry, sphinx: f[1].geometry, head: f[2].geometry, brazier: f[3].geometry, palm: f[4].geometry, pylon: f[5].geometry },
    })),
  );
}
