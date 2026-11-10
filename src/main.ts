import { GameAudio } from './audio/audio';
import { GestureRecognizer } from './input/gestures';
import { QualityGovernor } from './quality';
import { loadSave, recordRun, writeSave, KV } from './save';
import { CFG, SCHEDULE, WORLD_NAMES, portalNearest } from './sim/config';
import { Game } from './sim/game';
import { Action, Player } from './sim/player';
import { Ui } from './ui/ui';
import { loading } from './view/loading';
import { ViewState, World } from './view/world';

type Mode = 'menu' | 'run' | 'pause' | 'dying' | 'over';
const STEP = 1 / 120; // fixed simulation step: identical physics at 30, 60 or 120 fps

let store: KV | null = null;
try { store = window.localStorage; } catch { /* storage blocked: play without saving */ }
const save = loadSave(store);
const audio = new GameAudio();
audio.muted = save.muted;

let mode: Mode = 'menu';
let game: Game | null = null;
let acc = 0;
let dyingT = 0;
let debugOn = /[?&]debug/.test(location.search);
const t0 = performance.now();
let splashDone = /[?&]nosplash/.test(location.search); // ?nosplash: skip the loading screen (automated tests)
// ?portal=300 moves the first portal closer (testing)
const portalParam = /[?&]portal=(\d+)/.exec(location.search);
if (portalParam) SCHEDULE.first = +portalParam[1];
let shownWorld = 0;
let portalHeard = -1; // the portal whose sound has already played
const idle: ViewState = { time: 0, dist: 0, speed: 9, player: new Player(), dashing: false, track: { rows: [], coins: [] } };

const ui = new Ui(
  {
    play: () => { audio.unlock(); audio.sfx('ui'); start(); },
    pause: () => setPaused(true),
    resume: () => { audio.sfx('ui'); setPaused(false); },
    menu: () => { audio.sfx('ui'); toMenu(); },
    power: () => input('power'),
    mute: () => { audio.unlock(); save.muted = !save.muted; audio.setMuted(save.muted); writeSave(store, save); return save.muted; },
    debug: () => { debugOn = !debugOn; if (!debugOn) ui.debug(null); },
  },
  save.muted,
);
const world = new World(ui.canvas);
world.onRumble = () => audio.sfx('rumble');
ui.menu(save);
if (splashDone) ui.hideSplash();

function start(): void {
  shownWorld = 0;
  portalHeard = -1;
  audio.world = 0;
  audio.menuMusic = false;
  game = new Game((Math.random() * 2 ** 31) | 0);
  gov.rewarm(2); // starting a run allocates and uploads: do not judge those frames
  world.reset();
  acc = 0;
  mode = 'run';
  audio.musicOn = true;
  ui.show('hud');
}
function toMenu(): void {
  shownWorld = 0;
  mode = 'menu';
  game = null;
  world.reset();
  audio.musicOn = false;
  audio.menuMusic = true;
  audio.suspend(false);
  ui.menu(save);
}
function setPaused(p: boolean): void {
  if (p && mode === 'run') { mode = 'pause'; audio.suspend(true); ui.show('pause'); }
  else if (!p && mode === 'pause') { mode = 'run'; audio.suspend(false); ui.show('hud'); last = performance.now(); }
}
function input(a: Action): void {
  if (mode === 'run' && game) game.act(a);
}

// Touch / pointer gestures on the whole play surface
const gest = new GestureRecognizer();
const fit = () => { gest.resize(window.innerWidth, window.innerHeight); world.resize(); };
window.addEventListener('resize', fit);
window.addEventListener('orientationchange', fit);
fit();
const surf = ui.root;
surf.addEventListener('pointerdown', e => { audio.unlock(); gest.down(e.pointerId, e.clientX, e.clientY, e.timeStamp / 1000); });
surf.addEventListener('pointermove', e => { const a = gest.move(e.pointerId, e.clientX, e.clientY); if (a) input(a); });
surf.addEventListener('pointerup', e => { const a = gest.up(e.pointerId, e.clientX, e.clientY, e.timeStamp / 1000); if (a) input(a); });
surf.addEventListener('pointercancel', e => gest.cancel(e.pointerId));
for (const t of ['touchmove', 'gesturestart', 'contextmenu', 'dblclick'] as const)
  surf.addEventListener(t, e => e.preventDefault(), { passive: false });

