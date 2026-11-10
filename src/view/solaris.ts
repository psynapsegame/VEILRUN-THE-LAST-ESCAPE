import * as THREE from 'three';
import { Builder, box, fluted, glowTexture } from './build';
import { SURFACES, Surface, installAtmosphere } from './materials';
import type { Particles } from './particles';
import type { Kind } from '../sim/config';

/** SOLARIS — the golden antique city. Palette, sky, ground, props and obstacle models. */
export const PAL = {
  // Masonry tints multiply the photographed sandstone, so they stay close to white.
  stone: 0xeedfc6,
  stoneDark: 0xb49a7c,
  stoneLight: 0xffffff,
  gold: 0xffc04d,
  violet: 0x8b5cff,
  cyan: 0x5fe8ff,
  fire: 0xff7a2a,
  fog: 0xc9b4a8,
  skyTop: 0x16306e,
  skyMid: 0x5f93cc,
  sand: 0xc48f58,
};

/** Where the sun sits in the sky (unit vector from the runner towards it). */
export const SUN_DIR = new THREE.Vector3(-0.18, 0.2, -1).normalize();
const GLOW = new Set([PAL.cyan, PAL.violet, PAL.fire, 0xffe08a, 0xfff0b0]);
const PLAIN = new Set([0x8a5a34, 0x9c6a3e, 0x3f8f4a, 0x56a85a, 0x7a4a2a]);
Builder.classify = c => (c === PAL.gold ? 1 : GLOW.has(c) ? 2 : PLAIN.has(c) ? 3 : 0);

const SLOT = 14; // metres between roadside props
const SLOTS = 13;

function hash(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

function sideProps(): THREE.BufferGeometry[] {
  const cyl = (r: number, h: number, seg = 10) => new THREE.CylinderGeometry(r, r, h, seg);
  const out: THREE.BufferGeometry[] = [];
  // Props are modelled for the left side around x = 0 (road edge towards +x).
  // 0: colonnade — two columns carrying an entablature
  {
    const b = new Builder();
    for (const z of [-3, 3]) {
      b.add(box(1.5, 0.5, 1.5), PAL.stoneDark, 0, 0.25, z)
        .add(fluted(0.55, 6), PAL.stoneLight, 0, 3.5, z)
        .add(cyl(0.6, 0.18), PAL.gold, 0, 1.2, z)
        .add(cyl(0.52, 0.18), PAL.gold, 0, 5.9, z)
        .add(box(1.5, 0.45, 1.5), PAL.stone, 0, 6.7, z);
    }
    b.add(box(1.7, 0.9, 8.2), PAL.stone, 0, 7.35, 0).add(box(1.9, 0.25, 8.6), PAL.gold, 0, 7.92, 0);
    out.push(b.build());
  }
  // 1: brazier on a pedestal
  {
    const b = new Builder();
    b.add(box(1.6, 1.2, 1.6), PAL.stoneDark, 0, 0.6, 0)
      .add(fluted(0.35, 1.6), PAL.stone, 0, 2.0, 0)
      .add(new THREE.CylinderGeometry(0.95, 0.35, 0.6, 10), PAL.gold, 0, 3.1, 0)
      .add(new THREE.ConeGeometry(0.6, 1.6, 7), PAL.fire, 0, 4.1, 0)
      .add(new THREE.ConeGeometry(0.32, 1.1, 6), 0xffe08a, 0.1, 4.2, 0.05);
    out.push(b.build());
  }
  // 2: stepped temple with a golden cap, set back from the road
  {
    const b = new Builder();
    for (let i = 0; i < 5; i++) b.add(box(11 - i * 2, 2.2, 11 - i * 2), i % 2 ? PAL.stone : PAL.stoneDark, -7, 1.1 + i * 2.2, 0);
    b.add(new THREE.ConeGeometry(1.5, 2.4, 4), PAL.gold, -7, 12.2, 0, 0, Math.PI / 4);
    b.add(box(0.5, 6, 3), PAL.violet, -1.6, 3, 0);
    out.push(b.build());
  }
  // 3: obelisk
  {
    const b = new Builder();
    b.add(box(2, 0.8, 2), PAL.stoneDark, 0, 0.4, 0)
      .add(new THREE.CylinderGeometry(0.45, 0.8, 9, 4), PAL.stoneLight, 0, 5.3, 0, 0, Math.PI / 4)
      .add(new THREE.ConeGeometry(0.64, 1.3, 4), PAL.gold, 0, 10.45, 0, 0, Math.PI / 4)
      .add(box(0.12, 3.5, 0.5), PAL.cyan, 0.52, 4.5, 0);
    out.push(b.build());
  }
  // 4: ruined column and rubble
  {
    const b = new Builder();
    b.add(box(1.5, 0.5, 1.5), PAL.stoneDark, 0, 0.25, 0)
      .add(fluted(0.55, 2.6), PAL.stoneLight, 0, 1.8, 0)
      .add(fluted(0.5, 2.4), PAL.stone, -1.4, 0.5, 1.8, 0, 0.4, Math.PI / 2)
      .add(box(0.9, 0.7, 0.8), PAL.stoneDark, 0.3, 0.35, -1.9, 0.2, 0.5, 0.1)
      .add(box(0.5, 0.4, 0.6), PAL.stone, -0.8, 0.2, -1.2, 0, 0.9, 0.3);
    out.push(b.build());
  }
  // 5: sun-banner mast
  {
    const b = new Builder();
    b.add(box(1.2, 0.6, 1.2), PAL.stoneDark, 0, 0.3, 0)
      .add(cyl(0.12, 8, 6), PAL.gold, 0, 4.6, 0)
      .add(box(0.08, 3.6, 1.5), PAL.violet, 0, 6.2, 0.9)
      .add(new THREE.TorusGeometry(0.6, 0.12, 6, 14), PAL.gold, 0, 9.2, 0, 0, Math.PI / 2);
    out.push(b.build());
  }
  // 6: palm tree
  {
    const b = new Builder();
    for (let i = 0; i < 6; i++)
      b.add(new THREE.CylinderGeometry(0.2 - i * 0.012, 0.24 - i * 0.012, 1.25, 7), i % 2 ? 0x8a5a34 : 0x9c6a3e, Math.sin(i * 0.5) * 0.35, 0.6 + i * 1.15, 0, 0, 0, -0.08 * i);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      b.add(new THREE.ConeGeometry(0.42, 3.4, 4), i % 2 ? 0x3f8f4a : 0x56a85a, 0.9 + Math.cos(a) * 1.35, 6.9 - (i % 3) * 0.18, Math.sin(a) * 1.35, 0, -a, -1.95, [1, 1, 0.18]);
    }
    b.add(new THREE.SphereGeometry(0.34, 8, 6), 0x7a4a2a, 0.9, 7.1, 0);
    out.push(b.build());
  }
  return out;
}

