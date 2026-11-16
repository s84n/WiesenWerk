import { Group, InstancedMesh, Matrix4, Mesh, type BufferGeometry, type Material } from 'three';
import { BUILDINGS, BUILDING_ID } from '../data/buildings';
import { LANDMARK_STAGES } from '../data/landmark';
import { footprintH, footprintW } from '../sim/buildings';
import type { Simulation } from '../sim/simulation';
import { buildingMatrix } from './buildings-view';
import { chimeCount, clockHandsNow, type ClockHands } from './clock';
import type { Effects } from './effects';
import { merge } from './geometry';
import {
  CLOCK_Y,
  CLOCK_Z,
  clockHand,
  clockTowerScaffold,
  clockTowerStages,
} from './landmark-models';

const TOWER = BUILDING_ID.clockTower;
const base = new Matrix4();
const local = new Matrix4();
const rotY = new Matrix4();
const rotZ = new Matrix4();
const out = new Matrix4();

/** Ab diesem Abschnitt (Zahl fertiger Abschnitte) läuft die Uhr bzw. schlägt die Glocke. */
const CLOCK_FROM = LANDMARK_STAGES.findIndex((s) => s.reward.clock) + 1;
const BELL_FROM = LANDMARK_STAGES.findIndex((s) => s.reward.bell) + 1;

/**
 * Der Uhrturm: setzt die fertigen Abschnitte zu einem Mesh zusammen (neu nur bei Bau oder
 * fertigem Abschnitt), stellt das Gerüst um den Abschnitt, der gerade entsteht, und dreht die
 * Zeiger nach der echten Uhrzeit (einmal pro Sekunde). Meldet Glockenschläge zur vollen Stunde.
 */
export class LandmarkView {
  readonly group = new Group();
  private tower: Mesh | null = null;
  /** Je Zifferblatt Stunden- und Minutenzeiger. */
  private readonly hours: InstancedMesh;
  private readonly minutes: InstancedMesh;
  private dirty = true;
  private towerId = -1;
  private stage = 0;
  private celebrate = false;
  private lastSecond = -1;
  private lastChimeKey = '';
  /** Ausstehende Glockenschläge (holt `takeChime` ab). */
  private chime = 0;
  private readonly hands: ClockHands = { hour: 0, minute: 0 };
  private readonly date = new Date();

  constructor(private readonly material: Material) {
    this.hours = new InstancedMesh(clockHand(false), material, 4);
    this.minutes = new InstancedMesh(clockHand(true), material, 4);
    for (const m of [this.hours, this.minutes]) {
      m.frustumCulled = false;
      m.visible = false;
      this.group.add(m);
    }
  }

  /** Nach Bauänderungen am Turm oder einem fertigen Abschnitt neu aufbauen. */
  markDirty(celebrate = false): void {
    this.dirty = true;
    if (celebrate) this.celebrate = true;
  }

  /** Glockenschläge seit dem letzten Abholen (0 = keine). */
  takeChime(): number {
    const n = this.chime;
    this.chime = 0;
    return n;
  }

  update(sim: Simulation, effects: Effects): void {
    if (this.dirty) this.rebuild(sim, effects);
    if (this.towerId < 0) return;
    this.date.setTime(Date.now());
    const second = this.date.getSeconds();
    if (second === this.lastSecond) return;
    this.lastSecond = second;
    if (this.stage >= CLOCK_FROM) this.placeHands();
    if (this.stage >= BELL_FROM) {
      const h = this.date.getHours();
      const n = chimeCount(h, this.date.getMinutes());
      const key = n > 0 ? String(h) : '-';
      if (key !== this.lastChimeKey) {
        // Nur beim Wechsel zur vollen Stunde läuten, nicht gleich nach dem Laden
        if (n > 0 && this.lastChimeKey !== '') this.chime = n;
        this.lastChimeKey = key;
      }
    }
  }

  private rebuild(sim: Simulation, effects: Effects): void {
    this.dirty = false;
    this.towerId = -1;
    if (sim.typeCount[TOWER] > 0) {
      const b = sim.buildings;
      for (let id = 0; id < b.highWater; id++) {
        if (b.alive[id] && b.type[id] === TOWER) {
          this.towerId = id;
          break;
        }
      }
    }
    this.stage = sim.landmark.stage;
    if (this.tower) {
      this.group.remove(this.tower);
      this.tower.geometry.dispose();
      this.tower = null;
    }
    const show = this.towerId >= 0;
    this.hours.visible = this.minutes.visible = show && this.stage >= CLOCK_FROM;
    if (!show) {
      this.celebrate = false;
      return;
    }
    const b = sim.buildings;
    const id = this.towerId;
    buildingMatrix(TOWER, b.x[id], b.y[id], b.rot[id], base);
    const parts: BufferGeometry[] = clockTowerStages()
      .slice(0, this.stage)
      .map((g) => g.clone());
    if (!sim.landmark.finished) parts.push(clockTowerScaffold(this.stage));
    if (parts.length > 0) {
      this.tower = new Mesh(merge(parts), this.material);
      this.tower.matrixAutoUpdate = false;
      this.tower.matrix.copy(base);
      this.tower.castShadow = true;
      this.tower.receiveShadow = true;
      this.group.add(this.tower);
    }
    this.lastSecond = -1;
    if (this.celebrate) {
      this.celebrate = false;
      const def = BUILDINGS[TOWER];
      const cx = b.x[id] + footprintW(def, b.rot[id]) / 2;
      const cz = b.y[id] + footprintH(def, b.rot[id]) / 2;
      for (let k = 0; k < 3; k++) effects.sparkle(cx, cz);
    }
  }

  /** Zeiger auf allen vier Seiten nach der Uhrzeit des Computers stellen. */
  private placeHands(): void {
    clockHandsNow(this.hands, this.date);
    for (let k = 0; k < 4; k++) {
      rotY.makeRotationY((k * Math.PI) / 2);
      for (const [mesh, angle] of [
        [this.hours, this.hands.hour],
        [this.minutes, this.hands.minute],
      ] as const) {
        // im Uhrzeigersinn, von vorn auf das Zifferblatt gesehen
        rotZ.makeRotationZ(-angle);
        local.makeTranslation(0, CLOCK_Y, CLOCK_Z + (mesh === this.minutes ? 0.012 : 0));
        out.multiplyMatrices(base, rotY).multiply(local).multiply(rotZ);
        mesh.setMatrixAt(k, out);
      }
    }
    this.hours.instanceMatrix.needsUpdate = true;
    this.minutes.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    if (this.tower) {
      this.group.remove(this.tower);
      this.tower.geometry.dispose();
      this.tower = null;
    }
    this.towerId = -1;
    this.dirty = true;
    this.hours.visible = this.minutes.visible = false;
  }
}
