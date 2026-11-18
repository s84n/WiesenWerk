import { Vector3 } from 'three';
import { HAND_MINING } from '../data/balance';
import { BUILDINGS, FREE_GENERATOR_KINDS, hasSetting } from '../data/buildings';
import { PALETTE } from '../data/palette';
import { TEXTS } from '../data/texts';
import type { BuildPreview } from '../render/build-preview';
import type { CameraRig } from '../render/camera-rig';
import { footprintH, footprintW } from '../sim/buildings';
import { copyArea, placeBlueprint, rotateBlueprint, type Blueprint } from '../sim/blueprint';
import type { BeltStep, BlueprintPlacement } from '../sim/commands';
import { PlaceResult, checkPlacement } from '../sim/placement';
import type { Simulation } from '../sim/simulation';

export type ToolMode = 'select' | 'build' | 'demolish' | 'copy' | 'paste';

const tmp = new Vector3();
/** Höhen, in denen der Sichtstrahl nach Bäumen abgesucht wird (Baumkronen zuerst). */
const PICK_HEIGHTS = [1.3, 0.9, 0.5, 0.15];
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

/**
 * Bauwerkzeuge: Auswahl und Abbau von Hand, Bauen mit Vorschau, Bänder ziehen, Abriss mit Rahmen.
 * Übersetzt Maus und Tastatur in Befehle an die Simulation.
 */
export class ToolController {
  mode: ToolMode = 'select';
  buildType = -1;
  rot = 0;
  /** Ausgewähltes Gebäude für das Infofenster (−1 = keins). */
  selected = -1;
  /** Rezept, das neu gebaute Maschinen bekommen (Pipette; −1 = keins). */
  recipe = -1;
  /** Bauvorschau Mast: Masten in Reichweite und ihre Mittelpunkte (wiederverwendet, keine Zuweisungen pro Bild). */
  private readonly poleLinks: number[] = [];
  private readonly poleTargets: number[] = [];
  /** Wird aufgerufen, wenn sich Modus oder Auswahl ändern (für die Oberfläche). */
  onChange: () => void = () => {};
  /** Kurze Meldung an den Spieler (wird von außen gesetzt). */
  onMessage: (text: string) => void = () => {};
  /** Zuletzt kopierte Blaupause (gilt für das ganze Spiel, auch nach dem Laden). */
  blueprint: Blueprint | null = null;
  private pastePlacements: BlueprintPlacement[] = [];

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
  /** Bänder: zuerst waagerecht (x) oder senkrecht (y) laufen; wird beim ersten Ziehen festgelegt. */
  private beltAxis: 'x' | 'y' | null = null;
  private beltPath: BeltStep[] = [];

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

  /** Wird gerade ein Gebäude gebaut, bei dem die Strom-Ansicht hilft? */
  get placingPower(): boolean {
    if (this.mode !== 'build') return false;
    const def = BUILDINGS[this.buildType];
    const kind = def.behavior.kind;
    return (
      def.power > 0 ||
      kind === 'pole' ||
      kind === 'burner' ||
      kind === 'battery' ||
      FREE_GENERATOR_KINDS.includes(kind)
    );
  }

  /** Wird das gewählte Gebäude in einer Linie gezogen (Bänder, Wege, Zäune)? */
  private get isLine(): boolean {
    return this.mode === 'build' && BUILDINGS[this.buildType].line === true;
  }

  private get isBelt(): boolean {
    return this.mode === 'build' && BUILDINGS[this.buildType].behavior.kind === 'belt';
  }

  selectBuilding(type: number): void {
    if (this.mode === 'build' && this.buildType === type) {
      this.cancel();
      return;
    }
    this.recipe = -1;
    this.mode = 'build';
    this.buildType = type;
    this.leftDown = false;
    this.selected = -1;
    this.onChange();
  }

  toggleDemolish(): void {
    if (this.mode === 'demolish') this.cancel();
    else {
      this.mode = 'demolish';
      this.leftDown = false;
      this.selected = -1;
      this.onChange();
    }
  }

  /** Blaupause: Rahmen ziehen zum Kopieren (C). */
  toggleCopy(): void {
    if (this.mode === 'copy') this.cancel();
    else {
      this.mode = 'copy';
      this.leftDown = false;
      this.selected = -1;
      this.onChange();
    }
  }

