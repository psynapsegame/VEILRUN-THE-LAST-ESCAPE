import * as THREE from 'three';
import type { SolidKind } from '../sim/config';
import type { Row } from '../sim/track';
import { Builder, box, canvasTexture } from './build';
import { hash } from './events';
import { GAP_N, cutHoles, fillHoles, makeHoleUniform, makeLipGeometry } from './holes';
import { NX } from './palette';

/**
 * NEXUS, the neon metropolis: a provisional second world built entirely from code.
 * Night sky with a ringed planet, a glass road drawn with light, towers whose windows glow, holographic
 * billboards, and its own obstacle models. Same layout rules as SOLARIS: a causeway raised above the city floor.
 */
const DEPTH = 8; // the city floor lies this far below the causeway
const SLOT = 14;
const SLOTS = 13;
const FAR = 30;
const BRIDGE = 7;
/** Rectangles of the holographic billboards' sheet (top and bottom halves of a square canvas). */
const AD1 = [0, 0.5, 1, 1] as const;
const AD2 = [0, 0, 1, 0.5] as const;

const onBridge = (k: number): boolean => ((k % 30) + 30) % 30 >= 22;

// ---------------------------------------------------------------- textures
/** Facade: a grid of windows, a share of them lit in neon colours (the lit ones also drive the emissive map). */
function facadeTextures(): { map: THREE.CanvasTexture; glow: THREE.CanvasTexture } {
  const S = 256, cols = 4, rows = 8, cw = S / cols, ch = S / rows;
  const cells: (string | null)[] = [];
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const pal = ['#2fe8ff', '#ffb02e', '#ff3fd2', '#cfe9ff', '#2fe8ff', '#ffd27a'];
  for (let i = 0; i < cols * rows; i++) cells.push(rnd() < 0.42 ? pal[Math.floor(rnd() * pal.length)] : null);
  const cell = (c: CanvasRenderingContext2D, i: number, fill: string) => {
    c.fillStyle = fill;
    c.fillRect((i % cols) * cw + 8, Math.floor(i / cols) * ch + 6, cw - 16, ch - 12);
  };
  const map = canvasTexture(S, c => {
    c.fillStyle = '#2a3354';
    c.fillRect(0, 0, S, S);
    cells.forEach((col, i) => cell(c, i, col ? '#5b6ea8' : '#0a1126'));
  });
  const glow = canvasTexture(S, c => {
    c.fillStyle = '#000';
    c.fillRect(0, 0, S, S);
    cells.forEach((col, i) => col && cell(c, i, col));
  });
  for (const t of [map, glow]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(0.5, 0.5); // prop UVs are in half-metres: one tile spans 4 m
    t.anisotropy = 4;
  }
  return { map, glow };
}

/** Road drawn with light: lane lines, magenta edges, faint grid and cross ticks. One tile = 8 m x 8 m. */
function roadTextures(): { map: THREE.CanvasTexture; glow: THREE.CanvasTexture } {
  const S = 512, px = (m: number) => S / 2 + (m / 8) * S;
  const map = canvasTexture(S, c => {
    c.fillStyle = '#0b1020';
    c.fillRect(0, 0, S, S);
    c.fillStyle = '#141c38';
    for (let i = 0; i < S; i += 64) { c.fillRect(i, 0, 2, S); c.fillRect(0, i, S, 2); }
  });
  const glow = canvasTexture(S, c => {
    c.fillStyle = '#000';
    c.fillRect(0, 0, S, S);
    c.fillStyle = 'rgba(47,232,255,0.16)';
    for (let i = 0; i < S; i += 64) { c.fillRect(i, 0, 1, S); c.fillRect(0, i, S, 1); }
    c.fillStyle = '#2fe8ff';
    for (const m of [-1.1, 1.1]) c.fillRect(px(m) - 3, 0, 6, S);
    c.fillStyle = '#ff3fd2';
    for (const m of [-3.7, 3.7]) c.fillRect(px(m) - 7, 0, 14, S);
    c.fillStyle = '#1fb7d6';
    for (const m of [-2.2, 0, 2.2]) for (let y = 0; y < S; y += 128) c.fillRect(px(m) - 3, y + 40, 6, 44);
  });
  for (const t of [map, glow]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, 240 / 8);
    t.anisotropy = 4;
  }
  return { map, glow };
}

