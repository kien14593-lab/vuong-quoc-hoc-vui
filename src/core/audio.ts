import { getSettings } from './state';
import { bus } from './events';

/**
 * Âm thanh tổng hợp bằng WebAudio – không cần tệp âm thanh, chạy được ngoại tuyến.
 * Gồm hiệu ứng (sfx) và nhạc nền sinh theo thủ tục cho từng khu vực.
 */
export type SfxName =
  | 'click'
  | 'pop'
  | 'correct'
  | 'wrong'
  | 'coin'
  | 'star'
  | 'jump'
  | 'land'
  | 'door'
  | 'unlock'
  | 'levelup'
  | 'badge'
  | 'whoosh'
  | 'hint'
  | 'break'
  | 'splash'
  | 'tick'
  | 'open'
  | 'buy'
  | 'step'
  | 'error';

export type TrackId = 'title' | 'village' | 'forest' | 'maze' | 'park' | 'zoo' | 'castle' | 'house' | 'mini' | 'final';

interface TrackDef {
  bpm: number;
  root: number;
  scale: number[];
  prog: number[];
  lead: OscillatorType;
  pad: OscillatorType;
  swing?: number;
  density: number;
  drums: boolean;
  seed: number;
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MIXO = [0, 2, 4, 5, 7, 9, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];

const TRACKS: Record<TrackId, TrackDef> = {
  title: { bpm: 96, root: 60, scale: MAJOR, prog: [0, 5, 3, 4], lead: 'triangle', pad: 'sine', density: 0.55, drums: false, seed: 11 },
  village: { bpm: 104, root: 62, scale: MAJOR, prog: [0, 3, 4, 0, 5, 3, 4, 4], lead: 'triangle', pad: 'sine', density: 0.6, drums: true, seed: 3 },
  forest: { bpm: 92, root: 57, scale: DORIAN, prog: [0, 3, 0, 4], lead: 'sine', pad: 'triangle', density: 0.5, drums: false, seed: 7 },
  maze: { bpm: 112, root: 55, scale: MIXO, prog: [0, 6, 3, 4], lead: 'square', pad: 'triangle', density: 0.45, drums: true, seed: 19 },
  park: { bpm: 126, root: 65, scale: MAJOR, prog: [0, 4, 5, 3], lead: 'square', pad: 'triangle', density: 0.7, drums: true, seed: 23 },
  zoo: { bpm: 110, root: 64, scale: MAJOR, prog: [0, 3, 4, 3], lead: 'triangle', pad: 'sine', density: 0.6, drums: true, seed: 31 },
  castle: { bpm: 88, root: 58, scale: MAJOR, prog: [0, 4, 5, 3, 0, 3, 4, 4], lead: 'sawtooth', pad: 'triangle', density: 0.45, drums: false, seed: 41 },
  house: { bpm: 84, root: 60, scale: MAJOR, prog: [0, 5, 1, 4], lead: 'sine', pad: 'sine', density: 0.4, drums: false, seed: 5 },
  mini: { bpm: 132, root: 62, scale: MAJOR, prog: [0, 4, 5, 4], lead: 'square', pad: 'triangle', density: 0.75, drums: true, seed: 53 },
  final: { bpm: 100, root: 60, scale: MAJOR, prog: [0, 4, 5, 3, 0, 3, 4, 0], lead: 'triangle', pad: 'triangle', density: 0.6, drums: true, seed: 61 },
};

const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

class AudioSystem {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxGain!: GainNode;
  private musicGain!: GainNode;
  private noise!: AudioBuffer;
  private track: TrackId | null = null;
  private wanted: TrackId | null = null;
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private melody: number[] = [];
  private duck = 1;
  private unlocked = false;

  constructor() {
    const unlock = () => {
      this.unlocked = true;
      this.ensure();
      if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
      if (this.wanted && this.track !== this.wanted) this.music(this.wanted);
    };
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    bus.on('settings', () => this.applyVolumes());
  }

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (!this.unlocked) return null;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try {
      this.ctx = new AC();
    } catch {
      return null;
    }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.sfxGain = ctx.createGain();
    this.sfxGain.connect(this.master);
    this.musicGain = ctx.createGain();
    this.musicGain.connect(this.master);
    const len = ctx.sampleRate * 1;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
    return ctx;
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const s = getSettings();
    const t = this.ctx.currentTime;
    this.sfxGain.gain.setTargetAtTime(s.sfx * 0.9, t, 0.02);
    this.musicGain.gain.setTargetAtTime(s.music * 0.22 * this.duck, t, 0.1);
  }