/** Monumental background buildings (second row, never reached). */
function farBuildings(): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  {
    const b = new Builder();
    for (let i = 0; i < 6; i++) b.add(box(26 - i * 4, 4, 22 - i * 3.4), i % 2 ? PAL.stone : PAL.stoneDark, 0, 2 + i * 4, 0);
    b.add(new THREE.ConeGeometry(3.4, 5, 4), PAL.gold, 0, 26.5, 0, 0, Math.PI / 4);
    for (const z of [-5, 0, 5]) b.add(box(0.4, 2.6, 1.4), PAL.cyan, 11.2, 6.2, z);
    b.add(box(0.5, 9, 4.5), PAL.violet, 13.1, 4.5, 0);
    out.push(b.build());
  }
  {
    const b = new Builder();
    b.add(box(16, 14, 16), PAL.stoneDark, 0, 7, 0).add(box(18, 1, 18), PAL.gold, 0, 14.5, 0)
      .add(new THREE.CylinderGeometry(6, 6.5, 8, 12), PAL.stone, 0, 19, 0)
      .add(new THREE.SphereGeometry(6.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), PAL.gold, 0, 23, 0)
      .add(new THREE.ConeGeometry(0.7, 5, 6), PAL.stoneLight, 0, 31, 0);
    for (const z of [-5, 0, 5]) b.add(box(0.4, 5, 2), PAL.cyan, 8.1, 7, z);
    out.push(b.build());
  }
  {
    const b = new Builder();
    for (const z of [-8, -4, 0, 4, 8]) b.add(fluted(1.1, 16), PAL.stoneLight, 6, 9, z);
    b.add(box(16, 1.5, 22), PAL.stoneDark, 0, 0.75, 0).add(box(15, 2.2, 21), PAL.stone, 0, 18.1, 0).add(box(16, 0.6, 22), PAL.gold, 0, 19.5, 0)
      .add(box(9, 16, 18), PAL.stoneDark, -2, 9, 0);
    out.push(b.build());
  }
  return out;
}

