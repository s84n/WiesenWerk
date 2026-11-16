import { TEXTS } from '../data/texts';
import { el } from './dom';
import { icon } from './icons';

/** Minuten eines Tages (Regler der Uhrzeit). */
const DAY_MINUTES = 24 * 60;

/**
 * Fotomodus: kleine Leiste unten (die restliche Oberfläche ist ausgeblendet). Uhrzeit frei
 * wählbar, „Foto speichern“ legt das Bild als PNG-Datei ab, H blendet auch die Leiste aus.
 */
export class PhotoBar {
  private readonly bar: HTMLElement;
  private readonly slider: HTMLInputElement;
  private readonly timeLabel: HTMLElement;
  private readonly liveButton: HTMLButtonElement;
  /** Gewählte Tageszeit (0..1) oder null = Spielzeit. */
  time: number | null = null;
  private captureWanted = false;
  private barHidden = false;

  constructor(
    parent: HTMLElement,
    private readonly close: () => void,
    private readonly onShutter: () => void,
  ) {
    this.bar = el('div', 'panel photo-bar');
    const title = el('div', 'photo-title');
    title.append(icon('camera', 18), el('span', '', TEXTS.photo.title));

    const timeBox = el('label', 'photo-time');
    this.timeLabel = el('span', 'photo-time-label');
    this.slider = el('input', 'photo-slider');
    this.slider.type = 'range';
    this.slider.min = '0';
    this.slider.max = String(DAY_MINUTES - 1);
    this.slider.step = '5';
    // Nach dem Ziehen den Fokus abgeben, damit WASD und Q/E wieder die Kamera steuern
    this.slider.addEventListener('change', () => this.slider.blur());
    this.slider.addEventListener('input', () => {
      this.time = Number(this.slider.value) / DAY_MINUTES;
      this.refreshTime();
    });
    timeBox.append(el('span', 'photo-time-caption', TEXTS.photo.time), this.slider, this.timeLabel);

    this.liveButton = el('button', 'photo-button', TEXTS.photo.live);
    this.liveButton.title = TEXTS.photo.liveTooltip;
    this.liveButton.addEventListener('click', () => {
      this.time = null;
      this.refreshTime();
      this.liveButton.blur();
    });

    const shot = el('button', 'photo-button primary');
    shot.append(icon('camera', 16), el('span', '', TEXTS.photo.save));
    shot.title = TEXTS.photo.saveTooltip;
    shot.addEventListener('click', () => {
      this.captureWanted = true;
      shot.blur();
    });

    const done = el('button', 'photo-button', TEXTS.photo.done);
    done.addEventListener('click', () => {
      done.blur();
      this.close();
    });

    const hint = el('div', 'photo-hint', TEXTS.photo.hint);
    const row = el('div', 'photo-row');
    row.append(title, timeBox, this.liveButton, shot, done);
    this.bar.append(row, hint);
    this.bar.style.display = 'none';
    parent.append(this.bar);
  }

  /** Beim Öffnen: Regler auf die aktuelle Tageszeit stellen. */
  open(currentTime: number): void {
    this.time = null;
    this.barHidden = false;
    this.slider.value = String(Math.round(currentTime * DAY_MINUTES));
    this.refreshTime(currentTime);
    this.bar.style.display = '';
  }

  hide(): void {
    this.bar.style.display = 'none';
    this.captureWanted = false;
  }

  /** Taste H: Leiste aus- und wieder einblenden (für Bildschirmfotos ohne jede Oberfläche). */
  toggleBar(): void {
    this.barHidden = !this.barHidden;
    this.bar.style.display = this.barHidden ? 'none' : '';
  }

  /**
   * Gleich nach dem Zeichnen aufrufen: Wurde ein Foto gewünscht, wird das gerade gezeichnete Bild
   * als PNG gespeichert (der Zeichenpuffer ist nur bis zum Ende des Bildes gültig).
   */
  capture(canvas: HTMLCanvasElement): void {
    if (!this.captureWanted) return;
    this.captureWanted = false;
    this.onShutter();
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = TEXTS.photo.fileName(new Date());
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }, 'image/png');
  }

  private refreshTime(live?: number): void {
    const t = this.time ?? live;
    this.liveButton.classList.toggle('active', this.time === null);
    if (t === undefined) {
      this.timeLabel.textContent = TEXTS.photo.liveLabel;
      return;
    }
    const minutes = Math.round(t * DAY_MINUTES) % DAY_MINUTES;
    this.timeLabel.textContent = TEXTS.photo.clock(Math.floor(minutes / 60), minutes % 60);
  }
}
