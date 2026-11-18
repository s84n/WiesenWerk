import {
  DoubleSide,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  RingGeometry,
  Vector3,
  type BufferGeometry,
  type Camera,
  type Material,
} from 'three';
import { BUILDINGS } from '../data/buildings';
import { LIFE_CONFIG } from '../data/config';
import { PALETTE } from '../data/palette';
import { footprintH, footprintW } from '../sim/buildings';
import { hash3Float } from '../sim/rng';
import type { Simulation } from '../sim/simulation';
import { chicken, hedgehog, sheep } from './animal-models';
import { FrameInstances } from './frame-instances';
import { colored, merge } from './geometry';
import type { ViewRect } from './machine-animations';

const m = new Matrix4();
const pos = new Vector3();
const scl = new Vector3();
const q = new Quaternion();
const UP = new Vector3(0, 1, 0);

/** Regenbogen: sechs Farbbänder als Halbkreis (Radius 1, Mittelpunkt am Boden). */
function rainbowGeometry(): BufferGeometry {
  const colors = [
    PALETTE.rainbowViolet,
    PALETTE.rainbowBlue,
    PALETTE.rainbowGreen,
    PALETTE.rainbowYellow,
    PALETTE.rainbowOrange,
    PALETTE.rainbowRed,
  ];
  const band = 0.035;
  return merge(
    colors.map((c, k) =>
      colored(new RingGeometry(0.8 + k * band, 0.8 + (k + 1) * band, 48, 1, 0, Math.PI), c),
    ),
  );
}

/**
 * Tiere und kleine Überraschungen (rein optisch): Schafe grasen auf Schafweiden, Hühner picken
 * vor den Dorfhäusern, in der Dämmerung streift ein Igel durch manche Gärten, und nach einem
 * Regenschauer steht für eine Weile ein Regenbogen am Himmel. Jedes Bild nur für den
 * sichtbaren Ausschnitt, nur nah herangezoomt.
 */
export class AnimalsView {
  readonly group = new Group();
  private readonly sheep: FrameInstances;
  private readonly chickens: FrameInstances;
  private readonly hedgehogs: FrameInstances;
  private readonly rainbow: Mesh;
  private readonly rainbowMaterial: MeshBasicMaterial;
  private pastures: number[] = [];
  private pastureVersion = -1;
  private hadRain = false;
  private rainbowStart = -1e9;

