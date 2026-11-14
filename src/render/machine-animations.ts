import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Matrix4,
  MeshLambertMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { BUILDINGS } from '../data/buildings';
import { PALETTE } from '../data/palette';
import { POWER } from '../data/balance';
import { MachineState } from '../sim/machines';
import { hash3Float } from '../sim/rng';
import type { Simulation } from '../sim/simulation';
import { SMOKE, SPINNERS } from './building-models';
import { buildingMatrix } from './buildings-view';
import { colored, merge } from './geometry';
import { FrameInstances } from './frame-instances';

const mB = new Matrix4();
const mT = new Matrix4();
const mR = new Matrix4();
const m = new Matrix4();
const v = new Vector3();
const pos = new Vector3();
const scl = new Vector3();
const q = new Quaternion();
const q2 = new Quaternion();
const UP = new Vector3(0, 1, 0);
const AXES = { x: new Vector3(1, 0, 0), y: new Vector3(0, 1, 0), z: new Vector3(0, 0, 1) };

const SMOKE_PUFFS = 5;
const SMOKE_LIFE = 2.6;
const WORKER_CYCLE = 8;
const WORKERS_PER_HUT = 2;
/** Arbeiter etwas größer als maßstabsgetreu, damit man sie zwischen den Bäumen sieht. */
const WORKER_SCALE = 1.4;

/** Kleiner Holzfäller: Blick nach +z, Unterkante auf y = 0. */
function worker(carrying: boolean): BufferGeometry {
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, c: number) =>
    colored(new BoxGeometry(w, h, d).translate(x, y + h / 2, z), c);
  const parts = [
    box(0.07, 0.14, 0.07, -0.045, 0, 0, PALETTE.workerPants),
    box(0.07, 0.14, 0.07, 0.045, 0, 0, PALETTE.workerPants),
    box(0.17, 0.16, 0.1, 0, 0.14, 0, PALETTE.workerShirt),
    colored(new SphereGeometry(0.065, 6, 4).translate(0, 0.37, 0), PALETTE.skin),
    colored(new CylinderGeometry(0.05, 0.09, 0.05, 6).translate(0, 0.43, 0), PALETTE.hat),
  ];
  if (carrying) {
    // Holzstamm auf der Schulter
    parts.push(
      colored(
        new CylinderGeometry(0.045, 0.045, 0.34, 6).rotateZ(Math.PI / 2).translate(0, 0.33, -0.04),
        PALETTE.trunk,
      ),
    );
  } else {
    // Axt in der rechten Hand
    parts.push(box(0.025, 0.24, 0.025, 0.11, 0.12, 0.05, PALETTE.woodDark));
    parts.push(box(0.025, 0.06, 0.08, 0.11, 0.32, 0.08, PALETTE.metal));
  }
  return merge(parts);
}

/** Sichtbarer Kartenausschnitt in Feldern. */
export interface ViewRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Zeigt, dass Gebäude arbeiten: drehende Teile (Sägeblatt, Zahnrad, Förderrad, Rotor, Lüfter),
 * Rauch aus Schornsteinen und kleine Holzfäller, die zu den Bäumen laufen und Stämme heimtragen.
 * Reine Darstellung: liest den Zustand der Maschinen, wird jedes Bild nur für den
 * sichtbaren Ausschnitt neu berechnet.
 */
export class MachineAnimations {
  readonly group = new Group();
  private readonly spinners = new Map<string, FrameInstances>();
  private readonly smoke: FrameInstances;
  private readonly workers: FrameInstances;
  private readonly carriers: FrameInstances;
  private phase = new Float32Array(256);
  private last = -1;
  /** Arbeitende Maschinen im Bild (für leise Arbeitsgeräusche). */
  workingInView = 0;

  constructor(material: Material) {
    for (const [model, def] of Object.entries(SPINNERS)) {
      this.spinners.set(model, new FrameInstances(def.make(), material, this.group));
    }
    const smokeMat = new MeshLambertMaterial({
      color: PALETTE.smoke,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      flatShading: true,
    });
    this.smoke = new FrameInstances(new IcosahedronGeometry(0.16, 0), smokeMat, this.group);
    this.workers = new FrameInstances(worker(false), material, this.group);
    this.carriers = new FrameInstances(worker(true), material, this.group);
  }

  update(sim: Simulation, now: number, view: ViewRect, show: boolean): void {
    const dt = this.last < 0 ? 0 : Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const t = now / 1000;
    for (const s of this.spinners.values()) s.begin();
    this.smoke.begin();
    this.workers.begin();
    this.carriers.begin();
    this.workingInView = 0;
    if (show) {
      if (this.phase.length < sim.buildings.capacity) {
        const next = new Float32Array(sim.buildings.capacity);
        next.set(this.phase);
        this.phase = next;
      }
      const ms = sim.machines;
      for (const list of [ms.crafters, ms.extractors, ms.burners, ms.winds]) {
        for (let k = 0; k < list.length; k++) this.animate(sim, list[k], t, dt, view);
      }
    }
    for (const s of this.spinners.values()) s.end();
    this.smoke.end();
    this.workers.end();
    this.carriers.end();
  }