const KEYS: Record<string, Action> = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', ' ': 'power',
  a: 'left', d: 'right', w: 'up', s: 'down', q: 'left', z: 'up',
};
window.addEventListener('keydown', e => {
  if (e.repeat) return;
  if (e.key === 'Escape' || e.key === 'p') { setPaused(mode === 'run'); return; }
  if (e.key === 'Enter' && (mode === 'menu' || mode === 'over')) { audio.unlock(); start(); return; }
  const a = KEYS[e.key];
  if (a) { e.preventDefault(); input(a); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });

// Adaptive quality + diagnostics. `?q=0..4` pins a graphics tier (testing); otherwise the governor adapts it,
// starting from the tier that worked last time on this device (never during loading, see src/quality.ts).
const pinned = /[?&]q=(\d)/.exec(location.search);
const TIER_KEY = 'veilrun.quality';
let startTier = 1;
try {
  const q = Number(store?.getItem(TIER_KEY));
  if (store?.getItem(TIER_KEY) !== null && Number.isInteger(q) && q >= 0 && q <= world.maxQuality) startTier = q;
} catch { /* no storage: start from the default tier */ }
const gov = new QualityGovernor(world.maxQuality, pinned ? +pinned[1] : startTier);
world.setQuality(gov.tier);
let dbgT = 0, worst = 0;
function monitor(ms: number, dt: number): void {
  worst = Math.max(worst, ms);
  if (!splashDone) gov.rewarm(); // the loading screen is not representative of play
  const tier = gov.frame(ms, dt);
  if (tier !== null && !pinned) {
    world.setQuality(tier);
    try { store?.setItem(TIER_KEY, String(tier)); } catch { /* ignore */ }
  }
  dbgT += dt;
  if (debugOn && dbgT > 0.5) {
    const i = world.renderer.info.render;
    ui.debug(`${(1000 / gov.ms).toFixed(0)} fps  ${gov.ms.toFixed(1)} ms  pire ${worst.toFixed(0)} ms\n` +
      `appels ${i.calls}  tris ${i.triangles}\nrésolution ×${world.renderer.getPixelRatio().toFixed(2)} (niveau ${world.quality})\n` +
      (game ? `v ${game.speed.toFixed(1)} m/s  lignes ${game.track.rows.length}` : 'menu'));
    dbgT = 0; worst = 0;
  }
}

let last = performance.now();
function frame(now: number): void {
  requestAnimationFrame(frame);
  const ms = now - last;
  last = now;
  const dt = Math.min(0.1, ms / 1000);
  if (!splashDone) {
    ui.splashProgress(loading.progress);
    const waited = performance.now() - t0;
    if ((loading.complete && waited > 1600) || waited > 20000) {
      splashDone = true;
      ui.hideSplash();
    }
  }
  if (mode === 'pause') return;
  monitor(ms, dt);

  if ((mode === 'run' || mode === 'dying') && game) {
    if (mode === 'run') {
      acc += dt;
      while (acc >= STEP) { game.step(STEP); acc -= STEP; }
      for (const ev of game.events) {
        world.handle(ev, game);
        if (ev.t === 'dashReady') audio.sfx('ready'); else audio.sfx(ev.t);
        if (ev.t === 'death') {
          mode = 'dying';
          dyingT = 0;
          audio.musicOn = false;
          try { navigator.vibrate?.(120); } catch { /* unsupported */ }
        }
      }
      game.events.length = 0;
      ui.hud(game);
      audio.intensity = (game.speed - CFG.speedStart) / (CFG.speedMax - CFG.speedStart);
      // The portal sound starts ~1.8 s before the ring, so its peak lands as the runner crosses it
      const p = portalNearest(game.dist);
      if (p > game.dist && p !== portalHeard && p - game.dist < game.speed * 1.8) { portalHeard = p; audio.sfx('portal'); }
    } else {
      dyingT += dt;
      if (dyingT > 1.1) {
        const rec = recordRun(save, game.score, game.dist, game.fragments);
        writeSave(store, save);
        ui.over(game, save, rec);
        audio.result();
        mode = 'over';
      }
    }
    world.render(dt, game);
  } else if (mode === 'over' && game) {
    world.render(dt, game);
  } else {
    idle.dist = (idle.dist + idle.speed * dt) % 1260; // a multiple of every scenery period: the wrap is invisible, and the first portal is never reached
    audio.intensity = 0;
    world.render(dt, idle);
  }
  // Portal: white-out on the page, the new world's name, and its sound
  ui.flash(world.flash);
  if (world.worldIdx !== shownWorld) {
    shownWorld = world.worldIdx;
    if (mode === 'run') {
      ui.announce(WORLD_NAMES[shownWorld]);
      audio.world = shownWorld;
    }
  }
}
requestAnimationFrame(frame);

// Test hook: lets automated browser tests observe the run without touching gameplay.
(window as unknown as Record<string, unknown>).__veilrun = { get mode() { return mode; }, get game() { return game; }, world };
