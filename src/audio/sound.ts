import { SOUND_CONFIG } from '../data/config';
import { ITEMS } from '../data/items';
import type { SimEvent } from '../sim/events';

const STORAGE_KEY = 'wiesenwerk-ton';

/**
 * Gemütliche Klänge, vollständig im Browser erzeugt (Web Audio, keine Dateien):
 * Holzklopfen beim Bauen, Hacken beim Sammeln, Glöckchen bei Forschung und Aufgaben,
 * leise Vögel und Wind im Hintergrund, sanftes Klappern arbeitender Maschinen.
 * Der Ton startet erst nach der ersten Eingabe (Vorgabe der Browser).
 */
export class SoundSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private wind: GainNode | null = null;
  private muted = false;
  private lastPlayed = new Map<string, number>();
  private nextBird = 0;
  private nextClack = 0;

  constructor() {
    try {
      this.muted = localStorage.getItem(STORAGE_KEY) === 'aus';
    } catch {
      // Ohne Speicher: Ton bleibt an
    }
    const unlock = (): void => {
      this.start();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  get isMuted(): boolean {
    return this.muted;
  }

  toggleMute(): void {
    this.muted = !this.muted;
    try {
      localStorage.setItem(STORAGE_KEY, this.muted ? 'aus' : 'an');
    } catch {
      // egal
    }
    this.start();
    if (this.master && this.ctx)
      this.master.gain.setTargetAtTime(
        this.muted ? 0 : SOUND_CONFIG.volume,
        this.ctx.currentTime,
        0.05,
      );
  }

  /** Reagiert auf Ereignisse der Simulation (einmal pro Bild). */
  handleEvents(events: readonly SimEvent[]): void {
    if (!this.ready()) return;
    for (const e of events) {
      switch (e.type) {
        case 'buildingAdded':
          this.once('build', 70, () => this.knock(170, 0.5));
          break;
        case 'buildingReplaced':
        case 'buildingUpgraded':
          this.once('build', 70, () => this.knock(220, 0.45));
          break;
        case 'buildingRemoved':
          this.once('remove', 90, () => this.poof());
          break;
        case 'harvested':
          if (ITEMS[e.item].key === 'wood') this.once('harvest', 60, () => this.chop());
          else this.once('harvest', 60, () => this.pick());
          break;
        case 'researched':
        case 'upgraded':
          this.once('chime', 300, () => this.chime([523.25, 659.25, 783.99, 1046.5]));
          break;
        case 'goalCompleted':
          this.once('goal', 300, () => this.chime([783.99, 1174.66]));
          break;
        case 'commandFailed':
          this.once('fail', 400, () => this.boop());
          break;
      }
    }
  }

  /** Klick auf einen Knopf der Oberfläche. */
  click(): void {
    if (this.ready()) this.once('click', 40, () => this.tick());
  }

  /**
   * Hintergrund: Vögel ab und zu, Arbeitsgeräusche je nach Anzahl arbeitender Maschinen im Bild.
   * `paused` = Spiel angehalten (dann keine Maschinengeräusche).
   */
  update(now: number, workingInView: number, paused: boolean): void {
    if (!this.ready()) return;
    if (now >= this.nextBird) {
      if (this.nextBird > 0) this.bird();
      this.nextBird = now + 4000 + Math.random() * 9000;
    }
    if (now >= this.nextClack) {
      const busy = paused ? 0 : Math.min(1, workingInView / 8);
      if (busy > 0) this.clack(busy);
      this.nextClack = now + 350 + Math.random() * 500;
    }
  }

  // ---------------------------------------------------------------- Aufbau

  private start(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const ctx = new AudioContext();
      this.ctx = ctx;
      const comp = ctx.createDynamicsCompressor();
      comp.connect(ctx.destination);
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : SOUND_CONFIG.volume;
      this.master.connect(comp);
      // Rauschen für Wind, Hacken und Puffen (2 s, wird wiederverwendet)
      const len = ctx.sampleRate * 2;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.startWind();
    } catch {
      this.ctx = null; // kein Ton verfügbar
    }
  }

  private ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running' && !this.muted;
  }

  /** Spielt einen Klang höchstens alle `gapMs` Millisekunden (z. B. viele Bandfelder auf einmal). */
  private once(key: string, gapMs: number, play: () => void): void {
    const now = performance.now();
    if (now - (this.lastPlayed.get(key) ?? -Infinity) < gapMs) return;
    this.lastPlayed.set(key, now);
    play();
  }

  private startWind(): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 380;
    this.wind = ctx.createGain();
    this.wind.gain.value = SOUND_CONFIG.ambience * 0.5;
    // langsames An- und Abschwellen
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const depth = ctx.createGain();
    depth.gain.value = SOUND_CONFIG.ambience * 0.35;
    lfo.connect(depth).connect(this.wind.gain);
    src.connect(filter).connect(this.wind).connect(this.master!);
    src.start();
    lfo.start();
  }

  // ---------------------------------------------------------------- Klänge

  private env(gain: GainNode, t: number, peak: number, attack: number, decay: number): void {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  private noiseBurst(
    t: number,
    type: BiquadFilterType,
    freq: number,
    peak: number,
    decay: number,
    q = 1,
  ): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = ctx.createGain();
    this.env(g, t, peak, 0.004, decay);
    src.connect(filter).connect(g).connect(this.master!);
    src.start(t, Math.random() * 1.5, decay + 0.05);
  }

  private tone(
    t: number,
    type: OscillatorType,
    f0: number,
    f1: number,
    peak: number,
    attack: number,
    decay: number,
    pan = 0,
  ): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + attack + decay);
    const g = ctx.createGain();
    this.env(g, t, peak, attack, decay);
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    osc.connect(g).connect(p).connect(this.master!);
    osc.start(t);
    osc.stop(t + attack + decay + 0.05);
  }

  /** Hölzernes Klopfen (Bauen). */
  private knock(freq: number, peak: number): void {
    const t = this.ctx!.currentTime;
    const f = freq * (0.92 + Math.random() * 0.16);
    this.tone(t, 'triangle', f, f * 0.55, peak, 0.003, 0.16);
    this.noiseBurst(t, 'bandpass', 900, peak * 0.5, 0.05, 2);
    this.tone(t + 0.07, 'triangle', f * 1.15, f * 0.6, peak * 0.5, 0.003, 0.12);
  }

  /** Axthieb (Holz sammeln). */
  private chop(): void {
    const t = this.ctx!.currentTime;
    this.noiseBurst(t, 'bandpass', 1400 + Math.random() * 400, 0.5, 0.07, 3);
    this.tone(t, 'sine', 140, 80, 0.45, 0.002, 0.12);
  }

  /** Spitzhacke auf Stein (Stein, Erz sammeln). */
  private pick(): void {
    const t = this.ctx!.currentTime;
    const f = 1500 + Math.random() * 400;
    this.tone(t, 'triangle', f, f * 0.9, 0.22, 0.001, 0.09);
    this.noiseBurst(t, 'highpass', 2500, 0.2, 0.04);
  }

  /** Weiches Puffen (Abriss). */
  private poof(): void {
    const t = this.ctx!.currentTime;
    this.noiseBurst(t, 'lowpass', 700, 0.45, 0.28);
    this.tone(t, 'sine', 260, 120, 0.25, 0.005, 0.2);
  }

  /** Glöckchen-Akkord (Forschung, Aufgabe erledigt). */
  private chime(notes: readonly number[]): void {
    const t = this.ctx!.currentTime;
    notes.forEach((f, i) => {
      this.tone(t + i * 0.09, 'sine', f, f, 0.22, 0.01, 1.3);
      this.tone(t + i * 0.09, 'sine', f * 2, f * 2, 0.05, 0.01, 0.7);
    });
  }

  /** Sanftes „Nö“ (etwas geht nicht). */
  private boop(): void {
    const t = this.ctx!.currentTime;
    this.tone(t, 'sine', 330, 250, 0.22, 0.01, 0.16);
    this.tone(t + 0.12, 'sine', 250, 210, 0.18, 0.01, 0.2);
  }

  /** Leiser Klick der Oberfläche. */
  private tick(): void {
    const t = this.ctx!.currentTime;
    this.tone(t, 'triangle', 1900, 1700, 0.1, 0.001, 0.03);
  }

  /** Vogelgezwitscher: zwei bis vier kurze Pfiffe. */
  private bird(): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const base = 2400 + Math.random() * 1400;
    const pan = Math.random() * 1.6 - 0.8;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const s = t + i * (0.11 + Math.random() * 0.05);
      this.tone(
        s,
        'sine',
        base,
        base * (1.25 + Math.random() * 0.25),
        SOUND_CONFIG.ambience * 1.2,
        0.01,
        0.07,
        pan,
      );
    }
  }

  /** Gedämpftes Klappern arbeitender Maschinen. */
  private clack(busy: number): void {
    const t = this.ctx!.currentTime;
    const f = 300 + Math.random() * 250;
    this.tone(
      t,
      'triangle',
      f,
      f * 0.7,
      SOUND_CONFIG.machines * busy,
      0.002,
      0.06,
      Math.random() - 0.5,
    );
  }
}
