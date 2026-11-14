import type { WebGLRenderer } from 'three';
import { RENDER_CONFIG } from '../data/config';
import { TEXTS } from '../data/texts';
import type { Simulation } from '../sim/simulation';

/**
 * Debug-Anzeige (F3): Bildrate, Tick-Zeit, Zeichenaufrufe, Dreiecke und Zähler.
 * Misst laufend, schreibt aber nur wenige Male pro Sekunde ins HTML.
 */
export class DebugOverlay {
  private readonly el: HTMLDivElement;
  private readonly values: HTMLElement[] = [];
  private visible = true;

  private frames = 0;
  private tickTimeSum = 0;
  private tickCount = 0;
  private lastUpdate = 0;
  private drawCalls = 0;
  private triangles = 0;

  private readonly labels = [
    TEXTS.debug.fps,
    TEXTS.debug.tickTime,
    TEXTS.debug.tick,
    TEXTS.debug.drawCalls,
    TEXTS.debug.triangles,
    TEXTS.debug.buildings,
    TEXTS.debug.segments,
    TEXTS.debug.items,
  ];

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'debug-overlay';
    const title = document.createElement('div');
    title.className = 'debug-title';
    title.textContent = TEXTS.debug.title;
    this.el.appendChild(title);
    for (const label of this.labels) {
      const row = document.createElement('div');
      row.className = 'debug-row';
      const l = document.createElement('span');
      l.textContent = label;
      const v = document.createElement('span');
      v.className = 'debug-value';
      row.append(l, v);
      this.el.appendChild(row);
      this.values.push(v);
    }
    parent.appendChild(this.el);
  }

  toggle(): void {
    this.visible = !this.visible;
    this.el.style.display = this.visible ? '' : 'none';
  }

  /** Pro Bild aufrufen. `tickMs` = Rechenzeit aller Ticks dieses Bildes, `ticks` = deren Anzahl. */
  frame(
    now: number,
    tickMs: number,
    ticks: number,
    renderer: WebGLRenderer,
    sim: Simulation,
    paused: boolean,
  ): void {
    this.frames++;
    this.tickTimeSum += tickMs;
    this.tickCount += ticks;
    this.drawCalls = renderer.info.render.calls;
    this.triangles = renderer.info.render.triangles;

    const interval = 1000 / RENDER_CONFIG.uiUpdatesPerSecond;
    if (now - this.lastUpdate < interval) return;
    const elapsed = now - this.lastUpdate;
    this.lastUpdate = now;
    if (!this.visible) {
      this.reset();
      return;
    }

    const fps = (this.frames * 1000) / elapsed;
    const avgTick = this.tickCount > 0 ? this.tickTimeSum / this.tickCount : 0;
    const v = this.values;
    v[0].textContent = fps.toFixed(0);
    v[1].textContent = paused ? TEXTS.debug.paused : `${avgTick.toFixed(3)} ms`;
    v[2].textContent = String(sim.tick);
    v[3].textContent = String(this.drawCalls);
    v[4].textContent = this.triangles.toLocaleString('de-DE');
    v[5].textContent = String(sim.buildingCount);
    v[6].textContent = String(sim.segmentCount);
    v[7].textContent = String(sim.itemCount);
    this.reset();
  }

  private reset(): void {
    this.frames = 0;
    this.tickTimeSum = 0;
    this.tickCount = 0;
  }
}
