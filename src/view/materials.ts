import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import wallD from '../assets/solaris/wall_diff.webp';
import wallN from '../assets/solaris/wall_nor.webp';
import wallA from '../assets/solaris/wall_arm.webp';
import roughD from '../assets/solaris/rough_diff.webp';
import roughN from '../assets/solaris/rough_nor.webp';
import roughA from '../assets/solaris/rough_arm.webp';
import roadD from '../assets/solaris/road_diff.webp';
import roadN from '../assets/solaris/road_nor.webp';
import roadA from '../assets/solaris/road_arm.webp';
import skyHdr from '../assets/solaris/sky.hdr';
import { loadTexture, loading } from './loading';


/** One photographed PBR surface: colour, normal and AO/roughness maps sharing a UV transform. */
export class Surface {
  readonly material: THREE.MeshStandardMaterial;
  readonly offset = new THREE.Vector2();
  readonly repeat = new THREE.Vector2(1, 1);

  constructor(diff: string, nor: string, arm: string, opts: THREE.MeshStandardMaterialParameters = {}) {
    const load = (url: string, srgb: boolean) => {
      const t = loadTexture(url, srgb);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 4;
      t.offset = this.offset;
      t.repeat = this.repeat;
      return t;
    };
    const a = load(arm, false);
    this.material = new THREE.MeshStandardMaterial({
      map: load(diff, true), normalMap: load(nor, false), aoMap: a, roughnessMap: a,
      roughness: 1, metalness: 0, ...opts,
    });
  }
}

export const SURFACES = {
  wall: () => new Surface(wallD, wallN, wallA, { vertexColors: true }),
  rough: () => new Surface(roughD, roughN, roughA),
  road: () => new Surface(roadD, roadN, roadA, { color: 0xf3e2c4 }),
  terrace: () => new Surface(wallD, wallN, wallA, { color: 0xd9bf9a }),
};

/** Image-based lighting from the prepared HDRI (the sun is already turned to face the runner). */
export function loadEnvironment(renderer: THREE.WebGLRenderer): Promise<THREE.Texture> {
  return loading.track(buildEnvironment(renderer));
}

async function buildEnvironment(renderer: THREE.WebGLRenderer): Promise<THREE.Texture> {
  const buf =
    typeof skyHdr === 'string'
      ? await (await fetch(skyHdr)).arrayBuffer()
      : (skyHdr.buffer.slice(skyHdr.byteOffset, skyHdr.byteOffset + skyHdr.byteLength) as ArrayBuffer);
  const d = new RGBELoader().parse(buf);
  const tex = new THREE.DataTexture(d.data as never, d.width, d.height, THREE.RGBAFormat, d.type);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.flipY = true;
  tex.needsUpdate = true;
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromEquirectangular(tex).texture;
  pm.dispose();
  tex.dispose();
  return env;
}

/**
 * Replaces three.js' flat distance fog with a height fog that pools near the
 * ground and glows towards the sun. Applies to every fogged material.
 */
export function installAtmosphere(sun: THREE.Vector3): void {
  const C = THREE.ShaderChunk;
  C.fog_pars_vertex = '#ifdef USE_FOG\n varying float vFogDepth;\n varying vec3 vFogWorld;\n#endif';
  C.fog_vertex = '#ifdef USE_FOG\n vFogDepth = - mvPosition.z;\n vFogWorld = cameraPosition + transpose(mat3(viewMatrix)) * mvPosition.xyz;\n#endif';
  C.fog_pars_fragment = '#ifdef USE_FOG\n uniform vec3 fogColor;\n varying float vFogDepth;\n varying vec3 vFogWorld;\n uniform float fogDensity;\n#endif';
  C.fog_fragment = `#ifdef USE_FOG
    vec3 fogRay = vFogWorld - cameraPosition;
    float fogDist = length(fogRay);
    float fogH = exp(-max(0.5 * (vFogWorld.y + cameraPosition.y), -40.0) * 0.07);
    float fogFactor = 1.0 - exp(-fogDist * fogDensity * (0.35 + 1.9 * fogH));
    float fogSun = pow(max(dot(fogRay / max(fogDist, 0.001), vec3(${sun.x.toFixed(4)}, ${sun.y.toFixed(4)}, ${sun.z.toFixed(4)})), 0.0), 8.0);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, mix(fogColor, vec3(1.3, 0.86, 0.46), fogSun), clamp(fogFactor, 0.0, 1.0));
  #endif`;
}