  /** Giảm nhạc nền khi đọc giọng nói. */
  setDuck(on: boolean): void {
    this.duck = on ? 0.45 : 1;
    this.applyVolumes();
  }

  private tone(freq: number, start: number, dur: number, type: OscillatorType, vol: number, dest: AudioNode, glideTo?: number, attack = 0.005): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g);
    g.connect(dest);
    o.start(start);
    o.stop(start + dur + 0.05);
  }

  private noiseBurst(start: number, dur: number, vol: number, dest: AudioNode, filter: BiquadFilterType = 'bandpass', f1 = 1200, f2?: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bf = ctx.createBiquadFilter();
    bf.type = filter;
    bf.frequency.setValueAtTime(f1, start);
    if (f2) bf.frequency.exponentialRampToValueAtTime(f2, start + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(bf);
    bf.connect(g);
    g.connect(dest);
    src.start(start, Math.random() * 0.5);
    src.stop(start + dur + 0.02);
  }

  play(name: SfxName): void {
    const ctx = this.ensure();
    if (!ctx || getSettings().sfx <= 0) return;
    const t = ctx.currentTime + 0.01;
    const d = this.sfxGain;
    switch (name) {
      case 'click':
        this.tone(880, t, 0.06, 'sine', 0.25, d);
        break;
      case 'pop':
        this.tone(420, t, 0.09, 'sine', 0.35, d, 920);
        break;
      case 'correct':
        [72, 76, 79, 84].forEach((m, i) => this.tone(midiHz(m), t + i * 0.07, 0.22, 'triangle', 0.32, d));
        this.tone(midiHz(88), t + 0.28, 0.4, 'sine', 0.15, d);
        break;
      case 'wrong':
        this.tone(midiHz(64), t, 0.16, 'sine', 0.28, d);
        this.tone(midiHz(60), t + 0.14, 0.24, 'sine', 0.25, d);
        break;
      case 'error':
        this.tone(220, t, 0.12, 'triangle', 0.2, d, 180);
        break;
      case 'coin':
        this.tone(midiHz(83), t, 0.07, 'square', 0.12, d);
        this.tone(midiHz(88), t + 0.06, 0.22, 'square', 0.12, d);
        break;
      case 'buy':
        [76, 80, 83, 88].forEach((m, i) => this.tone(midiHz(m), t + i * 0.05, 0.12, 'square', 0.09, d));
        break;
      case 'star':
        [84, 88, 91, 96, 91, 96].forEach((m, i) => this.tone(midiHz(m), t + i * 0.05, 0.25, 'sine', 0.16, d));
        break;
      case 'jump':
        this.tone(300, t, 0.16, 'sine', 0.28, d, 640);
        break;
      case 'land':
        this.tone(140, t, 0.08, 'sine', 0.3, d, 80);
        break;
      case 'step':
        this.noiseBurst(t, 0.04, 0.05, d, 'highpass', 2500);
        break;
      case 'door':
        this.tone(180, t, 0.35, 'triangle', 0.22, d, 90);
        this.noiseBurst(t, 0.3, 0.08, d, 'lowpass', 900, 200);
        break;
      case 'open':
        this.tone(midiHz(67), t, 0.1, 'triangle', 0.2, d);
        this.tone(midiHz(74), t + 0.08, 0.2, 'triangle', 0.2, d);
        break;
      case 'unlock':
        [67, 71, 74, 79].forEach((m, i) => this.tone(midiHz(m), t + i * 0.06, 0.3, 'triangle', 0.25, d));
        this.noiseBurst(t + 0.25, 0.4, 0.05, d, 'highpass', 6000);
        break;
      case 'levelup': {
        const seq = [60, 64, 67, 72, 67, 72, 76, 79, 84];
        seq.forEach((m, i) => this.tone(midiHz(m), t + i * 0.08, 0.3, 'square', 0.1, d));
        [72, 76, 79].forEach((m) => this.tone(midiHz(m), t + 0.75, 0.9, 'triangle', 0.18, d));
        break;
      }
      case 'badge':
        [79, 84, 88, 91].forEach((m, i) => this.tone(midiHz(m), t + i * 0.1, 0.6, 'sine', 0.2, d));
        break;
      case 'whoosh':
        this.noiseBurst(t, 0.35, 0.2, d, 'bandpass', 400, 3000);
        break;
      case 'hint':
        this.tone(midiHz(79), t, 0.3, 'sine', 0.22, d);
        this.tone(midiHz(86), t + 0.12, 0.45, 'sine', 0.18, d);
        break;
      case 'break':
        this.noiseBurst(t, 0.45, 0.45, d, 'lowpass', 1800, 150);
        this.tone(110, t, 0.25, 'triangle', 0.3, d, 50);
        break;
      case 'splash':
        this.noiseBurst(t, 0.4, 0.25, d, 'bandpass', 2500, 600);
        break;
      case 'tick':
        this.noiseBurst(t, 0.03, 0.2, d, 'highpass', 4000);
        break;
    }
  }

  music(track: TrackId | null): void {
    this.wanted = track;
    const ctx = this.ensure();
    if (!ctx) return;
    if (track === this.track) return;
    this.track = track;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (!track) return;
    const def = TRACKS[track];
    this.makeMelody(def);
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.15;
    this.timer = window.setInterval(() => this.schedule(), 60);
  }

  private makeMelody(def: TrackDef): void {
    let s = def.seed * 9301 + 49297;
    const r = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
    const steps = def.prog.length * 8;
    const out: number[] = [];
    let deg = 4;
    for (let i = 0; i < steps; i++) {
      const strong = i % 4 === 0;
      if (r() > def.density && !strong) {
        out.push(-1);
        continue;
      }
      deg += Math.round((r() - 0.5) * 4);
      deg = Math.max(0, Math.min(11, deg));
      out.push(deg);
    }
    this.melody = out;
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.track) return;
    const def = TRACKS[this.track];
    const eighth = 60 / def.bpm / 2;
    const dest = this.musicGain;
    while (this.nextTime < ctx.currentTime + 0.25) {
      const t = this.nextTime;
      const i = this.step;
      const bar = Math.floor(i / 8) % def.prog.length;
      const chordDeg = def.prog[bar];
      const note = (deg: number, oct = 0) => {
        const sc = def.scale;
        const idx = deg % sc.length;
        const o = Math.floor(deg / sc.length);
        return def.root + sc[idx] + 12 * (o + oct);
      };
      const pos = i % 8;
      if (pos === 0) {
        [0, 2, 4].forEach((k) => this.tone(midiHz(note(chordDeg + k)), t, eighth * 7.5, def.pad, 0.05, dest, undefined, 0.15));
      }
      if (pos === 0 || pos === 4) this.tone(midiHz(note(chordDeg, -2)), t, eighth * 3.5, 'triangle', 0.16, dest, undefined, 0.01);
      if (pos === 6 && def.drums) this.tone(midiHz(note(chordDeg + 4, -2)), t, eighth * 1.5, 'triangle', 0.1, dest);
      const m = this.melody[i % this.melody.length];
      if (m >= 0) {
        const snap = pos % 4 === 0 ? chordDeg + [0, 2, 4][m % 3] : chordDeg + m;
        this.tone(midiHz(note(snap, 1)), t, eighth * 1.8, def.lead, def.lead === 'square' || def.lead === 'sawtooth' ? 0.035 : 0.08, dest);
      }
      if (def.drums) {
        if (pos % 2 === 1) this.noiseBurst(t, 0.03, 0.035, dest, 'highpass', 7000);
        if (pos === 0 || pos === 4) this.tone(90, t, 0.12, 'sine', 0.22, dest, 45);
        if (pos === 2 || pos === 6) this.noiseBurst(t, 0.1, 0.06, dest, 'bandpass', 1800);
      }
      this.nextTime += eighth * (def.swing && pos % 2 === 0 ? 1 + def.swing : def.swing && pos % 2 === 1 ? 1 - def.swing : 1);
      this.step++;
    }
  }
}

export const audio = new AudioSystem();
export const sfx = (n: SfxName) => audio.play(n);
