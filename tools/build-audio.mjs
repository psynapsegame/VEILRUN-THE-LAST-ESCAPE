// Prepares the game's audio from assets-src/audio/*.mp3 (ElevenLabs exports) into src/assets/audio/*.m4a:
//   node tools/build-audio.mjs        (needs ffmpeg)
// - sound effects: cut around the real sound (the exports are padded to 3 s or more), faded, peak-normalised
// - music and ambience: baked into seamless loops (end cross-faded into the start), loudness matched
//   (the three run layers share one gain so their relative intensity is kept)
// - everything mono, 32 kHz, AAC: small files and a decoded size a phone can afford
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, statSync, unlinkSync } from 'node:fs';

const SRC = 'assets-src/audio/', OUT = 'src/assets/audio/', TMP = '/tmp/vr-audio-';
mkdirSync(OUT, { recursive: true });
const ff = (...a) => execFileSync('ffmpeg', ['-hide_banner', '-v', 'error', '-y', ...a], { maxBuffer: 1 << 28 });
// ffmpeg prints its measurements on stderr
const ffText = (...a) => { const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...a], { encoding: 'utf8', maxBuffer: 1 << 28 }); return `${r.stdout}\n${r.stderr}`; };
const RATE = 32000;
const enc = (out, kbps) => ['-ac', '1', '-ar', String(RATE), '-c:a', 'aac', '-b:a', `${kbps}k`, '-movflags', '+faststart', out];

/** RMS level (dB) per 10 ms frame of a file, mono 16 kHz. */
function levels(file) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], { maxBuffer: 1 << 28 });
  const n = raw.length / 2, hop = 160, out = [];
  for (let i = 0; i + hop <= n; i += hop) {
    let s = 0;
    for (let k = 0; k < hop; k++) { const v = raw.readInt16LE((i + k) * 2) / 32768; s += v * v; }
    out.push(20 * Math.log10(Math.sqrt(s / hop) + 1e-6));
  }
  return out;
}
const peakDb = (file) => { const m = /max_volume: (-?[\d.]+) dB/.exec(ffText('-i', file, '-af', 'volumedetect', '-f', 'null', '-')); if (!m) throw new Error(`cannot measure the peak of ${file}`); return +m[1]; };
const lufs = (file) => { const t = ffText('-i', file, '-af', 'ebur128=framelog=quiet', '-f', 'null', '-'); const m = /I:\s+(-?[\d.]+) LUFS/.exec(t.slice(t.lastIndexOf('Summary'))); if (!m) throw new Error(`cannot measure the loudness of ${file}`); return +m[1]; };