  private animate(sim: Simulation, id: number, t: number, dt: number, view: ViewRect): void {
    const b = sim.buildings;
    const x = b.x[id];
    const y = b.y[id];
    if (x < view.minX - 3 || x > view.maxX + 1 || y < view.minY - 3 || y > view.maxY + 1) return;
    const type = b.type[id];
    const def = BUILDINGS[type];
    const ms = sim.machines;
    const working = ms.state[id] === MachineState.Working;
    if (working) this.workingInView++;
    buildingMatrix(type, x, y, b.rot[id], mB);

    // Drehende Teile: dauerhaft sichtbar, drehen nur bei der Arbeit (Windrad je nach Wind)
    const spin = SPINNERS[def.model];
    if (spin) {
      let speed = working ? 1 : 0;
      if (def.behavior.kind === 'wind')
        speed = (sim.power.wind / POWER.scale) * (working ? 1 : 0.4);
      this.phase[id] = (this.phase[id] + dt * spin.speed * speed * Math.PI * 2) % (Math.PI * 2);
      mT.makeTranslation(spin.offset[0], spin.offset[1], spin.offset[2]);
      mR.makeRotationAxis(AXES[spin.axis], this.phase[id]);
      m.multiplyMatrices(mB, mT).multiply(mR);
      this.spinners.get(def.model)!.push(m);
    }

    // Rauch
    const chimney = SMOKE[def.model];
    if (chimney && working) {
      const seed = hash3Float(id, 3, 11);
      for (let k = 0; k < SMOKE_PUFFS; k++) {
        const life = (t / SMOKE_LIFE + k / SMOKE_PUFFS + seed) % 1;
        v.set(chimney[0], chimney[1], chimney[2]).applyMatrix4(mB);
        pos.set(v.x + life * 0.35, v.y + life * 1.5, v.z + life * 0.12);
        const s = (0.5 + life * 1.3) * (1 - life * life * life * life);
        scl.set(s, s, s);
        q.setFromAxisAngle(UP, life * 3 + seed * 6);
        this.smoke.push(m.compose(pos, q, scl));
      }
    }

    if (def.behavior.kind === 'lumberjack') this.animateWorkers(sim, id, t, working);
  }

  /** Holzfäller: laufen zu einem Baum, fällen, tragen den Stamm zur Hütte. */
  private animateWorkers(sim: Simulation, id: number, t: number, working: boolean): void {
    const ms = sim.machines;
    const list = ms.treeLists[id];
    const size = sim.world.size;
    // Tür der Hütte (vorne links, gedreht mit dem Gebäude)
    const home = v.set(-0.3, 0, 1.15).applyMatrix4(mB);
    const hx = home.x;
    const hz = home.z;
    const seed = hash3Float(id, 5, 17);
    for (let w = 0; w < WORKERS_PER_HUT; w++) {
      const p = (t / WORKER_CYCLE + w / WORKERS_PER_HUT + seed) % 1;
      let tree = -1;
      if (working && list && list.length > 0) {
        const start = (ms.treeCursor[id] + w * 3) % list.length;
        for (let k = 0; k < list.length && tree < 0; k++) {
          const tile = list[(start + k) % list.length];
          if (sim.trees.hasTree(tile)) tree = tile;
        }
      }
      if (tree < 0) {
        // Pause vor der Hütte
        pos.set(hx + (w - 0.5) * 0.3, 0, hz + 0.15);
        q.setFromAxisAngle(UP, 0);
        scl.set(WORKER_SCALE, WORKER_SCALE, WORKER_SCALE);
        this.workers.push(m.compose(pos, q, scl));
        continue;
      }
      const tx = (tree % size) + 0.5;
      const tz = Math.floor(tree / size) + 0.5;
      // vor dem Baum stehen bleiben (Richtung Hütte)
      const dx = hx - tx;
      const dz = hz - tz;
      const len = Math.hypot(dx, dz) || 1;
      const sx = tx + (dx / len) * 0.55;
      const sz = tz + (dz / len) * 0.55;
      let px: number;
      let pz: number;
      let yaw: number;
      let bob = 0;
      let tilt = 0;
      let carry = false;
      if (p < 0.35) {
        const u = p / 0.35;
        px = hx + (sx - hx) * u;
        pz = hz + (sz - hz) * u;
        yaw = Math.atan2(sx - hx, sz - hz);
        bob = Math.abs(Math.sin(t * 14)) * 0.035;
      } else if (p < 0.7) {
        px = sx;
        pz = sz;
        yaw = Math.atan2(tx - sx, tz - sz);
        tilt = Math.max(0, Math.sin(t * 9)) * 0.45;
      } else {
        const u = (p - 0.7) / 0.3;
        px = sx + (hx - sx) * u;
        pz = sz + (hz - sz) * u;
        yaw = Math.atan2(hx - sx, hz - sz);
        bob = Math.abs(Math.sin(t * 12)) * 0.03;
        carry = true;
      }
      pos.set(px, bob, pz);
      q.setFromAxisAngle(UP, yaw);
      if (tilt > 0) q.multiply(q2.setFromAxisAngle(AXES.x, tilt));
      scl.set(WORKER_SCALE, WORKER_SCALE, WORKER_SCALE);
      (carry ? this.carriers : this.workers).push(m.compose(pos, q, scl));
    }
  }

  dispose(): void {
    for (const s of this.spinners.values()) s.dispose();
    this.smoke.dispose();
    this.workers.dispose();
    this.carriers.dispose();
  }
}
