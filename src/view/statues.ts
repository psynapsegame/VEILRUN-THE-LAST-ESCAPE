import * as THREE from 'three';
import colosseAsset from '../assets/statues/colosse.glb';
import sphinxAsset from '../assets/statues/sphinx.glb';
import headAsset from '../assets/statues/tete.glb';
import brazierAsset from '../assets/statues/brasero.glb';
import idolAsset from '../assets/statues/idole.glb';
import idolLodAsset from '../assets/statues/idole_lod.glb';
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
    Promise.all([colosseAsset, sphinxAsset, headAsset, brazierAsset, idolAsset, idolLodAsset].map(one)).then(
      ([colossus, sphinx, head, brazier, idol, idolLod]) => ({ colossus, sphinx, head, brazier, idol, idolLod }),
    ),
  );
}
