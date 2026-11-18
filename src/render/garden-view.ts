import { Group, Matrix4, Quaternion, Vector3, type Material } from 'three';
import { POWER } from '../data/balance';
import { BUILDINGS } from '../data/buildings';
import { footprintH, footprintW } from '../sim/buildings';
import { hash3Float } from '../sim/rng';
import type { Simulation } from '../sim/simulation';
import { buildingMatrix } from './buildings-view';
import type { Effects } from './effects';
import { FrameInstances } from './frame-instances';
import {
  GARDEN_GROUND,
  GARDEN_LAYOUTS,
  PLANT_MODELS,
  type GardenLayout,
  type PlantModel,
} from './garden-models';
import type { ViewRect } from './machine-animations';

const mB = new Matrix4();
const m = new Matrix4();
const v = new Vector3();
const pos = new Vector3();
const scl = new Vector3();
const q = new Quaternion();
const UP = new Vector3(0, 1, 0);

const BEES_PER_GARDEN = 3;
const BEES_PER_HIVE = 4;

/**
 * Wachsende Pflanzen in den Gärten: Keimlinge, Blattrosetten, Kohlköpfe und Kürbisse,
 * Blumen, Apfelbäume mit Blüten und Äpfeln – je nach Wachstum (`machines.gardenGrowth`).
 * Dazu Bienen über bestäubten Gärten und um die Bienenstöcke. Reine Darstellung, jedes Bild
 * nur für den sichtbaren Ausschnitt; nach einer Ernte fliegen ein paar Blätter.
 */
export class GardenView {
  readonly group = new Group();
  private readonly parts = new Map<PlantModel, FrameInstances>();
  /** Ernten je Garten beim letzten Bild (erkennt die Ernte für die Blätter). */
  private harvests = new Int32Array(0);
  private hives: number[] = [];
  private hiveVersion = -1;

  constructor(material: Material) {
    for (const [name, make] of Object.entries(PLANT_MODELS))
      this.parts.set(name as PlantModel, new FrameInstances(make(), material, this.group));
  }

  /**
   * `near` = nah genug für Bienen, `day` = Tageslicht (0..1; nachts schlafen die Bienen).
   */
  update(
    sim: Simulation,
    now: number,
    view: ViewRect,
    near: boolean,
    day: number,
    effects: Effects,
  ): void {
    for (const p of this.parts.values()) p.begin();
    const ms = sim.machines;
    const b = sim.buildings;
    if (this.harvests.length < b.capacity) {
      const next = new Int32Array(b.capacity).fill(-1);
      next.set(this.harvests);
      this.harvests = next;
    }
    const t = now / 1000;
    const bees = near && day > 0.35;
    for (let k = 0; k < ms.gardens.length; k++) {
      const id = ms.gardens[k];
      const x = b.x[id];
      const y = b.y[id];
      if (x < view.minX - 3 || x > view.maxX + 1 || y < view.minY - 3 || y > view.maxY + 1)
        continue;
      const type = b.type[id];
      const def = BUILDINGS[type];
      // Ernte erkannt: ein paar Blätter wirbeln auf
      const done = ms.fuelEnergy[id];
      if (this.harvests[id] >= 0 && done > this.harvests[id]) {
        effects.leaves(x + footprintW(def, b.rot[id]) / 2, y + footprintH(def, b.rot[id]) / 2);
      }
      this.harvests[id] = done;
      const layouts = GARDEN_LAYOUTS[def.model];
      if (!layouts) continue;
      buildingMatrix(type, x, y, b.rot[id], mB);
      const g = ms.gardenGrowth(id);
      const ground = GARDEN_GROUND[def.model] ?? 0;
      for (const layout of layouts) this.plants(layout, id, g, ground);
      if (bees && sim.cozy.growth[id] > POWER.scale) {
        const w = footprintW(def, b.rot[id]);
        const h = footprintH(def, b.rot[id]);
        for (let n = 0; n < BEES_PER_GARDEN; n++)
          this.bee(x + w / 2, y + h / 2, Math.min(w, h) * 0.35, 0.45 + ground, t, id * 7 + n);
      }
    }
    if (bees) {
      if (this.hiveVersion !== sim.cozy.version) this.findHives(sim);
      for (const id of this.hives) {
        if (!b.alive[id]) continue;
        const x = b.x[id];
        const y = b.y[id];
        if (x < view.minX || x > view.maxX || y < view.minY || y > view.maxY) continue;
        for (let n = 0; n < BEES_PER_HIVE; n++)
          this.bee(x + 0.5, y + 0.5, 0.45, 0.6, t, id * 5 + n);
      }
    }
    for (const p of this.parts.values()) p.end();
  }