/** The glowing grid of the city floor, seen through the holes. */
function floorTextures(): { map: THREE.CanvasTexture; glow: THREE.CanvasTexture } {
  const S = 256;
  const map = canvasTexture(S, c => { c.fillStyle = '#05070f'; c.fillRect(0, 0, S, S); });
  const glow = canvasTexture(S, c => {
    c.fillStyle = '#000';
    c.fillRect(0, 0, S, S);
    c.fillStyle = '#1aa9c9';
    c.fillRect(0, 0, S, 3);
    c.fillRect(0, 0, 3, S);
    c.fillStyle = 'rgba(255,63,210,0.55)';
    c.fillRect(S / 2, 0, 2, S);
    c.fillRect(0, S / 2, S, 2);
  });
  for (const t of [map, glow]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(60, 60); }
  return { map, glow };
}

/** Two holographic adverts (abstract: no text, no logos). */
function holoTexture(): THREE.CanvasTexture {
  return canvasTexture(1024, c => {
    const W = 1024, H = 512;
    // Top half: magenta to blue, a big ring and bars
    let g = c.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, '#3a0a5a'); g.addColorStop(0.5, '#c0267f'); g.addColorStop(1, '#1d4fd8');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.strokeStyle = '#ffffff'; c.lineWidth = 14;
    c.beginPath(); c.arc(300, 256, 150, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 6; c.beginPath(); c.arc(300, 256, 100, 0, Math.PI * 2); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 6; i++) c.fillRect(540, 90 + i * 56, 120 + ((i * 97) % 260), 22);
    c.fillStyle = '#2fe8ff'; c.fillRect(0, 0, W, 10); c.fillRect(0, H - 10, W, 10);
    // Bottom half: amber to red, triangles and a bar chart
    g = c.createLinearGradient(0, H, W, 2 * H);
    g.addColorStop(0, '#ffb02e'); g.addColorStop(1, '#c4162a');
    c.fillStyle = g; c.fillRect(0, H, W, H);
    c.fillStyle = 'rgba(20,10,40,0.85)';
    for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(80 + i * 120, H + 400); c.lineTo(140 + i * 120, H + 110); c.lineTo(200 + i * 120, H + 400); c.fill(); }
    c.fillStyle = '#ffffff';
    for (let i = 0; i < 7; i++) c.fillRect(620 + i * 52, H + 420 - (60 + ((i * 71) % 220)), 34, 60 + ((i * 71) % 220));
    c.fillStyle = '#2fe8ff'; c.fillRect(0, H, W, 10); c.fillRect(0, 2 * H - 10, W, 10);
  });
}

// ---------------------------------------------------------------- architecture
function platform(b: Builder, depth = 10.5, width = 15): void {
  b.add(box(width, DEPTH, depth), NX.steel, 3 - width / 2, -DEPTH / 2, 0)
    .add(box(width + 0.3, 0.3, depth + 0.3), NX.dark, 3 - width / 2, -0.15, 0)
    .add(box(0.12, 0.08, depth + 0.3), NX.cyan, 3.1, -0.1, 0);
}

/** A tower: windowed body, trim cap, neon corner strips on the road side, antenna and a red beacon. */
function tower(b: Builder, x: number, z: number, w: number, d: number, h: number, y0 = 0, neon = NX.cyan): void {
  b.add(box(w, h, d), NX.steel, x, y0 + h / 2, z)
    .add(box(w + 0.4, 0.35, d + 0.4), NX.trim, x, y0 + h + 0.17, z);
  for (const sz of [-1, 1]) b.add(box(0.14, h, 0.14), neon, x + w / 2, y0 + h / 2, z + (sz * d) / 2);
  b.add(box(0.4, 3.2, 0.4), NX.dark, x, y0 + h + 2, z).add(box(0.32, 0.32, 0.32), NX.red, x, y0 + h + 3.7, z);
}

/** Horizontal neon ring around a tower (a thin torus lying flat). */
function ring(b: Builder, x: number, y: number, z: number, r: number, color: number): void {
  b.add(new THREE.TorusGeometry(r, 0.11, 6, 28), color, x, y, z, Math.PI / 2, 0, 0);
}