  /** Letzte Blaupause einfügen (Strg + V). */
  startPaste(): void {
    if (!this.blueprint) {
      this.onMessage(TEXTS.build.noBlueprint);
      return;
    }
    this.mode = 'paste';
    this.leftDown = false;
    this.selected = -1;
    this.onChange();
  }

  /** Pipette: Gebäude unter der Maus samt Drehung und Rezept als Bauauswahl übernehmen. */
  pipette(): void {
    const sim = this.getSim();
    this.updateHover();
    const id = sim.buildingAt(this.hoverX, this.hoverY);
    if (id < 0) return;
    const type = sim.buildings.type[id];
    if (!sim.research.buildingUnlocked[type]) return;
    this.mode = 'build';
    this.buildType = type;
    this.rot = sim.buildings.rot[id];
    this.recipe = hasSetting(BUILDINGS[type].behavior.kind) ? sim.machines.recipe[id] : -1;
    this.leftDown = false;
    this.selected = -1;
    this.onChange();
  }

  /** Wählt ein Gebäude für das Infofenster aus (−1 = nichts). */
  select(id: number): void {
    if (this.selected === id) return;
    this.selected = id;
    this.onChange();
  }

  cancel(): void {
    this.mode = 'select';
    this.buildType = -1;
    this.leftDown = false;
    this.selected = -1;
    this.preview.hide();
    this.onChange();
  }

  /** Pro Bild nach der Kamera aufrufen. `dt` in Sekunden. */
  update(dt: number): void {
    const sim = this.getSim();
    if (this.selected >= 0 && !sim.buildings.alive[this.selected]) this.select(-1);
    this.updateHover();
    let cursor = 'default';

    if (!this.inside || this.hoverX < 0) {
      this.preview.hide();
    } else if (this.isLine) {
      this.updateBeltPreview(sim);
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
      // Gärten und Deko: Bereich, den sie gemütlich machen (bzw. den die Bienen bestäuben)
      const b = def.behavior;
      const r = b.kind === 'beehive' ? b.radius : (def.cozy?.radius ?? -1);
      if (r >= 0) {
        this.preview.showRange(
          this.placeX - r,
          this.placeY - r,
          this.placeX + w - 1 + r,
          this.placeY + h - 1 + r,
          PALETTE.cozyArea,
        );
      }
      // Strommast: Versorgungsbereich, Verbindungsreichweite und künftige Kabel zeigen
      if (def.behavior.kind === 'pole') {
        const r = def.behavior.supplyRadius;
        this.preview.showRange(
          this.placeX - r,
          this.placeY - r,
          this.placeX + w - 1 + r,
          this.placeY + h - 1 + r,
        );
        sim.power.linksFor(this.buildType, this.placeX, this.placeY, this.rot, this.poleLinks);
        const b = sim.buildings;
        this.poleTargets.length = 0;
        for (const id of this.poleLinks) {
          const d = BUILDINGS[b.type[id]];
          this.poleTargets.push(
            b.x[id] + footprintW(d, b.rot[id]) / 2,
            b.y[id] + footprintH(d, b.rot[id]) / 2,
          );
        }
        this.preview.showPoleReach(
          this.placeX + w / 2,
          this.placeY + h / 2,
          def.behavior.connectRange,
          this.poleTargets,
        );
      }
    } else if (this.mode === 'copy') {
      cursor = 'crosshair';
      const x0 = this.leftDown ? this.dragX : this.hoverX;
      const y0 = this.leftDown ? this.dragY : this.hoverY;
      this.preview.showOnlyArea(x0, y0, this.hoverX, this.hoverY, PALETTE.powerArea);
    } else if (this.mode === 'paste' && this.blueprint) {
      const bp = this.blueprint;
      this.placeX = this.hoverX - Math.floor((bp.w - 1) / 2);
      this.placeY = this.hoverY - Math.floor((bp.h - 1) / 2);
      const list = placeBlueprint(bp, this.placeX, this.placeY);
      const valid = list.map(
        (p) => checkPlacement(sim, p.building, p.x, p.y, p.rot) === PlaceResult.Ok,
      );
      this.pastePlacements = list;
      this.preview.showBlueprint(
        list,
        valid,
        this.placeX,
        this.placeY,
        this.placeX + bp.w - 1,
        this.placeY + bp.h - 1,
        valid.every((v) => v),
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
        const id = sim.buildingAt(this.hoverX, this.hoverY);
        if (id >= 0) cursor = 'pointer';
        this.showSelection(sim);
      }
    }

    if (cursor !== this.cursor) {
      this.canvas.style.cursor = cursor;
      this.cursor = cursor;
    }
  }

