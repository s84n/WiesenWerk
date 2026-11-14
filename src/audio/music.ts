import { MUSIC_CONFIG, MUSIC_TRACKS } from '../data/music';

/**
 * Einfacher Musikspieler: Stücke aus `MUSIC_TRACKS` in zufälliger Reihenfolge mit weichem
 * Überblenden. Dateien werden erst geladen, wenn sie dran sind. Ohne Stücke oder bei fehlenden
 * Dateien passiert einfach nichts (keine Fehlermeldung).
 */
export class MusicPlayer {
  private current: HTMLAudioElement | null = null;
  private order: number[] = [];
  private volume = 0.5;
  private started = false;
  private waitUntil = 0;
  private broken = new Set<number>();

  /** Lautstärke 0..1 (0 = aus). */
  setVolume(v: number): void {
    this.volume = v;
    if (this.current) this.current.volume = Math.min(this.current.volume, v);
  }

  /** Nach der ersten Nutzereingabe aufrufen (Browser erlauben vorher keinen Ton). */
  start(): void {
    this.started = true;
  }

  /** Einmal pro Bild. */
  update(now: number): void {
    if (!this.started || MUSIC_TRACKS.length === 0 || this.broken.size >= MUSIC_TRACKS.length)
      return;
    const fade = MUSIC_CONFIG.crossfadeSeconds;
    const cur = this.current;
    if (!cur) {
      if (now >= this.waitUntil && this.volume > 0) this.playNext();
      return;
    }
    // Ein- und Ausblenden über die Lautstärke
    const t = cur.currentTime;
    const d = Number.isFinite(cur.duration) ? cur.duration : Infinity;
    let v = this.volume;
    if (t < fade) v *= t / fade;
    if (d - t < fade) v *= Math.max(0, (d - t) / fade);
    cur.volume = Math.min(1, Math.max(0, v));
    if (cur.ended) {
      this.current = null;
      this.waitUntil = now + MUSIC_CONFIG.gapSeconds * 1000;
    }
  }

  private playNext(): void {
    if (this.order.length === 0) {
      this.order = MUSIC_TRACKS.map((_, i) => i).filter((i) => !this.broken.has(i));
      for (let i = this.order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.order[i], this.order[j]] = [this.order[j], this.order[i]];
      }
    }
    const index = this.order.pop();
    if (index === undefined) return;
    const audio = new Audio(MUSIC_CONFIG.folder + MUSIC_TRACKS[index]);
    audio.preload = 'auto';
    audio.volume = 0;
    audio.addEventListener('error', () => {
      this.broken.add(index);
      if (this.current === audio) this.current = null;
    });
    this.current = audio;
    audio.play().catch(() => {
      // Wiedergabe abgelehnt (z. B. noch keine Eingabe): später noch einmal
      if (this.current === audio) this.current = null;
      this.waitUntil = performance.now() + 3000;
    });
  }
}
