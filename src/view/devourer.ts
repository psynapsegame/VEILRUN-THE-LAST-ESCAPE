import * as THREE from 'three';

/**
 * The Devourer: the thing the runner is fleeing, glimpsed far beyond the city
 * whenever the view opens up. Provisional silhouette built from dark volumes
 * and glowing eyes, kept hazy so it reads as immense and distant.
 */
export class Devourer {
  readonly group = new THREE.Group();
  private eyes: THREE.Sprite[] = [];
  private limbs: THREE.Mesh[] = [];
  private show = 0;
  private t = 0;

  constructor(glow: THREE.Texture) {
    const dark = new THREE.MeshBasicMaterial({ color: 0x8a8298, fog: false, transparent: true, opacity: 0.8 });
    const add = (g: THREE.BufferGeometry, x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
      const m = new THREE.Mesh(g, dark);
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      this.group.add(m);
      return m;
    };
    const ball = new THREE.SphereGeometry(1, 16, 12);
    add(ball, 0, 10, 0, 46, 60, 26); // torso of smoke
    add(ball, 0, 62, 0, 58, 24, 24); // shoulders
    add(ball, 0, 90, 4, 17, 20, 16); // head
    for (const s of [-1, 1]) {
      const horn = add(new THREE.ConeGeometry(4, 22, 7), s * 12, 108, 2, 1, 1, 1);
      horn.rotation.z = -s * 0.45;
      this.limbs.push(horn);
      this.limbs.push(add(ball, s * 44, 44, 0, 20, 34, 18)); // drooping shoulders of smoke
    }
    // Soft dark puffs blur the silhouette so it reads as smoke, not as solid shapes
    for (let i = 0; i < 9; i++) {
      const puff = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0x6f6884, depthWrite: false, fog: false, opacity: 0.5 }));
      const a = (i / 9) * Math.PI * 2;
      puff.position.set(Math.cos(a) * 46, 52 + Math.sin(a) * 42, 6);
      puff.scale.setScalar(70);
      this.group.add(puff);
    }
    for (const s of [-1, 1]) {
      const eye = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0x7ff3ff, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0 }));
      eye.position.set(s * 6.5, 93, 18);
      eye.scale.setScalar(17);
      this.group.add(eye);
      this.eyes.push(eye);
    }
    const maw = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0x9a6bff, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0 }));
    maw.position.set(0, 81, 18);
    maw.scale.set(20, 7, 1);
    this.group.add(maw);
    this.eyes.push(maw);
    // Far beyond the skyline; portrait screens see only about 16 degrees to each side
    this.group.position.set(62, -150, -430);
    this.group.scale.setScalar(1.5);
    this.group.visible = false;
  }

  /** `visible` raises the creature above the skyline; otherwise it sinks back below the horizon. */
  update(dt: number, visible: boolean): void {
    this.t += dt;
    this.show += ((visible ? 1 : 0) - this.show) * (1 - Math.exp(-dt * 0.9));
    this.group.visible = this.show > 0.01;
    if (!this.group.visible) return;
    this.group.position.y = -150 + 150 * this.show + Math.sin(this.t * 0.5) * 2;
    this.group.rotation.z = Math.sin(this.t * 0.35) * 0.03;
    this.limbs.forEach((l, i) => (l.position.y += Math.sin(this.t * 0.6 + i * 2) * 0.02));
    const pulse = 0.75 + 0.25 * Math.sin(this.t * 3.1);
    for (const e of this.eyes) e.material.opacity = this.show * pulse;
  }
}