  /** Markiert das ausgewählte Gebäude. */
  private showSelection(sim: Simulation): void {
    const id = this.selected;
    if (id < 0) {
      this.preview.hide();
      return;
    }
    const b = sim.buildings;
    const def = BUILDINGS[b.type[id]];
    const x = b.x[id];
    const y = b.y[id];
    this.preview.showOnlyArea(
      x,
      y,
      x + footprintW(def, b.rot[id]) - 1,
      y + footprintH(def, b.rot[id]) - 1,
      PALETTE.highlight,
    );
  }

  private updateBeltPreview(sim: Simulation): void {
    const path = this.leftDown
      ? this.computeBeltPath(sim, this.dragX, this.dragY, this.hoverX, this.hoverY)
      : [{ x: this.hoverX, y: this.hoverY, dir: this.rot }];
    const valid = path.map((p) => {
      const id = sim.buildingAt(p.x, p.y);
      if (id >= 0) {
        // Bänder dürfen vorhandene Bänder drehen oder aufwerten, Wege überspringen Gleiche
        if (this.isBelt) return sim.isBelt(id);
        return sim.buildings.type[id] === this.buildType;
      }
      return checkPlacement(sim, this.buildType, p.x, p.y, p.dir) === PlaceResult.Ok;
    });
    this.beltPath = path;
    this.preview.showBeltPath(this.buildType, path, valid);
  }

  /** Weg in L-Form vom Startfeld zum Feld unter der Maus. */
  private computeBeltPath(
    sim: Simulation,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ): BeltStep[] {
    if (x0 === x1 && y0 === y1) {
      const into = this.isBelt ? sim.belts.inputDirFor(sim.world.index(x0, y0)) : -1;
      return [{ x: x0, y: y0, dir: into >= 0 ? into : this.rot }];
    }
    if (this.beltAxis === null) this.beltAxis = Math.abs(x1 - x0) >= Math.abs(y1 - y0) ? 'x' : 'y';
    const points: [number, number][] = [];
    let x = x0;
    let y = y0;
    points.push([x, y]);
    const stepAxis = (axis: 'x' | 'y'): void => {
      if (axis === 'x') while (x !== x1) points.push([(x += Math.sign(x1 - x)), y]);
      else while (y !== y1) points.push([x, (y += Math.sign(y1 - y))]);
    };
    stepAxis(this.beltAxis);
    stepAxis(this.beltAxis === 'x' ? 'y' : 'x');

    const path: BeltStep[] = [];
    for (let i = 0; i < points.length; i++) {
      const [px, py] = points[i];
      let dir: number;
      if (i < points.length - 1) {
        dir = dirBetween(px, py, points[i + 1][0], points[i + 1][1]);
      } else {
        dir = dirBetween(points[i - 1][0], points[i - 1][1], px, py);
        // Endet das Band neben einem passenden Gebäudeeingang, zeigt es hinein.
        if (this.isBelt && sim.world.inBounds(px, py)) {
          const into = sim.belts.inputDirFor(sim.world.index(px, py));
          if (into >= 0 && into !== ((dir + 2) & 3)) dir = into;
        }
      }
      if (sim.world.inBounds(px, py)) path.push({ x: px, y: py, dir });
    }
    return path;
  }

  private updateHover(): void {
    if (this.inside && this.rig.groundAt(this.ndcX, this.ndcY, tmp)) {
      this.hoverX = Math.floor(tmp.x);
      this.hoverY = Math.floor(tmp.z);
    } else {
      this.hoverX = this.hoverY = -1;
    }
  }

