import { QUALITIES, type Quality } from '../data/config';

const KEY = 'wiesenwerk-einstellungen';

/** Einstellungen des Spielers. Liegen nur in diesem Browser (kein Teil des Spielstands). */
export interface Settings {
  quality: Quality;
  /** Stufe wurde beim ersten Start automatisch gemessen (noch nicht von Hand gewählt). */
  qualityChosen: boolean;
  dayNight: boolean;
  /** Lautstärke der Klänge und der Musik (0..1). */
  soundVolume: number;
  musicVolume: number;
  muted: boolean;
}

const DEFAULTS: Settings = {
  quality: 'high',
  qualityChosen: false,
  dayNight: true,
  soundVolume: 0.7,
  musicVolume: 0.5,
  muted: false,
};

/**
 * Lädt und speichert die Einstellungen (`localStorage`, Fehler werden still ignoriert –
 * im privaten Fenster gelten dann einfach die Standardwerte).
 */
export class SettingsStore {
  readonly value: Settings;
  /** Gab es schon gespeicherte Einstellungen (sonst: erster Start)? */
  readonly existed: boolean;
  private readonly listeners: ((s: Settings) => void)[] = [];

  constructor() {
    let stored: Partial<Settings> | null = null;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) stored = JSON.parse(raw) as Partial<Settings>;
    } catch {
      stored = null;
    }
    this.existed = stored !== null;
    const v = { ...DEFAULTS, ...(stored ?? {}) };
    if (!QUALITIES.includes(v.quality)) v.quality = DEFAULTS.quality;
    v.soundVolume = clamp01(v.soundVolume);
    v.musicVolume = clamp01(v.musicVolume);
    this.value = v;
  }

  onChange(fn: (s: Settings) => void): void {
    this.listeners.push(fn);
  }

  set<K extends keyof Settings>(key: K, value: Settings[K]): void {
    if (this.value[key] === value) return;
    this.value[key] = value;
    try {
      localStorage.setItem(KEY, JSON.stringify(this.value));
    } catch {
      // ohne Speicher gelten die Werte bis zum Neuladen
    }
    for (const l of this.listeners) l(this.value);
  }
}

function clamp01(v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 0.5;
  return Math.min(1, Math.max(0, n));
}
