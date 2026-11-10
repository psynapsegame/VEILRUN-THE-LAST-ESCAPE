import { CFG } from '../sim/config';
import type { Game } from '../sim/game';
import type { SaveData } from '../save';
import titleUrl from '../assets/art/title.webp';
import { CSS } from './style';

export const VERSION = '0.8.0';
const fmt = (n: number) => Math.floor(n).toLocaleString('fr-FR');

export interface UiHandlers {
  play(): void;
  pause(): void;
  resume(): void;
  menu(): void;
  power(): void;
  mute(): boolean; // returns the new muted state
  debug(): void;
}

/** DOM overlay: menu, HUD, pause and result screens. Every control is wired to a real action. */
export class Ui {
  readonly root: HTMLDivElement;
  readonly canvas: HTMLCanvasElement;
  private layers: Record<'menu' | 'hud' | 'pause' | 'over', HTMLElement>;
  private el: Record<string, HTMLElement> = {};
  private last = { d: -1, s: -1, f: -1, ready: false, tip: '' };
  private ring!: SVGCircleElement;

  constructor(h: UiHandlers, muted: boolean) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.root = document.createElement('div');
    this.root.id = 'vr';
    const R = 2 * Math.PI * 34;
    this.root.innerHTML = `
<canvas aria-label="VEILRUN"></canvas>
<section class="vr-layer vr-veil" data-l="menu">
  <div><h1 class="vr-title">VEILRUN</h1><p class="vr-sub">THE LAST ESCAPE</p></div>
  <button class="vr-btn" data-a="play">COURIR</button>
  <div class="vr-stats"><div class="vr-stat"><b data-e="mBest">0</b><span>Record</span></div><div class="vr-stat"><b data-e="mDist">0</b><span>Distance</span></div><div class="vr-stat"><b data-e="mFrag">0</b><span>Fragments</span></div></div>
  <div class="vr-help"><i>GLISSER ← →</i><span>changer de voie</span><i>GLISSER ↑</i><span>sauter</span><i>GLISSER ↓</i><span>glisser sous l’obstacle</span><i>DOUBLE-TAP</i><span>dash : traverse tout</span></div>
  <div class="vr-corner"><button class="vr-icon" data-a="mute" aria-label="Son"></button></div>
  <button class="vr-ver" data-a="debug">SOLARIS · ${VERSION}</button>
</section>
<section class="vr-layer vr-hud" data-l="hud" hidden>
  <div class="vr-top">
    <div><div class="vr-big"><span data-e="dist">0</span><small>M</small></div><div class="vr-label">Score <span data-e="score">0</span></div></div>
    <div class="vr-right"><div class="vr-frag" data-e="frag">0</div><button class="vr-icon" data-a="pause" aria-label="Pause">❙❙</button></div>
  </div>
  <div class="vr-tip" data-e="tip"></div>
  <div class="vr-bottom"><button class="vr-dash" data-a="power" data-e="dash" aria-label="Dash">
    <svg viewBox="0 0 74 74"><circle class="bg" cx="37" cy="37" r="34"/><circle class="fg" cx="37" cy="37" r="34" stroke-dasharray="${R}" stroke-dashoffset="0"/></svg>DASH</button></div>
</section>
<section class="vr-layer vr-veil solid" data-l="pause" hidden>
  <h2 class="vr-h">PAUSE</h2>
  <button class="vr-btn" data-a="resume">REPRENDRE</button>
  <button class="vr-btn ghost" data-a="menu">MENU</button>
</section>
<section class="vr-layer vr-veil solid" data-l="over" hidden>
  <h2 class="vr-h">RATTRAPÉ</h2>
  <div class="vr-record" data-e="rec" hidden>NOUVEAU RECORD</div>
  <div class="vr-stats"><div class="vr-stat"><b data-e="oScore">0</b><span>Score</span></div><div class="vr-stat"><b data-e="oDist">0</b><span>Mètres</span></div><div class="vr-stat"><b data-e="oFrag">0</b><span>Fragments</span></div></div>
  <div class="vr-label">Record <span data-e="oBest">0</span></div>
  <button class="vr-btn" data-a="play">REJOUER</button>
  <button class="vr-btn ghost" data-a="menu">MENU</button>
</section>
<div class="vr-debug" data-e="debug" hidden></div>
<section class="vr-splash" data-e="splash" aria-label="Chargement">
  <div class="vr-splash-head"><h1 class="vr-title">VEILRUN</h1><p class="vr-sub">THE LAST ESCAPE</p></div>
  <div class="vr-load"><i data-e="loadbar"></i></div>
</section>`;
    document.body.appendChild(this.root);
    this.canvas = this.root.querySelector('canvas')!;
    const L = (n: string) => this.root.querySelector<HTMLElement>(`[data-l="${n}"]`)!;
    this.layers = { menu: L('menu'), hud: L('hud'), pause: L('pause'), over: L('over') };
    this.root.querySelectorAll<HTMLElement>('[data-e]').forEach(e => (this.el[e.dataset.e!] = e));
    this.ring = this.root.querySelector<SVGCircleElement>('.vr-dash .fg')!;
    this.el.splash.style.backgroundImage = `url(${titleUrl})`;
    const muteBtn = this.root.querySelector<HTMLElement>('[data-a="mute"]')!;
    const setMute = (m: boolean) => (muteBtn.textContent = m ? '🔇' : '🔊');
    setMute(muted);
    this.root.addEventListener('click', e => {
      const a = (e.target as HTMLElement).closest<HTMLElement>('[data-a]')?.dataset.a;
      if (!a) return;
      if (a === 'mute') setMute(h.mute());
      else h[a as Exclude<keyof UiHandlers, 'mute'>]();
    });
    // Buttons must never leak into the gesture surface.
    this.root.querySelectorAll('button').forEach(b => b.addEventListener('pointerdown', e => e.stopPropagation()));
  }

  /** Loading screen: real progress (0..1) of the assets the scene is waiting for. */
  splashProgress(p: number): void {
    this.el.loadbar.style.width = `${Math.round(p * 100)}%`;
  }
  hideSplash(): void {
    const s = this.el.splash;
    s.classList.add('out');
    setTimeout(() => (s.hidden = true), 900);
  }

  show(name: 'menu' | 'hud' | 'pause' | 'over'): void {
    for (const k in this.layers) this.layers[k as keyof typeof this.layers].hidden = k !== name && !(name === 'pause' && k === 'hud');
  }

  menu(s: SaveData): void {
    this.el.mBest.textContent = fmt(s.best);
    this.el.mDist.textContent = fmt(s.bestDist) + ' m';
    this.el.mFrag.textContent = fmt(s.fragments);
    this.show('menu');
  }

  hud(g: Game): void {
    const d = Math.floor(g.dist), sc = g.score, l = this.last;
    if (d !== l.d) this.el.dist.textContent = fmt((l.d = d));
    if (sc !== l.s) this.el.score.textContent = fmt((l.s = sc));
    if (g.fragments !== l.f) this.el.frag.textContent = fmt((l.f = g.fragments));
    const ready = g.dashCooldown <= 0;
    const R = 2 * Math.PI * 34;
    this.ring.style.strokeDashoffset = String(ready ? 0 : (R * g.dashCooldown) / CFG.dashCooldown);
    if (ready !== l.ready) this.el.dash.classList.toggle('ready', (l.ready = ready));
    // First seconds of a run: one instruction at a time
    const tip = g.time < 2.2 ? '← GLISSE →' : g.time < 4.4 ? '↑ SAUTER   ·   ↓ GLISSER' : g.time < 6.6 ? 'DOUBLE-TAP : DASH' : '';
    if (tip !== l.tip) {
      this.el.tip.textContent = l.tip = tip;
    }
  }

  over(g: Game, s: SaveData, record: boolean): void {
    this.el.oScore.textContent = fmt(g.score);
    this.el.oDist.textContent = fmt(g.dist);
    this.el.oFrag.textContent = fmt(g.fragments);
    this.el.oBest.textContent = fmt(s.best);
    this.el.rec.hidden = !record;
    this.show('over');
  }

  debug(text: string | null): void {
    this.el.debug.hidden = text === null;
    if (text !== null) this.el.debug.textContent = text;
  }
}
