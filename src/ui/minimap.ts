import { BUILDINGS } from '../data/buildings';
import { PALETTE } from '../data/palette';
import { TEXTS } from '../data/texts';
import { DEPOSITS, TileType } from '../data/world';
import { footprintH, footprintW } from '../sim/buildings';
import type { SimEvent } from '../sim/events';
import type { Simulation } from '../sim/simulation';
import { el } from './dom';

const KEY = 'wiesenwerk-minikarte';
/** Höchstens so oft wird das Bild nach Bauänderungen neu übertragen. */
const REDRAW_MS = 250;

/**
 * Minikarte unten rechts: ein Bildpunkt je Feld (Gelände, Gebäude, Bänder), darüber der
 * sichtbare Ausschnitt. Klick oder Ziehen springt hin. Das Bild wird nur bei Bauänderungen
 * stückweise aktualisiert; der Ausschnitt nur, wenn sich die Kamera bewegt.
 */
export class Minimap {
  private readonly wrap: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly overlay: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly octx: CanvasRenderingContext2D;
  private image: ImageData | null = null;
  private sim: Simulation | null = null;
  private size = 0;
  private dirty = false;
  private lastDraw = 0;
  private lastView = '';
  private visible = true;
  private dragging = false;
  private shown = true;

  constructor(
    parent: HTMLElement,
    private readonly jumpTo: (x: number, z: number) => void,
  ) {
    this.wrap = el('div', 'panel minimap');
    this.wrap.title = TEXTS.minimap.tooltip;
    this.canvas = el('canvas', 'minimap-map');
    this.overlay = el('canvas', 'minimap-view');
    this.ctx = this.canvas.getContext('2d')!;
    this.octx = this.overlay.getContext('2d')!;
    this.wrap.append(this.canvas, this.overlay);
    parent.appendChild(this.wrap);
    try {
      this.visible = localStorage.getItem(KEY) !== 'aus';
    } catch {
      this.visible = true;
    }

    const jump = (e: PointerEvent): void => {
      const r = this.overlay.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * this.size;
      const z = ((e.clientY - r.top) / r.height) * this.size;
      this.jumpTo(x, z);
    };
    this.overlay.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      this.dragging = true;
      this.overlay.setPointerCapture(e.pointerId);
      jump(e);
    });
    this.overlay.addEventListener('pointermove', (e) => {
      if (this.dragging) jump(e);
    });
    this.overlay.addEventListener('pointerup', () => (this.dragging = false));
    window.addEventListener('keydown', (e) => {
      if (e.repeat || e.code !== 'KeyM') return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      this.toggle();
    });
  }

  toggle(): void {
    this.visible = !this.visible;
    try {
      localStorage.setItem(KEY, this.visible ? 'an' : 'aus');
    } catch {
      // ohne Speicher gilt die Wahl bis zum Neuladen
    }
    this.lastView = '';
  }

  /** Neue Welt: Gelände und alle Gebäude einmal zeichnen. */
  setSimulation(sim: Simulation): void {
    this.sim = sim;
    const size = sim.world.size;
    this.size = size;
    this.canvas.width = this.canvas.height = size;
    this.overlay.width = this.overlay.height = size;
    this.image = this.ctx.createImageData(size, size);
    for (let i = 0; i < size * size; i++) this.paintTile(i);
    const b = sim.buildings;
    for (let id = 0; id < b.highWater; id++) if (b.alive[id]) this.paintBuilding(id);
    this.ctx.putImageData(this.image, 0, 0);
    this.lastView = '';
  }

  handleEvents(events: readonly SimEvent[]): void {
    if (!this.sim || !this.image) return;
    for (const e of events) {
      if (e.type === 'buildingAdded') {
        this.paintBuilding(e.id);
        this.dirty = true;
      } else if (e.type === 'buildingRemoved') {
        const def = BUILDINGS[e.buildingType];
        this.paintArea(e.x, e.y, footprintW(def, e.rot), footprintH(def, e.rot));
        this.dirty = true;
      } else if (e.type === 'buildingReplaced') {
        this.paintBuilding(e.id);
        this.dirty = true;
      }
    }
  }

  /**
   * Einmal pro Bild. `corners` = Bodenpunkte der vier Bildecken (x, z abwechselnd) oder `null`.
   */
  update(now: number, corners: readonly number[] | null, active: boolean): void {
    const show = this.visible && active;
    if (show !== this.shown) {
      this.shown = show;
      this.wrap.style.display = show ? '' : 'none';
      this.lastView = '';
    }
    if (!show || !this.image) return;
    if (this.dirty && now - this.lastDraw >= REDRAW_MS) {
      this.dirty = false;
      this.lastDraw = now;
      this.ctx.putImageData(this.image, 0, 0);
    }
    if (!corners) return;
    const key = corners.map((v) => Math.round(v * 2)).join(',');
    if (key === this.lastView) return;
    this.lastView = key;
    const c = this.octx;
    c.clearRect(0, 0, this.size, this.size);
    c.beginPath();
    c.moveTo(corners[0], corners[1]);
    for (let k = 2; k < corners.length; k += 2) c.lineTo(corners[k], corners[k + 1]);
    c.closePath();
    c.fillStyle = 'rgba(255, 246, 216, 0.18)';
    c.fill();
    c.lineWidth = Math.max(1.5, this.size / 160);
    c.strokeStyle = hexCss(PALETTE.miniView);
    c.stroke();
  }

  private paintArea(x0: number, y0: number, w: number, h: number): void {
    const size = this.size;
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++)
        if (x >= 0 && y >= 0 && x < size && y < size) this.paintTile(y * size + x);
  }

  private paintBuilding(id: number): void {
    const sim = this.sim!;
    const b = sim.buildings;
    const def = BUILDINGS[b.type[id]];
    const kind = def.behavior.kind;
    const color =
      kind === 'belt' || kind === 'tunnel'
        ? PALETTE.miniBelt
        : kind === 'hq'
          ? PALETTE.flag
          : kind === 'decor'
            ? PALETTE.pathStone
            : kind === 'pole'
              ? PALETTE.woodDark
              : PALETTE.miniBuilding;
    const w = footprintW(def, b.rot[id]);
    const h = footprintH(def, b.rot[id]);
    for (let y = b.y[id]; y < b.y[id] + h; y++)
      for (let x = b.x[id]; x < b.x[id] + w; x++) this.setPixel(y * this.size + x, color);
  }

  private paintTile(i: number): void {
    const w = this.sim!.world;
    const t = w.tiles[i];
    const color =
      t === TileType.Water
        ? PALETTE.water
        : t === TileType.Rock
          ? PALETTE.rock
          : t === TileType.Forest
            ? PALETTE.leafDark
            : t === TileType.Deposit
              ? PALETTE[DEPOSITS[w.resource[i] - 1]?.oreColor ?? 'stone']
              : PALETTE.meadow;
    this.setPixel(i, color);
  }

  private setPixel(i: number, color: number): void {
    const d = this.image!.data;
    d[i * 4] = (color >> 16) & 255;
    d[i * 4 + 1] = (color >> 8) & 255;
    d[i * 4 + 2] = color & 255;
    d[i * 4 + 3] = 255;
  }
}

function hexCss(c: number): string {
  return `#${c.toString(16).padStart(6, '0')}`;
}
