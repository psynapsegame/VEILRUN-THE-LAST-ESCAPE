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
  return loading.track(
    Promise.all([colosseAsset, sphinxAsset, headAsset, brazierAsset, idolAsset, idolLodAsset, palmAsset, pylonAsset, crystalAsset, gateAsset, gateLodAsset, pillarAsset, pillarLodAsset].map(one)).then(
      ([colossus, sphinx, head, brazier, idol, idolLod, palm, pylon, crystal, gate, gateLod, pillar, pillarLod]) => ({ colossus, sphinx, head, brazier, idol, idolLod, palm, pylon, crystal, gate, gateLod, pillar, pillarLod }),
    ),
  );
}