function archGeometry(): THREE.BufferGeometry {
  const b = new Builder();
  for (const s of [-1, 1]) {
    b.add(box(2.4, 1, 2.6), PAL.stoneDark, s * 6.2, 0.5, 0)
      .add(box(1.9, 9, 2.1), PAL.stone, s * 6.2, 5.5, 0)
      .add(box(2.2, 0.4, 2.4), PAL.gold, s * 6.2, 10.2, 0)
      .add(box(0.2, 5, 0.9), PAL.cyan, s * 5.2, 5.5, 0);
  }
  b.add(box(15.6, 1.8, 2.6), PAL.stoneLight, 0, 11.3, 0)
    .add(box(16.2, 0.4, 3), PAL.gold, 0, 12.4, 0)
    .add(new THREE.TorusGeometry(1.5, 0.28, 8, 20), PAL.gold, 0, 14.4, 0)
    .add(new THREE.SphereGeometry(0.9, 12, 8), 0xfff0b0, 0, 14.4, 0);
  for (const x of [-3.4, 3.4]) b.add(box(1.6, 3.6, 0.1), PAL.violet, x, 8.6, 0).add(box(1.8, 0.2, 0.16), PAL.gold, x, 6.75, 0);
  return b.build();
}

/** Obstacle models. Visual extents match the collision volumes in sim/config. */
export function obstacleGeometry(kind: Kind): THREE.BufferGeometry {
  const b = new Builder();
  if (kind === 'low') {
    // Toppled column drum lying across the lane
    b.add(new THREE.CylinderGeometry(0.44, 0.44, 1.7, 12), PAL.stoneLight, 0, 0.45, 0, 0, 0, Math.PI / 2);
    for (const x of [-0.6, 0, 0.6]) b.add(new THREE.CylinderGeometry(0.47, 0.47, 0.1, 12), PAL.gold, x, 0.45, 0, 0, 0, Math.PI / 2);
    b.add(box(0.5, 0.3, 0.5), PAL.stoneDark, -0.75, 0.15, 0.45, 0, 0.5, 0);
  } else if (kind === 'high') {
    // Sun gate: a beam at head height carrying a solar disc; slide beneath it
    for (const s of [-1, 1]) b.add(box(0.14, 3, 0.3), PAL.stoneDark, s * 0.92, 1.5, 0);
    b.add(box(2, 0.55, 0.5), PAL.stone, 0, 1.45, 0)
      .add(box(2, 0.1, 0.56), PAL.gold, 0, 1.2, 0)
      .add(new THREE.TorusGeometry(0.55, 0.11, 6, 16), PAL.gold, 0, 2.4, 0)
      .add(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 14), PAL.cyan, 0, 2.4, 0, Math.PI / 2)
      .add(box(2, 0.14, 0.3), PAL.stoneDark, 0, 3.05, 0);
  } else {
    // Guardian pillar: no way through, change lane
    b.add(box(1.7, 0.5, 1), PAL.stoneDark, 0, 0.25, 0)
      .add(new THREE.CylinderGeometry(0.5, 0.78, 2.4, 4), PAL.stone, 0, 1.7, 0, 0, Math.PI / 4)
      .add(box(0.5, 1.1, 0.08), PAL.violet, 0, 1.75, 0.5)
      .add(new THREE.ConeGeometry(0.72, 0.9, 4), PAL.gold, 0, 3.3, 0, 0, Math.PI / 4)
      .add(box(1.3, 0.14, 0.9), PAL.gold, 0, 0.57, 0);
  }
  return b.build();
}

export class Solaris {
  readonly group = new THREE.Group();
  private road: Surface;
  private terrace: Surface;
  private curb: Surface;
  private props: THREE.BufferGeometry[];
  private slots: { mesh: THREE.Mesh; k: number; side: number }[] = [];
  private arches: THREE.Mesh[] = [];
  /** Shared materials, indexed by Builder slot: masonry, gold, glowing, plain. */
  readonly mats: THREE.Material[];
  readonly wall: Surface;
  /** Rough-hewn stone (curbs, rubble). */
  get curbMaterial(): THREE.Material {
    return this.curb.material;
  }
  readonly sun: THREE.DirectionalLight;
  readonly glow = glowTexture();
  private sky: THREE.ShaderMaterial;
  private far: THREE.BufferGeometry[];
  private farSlots: { mesh: THREE.Mesh; k: number; side: number }[] = [];
  private fires: THREE.Sprite[] = [];

