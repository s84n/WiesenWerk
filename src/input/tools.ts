import { Vector3 } from 'three';
import { HAND_MINING } from '../data/balance';
import { BUILDINGS } from '../data/buildings';
import { PALETTE } from '../data/palette';
import type { BuildPreview } from '../render/build-preview';
import type { CameraRig } from '../render/camera-rig';
import { footprintH, footprintW } from '../sim/buildings';
import { PlaceResult, checkPlacement } from '../sim/placement';
import type { Simulation } from '../sim/simulation';

export type ToolMode = 'select' | 'build' | 'demolish';

const tmp = new Vector3();
/** Höhen, in denen der Sichtstrahl nach Bäumen abgesucht wird (Baumkronen zuerst). */
const PICK_HEIGHTS = [1.3, 0.9, 0.5, 0.15];

/**
 * Bauwerkzeuge: Auswahl/Abbau von Hand, Bauen mit Vorschau, Abriss mit Rahmen.
 * Übersetzt Maus und Tastatur in Befehle an die Simulation.
 */
export class ToolController {
  mode: ToolMode = 'select';
  buildType = -1;
  rot = 0;
  /** Wird aufgerufen, wenn sich Modus oder Auswahl ändern (für die Oberfläche). */
  onChange: () => void = () => {};

  private ndcX = 0;
  private ndcY = 0;
  private inside = false;
  private leftDown = false;
  private dragX = 0;
  private dragY = 0;
  private hoverX = -1;
  private hoverY = -1;
  private placeX = 0;
  private placeY = 0;
  private harvestTimer = 0;
  private cursor = '';

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly rig: CameraRig,
    private readonly getSim: () => Simulation,
    private readonly preview: BuildPreview,
    /** Gebäudetypen für die Tasten 1 bis 9. */
    readonly hotbar: readonly number[],
  ) {
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerleave', () => (this.inside = false));
    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('keydown', this.onKeyDown);
  }

  selectBuilding(type: number): void {
    if (this.mode === 'build' && this.buildType === type) {
      this.cancel();
      return;
    }
    this.mode = 'build';
    this.buildType = type;
    this.onChange();
  }

  toggleDemolish(): void {
    if (this.mode === 'demolish') this.cancel();
    else {
      this.mode = 'demolish';
      this.leftDown = false;
      this.onChange();
    }
  }

  cancel(): void {
    this.mode = 'select';
    this.buildType = -1;
    this.leftDown = false;
    this.preview.hide();
    this.onChange();
  }

  /** Pro Bild nach der Kamera aufrufen. `dt` in Sekunden. */
  update(dt: number): void {
    const sim = this.getSim();
    this.updateHover();
    let cursor = 'default';

    if (!this.inside || this.hoverX < 0) {
      this.preview.hide();
    } else if (this.mode === 'build') {
      const def = BUILDINGS[this.buildType];
      const w = footprintW(def, this.rot);
      const h = footprintH(def, this.rot);
      this.placeX = this.hoverX - Math.floor((w - 1) / 2);
      this.placeY = this.hoverY - Math.floor((h - 1) / 2);
      const result = checkPlacement(sim, this.buildType, this.placeX, this.placeY, this.rot);
      this.preview.showBuilding(
        this.buildType,
        this.placeX,
        this.placeY,
        this.rot,
        result === PlaceResult.Ok,
      );
    } else if (this.mode === 'demolish') {
      cursor = 'crosshair';
      if (this.leftDown) {
        this.preview.showOnlyArea(
          this.dragX,
          this.dragY,
          this.hoverX,
          this.hoverY,
          PALETTE.hintBad,
        );
      } else {
        const id = sim.buildingAt(this.hoverX, this.hoverY);
        if (id >= 0) {
          const b = sim.buildings;
          this.preview.highlightBuilding(b.type[id], b.x[id], b.y[id], b.rot[id]);
        } else {
          this.preview.showOnlyArea(
            this.hoverX,
            this.hoverY,
            this.hoverX,
            this.hoverY,
            PALETTE.hintBad,
          );
        }
      }
    } else {
      const tile = this.pickHarvestTile(sim);
      if (tile >= 0) {
        const x = tile % sim.world.size;
        const y = Math.floor(tile / sim.world.size);
        this.preview.showOnlyArea(x, y, x, y, PALETTE.highlight);
        cursor = 'pointer';
        if (this.leftDown) {
          this.harvestTimer -= dt * 1000;
          if (this.harvestTimer <= 0) {
            sim.enqueue({ type: 'harvest', x, y });
            this.harvestTimer += HAND_MINING.holdIntervalMs;
          }
        }
      } else {
        this.preview.hide();
      }
    }

    if (cursor !== this.cursor) {
      this.canvas.style.cursor = cursor;
      this.cursor = cursor;
    }
  }

  private updateHover(): void {
    if (this.inside && this.rig.groundAt(this.ndcX, this.ndcY, tmp)) {
      this.hoverX = Math.floor(tmp.x);
      this.hoverY = Math.floor(tmp.z);
    } else {
      this.hoverX = this.hoverY = -1;
    }
  }

  /** Sucht entlang des Sichtstrahls ein Feld zum Abbauen (auch über Baumkronen). Gibt −1 zurück, wenn keins da ist. */
  private pickHarvestTile(sim: Simulation): number {
    for (const h of PICK_HEIGHTS) {
      if (!this.rig.pointAtHeight(this.ndcX, this.ndcY, h, tmp)) continue;
      const x = Math.floor(tmp.x);
      const y = Math.floor(tmp.z);
      if (sim.isHarvestable(x, y)) return sim.world.index(x, y);
    }
    return -1;
  }

  private readonly onPointerMove = (e: PointerEvent): void => {
    const r = this.canvas.getBoundingClientRect();
    this.ndcX = ((e.clientX - r.left) / r.width) * 2 - 1;
    this.ndcY = -((e.clientY - r.top) / r.height) * 2 + 1;
    this.inside = true;
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    this.onPointerMove(e);
    if (e.button === 2) {
      this.cancel();
      return;
    }
    if (e.button !== 0) return;
    const sim = this.getSim();
    this.updateHover();
    if (this.hoverX < 0) return;

    if (this.mode === 'build') {
      sim.enqueue({
        type: 'build',
        building: this.buildType,
        x: this.placeX,
        y: this.placeY,
        rot: this.rot,
      });
    } else if (this.mode === 'demolish') {
      this.leftDown = true;
      this.dragX = this.hoverX;
      this.dragY = this.hoverY;
    } else {
      const tile = this.pickHarvestTile(sim);
      if (tile >= 0) {
        sim.enqueue({
          type: 'harvest',
          x: tile % sim.world.size,
          y: Math.floor(tile / sim.world.size),
        });
      }
      this.leftDown = true;
      this.harvestTimer = HAND_MINING.holdIntervalMs;
    }
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (e.button !== 0 || !this.leftDown) return;
    this.leftDown = false;
    if (this.mode === 'demolish' && this.hoverX >= 0) {
      this.getSim().enqueue({
        type: 'demolishArea',
        x0: this.dragX,
        y0: this.dragY,
        x1: this.hoverX,
        y1: this.hoverY,
      });
    }
  };

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.repeat) return;
    if (e.code === 'KeyR' && this.mode === 'build') {
      this.rot = (this.rot + (e.shiftKey ? 3 : 1)) % 4;
    } else if (e.code === 'KeyX') {
      this.toggleDemolish();
    } else if (e.code === 'Escape') {
      this.cancel();
    } else if (/^Digit[1-9]$/.test(e.code)) {
      const type = this.hotbar[Number(e.code.slice(5)) - 1];
      if (type !== undefined) this.selectBuilding(type);
    }
  };
}