// ---------------------------------------------------------------- sound effects
// start/dur in seconds in the source; 'auto' finds the loudest event and its onset.
const SFX = {
  jump: { auto: 0.55, fade: 0.16, peak: -4 },
  land: { auto: 0.35, fade: 0.1, peak: -3 },
  lane: { auto: 0.3, fade: 0.1, peak: -6 },
  slide: { auto: 0.95, fade: 0.3, peak: -6 },
  ui: { auto: 0.3, fade: 0.1, peak: -5 },
  crystal: { auto: 0.7, fade: 0.3, peak: -4 },
  dash: { start: 2.55, dur: 1.35, fade: 0.35, peak: -3 },
  devourer: { start: 0, dur: 3.0, fade: 0.7, peak: -3 },
  defeat: { start: 0, dur: 4.6, fade: 1.2, peak: -3 },
  results: { start: 0, dur: 10, fade: 1.6, peak: -4 },
  smash: { start: 0, dur: 2.2, fade: 0.8, peak: -3 },
  death: { start: 0, dur: 1.6, fade: 0.6, peak: -3 },
  fall: { start: 0.2, dur: 2.4, fade: 0.8, peak: -4 },
  collapse: { start: 0, dur: 5.0, fade: 1.5, peak: -4 },
  milestone: { start: 1.4, dur: 3.2, fade: 0.8, peak: -5 },
  ready: { start: 0, dur: 0.9, fade: 0.25, peak: -6 },
  footsteps: { auto: 0.28, fade: 0.1, peak: -10 }, // one footfall; main.ts repeats it at the running cadence
  portal: { aroundPeak: [1.8, 3.8], fade: 0.8, peak: -3 }, // starts 1.8 s before the loudest moment
};
for (const [name, c] of Object.entries(SFX)) {
  const src = `${SRC}${name}.mp3`;
  const lv = levels(src);
  const pk = lv.indexOf(Math.max(...lv));
  let start = c.start ?? 0, dur = c.dur ?? 0;
  if (c.auto) {
    let i = pk;
    while (i > 0 && lv[i - 1] > lv[pk] - 26) i--; // walk back to where the event begins
    start = Math.max(0, i / 100 - 0.02);
    dur = c.auto;
  } else if (c.aroundPeak) {
    start = Math.max(0, pk / 100 - c.aroundPeak[0]);
    dur = c.aroundPeak[1];
  }
  const cut = `${TMP}${name}.wav`;
  ff('-ss', String(start), '-t', String(dur), '-i', src, '-af', `afade=t=in:d=0.006,afade=t=out:st=${Math.max(0, dur - c.fade)}:d=${c.fade}`, '-ac', '1', '-ar', String(RATE), cut);
  const gain = c.peak - peakDb(cut);
  ff('-i', cut, '-af', `volume=${gain.toFixed(2)}dB`, ...enc(`${OUT}${name}.m4a`, 64));
  unlinkSync(cut);
  console.log(`${name.padEnd(9)} from ${start.toFixed(2)} s, ${dur.toFixed(2)} s, loudest moment at ${(pk / 100 - start).toFixed(2)} s into the cut, gain ${gain >= 0 ? '+' : ''}${gain.toFixed(1)} dB, ${(statSync(`${OUT}${name}.m4a`).size / 1024).toFixed(0)} kB`);
}

// ---------------------------------------------------------------- loops
/** Bake a seamless loop: the last X seconds are cross-faded into the first X seconds. */
function bakeLoop(src, X, dst) {
  const T = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src], { encoding: 'utf8' }).trim();
  const f = `[0]atrim=${X}:${T - X},asetpts=PTS-STARTPTS[body];[0]atrim=${T - X}:${T},asetpts=PTS-STARTPTS[tail];[0]atrim=0:${X},asetpts=PTS-STARTPTS[head];` +
    `[tail][head]acrossfade=d=${X}:c1=qsin:c2=qsin[mix];[body][mix]concat=n=2:v=0:a=1[out]`;
  ff('-i', src, '-filter_complex', f, '-map', '[out]', '-ac', '1', '-ar', String(RATE), dst);
  return T - X;
}
const baked = {};
for (const n of ['menu', 'run_1', 'run_2', 'run_3']) { baked[n] = `${TMP}${n}.wav`; console.log(`${n.padEnd(9)} loop of ${bakeLoop(`${SRC}${n}.mp3`, 2, baked[n]).toFixed(2)} s`); }
baked.ambience_solaris = `${TMP}ambience_solaris.wav`;
console.log(`ambience  loop of ${bakeLoop(`${SRC}ambience_solaris.mp3`, 1, baked.ambience_solaris).toFixed(2)} s`);

// Loudness: the run layers share ONE gain (the loudest lands on -17 LUFS) so layer 3 stays the most intense
const runL = ['run_1', 'run_2', 'run_3'].map(n => lufs(baked[n]));
const runGain = -17 - Math.max(...runL);
const gains = { run_1: runGain, run_2: runGain, run_3: runGain, menu: -19 - lufs(baked.menu), ambience_solaris: -28 - lufs(baked.ambience_solaris) };
console.log('run layers', runL.map(v => v.toFixed(1)).join(' / '), 'LUFS, common gain', runGain.toFixed(1), 'dB');
for (const [n, g] of Object.entries(gains)) {
  ff('-i', baked[n], '-af', `volume=${g.toFixed(2)}dB,alimiter=limit=0.89:level=disabled`, ...enc(`${OUT}${n}.m4a`, n === 'ambience_solaris' ? 40 : 48));
  unlinkSync(baked[n]);
  console.log(`${n.padEnd(17)} gain ${g >= 0 ? '+' : ''}${g.toFixed(1)} dB  ${(statSync(`${OUT}${n}.m4a`).size / 1024).toFixed(0)} kB`);
}