  constructor(scene: THREE.Scene) {
    installAtmosphere(SUN_DIR);
    scene.fog = new THREE.FogExp2(PAL.fog, 0.0026);
    this.wall = SURFACES.wall();
    this.wall.repeat.set(0.5, 0.5); // prop UVs are in half-metres: one texture tile spans 4 m
    this.mats = [
      this.wall.material,
      new THREE.MeshStandardMaterial({ metalness: 1, roughness: 0.3, vertexColors: true, envMapIntensity: 1.3 }),
      new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.5, 1.5, 1.5) }),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }),
    ];
    // The environment map provides the ambient light; the hemisphere only lifts the shadows a little.
    scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x8a6a4a, 0.35));
    const sun = (this.sun = new THREE.DirectionalLight(0xffd29a, 3.6));
    sun.position.set(-10, 11, -7);
    sun.target.position.set(0, 0, -14);
    scene.add(sun, sun.target);
    // One tight shadow map around the runner's playfield
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const sc = sun.shadow.camera;
    sc.left = -11; sc.right = 11; sc.top = 26; sc.bottom = -16; sc.near = 1; sc.far = 50;
    sun.shadow.bias = -0.0015;
    sun.shadow.normalBias = 0.04;

    // Sky dome: violet zenith melting into a golden horizon, with the sun ahead
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(400, 24, 12),
      new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: { top: { value: new THREE.Color(PAL.skyTop) }, mid: { value: new THREE.Color(PAL.skyMid) }, hor: { value: new THREE.Color(PAL.fog) }, time: { value: 0 } },
        vertexShader: 'varying vec3 d; void main(){ d = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `precision highp float; varying vec3 d; uniform vec3 top, mid, hor; uniform float time;
          float hs(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float ns(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
            return mix(mix(hs(i), hs(i+vec2(1,0)), f.x), mix(hs(i+vec2(0,1)), hs(i+vec2(1,1)), f.x), f.y); }
          void main(){ vec3 n = normalize(d); float h = clamp(n.y, 0.0, 1.0);
            float s = max(0.0, dot(n, normalize(vec3(-0.18, 0.2, -1.0))));
            // Haze at the horizon turns gold around the sun, exactly like the fog on the ground
            vec3 haze = mix(hor, vec3(1.3, 0.86, 0.46), pow(s, 8.0));
            vec3 c = mix(haze, mid, smoothstep(0.0, 0.3, h)); c = mix(c, top, smoothstep(0.2, 0.85, h));
            c += vec3(1.0, 0.62, 0.3) * pow(s, 4.0) * 0.22 * (1.0 - h);
            vec2 q = n.xz / (n.y + 0.12) * vec2(1.2, 2.6) + vec2(time * 0.012, 0.0);
            float cl = ns(q) * 0.55 + ns(q * 2.3) * 0.3 + ns(q * 5.1) * 0.15;
            cl = smoothstep(0.5, 0.82, cl) * smoothstep(0.015, 0.16, n.y) * (1.0 - smoothstep(0.5, 0.85, h));
            vec3 cc = mix(vec3(0.82, 0.8, 0.9), vec3(1.6, 1.05, 0.62), clamp(s * 1.5 + 0.2 - h, 0.0, 1.0));
            c = mix(c, cc, cl * 0.85);
            c += vec3(1.0, 0.85, 0.6) * (pow(s, 1200.0) * 14.0 + pow(s, 60.0) * 0.35);
            gl_FragColor = vec4(c, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      }),
    );
    sky.renderOrder = -10;
    this.sky = sky.material as THREE.ShaderMaterial;
    this.group.add(sky);

    // Road: polished cream slabs with gold lane inlays, between rough-hewn curbs
    this.road = SURFACES.road();
    this.road.repeat.set(8 / 3, 240 / 3);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(8, 240), this.road.material);
    road.rotation.x = -Math.PI / 2;
    road.position.z = -100;
    road.receiveShadow = true;
    this.group.add(road);
    const gold = new THREE.MeshStandardMaterial({ color: 0xffc35a, metalness: 1, roughness: 0.32, envMapIntensity: 1.3 });
    for (const x of [-1.1, 1.1, -3.7, 3.7]) {
      const inlay = new THREE.Mesh(box(Math.abs(x) > 2 ? 0.22 : 0.09, 0.02, 240), gold);
      inlay.position.set(x, 0.003, -100);
      this.group.add(inlay);
    }
    this.terrace = SURFACES.terrace();
    this.terrace.repeat.set(125, 125);
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), this.terrace.material);
    sand.receiveShadow = true;
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, -0.6, -150);
    this.group.add(sand);
    this.curb = SURFACES.rough();
    for (const s of [-1, 1]) {
      const geo = box(0.7, 0.9, 240);
      const P = geo.attributes.position, uv = geo.attributes.uv;
      for (let i = 0; i < P.count; i++) uv.setXY(i, P.getZ(i) * 0.4, (P.getX(i) + P.getY(i)) * 0.4);
      const curb = new THREE.Mesh(geo, this.curb.material);
      curb.position.set(s * 4.35, -0.1, -100);
      curb.castShadow = curb.receiveShadow = true;
      this.group.add(curb);
    }

    // Far skyline: hazy pyramids that never get closer
    const haze = new THREE.MeshBasicMaterial({ color: 0xb9a7a4, fog: false });
    const haze2 = new THREE.MeshBasicMaterial({ color: 0xcdb7a6, fog: false });
    const spots: [number, number, number, number][] = [[-110, -300, 70, 0], [95, -330, 95, 1], [-30, -360, 55, 1], [170, -280, 50, 0], [-200, -310, 60, 1]];
    for (const [x, z, h, m] of spots) {
      const p = new THREE.Mesh(new THREE.ConeGeometry(h * 0.85, h, 4), m ? haze2 : haze);
      p.position.set(x, h / 2 - 2, z);
      p.rotation.y = Math.PI / 4;
      this.group.add(p);
    }

    this.props = sideProps();
    for (let i = 0; i < SLOTS; i++)
      for (const side of [-1, 1]) {
        const mesh = new THREE.Mesh(this.props[0], this.mats);
        mesh.scale.x = -side; // props are modelled for the left side
        mesh.castShadow = true;
        this.group.add(mesh);
        this.slots.push({ mesh, k: -1e9, side });
        const fire = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: 0xff9a3c, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
        fire.scale.setScalar(5);
        fire.visible = false;
        this.group.add(fire);
        this.fires.push(fire);
      }
    this.far = farBuildings();
    for (let i = 0; i < 7; i++)
      for (const side of [-1, 1]) {
        const mesh = new THREE.Mesh(this.far[0], this.mats);
        mesh.scale.x = -side;
        this.group.add(mesh);
        this.farSlots.push({ mesh, k: -1e9, side });
      }
    const arch = archGeometry();
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(arch, this.mats);
      this.group.add(m);
      this.arches.push(m);
    }
    scene.add(this.group);
  }

  /** Recycle props around the runner. No allocation: geometries are shared, meshes reused. */
  update(dist: number, dt: number, parts: Particles): void {
    this.sky.uniforms.time.value += dt;
    this.road.offset.y = (dist / 3) % 1;
    this.terrace.offset.y = (dist / 4) % 1;
    this.curb.offset.x = -((dist * 0.4) % 1);
    const FAR = 30;
    const fb = Math.floor(dist / FAR) - 1;
    for (let n = 0; n < this.farSlots.length; n++) {
      const s = this.farSlots[n];
      const k = fb + (n >> 1);
      if (s.k !== k) {
        s.k = k;
        const h = hash(k * 2 + 77 + (s.side > 0 ? 1 : 0));
        s.mesh.geometry = this.far[Math.floor(h * this.far.length)];
        s.mesh.position.x = s.side * (30 + h * 10);
      }
      s.mesh.position.z = dist - k * FAR - 9;
    }
    const base = Math.floor(dist / SLOT) - 1;
    for (let n = 0; n < this.slots.length; n++) {
      const s = this.slots[n];
      const k = base + (n >> 1);
      if (s.k !== k) {
        s.k = k;
        const h = hash(k * 2 + (s.side > 0 ? 1 : 0));
        s.mesh.geometry = this.props[Math.floor(h * this.props.length)];
        s.mesh.position.x = s.side * (6.4 + hash(k * 31 + s.side) * 1.5);
        s.mesh.userData.fire = s.mesh.geometry === this.props[1];
      }
      s.mesh.position.z = dist - k * SLOT;
      // Braziers: flickering halo and rising embers
      const fire = this.fires[n];
      fire.visible = s.mesh.userData.fire;
      if (fire.visible) {
        fire.position.set(s.mesh.position.x, 4.2, s.mesh.position.z);
        fire.scale.setScalar(4.4 + Math.sin(dist * 0.9 + n) * 0.5 + Math.random() * 0.5);
        if (s.mesh.position.z > -90 && Math.random() < dt * 14)
          parts.emit(fire.position.x + (Math.random() - 0.5) * 0.6, 4, fire.position.z, (Math.random() - 0.5) * 0.6, 1.5 + Math.random() * 2, 0, 1, 0.5, 0.15, 0.9);
      }
    }
    const ARCH = SLOT * 6;
    const ab = Math.floor(dist / ARCH);
    for (let i = 0; i < this.arches.length; i++) this.arches[i].position.z = dist - (ab + i) * ARCH - SLOT / 2;
  }
}