function sideProps(): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  { // 0: twin towers joined by a sky bridge
    const b = new Builder();
    platform(b);
    tower(b, -4, -3, 4.5, 4, 36);
    tower(b, -8, 2.8, 4, 4.5, 26, 0, NX.magenta);
    b.add(box(5, 1.2, 4), NX.steel, -6, 20, -0.1).add(box(5.2, 0.12, 4.2), NX.cyan, -6, 19.35, -0.1);
    out.push(b.build());
  }
  { // 1: billboard tower
    const b = new Builder();
    platform(b);
    tower(b, -5.5, 0, 5, 9, 30, 0, NX.magenta);
    b.panel(-2.96, 17, 0, 8, 4, AD1);
    b.add(box(0.1, 4.4, 8.4), NX.cyan, -2.98, 17, 0).add(box(0.12, 0.12, 8.6), NX.cyan, -2.95, 19.3, 0).add(box(0.12, 0.12, 8.6), NX.cyan, -2.95, 14.7, 0);
    out.push(b.build());
  }
  { // 2: plaza with terraces and a neon ring gate
    const b = new Builder();
    platform(b);
    b.add(box(10, 1.2, 9), NX.steel, -6, 0.6, 0).add(box(7, 1.2, 7), NX.steel, -7, 1.8, 0).add(box(4, 1.2, 4), NX.steel, -8, 3, 0);
    b.add(box(0.1, 0.1, 9.2), NX.cyan, -1.02, 1.2, 0).add(box(0.1, 0.1, 7.2), NX.cyan, -3.52, 2.4, 0).add(box(0.1, 0.1, 4.2), NX.cyan, -5.98, 3.6, 0);
    b.add(new THREE.TorusGeometry(3.2, 0.14, 8, 40), NX.magenta, -1.2, 4.2, 0).add(new THREE.TorusGeometry(2.6, 0.08, 8, 40), NX.cyan, -1.2, 4.2, 0);
    out.push(b.build());
  }
  { // 3: spire with neon rings
    const b = new Builder();
    platform(b);
    tower(b, -5, 0, 3, 3, 52);
    for (const y of [10, 20, 30, 40]) ring(b, -5, y, 0, 2.6, y % 20 ? NX.magenta : NX.cyan);
    out.push(b.build());
  }
  { // 4: wide billboard block with a rooftop sign
    const b = new Builder();
    platform(b);
    tower(b, -6, 0, 6, 10, 14, 0, NX.amber);
    b.panel(-2.96, 8, 0, 8, 4, AD2);
    for (const z of [-3, -1, 1, 3]) b.add(box(0.5, 1.6 + Math.abs(z) * 0.2, 0.5), NX.magenta, -4.6, 15.4, z);
    out.push(b.build());
  }
  { // 5: ziggurat
    const b = new Builder();
    platform(b);
    tower(b, -6, 0, 9, 9, 6, 0, NX.cyan);
    tower(b, -6.2, 0, 7, 7, 6, 6, NX.magenta);
    tower(b, -6.4, 0, 5, 5, 6, 12, NX.cyan);
    tower(b, -6.6, 0, 3, 3, 6, 18, NX.magenta);
    out.push(b.build());
  }
  { // 6: stacks of thin towers
    const b = new Builder();
    platform(b);
    [[-3.5, -3.6, 18], [-4.5, -1.2, 30], [-3.4, 1.2, 22], [-6.5, 3.4, 40], [-8, -2.5, 26]].forEach(([x, z, h], i) => tower(b, x, z, 2, 2, h, 0, i % 2 ? NX.magenta : NX.cyan));
    out.push(b.build());
  }
  { // 7 (BRIDGE): two thin piers carrying the causeway: the view opens on the skyline
    const b = new Builder();
    for (const z of [-5, 5]) {
      b.add(box(1.8, DEPTH + 0.5, 1.8), NX.steel, 2.3, (0.5 - DEPTH) / 2, z).add(box(1.9, 0.14, 1.9), NX.cyan, 2.3, 0.55, z);
      ring(b, 2.3, -3, z, 1.5, NX.magenta);
    }
    out.push(b.build());
  }
  return out;
}