  constructor(material: Material) {
    this.sheep = new FrameInstances(sheep(), material, this.group, 32);
    this.chickens = new FrameInstances(chicken(), material, this.group, 32);
    this.hedgehogs = new FrameInstances(hedgehog(), material, this.group, 8);
    this.rainbowMaterial = new MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
      side: DoubleSide,
    });
    this.rainbow = new Mesh(rainbowGeometry(), this.rainbowMaterial);
    this.rainbow.visible = false;
    this.rainbow.renderOrder = -1;
    this.group.add(this.rainbow);
  }

  update(
    sim: Simulation,
    now: number,
    view: ViewRect,
    near: boolean,
    day: number,
    rain: number,
    houses: readonly number[],
    camera: Camera,
    cx: number,
    cz: number,
    viewHeight: number,
  ): void {
    const t = now / 1000;
    this.sheep.begin();
    this.chickens.begin();
    this.hedgehogs.begin();
    if (near) {
      this.updateSheep(sim, t, view);
      if (day > 0.4) this.updateChickens(sim, t, view, houses);
      // Igel kommen in der Dämmerung und nachts heraus
      if (day < 0.6) this.updateHedgehogs(sim, t, view);
    }
    this.sheep.end();
    this.chickens.end();
    this.hedgehogs.end();
    this.updateRainbow(now, day, rain, camera, cx, cz, viewHeight);
  }

  /** Weiden neu suchen, wenn sich Gebäude geändert haben (gleiche Zählung wie die Gemütlichkeit). */
  private findPastures(sim: Simulation): void {
    this.pastureVersion = sim.cozy.version;
    this.pastures = [];
    const b = sim.buildings;
    for (let id = 0; id < b.highWater; id++)
      if (b.alive[id] && BUILDINGS[b.type[id]].model === 'sheepPasture') this.pastures.push(id);
  }

  /** Schafe: wandern langsam über die Weide, bleiben stehen und grasen (Kopf tiefer). */
  private updateSheep(sim: Simulation, t: number, view: ViewRect): void {
    sim.cozy.ensure();
    if (this.pastureVersion !== sim.cozy.version) this.findPastures(sim);
    const b = sim.buildings;
    for (const id of this.pastures) {
      if (!b.alive[id]) continue;
      const x = b.x[id];
      const y = b.y[id];
      if (x < view.minX - 3 || x > view.maxX + 1 || y < view.minY - 3 || y > view.maxY + 1)
        continue;
      const def = BUILDINGS[b.type[id]];
      const w = footprintW(def, b.rot[id]);
      const h = footprintH(def, b.rot[id]);
      for (let k = 0; k < LIFE_CONFIG.sheepPerPasture; k++) {
        const r = hash3Float(id, k, 83);
        // sanfte Lissajous-Bahn innerhalb des Zauns, sehr langsam
        const a = t * (0.05 + r * 0.04) + r * 40;
        const px = x + w / 2 + Math.sin(a) * (w / 2 - 0.55) * 0.8 + (r - 0.5) * 0.4;
        const pz = y + h / 2 + Math.sin(a * 1.7 + k) * (h / 2 - 0.55) * 0.8;
        const dx = Math.cos(a) * 0.8;
        const dz = Math.cos(a * 1.7 + k) * 1.36;
        // grasen: abwechselnd laufen und mit gesenktem Kopf stehen
        const graze = Math.sin(t * 0.4 + r * 10) > 0.2;
        pos.set(px, 0.04, pz);
        q.setFromAxisAngle(UP, Math.atan2(dx, dz));
        if (graze) q.multiply(qTilt.setFromAxisAngle(AXIS_X, 0.18));
        scl.set(1.15, 1.15, 1.15);
        this.sheep.push(m.compose(pos, q, scl));
      }
    }
  }

  /** Hühner: picken vor den Dorfhäusern, trippeln ein Stück und picken wieder. */
  private updateChickens(
    sim: Simulation,
    t: number,
    view: ViewRect,
    houses: readonly number[],
  ): void {
    const size = sim.world.size;
    for (const tile of houses) {
      const hx = (tile % size) + 0.5;
      const hz = Math.floor(tile / size) + 0.5;
      if (hx < view.minX - 2 || hx > view.maxX + 2 || hz < view.minY - 2 || hz > view.maxY + 2)
        continue;
      const n = Math.floor(hash3Float(tile, 7, 41) * (LIFE_CONFIG.chickensPerHouse + 1));
      for (let k = 0; k < n; k++) {
        const r = hash3Float(tile, k, 47);
        const a = Math.floor(t * 0.5 + r * 7) * 2.4 + r * 9; // springt alle 2 s zu einem neuen Ziel
        const tx = hx + Math.cos(a) * 0.75;
        const tz = hz + 0.55 + Math.sin(a) * 0.35;
        const peck = Math.max(0, Math.sin(t * 9 + r * 30)) * 0.5;
        pos.set(tx, 0, tz);
        q.setFromAxisAngle(UP, a + r * 3).multiply(qTilt.setFromAxisAngle(AXIS_X, peck));
        scl.set(1.3, 1.3, 1.3);
        this.chickens.push(m.compose(pos, q, scl));
      }
    }
  }

  /** Igel: streifen in der Dämmerung langsam am Rand mancher Gärten entlang. */
  private updateHedgehogs(sim: Simulation, t: number, view: ViewRect): void {
    const b = sim.buildings;
    for (const id of sim.machines.gardens) {
      if (hash3Float(id, 2, 59) >= LIFE_CONFIG.hedgehogChance) continue;
      const x = b.x[id];
      const y = b.y[id];
      if (x < view.minX - 3 || x > view.maxX + 1 || y < view.minY - 3 || y > view.maxY + 1)
        continue;
      const def = BUILDINGS[b.type[id]];
      const w = footprintW(def, b.rot[id]) + 0.5;
      const h = footprintH(def, b.rot[id]) + 0.5;
      // einmal rund um den Garten, mit Pausen zum Schnüffeln
      const perim = 2 * (w + h);
      const raw = (t * 0.12 + hash3Float(id, 3, 61) * perim) % perim;
      const s = raw - Math.max(0, Math.sin(t * 0.8)) * 0.1;
      let px: number;
      let pz: number;
      let yaw: number;
      const x0 = x - 0.25;
      const z0 = y - 0.25;
      if (s < w) [px, pz, yaw] = [x0 + s, z0, Math.PI / 2];
      else if (s < w + h) [px, pz, yaw] = [x0 + w, z0 + s - w, 0];
      else if (s < 2 * w + h) [px, pz, yaw] = [x0 + w - (s - w - h), z0 + h, -Math.PI / 2];
      else [px, pz, yaw] = [x0, z0 + h - (s - 2 * w - h), Math.PI];
      pos.set(px, 0, pz);
      q.setFromAxisAngle(UP, yaw);
      scl.set(1.3, 1.3, 1.3);
      this.hedgehogs.push(m.compose(pos, q, scl));
    }
  }

  /** Regenbogen: erscheint, wenn ein Schauer vorbei ist und die Sonne scheint, und verblasst. */
  private updateRainbow(
    now: number,
    day: number,
    rain: number,
    camera: Camera,
    cx: number,
    cz: number,
    viewHeight: number,
  ): void {
    if (rain > 0.3) this.hadRain = true;
    if (this.hadRain && rain < 0.05) {
      this.hadRain = false;
      if (day > 0.5) this.rainbowStart = now;
    }
    const age = (now - this.rainbowStart) / 1000;
    const total = LIFE_CONFIG.rainbowSeconds;
    const fade = age < 0 || age > total ? 0 : Math.min(1, age / 4, (total - age) / 6);
    this.rainbow.visible = fade > 0.01;
    if (!this.rainbow.visible) return;
    this.rainbowMaterial.opacity = 0.5 * fade * Math.min(1, day * 1.5);
    // hinter dem Blickpunkt (von der Kamera aus gesehen), zur Kamera gedreht
    const dx = cx - camera.position.x;
    const dz = cz - camera.position.z;
    const len = Math.hypot(dx, dz) || 1;
    const dist = viewHeight * 0.25;
    // Mitte etwas unter dem Boden: die Füße verschwinden im Gelände statt hart abzubrechen
    this.rainbow.position.set(cx + (dx / len) * dist, -viewHeight * 0.06, cz + (dz / len) * dist);
    this.rainbow.rotation.set(0, Math.atan2(-dx, -dz), 0);
    const r = viewHeight * 0.5;
    this.rainbow.scale.set(r, r, r);
  }

  dispose(): void {
    this.sheep.dispose();
    this.chickens.dispose();
    this.hedgehogs.dispose();
    this.rainbow.geometry.dispose();
    this.rainbowMaterial.dispose();
  }
}

const qTilt = new Quaternion();
const AXIS_X = new Vector3(1, 0, 0);
