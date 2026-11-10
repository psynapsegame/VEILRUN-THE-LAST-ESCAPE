import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * A dimensional portal: a glowing ring across the whole road with a swirling vortex inside. The vortex wears
 * the colours of the world it leads to (neon for NEXUS, gold for SOLARIS). It stands at a fixed place on the
 * road, so it scrolls past like everything else; the world itself is swapped as the runner crosses it.
 */
export class Portal {
  readonly group = new THREE.Group();
  private mat: THREE.ShaderMaterial;
  private halo: THREE.Sprite;
  private target = -1;

  constructor(glow: THREE.Texture) {
    const white = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 2.6, 3.0), fog: false });
    const pink = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.8, 0.6, 2.4), fog: false });
    this.group.add(new THREE.Mesh(new THREE.TorusGeometry(4.75, 0.36, 12, 64), white));
    this.group.add(new THREE.Mesh(new THREE.TorusGeometry(4.15, 0.1, 8, 64), pink));
    // Emitters spaced around the ring
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const g = new THREE.BoxGeometry(0.55, 1.0, 0.7);
      g.rotateZ(a - Math.PI / 2);
      g.translate(Math.cos(a) * 5.2, Math.sin(a) * 5.2, 0);
      parts.push(g);
    }
    this.group.add(new THREE.Mesh(mergeGeometries(parts)!, new THREE.MeshStandardMaterial({ color: 0x1a2038, metalness: 0.9, roughness: 0.3 })));

    this.mat = new THREE.ShaderMaterial({
      fog: false,
      uniforms: { time: { value: 0 }, colA: { value: new THREE.Color() }, colB: { value: new THREE.Color() } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `varying vec2 vUv; uniform float time; uniform vec3 colA, colB;
        void main(){ vec2 p = vUv * 2.0 - 1.0; float r = length(p); float a = atan(p.y, p.x);
          float s = sin(a * 3.0 + r * 9.0 - time * 4.0) * 0.5 + 0.5;
          float s2 = sin(a * 5.0 - r * 14.0 + time * 3.0) * 0.5 + 0.5;
          vec3 c = mix(colA, colB, s * 0.7 + s2 * 0.3) * (1.5 - r * 0.8);
          c += vec3(1.0) * pow(max(0.0, 1.0 - r * 1.5), 3.0) * 1.2;
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(4.4, 56), this.mat);
    disc.position.z = -0.05;
    this.group.add(disc);
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.8 }));
    this.halo.scale.setScalar(26);
    this.halo.position.z = -0.4;
    this.group.add(this.halo);
    this.group.visible = false;
  }

  /** `z` is the portal's scene z (negative ahead of the runner); `toWorld` the world it leads to. */
  update(z: number, toWorld: number, time: number): void {
    this.group.visible = z > -320 && z < 16;
    if (!this.group.visible) return;
    this.group.position.set(0, 4.75, z);
    this.mat.uniforms.time.value = time;
    if (toWorld !== this.target) {
      this.target = toWorld;
      if (toWorld === 1) { this.mat.uniforms.colA.value.setRGB(0.1, 0.9, 1.4); this.mat.uniforms.colB.value.setRGB(1.5, 0.2, 1.2); this.halo.material.color.setRGB(0.6, 0.5, 1.0); }
      else { this.mat.uniforms.colA.value.setRGB(1.5, 0.9, 0.2); this.mat.uniforms.colB.value.setRGB(1.6, 0.35, 0.1); this.halo.material.color.setRGB(1.0, 0.7, 0.3); }
    }
    this.halo.material.opacity = 0.65 + 0.15 * Math.sin(time * 3);
  }
}