/** Second-row giants (never reached). */
function farBuildings(): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  { const b = new Builder(); tower(b, 0, 0, 16, 16, 110, -DEPTH, NX.cyan); out.push(b.build()); }
  { const b = new Builder(); tower(b, 0, -9, 12, 12, 90, -DEPTH, NX.magenta); tower(b, -4, 8, 10, 10, 130, -DEPTH, NX.cyan); out.push(b.build()); }
  { const b = new Builder(); tower(b, 0, 0, 10, 10, 150, -DEPTH, NX.magenta); for (const y of [30, 60, 90, 120]) ring(b, 0, y, 0, 7, NX.cyan); out.push(b.build()); }
  { const b = new Builder(); tower(b, 0, 0, 22, 12, 70, -DEPTH, NX.amber); b.panel(11.04, 40, 0, 10, 5, AD1); out.push(b.build()); }
  return out;
}

/**
 * Obstacle models, inside the collision volumes of sim/config. Posts and bars are dark metal,
 * the dangerous parts glow: red for the beam you slide under, magenta for walls and laser grids.
 */
export function nexusObstacle(kind: SolidKind | 'laser'): { body: THREE.BufferGeometry; beams?: THREE.BufferGeometry } {
  const b = new Builder();
  if (kind === 'low') {
    // Barrier: jump over it
    b.add(box(1.7, 0.4, 0.5), NX.trim, 0, 0.2, 0).add(box(1.72, 0.08, 0.54), NX.cyan, 0, 0.44, 0);
    for (const s of [-1, 1]) b.add(box(0.2, 0.62, 0.3), NX.dark, s * 0.9, 0.31, 0).add(box(0.22, 0.08, 0.34), NX.cyan, s * 0.9, 0.64, 0);
    for (let i = 0; i < 5; i++) b.add(box(0.12, 0.3, 0.52), NX.amber, -0.64 + i * 0.32, 0.2, 0, 0, 0, 0.5);
    return { body: b.build() };
  }
  if (kind === 'high') {
    // Laser gate: slide under the red beam
    for (const s of [-1, 1]) {
      b.add(box(0.22, 2.7, 0.4), NX.dark, s * 0.97, 1.35, 0).add(box(0.3, 0.3, 0.5), NX.trim, s * 0.97, 1.55, 0);
    }
    b.add(box(2.16, 0.5, 0.45), NX.dark, 0, 2.55, 0).add(box(2.0, 0.07, 0.48), NX.cyan, 0, 2.28, 0);
    b.add(box(1.7, 0.1, 0.12), NX.red, 0, 1.55, 0);
    return { body: b.build() };
  }
  if (kind === 'full') {
    // Security wall: change lane
    b.add(box(1.2, 2.9, 0.6), NX.steel, 0, 1.45, 0).add(box(1.3, 0.2, 0.7), NX.trim, 0, 2.95, 0);
    for (const x of [-0.4, 0, 0.4]) b.add(box(0.1, 2.5, 0.06), NX.magenta, x, 1.5, 0.33);
    b.add(box(1.0, 0.18, 0.08), NX.amber, 0, 2.7, 0.34).add(box(0.26, 0.26, 0.26), NX.red, 0, 3.25, 0);
    return { body: b.build() };
  }
  // Laser grid: posts always, beams only while it is on
  for (const s of [-1, 1]) b.add(box(0.22, 3.1, 0.3), NX.dark, s * 0.97, 1.55, 0).add(box(0.3, 0.2, 0.36), NX.trim, s * 0.97, 3.2, 0).add(box(0.1, 0.1, 0.34), NX.red, s * 0.97, 3.05, 0);
  const g = new Builder();
  for (const y of [0.3, 0.85, 1.4, 1.95, 2.5]) g.add(box(1.76, 0.07, 0.07), NX.magenta, 0, y, 0);
  return { body: b.build(), beams: g.build() };
}

