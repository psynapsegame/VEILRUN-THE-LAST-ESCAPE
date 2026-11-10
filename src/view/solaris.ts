import * as THREE from 'three';
import { box, glowTexture } from './build';
import { Banners } from './banners';
import { Devourer } from './devourer';
import frescoesUrl from '../assets/art/frescoes.webp';
import panoramaUrl from '../assets/art/panorama.webp';
import { Anchor, BRIDGE, GATE_BANNERS, NO_COLLAPSE, STATUES, StatuePlacement, columnGeometry, farBuildings, gateGeometry, sideProps } from './kit';
import { loadTexture } from './loading';
import { Statue, Statues, loadStatues } from './statues';
import { PAL } from './palette';
import { SURFACES, Surface, installAtmosphere } from './materials';
import type { Particles } from './particles';

/** SOLARIS — the golden antique city: sky, light, causeway and the recycling of kit pieces. */
/** Where the sun sits in the sky (unit vector from the runner towards it). */
export const SUN_DIR = new THREE.Vector3(-0.18, 0.2, -1).normalize();
const SLOT = 14; // metres between roadside props
const SLOTS = 13;
/** Which far buildings appear, weighted: the giant colossus is rarer than the rest. */
const FAR_PICK = [0, 1, 2, 3, 0, 1, 3];

/** Slots belonging to an open bridge section. */
function onBridge(k: number): boolean {
  return ((k % 30) + 30) % 30 >= 22;
}

