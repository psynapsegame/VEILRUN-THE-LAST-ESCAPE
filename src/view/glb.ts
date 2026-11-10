import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** Loads a .glb imported either as a URL (normal build) or as raw bytes (single-file build). */
export async function loadGlb(asset: string | Uint8Array): Promise<GLTF> {
  const buf =
    typeof asset === 'string'
      ? await (await fetch(asset)).arrayBuffer()
      : (asset.buffer.slice(asset.byteOffset, asset.byteOffset + asset.byteLength) as ArrayBuffer);
  return new GLTFLoader().parseAsync(buf, '');
}