// ---------------------------------------------------------------- the world
export class Nexus {
  readonly group = new THREE.Group();
  /** Every light of this world (switched off when the other world is on). */
  readonly lights: THREE.Light[] = [];
  /** Materials indexed by Builder slot: windowed facade, trim metal, neon, plain dark, holographic panel. */
  readonly mats: THREE.Material[];
  readonly fog = new THREE.FogExp2(0x1b1038, 0.0042);
  private sky: THREE.ShaderMaterial;
  private roadTex: ReturnType<typeof roadTextures>;
  private floorTex: ReturnType<typeof floorTextures>;
  private props: THREE.BufferGeometry[];
  private far: THREE.BufferGeometry[];
  private slots: { mesh: THREE.Mesh; k: number; side: number }[] = [];
  private farSlots: { mesh: THREE.Mesh; k: number; side: number }[] = [];
  private gapUniform = makeHoleUniform();
  private lips: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene) {
    const fac = facadeTextures();
    const holo = holoTexture();
    this.roadTex = roadTextures();
    this.floorTex = floorTextures();
    this.mats = [
      new THREE.MeshStandardMaterial({ vertexColors: true, map: fac.map, emissiveMap: fac.glow, emissive: 0xffffff, emissiveIntensity: 1.7, roughness: 0.55, metalness: 0.35 }),
      new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.9, roughness: 0.3 }),
      new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(2.6, 2.6, 2.6) }),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.25 }),
      new THREE.MeshBasicMaterial({ map: holo, color: new THREE.Color(1.5, 1.5, 1.5), side: THREE.DoubleSide }),
    ];

    // Night: cold sky light, a moon-like key light and a magenta fill. No shadow maps here (a blob shadow is used).
    const hemi = new THREE.HemisphereLight(0x6a7cff, 0x1a0830, 1.25);
    const key = new THREE.DirectionalLight(0x9fc0ff, 2.0);
    key.position.set(-8, 10, 8);
    const fill = new THREE.DirectionalLight(0xff40d0, 0.9);
    fill.position.set(8, 5, 6);
    this.lights.push(hemi, key, fill);
    for (const l of this.lights) { l.visible = false; scene.add(l); }

    // Sky: dark gradient, stars, a banded planet with a ring, a neon glow along the horizon ahead
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(400, 24, 12),
      new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: { time: { value: 0 } },
        vertexShader: 'varying vec3 d; void main(){ d = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `precision highp float; varying vec3 d; uniform float time;
          float hs(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          void main(){ vec3 n = normalize(d); float h = clamp(n.y, 0.0, 1.0);
            vec3 c = mix(vec3(0.30, 0.07, 0.34), vec3(0.07, 0.03, 0.17), smoothstep(0.0, 0.25, h));
            c = mix(c, vec3(0.012, 0.014, 0.06), smoothstep(0.15, 0.8, h));
            float s = max(0.0, dot(n, normalize(vec3(-0.3, 0.12, -1.0))));
            c += vec3(0.1, 0.55, 0.9) * pow(s, 6.0) * 0.35 * (1.0 - h);
            vec2 sp = n.xz / (n.y + 0.5) * 70.0; float st = step(0.982, hs(floor(sp))) * smoothstep(0.1, 0.5, h);
            c += vec3(0.8, 0.9, 1.0) * st * (0.4 + 0.6 * sin(time * 1.7 + hs(floor(sp)) * 30.0));
            vec3 pd = normalize(vec3(0.42, 0.30, -1.0)); float pa = acos(clamp(dot(n, pd), -1.0, 1.0));
            if (pa < 0.14) { float t = pa / 0.14; float band = sin((n.y - pd.y) * 120.0) * 0.5 + 0.5;
              c = mix(vec3(0.9, 0.35, 0.85), vec3(0.2, 0.5, 1.0), clamp(0.5 + (n.y - pd.y) * 4.0 + band * 0.18, 0.0, 1.0)) * (1.0 - 0.5 * t); }
            vec2 q = vec2(n.x - pd.x, (n.y - pd.y) * 3.4); float rr = length(q);
            c += vec3(0.8, 0.6, 1.0) * smoothstep(0.012, 0.0, abs(rr - 0.27)) * 0.8 * step(0.14, pa);
            gl_FragColor = vec4(c, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      }),
    );
    sky.renderOrder = -10;
    this.sky = sky.material as THREE.ShaderMaterial;
    this.group.add(sky);

    // Road of glass and light; the holes are cut into it as in SOLARIS
    const roadMat = new THREE.MeshStandardMaterial({ map: this.roadTex.map, emissiveMap: this.roadTex.glow, emissive: 0xffffff, emissiveIntensity: 1.6, roughness: 0.3, metalness: 0.5 });
    cutHoles(roadMat, this.gapUniform);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(8, 240), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.z = -100;
    this.group.add(road);
    const dark = new THREE.MeshStandardMaterial({ color: 0x131828, roughness: 0.6, metalness: 0.5 });
    const neon = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 2.2, 2.6) });
    for (const s of [-1, 1]) {
      const curb = new THREE.Mesh(box(0.7, 0.9, 240), dark);
      curb.position.set(s * 4.35, -0.1, -100);
      const strip = new THREE.Mesh(box(0.1, 0.05, 240), neon);
      strip.position.set(s * 4.1, 0.37, -100);
      const wall = new THREE.Mesh(box(1, DEPTH, 240), dark);
      wall.position.set(s * 4.5, -DEPTH / 2 - 0.5, -100);
      this.group.add(curb, strip, wall);
    }
    const floorMat = new THREE.MeshStandardMaterial({ map: this.floorTex.map, emissiveMap: this.floorTex.glow, emissive: 0xffffff, emissiveIntensity: 1.2, roughness: 0.8 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -DEPTH, -150);
    this.group.add(floor);

    // Stone-like edges around the holes, here dark metal with a cold glow
    {
      const geo = makeLipGeometry();
      const mat = new THREE.MeshStandardMaterial({ color: 0x2a3560, emissive: 0x0a4a66, emissiveIntensity: 1, roughness: 0.5, metalness: 0.6, side: THREE.DoubleSide, vertexColors: true });
      for (let i = 0; i < GAP_N; i++) {
        const m = new THREE.Mesh(geo, mat);
        m.visible = false;
        this.group.add(m);
        this.lips.push(m);
      }
    }

    this.props = sideProps();
    this.far = farBuildings();
    for (let i = 0; i < SLOTS; i++)
      for (const side of [-1, 1]) {
        const m = new THREE.Mesh(this.props[0], this.mats);
        m.scale.x = -side; // pieces are modelled for the left side
        this.group.add(m);
        this.slots.push({ mesh: m, k: -1e9, side });
      }
    for (let i = 0; i < 7; i++)
      for (const side of [-1, 1]) {
        const m = new THREE.Mesh(this.far[0], this.mats);
        m.scale.x = -side;
        this.group.add(m);
        this.farSlots.push({ mesh: m, k: -1e9, side });
      }
    this.group.visible = false;
    scene.add(this.group);
  }

  /** Cut this frame's holes into the road. */
  updateGaps(rows: Row[], dist: number): void {
    fillHoles(this.gapUniform, this.lips, rows, dist);
  }

  /** Recycle the roadside pieces around the runner. */
  update(dist: number, dt: number): void {
    this.sky.uniforms.time.value += dt;
    const off = (dist / 8) % 1;
    this.roadTex.map.offset.y = this.roadTex.glow.offset.y = off;
    this.floorTex.map.offset.y = this.floorTex.glow.offset.y = (dist / 8) % 1;
    const fb = Math.floor(dist / FAR) - 1;
    for (let n = 0; n < this.farSlots.length; n++) {
      const s = this.farSlots[n];
      const k = fb + (n >> 1);
      if (s.k !== k) {
        s.k = k;
        const h = hash(k * 2 + 311 + (s.side > 0 ? 1 : 0));
        s.mesh.geometry = this.far[Math.floor(h * this.far.length)];
        s.mesh.position.x = s.side * (40 + h * 14);
      }
      s.mesh.position.z = dist - k * FAR - 9;
    }
    const base = Math.floor(dist / SLOT) - 1;
    for (let n = 0; n < this.slots.length; n++) {
      const s = this.slots[n];
      const k = base + (n >> 1);
      if (s.k !== k) {
        s.k = k;
        const h = hash(k * 2 + 7 + (s.side > 0 ? 1 : 0));
        s.mesh.geometry = this.props[onBridge(k) ? BRIDGE : Math.floor(h * BRIDGE)];
        s.mesh.position.x = s.side * 7.9;
      }
      s.mesh.position.z = dist - k * SLOT;
    }
  }
}