  /** Sucht entlang des Sichtstrahls ein Feld zum Abbauen (auch über Baumkronen). −1 = keins. */
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

  /** Fotomodus: keine Werkzeuge (Klicks und Tasten bauen oder wählen nichts). */
  suspended = false;

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (this.suspended) return;
    this.onPointerMove(e);
    if (e.button === 2) {
      this.cancel();
      return;
    }
    if (e.button !== 0) return;
    const sim = this.getSim();
    this.updateHover();
    if (this.hoverX < 0) return;

    if (this.isLine) {
      this.leftDown = true;
      this.dragX = this.hoverX;
      this.dragY = this.hoverY;
      this.beltAxis = null;
    } else if (this.mode === 'build') {
      sim.enqueue({
        type: 'build',
        building: this.buildType,
        x: this.placeX,
        y: this.placeY,
        rot: this.rot,
        recipe: this.recipe,
      });
    } else if (this.mode === 'demolish' || this.mode === 'copy') {
      this.leftDown = true;
      this.dragX = this.hoverX;
      this.dragY = this.hoverY;
    } else if (this.mode === 'paste') {
      if (this.pastePlacements.length > 0)
        sim.enqueue({ type: 'buildMany', list: this.pastePlacements });
    } else {
      const tile = this.pickHarvestTile(sim);
      if (tile >= 0) {
        sim.enqueue({
          type: 'harvest',
          x: tile % sim.world.size,
          y: Math.floor(tile / sim.world.size),
        });
        this.leftDown = true;
        this.harvestTimer = HAND_MINING.holdIntervalMs;
      } else {
        this.select(sim.buildingAt(this.hoverX, this.hoverY));
      }
    }
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (e.button !== 0 || !this.leftDown) return;
    this.leftDown = false;
    const sim = this.getSim();
    if (this.isLine) {
      if (this.beltPath.length > 0) {
        sim.enqueue({ type: 'buildLine', building: this.buildType, path: this.beltPath });
        // Richtung des letzten Feldes merken, damit Einzelklicks danach passend weiterbauen
        this.rot = this.beltPath[this.beltPath.length - 1].dir;
      }
    } else if (this.mode === 'copy' && this.hoverX >= 0) {
      const bp = copyArea(sim, this.dragX, this.dragY, this.hoverX, this.hoverY);
      if (!bp) {
        this.onMessage(TEXTS.build.copyEmpty);
        return;
      }
      this.blueprint = bp;
      this.onMessage(TEXTS.build.copied(bp.entries.length));
      this.startPaste();
    } else if (this.mode === 'demolish' && this.hoverX >= 0) {
      sim.enqueue({
        type: 'demolishArea',
        x0: this.dragX,
        y0: this.dragY,
        x1: this.hoverX,
        y1: this.hoverY,
      });
    }
  };

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (this.suspended) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.repeat) return;
    if (e.code === 'KeyR' && this.mode === 'build') {
      if (this.isLine && this.leftDown) this.beltAxis = this.beltAxis === 'x' ? 'y' : 'x';
      else this.rot = (this.rot + (e.shiftKey ? 3 : 1)) % 4;
    } else if (e.code === 'KeyR' && this.mode === 'paste' && this.blueprint) {
      const turns = e.shiftKey ? 3 : 1;
      for (let k = 0; k < turns; k++) this.blueprint = rotateBlueprint(this.blueprint);
    } else if (e.code === 'KeyV' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this.startPaste();
    } else if (e.code === 'KeyC' && !e.ctrlKey && !e.metaKey) {
      this.toggleCopy();
    } else if (e.code === 'KeyX') {
      this.toggleDemolish();
    } else if (e.code === 'KeyF') {
      this.pipette();
    } else if (e.code === 'Escape') {
      this.cancel();
    } else if (/^Digit[1-9]$/.test(e.code)) {
      const type = this.hotbar[Number(e.code.slice(5)) - 1];
      if (type !== undefined) this.selectBuilding(type);
    }
  };
}

function dirBetween(x0: number, y0: number, x1: number, y1: number): number {
  for (let d = 0; d < 4; d++) if (x0 + DX[d] === x1 && y0 + DY[d] === y1) return d;
  return 0;
}
