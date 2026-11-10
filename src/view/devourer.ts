import * as THREE from 'three';
import devourerUrl from '../assets/art/devourer.webp';
import { loadTexture } from './loading';

const H = 190; // height of the painted figure, in metres, at about 440 m from the runner
const W = (H * 765) / 1024;

/**
 * The Devourer: the thing the runner is fleeing, glimpsed far beyond the city. It never moves in or out of view:
 * it stands on the horizon, and the haze around it thins or thickens. The picture is made to flow like smoke
 * (animated distortion, edges that erode and re-form, lower body melting into the dust) and is tinted by the
 * atmosphere so it reads as very far away. Its presence grows with the distance run.
 * A sculpted, rigged 3D creature would replace this picture later.
 */
export class Devourer {
  readonly group = new THREE.Group();
  private eyes: THREE.Sprite[] = [];
  private body: THREE.Mesh;
  private uniforms = { uTime: { value: 0 }, uPresence: { value: 0 } };
  /** 0 = lost in the haze, 1 = fully visible (tests may set it directly). */
  presence = 0;
  private t = 0;

  constructor(glow: THREE.Texture) {
    const mat = new THREE.MeshBasicMaterial({ map: loadTexture(devourerUrl), transparent: true, depthWrite: false, fog: false });
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, this.uniforms);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform float uTime; uniform float uPresence;
          float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
            return mix(mix(h21(i), h21(i+vec2(1.0,0.0)), f.x), mix(h21(i+vec2(0.0,1.0)), h21(i+vec2(1.0,1.0)), f.x), f.y); }
          float fbm(vec2 p){ return vn(p)*0.55 + vn(p*2.1)*0.3 + vn(p*4.3)*0.15; }`)
        .replace('#include <map_fragment>', `
          vec2 flow = vec2(fbm(vMapUv*5.0 + vec2(0.0, uTime*0.10)), fbm(vMapUv*5.0 + vec2(7.3, uTime*0.08))) - 0.5;
          vec4 sampledDiffuseColor = texture2D(map, vMapUv + flow * 0.035);
          float n = fbm(vMapUv*6.0 + vec2(uTime*0.03, -uTime*0.06));
          float th = 1.0 - uPresence * 1.35;
          sampledDiffuseColor.a *= smoothstep(th, th + 0.3, n) * (0.88 + 0.12 * sin(uTime*0.7));
          sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, vec3(0.74, 0.62, 0.48), 0.38); // aerial perspective
          diffuseColor *= sampledDiffuseColor;`);
    };
    this.body = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat);
    this.body.position.y = H / 2;
    this.group.add(this.body);
    // Eyes sit at 45% and 52% of the picture's width, 27% from its top
    for (const u of [0.451, 0.519]) {
      const eye = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0x7ff3ff, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0 }));
      eye.position.set((u - 0.5) * W, (1 - 0.266) * H, 1);
      eye.scale.setScalar(10);
      this.group.add(eye);
      this.eyes.push(eye);
    }
    this.group.position.set(30, -8, -440);
    this.group.visible = false;
  }

  /** `target` is the wanted presence (0..1); it is approached slowly, over a few seconds. */
  update(dt: number, target: number): void {
    this.t += dt;
    this.presence += (target - this.presence) * (1 - Math.exp(-dt * 0.45));
    this.group.visible = this.presence > 0.03;
    if (!this.group.visible) return;
    this.uniforms.uTime.value = this.t;
    this.uniforms.uPresence.value = this.presence;
    this.group.position.y = -8 + Math.sin(this.t * 0.4) * 1.2; // breathes; never slides in or out
    const eyes = Math.max(0, (this.presence - 0.4) / 0.6);
    const pulse = 0.65 + 0.35 * Math.sin(this.t * 2.6);
    for (const e of this.eyes) e.material.opacity = eyes * eyes * pulse;
  }
}
