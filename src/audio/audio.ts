/**
 * Original procedural audio (Web Audio): no samples, nothing licensed.
 * Music is a generative loop in D Phrygian dominant whose tempo and brightness
 * follow the run's intensity.
 */
const SCALE = [0, 1, 4, 5, 7, 8, 10]; // D Phrygian dominant
const ARP = [0, 2, 4, 6, 4, 2, 5, 3, 0, 2, 4, 7, 6, 4, 2, 1];
const BASS = [0, 0, 0, 0, 5, 5, 3, 4];

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicGain!: GainNode;
  private filter!: BiquadFilterNode;
  private noise!: AudioBuffer;
  private step = 0;
  private nextT = 0;
  private timer = 0;
  private coinStreak = 0;
  private lastCoin = 0;
  muted = false;
  /** 0..1, set by the game each frame. */
  intensity = 0;
  musicOn = false;

  /** Must be called from a user gesture (browser autoplay policy). */
  unlock(): void {
    if (this.ctx) { void this.ctx.resume(); return; }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const c = (this.ctx = new AC());
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    const comp = c.createDynamicsCompressor();
    this.master.connect(comp).connect(c.destination);
    this.filter = c.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 900;
    this.musicGain = c.createGain();
    this.musicGain.gain.value = 0.5;
    this.filter.connect(this.musicGain).connect(this.master);
    this.noise = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.nextT = c.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 60);
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }
  suspend(on: boolean): void {
    if (!this.ctx) return;
    if (on) void this.ctx.suspend();
    else void this.ctx.resume();
  }
  dispose(): void {
    clearInterval(this.timer);
  }

  private tone(type: OscillatorType, f0: number, f1: number, t: number, dur: number, vol: number, dest?: AudioNode): void {
    const c = this.ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest ?? this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  private hiss(t: number, dur: number, vol: number, freq: number, q = 1, sweepTo = freq): void {
    const c = this.ctx!;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo !== freq) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t);
    s.stop(t + dur + 0.02);
  }
  private hz(deg: number, oct: number): number {
    const n = SCALE[((deg % 7) + 7) % 7] + 12 * (oct + Math.floor(deg / 7));
    return 146.83 * Math.pow(2, n / 12);
  }

  private schedule(): void {
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    if (this.nextT < c.currentTime) this.nextT = c.currentTime + 0.05;
    const bpm = 104 + 44 * this.intensity;
    const sixteenth = 60 / bpm / 4;
    this.filter.frequency.setTargetAtTime(700 + 3200 * this.intensity, c.currentTime, 0.3);
    while (this.nextT < c.currentTime + 0.2) {
      const s = this.step++;
      const t = this.nextT;
      this.nextT += sixteenth;
      if (!this.musicOn) {
        // Menu: a slow, sparse drone
        if (s % 16 === 0) this.tone('sine', this.hz(0, -1), this.hz(0, -1), t, sixteenth * 14, 0.22, this.filter);
        if (s % 8 === 4) this.tone('triangle', this.hz(ARP[(s >> 3) % 16], 1), this.hz(ARP[(s >> 3) % 16], 1), t, sixteenth * 6, 0.07, this.filter);
        continue;
      }
      const bar = Math.floor(s / 16);
      const root = BASS[bar % 8];
      if (s % 4 === 0) this.tone('sine', 130, 42, t, 0.16, 0.7); // kick
      if (s % 4 === 2) this.hiss(t, 0.04, 0.1 + 0.1 * this.intensity, 7000, 2); // hat
      if (s % 8 === 4 && this.intensity > 0.25) this.hiss(t, 0.12, 0.22, 1800, 0.8); // snare
      if (s % 2 === 0) this.tone('sawtooth', this.hz(root, -2), this.hz(root, -2), t, sixteenth * 1.7, 0.28, this.filter);
      const deg = root + ARP[s % 16];
      this.tone('triangle', this.hz(deg, 1), this.hz(deg, 1), t, sixteenth * 1.4, 0.13, this.filter);
      if (s % 16 === 0) this.tone('sawtooth', this.hz(root + 4, 0), this.hz(root + 4, 0), t, sixteenth * 15, 0.06, this.filter);
    }
  }

  sfx(name: 'jump' | 'land' | 'slide' | 'lane' | 'coin' | 'dash' | 'smash' | 'death' | 'ready' | 'ui'): void {
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    const t = c.currentTime;
    switch (name) {
      case 'jump': this.tone('sine', 260, 620, t, 0.16, 0.25); this.hiss(t, 0.14, 0.12, 900, 1, 3000); break;
      case 'land': this.tone('sine', 120, 50, t, 0.1, 0.4); break;
      case 'slide': this.hiss(t, 0.5, 0.3, 2400, 0.7, 500); break;
      case 'lane': this.hiss(t, 0.09, 0.14, 1500, 1.2, 2600); break;
      case 'coin': {
        this.coinStreak = t - this.lastCoin < 0.5 ? Math.min(this.coinStreak + 1, 9) : 0;
        this.lastCoin = t;
        const f = this.hz(this.coinStreak, 2);
        this.tone('triangle', f, f, t, 0.14, 0.22);
        this.tone('sine', f * 2, f * 2, t + 0.03, 0.12, 0.1);
        break;
      }
      case 'dash': this.hiss(t, 0.55, 0.45, 400, 0.6, 5000); this.tone('sawtooth', 110, 440, t, 0.4, 0.2); break;
      case 'smash': this.hiss(t, 0.45, 0.7, 500, 0.5, 120); this.tone('sine', 90, 30, t, 0.35, 0.7); break;
      case 'death': this.hiss(t, 0.7, 0.7, 700, 0.5, 80); this.tone('sawtooth', 220, 40, t, 0.8, 0.4); break;
      case 'ready': this.tone('triangle', this.hz(4, 2), this.hz(4, 2), t, 0.12, 0.18); this.tone('triangle', this.hz(7, 2), this.hz(7, 2), t + 0.09, 0.2, 0.18); break;
      case 'ui': this.tone('triangle', 520, 780, t, 0.09, 0.15); break;
    }
  }
}