  private findHives(sim: Simulation): void {
    this.hiveVersion = sim.cozy.version;
    this.hives = [];
    const b = sim.buildings;
    for (let id = 0; id < b.highWater; id++)
      if (b.alive[id] && BUILDINGS[b.type[id]].behavior.kind === 'beehive') this.hives.push(id);
  }

  /** Setzt die Pflanzen eines Beetes je nach Wachstum `g` (0..1, `mB` muss gesetzt sein). */
  private plants(layout: GardenLayout, id: number, g: number, ground: number): void {
    const pts = layout.points;
    for (let k = 0; k < pts.length; k++) {
      // jede Pflanze etwas anders: Drehung, Größe, leicht versetztes Wachstum
      const r = hash3Float(id, k, 41);
      const gk = clamp01(g * (0.92 + r * 0.16));
      const yaw = r * Math.PI * 2;
      const size = 0.9 + r * 0.2;
      const px = pts[k][0];
      const pz = pts[k][1];
      if (layout.kind === 'vegetable') {
        if (gk < 0.2) this.put('sprout', px, ground, pz, yaw, size * (0.5 + gk * 2.5));
        else if (gk < 0.55) this.put('leafy', px, ground, pz, yaw, size * (0.55 + gk));
        else {
          const u = (gk - 0.55) / 0.45;
          const model = k % 3 === 2 ? 'pumpkin' : 'cabbage';
          this.put('leafy', px, ground, pz, yaw, size * 1.1);
          this.put(model, px, ground, pz, yaw, size * (0.45 + u * 0.6));
        }
      } else if (layout.kind === 'flower') {
        if (gk < 0.15) {
          this.put('sprout', px, ground, pz, yaw, size * (0.5 + gk * 3));
          continue;
        }
        const s = size * (0.45 + 0.65 * clamp01((gk - 0.15) / 0.4));
        this.put('stems', px, ground, pz, yaw, s);
        if (gk > 0.5) {
          const bloom = clamp01((gk - 0.5) / 0.3);
          this.put(k % 2 ? 'blooms1' : 'blooms0', px, ground, pz, yaw, s, bloom);
        }
      } else {
        const s = size * (0.3 + 0.7 * gk);
        this.put('appleTree', px, ground, pz, yaw, s);
        if (gk > 0.45 && gk < 0.82) {
          // Blüten gehen auf und fallen wieder ab
          const open = Math.min(clamp01((gk - 0.45) / 0.1), clamp01((0.82 - gk) / 0.08));
          this.put('treeBlossoms', px, ground, pz, yaw, s, open);
        } else if (gk >= 0.82) {
          this.put('apples', px, ground, pz, yaw, s, clamp01((gk - 0.82) / 0.12));
        }
      }
    }
  }

  /**
   * Ein Teil in Gebäudekoordinaten setzen. `grow` < 1 lässt Blüten und Früchte kleiner
   * erscheinen (sie sitzen dabei an der Krone bzw. am Stängel, darum Skalierung um den Ursprung
   * der Pflanze und Ausgleich in der Höhe).
   */
  private put(
    model: PlantModel,
    x: number,
    y: number,
    z: number,
    yaw: number,
    s: number,
    grow = 1,
  ): void {
    if (s <= 0.01 || grow <= 0.01) return;
    v.set(x, y, z).applyMatrix4(mB);
    q.setFromAxisAngle(UP, yaw);
    // Blüten/Früchte wachsen an Ort und Stelle: Höhe bleibt, Breite und Dicke wachsen
    scl.set(s * grow, s, s * grow);
    this.parts.get(model)!.push(m.compose(v, q, scl));
  }

  /** Eine Biene, die in Achten um einen Punkt fliegt. */
  private bee(cx: number, cz: number, radius: number, height: number, t: number, seed: number) {
    const r = hash3Float(seed, 3, 77);
    const speed = 0.7 + r * 0.6;
    const a = t * speed * 2 + r * 20;
    const px = cx + Math.sin(a) * radius;
    const pz = cz + Math.sin(a * 2) * radius * 0.6;
    const py = height + Math.sin(t * 5 + r * 9) * 0.06;
    // Blickrichtung entlang der Flugbahn
    const dx = Math.cos(a) * radius;
    const dz = Math.cos(a * 2) * radius * 1.2;
    pos.set(px, py, pz);
    q.setFromAxisAngle(UP, Math.atan2(dx, dz));
    scl.set(1.6, 1.6, 1.6);
    this.parts.get('bee')!.push(m.compose(pos, q, scl));
  }

  dispose(): void {
    for (const p of this.parts.values()) p.dispose();
  }
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