function hash(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

export class Solaris {
  readonly group = new THREE.Group();
  private road: Surface;
  private terrace: Surface;
  private curb: Surface;
  private props: THREE.BufferGeometry[];
  private propFire: number[];
  private propBanners: Anchor[][];
  private banners = new Banners();
  private devourer: Devourer;
  private fallers: { mesh: THREE.Mesh; k: number; side: number; angle: number; vel: number; done: boolean }[] = [];
  /** Resolves once every sculpted statue is loaded (the world swaps its obstacle model in then). */
  readonly statuesReady: Promise<Statues>;
  /** Called when a toppling column hits the ground (camera shake, sound). */
  onImpact: ((x: number, z: number) => void) | null = null;
  private slots: { mesh: THREE.Mesh; k: number; side: number; statues: Map<number, THREE.Mesh> }[] = [];
  private arches: THREE.Mesh[] = [];
  /** Shared materials, indexed by Builder slot: masonry, gold, glowing, plain, painted panels. */
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
  private farSlots: { mesh: THREE.Mesh; k: number; side: number; statues: Map<number, THREE.Mesh> }[] = [];
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
      (() => {
        // Mural and carved frieze: the picture is its own relief, so it doubles as a bump map
        const map = loadTexture(frescoesUrl);
        map.anisotropy = 4;
        return new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: 1.6, roughness: 0.92 });
      })(),
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
    sand.position.set(0, -8, -150);
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
      // Retaining wall: the road is a causeway raised above the city floor
      const wg = box(1, 8, 240);
      const WP = wg.attributes.position, wuv = wg.attributes.uv;
      for (let i = 0; i < WP.count; i++) wuv.setXY(i, WP.getZ(i) * 0.4, (WP.getX(i) + WP.getY(i)) * 0.4);
      const wall = new THREE.Mesh(wg, this.curb.material);
      wall.position.set(s * 4.5, -4.5, -100);
      this.group.add(wall);
    }

    // Distant city: a painted panorama far beyond the playfield, faded into the sky at the top and sides.
    // Its low sun sits near the real one (the left of the picture).
    const pano = new THREE.Mesh(
      new THREE.PlaneGeometry(560, 140),
      new THREE.MeshBasicMaterial({ map: loadTexture(panoramaUrl), transparent: true, depthWrite: false, fog: false }),
    );
    pano.position.set(180, -14 + 70, -470);
    this.group.add(pano);

    const kit = sideProps();
    this.props = kit.geos;
    this.propFire = kit.fire;
    this.propBanners = kit.banners;
    this.group.add(this.banners.mesh);
    this.devourer = new Devourer(this.glow);
    this.group.add(this.devourer.group);
    const colGeo = columnGeometry();
    for (let i = 0; i < 4; i++) {
      const mesh = new THREE.Mesh(colGeo, this.mats);
      mesh.castShadow = true;
      mesh.visible = false;
      this.group.add(mesh);
      this.fallers.push({ mesh, k: -1e9, side: 1, angle: 0, vel: 0, done: false });
    }
    for (let i = 0; i < SLOTS; i++)
      for (const side of [-1, 1]) {
        const mesh = new THREE.Mesh(this.props[0], this.mats);
        mesh.scale.x = -side; // props are modelled for the left side
        mesh.castShadow = true;
        this.group.add(mesh);
        this.slots.push({ mesh, k: -1e9, side, statues: new Map() });
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
        this.farSlots.push({ mesh, k: -1e9, side, statues: new Map() });
      }
    const arch = gateGeometry();
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(arch, this.mats);
      this.group.add(m);
      this.arches.push(m);
    }
    scene.add(this.group);
    this.statuesReady = loadStatues();
    void this.statuesReady.then(st => this.attachStatues(st));
  }

  /** Stand the sculpted statues on their plinths: one hidden mesh per slot and statue, shown with its piece. */
  private attachStatues(st: Statues): void {
    const byId: Record<StatuePlacement['id'], Statue> = { colossus: st.colossus, sphinx: st.sphinx, head: st.head, brazier: st.brazier };
    for (const place of STATUES) {
      const statue = byId[place.id];
      for (const slot of place.far ? this.farSlots : this.slots) {
        const m = new THREE.Mesh(statue.geometry, statue.material);
        m.position.set(place.x, place.y, place.z);
        m.rotation.y = place.ry;
        m.scale.setScalar(place.scale);
        m.castShadow = !place.far;
        m.visible = false;
        slot.mesh.add(m);
        slot.statues.set(place.index, m);
        const idx = slot.mesh.userData.index;
        if (idx !== undefined) m.visible = idx === place.index;
      }
    }
  }

  /** Stand a column on the road-side corner of some city blocks, ready to fall. */
  private armFaller(k: number, side: number, geo: THREE.BufferGeometry): void {
    const i = this.props.indexOf(geo);
    if (i === BRIDGE || NO_COLLAPSE.has(i) || hash(k * 13 + side * 7) > 0.2) return;
    const f = this.fallers.find(x => !x.mesh.visible);
    if (!f) return;
    Object.assign(f, { k, side, angle: 0, vel: 0, done: false });
    f.mesh.visible = true;
    f.mesh.rotation.x = 0;
    f.mesh.position.set(side * 6.2, 0, 0);
  }

  /** Recycle props around the runner. No allocation: geometries are shared, meshes reused. */
  update(dist: number, dt: number, parts: Particles): void {
    this.sky.uniforms.time.value += dt;
    this.banners.begin(dt);
    this.devourer.update(dt, onBridge(Math.floor(dist / SLOT) + 2));
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
        const fi = FAR_PICK[Math.floor(h * FAR_PICK.length)];
        s.mesh.geometry = this.far[fi];
        s.mesh.userData.index = fi;
        for (const [idx, m] of s.statues) m.visible = idx === fi;
        s.mesh.position.x = s.side * (38 + h * 12);
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
        // Stretches of open bridge alternate with dense city blocks
        const pi = onBridge(k) ? BRIDGE : Math.floor(h * BRIDGE);
        s.mesh.geometry = this.props[pi];
        s.mesh.userData.index = pi;
        for (const [idx, m] of s.statues) m.visible = idx === pi;
        s.mesh.userData.banners = this.propBanners[pi];
        this.armFaller(k, s.side, s.mesh.geometry);
        s.mesh.position.x = s.side * 7.9;
        s.mesh.userData.fire = this.propFire[pi];
      }
      s.mesh.position.z = dist - k * SLOT;
      if (s.mesh.position.z > -150) for (const a of s.mesh.userData.banners as Anchor[]) this.banners.add(a, s.mesh.position.x, s.mesh.position.z, -s.side);
      // Braziers: flickering halo and rising embers
      const fire = this.fires[n];
      fire.visible = s.mesh.userData.fire > 0;
      if (fire.visible) {
        fire.position.set(s.mesh.position.x, s.mesh.userData.fire, s.mesh.position.z);
        fire.scale.setScalar(4.4 + Math.sin(dist * 0.9 + n) * 0.5 + Math.random() * 0.5);
        if (s.mesh.position.z > -90 && Math.random() < dt * 14)
          parts.emit(fire.position.x + (Math.random() - 0.5) * 0.6, fire.position.y, fire.position.z, (Math.random() - 0.5) * 0.6, 1.5 + Math.random() * 2, 0, 1, 0.5, 0.15, 0.9);
      }
    }
    const ARCH = SLOT * 6;
    const ab = Math.floor(dist / ARCH);
    for (let i = 0; i < this.arches.length; i++) {
      const z = dist - (ab + i) * ARCH - SLOT / 2;
      this.arches[i].position.z = z;
      for (const a of GATE_BANNERS) this.banners.add(a, 0, z, 1);
    }
    this.banners.end();

    // Collapse set pieces: a column near the road topples as the runner approaches
    for (const f of this.fallers) {
      if (!f.mesh.visible) continue;
      const z = dist - f.k * SLOT - 5.2;
      f.mesh.position.z = z;
      if (z > 30) { f.mesh.visible = false; continue; }
      if (z > -42 && !f.done) {
        f.vel += (0.5 + 3.4 * Math.sin(f.angle + 0.06)) * dt;
        f.angle += f.vel * dt;
        if (f.angle >= Math.PI / 2 - 0.04) {
          f.angle = Math.PI / 2 - 0.04;
          f.done = true;
          for (let i = 0; i < 26; i++)
            parts.emit(f.mesh.position.x + (Math.random() - 0.5) * 1.5, 0.3, z + 1 + Math.random() * 6, (Math.random() - 0.5) * 4, 1 + Math.random() * 3, (Math.random() - 0.5) * 3, 0.75, 0.6, 0.42, 1.1, 3);
          this.onImpact?.(f.mesh.position.x, z);
        }
        f.mesh.rotation.x = f.angle; // falls along the road, towards the runner, clear of the lanes
      }
    }
  }
}

export { PAL };
