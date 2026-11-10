import * as THREE from 'three';
import devourerUrl from '../assets/art/devourer.webp';
import { loadTexture } from './loading';

const H = 190; // height of the painted figure, in metres, at about 440 m from the runner
const W = (H * 765) / 1024;
const HIDDEN_Y = -300;
const SHOWN_Y = -10;

/**
 * The Devourer: the thing the runner is fleeing, glimpsed far beyond the city whenever the view opens up.
 * An illustrated, cut-out figure standing on the horizon; its eyes are live glows on top of the picture.
 */
export class Devourer {
  readonly group = new THREE.Group();
  private eyes: THREE.Sprite[] = [];
  private body: THREE.Mesh;
  private show = 0;
  private t = 0;

  constructor(glow: THREE.Texture) {
    this.body = new THREE.Mesh(
      new THREE.PlaneGeometry(W, H),
      new THREE.MeshBasicMaterial({ map: loadTexture(devourerUrl), transparent: true, depthWrite: false, fog: false, opacity: 0.92 }),
    );
    this.body.position.y = H / 2;
    this.group.add(this.body);
    // Eyes sit at 45% and 52% of the picture's width, 27% from its top
    for (const u of [0.451, 0.519]) {
      const eye = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0x7ff3ff, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0 }));
      eye.position.set((u - 0.5) * W, (1 - 0.266) * H, 1);
      eye.scale.setScalar(11);
      this.group.add(eye);
      this.eyes.push(eye);
    }
    this.group.position.set(30, HIDDEN_Y, -440);
    this.group.visible = false;
  }

  /** `visible` raises the creature above the skyline; otherwise it sinks back below the horizon. */
  update(dt: number, visible: boolean): void {
    this.t += dt;
    this.show += ((visible ? 1 : 0) - this.show) * (1 - Math.exp(-dt * 0.9));
    this.group.visible = this.show > 0.01;
    if (!this.group.visible) return;
    this.group.position.y = HIDDEN_Y + (SHOWN_Y - HIDDEN_Y) * this.show + Math.sin(this.t * 0.5) * 1.5;
    this.body.scale.setScalar(1 + Math.sin(this.t * 0.4) * 0.012);
    const pulse = 0.7 + 0.3 * Math.sin(this.t * 3.1);
    for (const e of this.eyes) e.material.opacity = this.show * pulse;
  }
}
