import { BoxGeometry, Group, InstancedMesh, Matrix4, type Material } from 'three';
import { PALETTE } from '../data/palette';
import { FrameInstances } from './frame-instances';
import { colored } from './geometry';
import { BELTS } from '../data/balance';
import { BUILDINGS } from '../data/buildings';
import { ITEM_COUNT } from '../data/items';
import { DIR_X, DIR_Y, footprintH, footprintW } from '../sim/buildings';
import type { Segment } from '../sim/belts';
import type { Simulation } from '../sim/simulation';
import type { World } from '../sim/world';
import { BELT_SURFACE, beltCurve, beltStraight } from './belt-models';
import { buildingMatrix } from './buildings-view';
import { DynamicChunkedInstances } from './dynamic-instances';
import { itemGeometries } from './item-models';

const m = new Matrix4();
const UNIT = BELTS.unitsPerTile;
const SPACING = BELTS.minSpacing;
const SHAPE_STRAIGHT = 0;
const SHAPE_LEFT = 1;
const SHAPE_RIGHT = 2;
const TIERS = 3;
/** Abstand der mitlaufenden Querleisten (halbes Feld). */
const SLAT_GAP = UNIT / 2;
/** Drehung je Laufrichtung (Leiste liegt quer zur Richtung). */
const YAW_COS = [-1, 0, 1, 0];
const YAW_SIN = [0, 1, 0, -1];

/**
 * Bänder (gerade Stücke und Kurven als Instanzen) und die Items darauf.
 * Item-Positionen werden jedes Bild nur für Segmente im Bildausschnitt aus den Abständen berechnet.
 */
export class BeltView {
  readonly group = new Group();
  private readonly shapes: DynamicChunkedInstances[];
  /** Bandgebäude je Feld und dessen Form (für das Ersetzen bei Änderungen). */
  private readonly tileId: Int32Array;
  private readonly tileShape: Int8Array;
  private readonly itemMeshes: InstancedMesh[] = [];
  private readonly itemCounts = new Int32Array(ITEM_COUNT);
  /** Querleisten, die mitlaufen, solange Ware auf dem Abschnitt fährt. */
  private readonly slats: FrameInstances;
  /** Verschiebung der Leisten je Segment (Einheiten) und letzte Simulationszeit. */
  private slatOffset = new Float32Array(64);
  private lastSimTime = -1;

  constructor(
    private readonly world: World,
    private readonly material: Material,
  ) {
    const chunks = world.chunksPerSide * world.chunksPerSide;
    // je Bandstufe: gerade, Kurve links, Kurve rechts (Index = (Stufe − 1) · 3 + Form)
    this.shapes = [];
    for (let tier = 1; tier <= TIERS; tier++) {
      for (const g of [beltStraight(tier), beltCurve(true, tier), beltCurve(false, tier)])
        this.shapes.push(new DynamicChunkedInstances(g, material, chunks, false));
    }
    for (const s of this.shapes) this.group.add(s.group);
    this.tileId = new Int32Array(world.size * world.size).fill(-1);
    this.tileShape = new Int8Array(world.size * world.size);
    this.slats = new FrameInstances(
      colored(
        new BoxGeometry(0.62, 0.012, 0.06).translate(0, BELT_SURFACE + 0.001, 0),
        PALETTE.beltSlat,
      ),
      material,
      this.group,
      512,
    );
    const geos = itemGeometries();
    for (let i = 0; i < ITEM_COUNT; i++) {
      const mesh = new InstancedMesh(geos[i], material, 256);
      mesh.count = 0;
      mesh.frustumCulled = false;
      this.itemMeshes.push(mesh);
      this.group.add(mesh);
    }
  }

  /** Aktualisiert das Bandstück auf einem Feld (Form hängt von den Nachbarn ab). */
  refreshTile(sim: Simulation, tile: number): void {
    const old = this.tileId[tile];
    if (old >= 0) {
      this.shapes[this.tileShape[tile]].remove(old);
      this.tileId[tile] = -1;
    }
    const id = sim.belts.beltAt(tile);
    if (id < 0) return;
    const exit = sim.belts.dirAt(tile);
    const turn = (exit - sim.belts.entryDir(tile)) & 3;
    const b = sim.buildings;
    const beh = BUILDINGS[b.type[id]].behavior;
    const tier = beh.kind === 'belt' ? beh.tier : 1;
    const shape =
      (tier - 1) * 3 + (turn === 3 ? SHAPE_LEFT : turn === 1 ? SHAPE_RIGHT : SHAPE_STRAIGHT);
    buildingMatrix(b.type[id], b.x[id], b.y[id], exit, m);
    this.shapes[shape].add(id, this.world.chunkOf(b.x[id], b.y[id]), m);
    this.tileId[tile] = id;
    this.tileShape[tile] = shape;
  }

  /** Feld und seine vier Nachbarn. */
  refreshAround(sim: Simulation, tile: number): void {
    this.refreshTile(sim, tile);
    for (let d = 0; d < 4; d++) {
      const n = sim.belts.neighbor(tile, d);
      if (n >= 0) this.refreshTile(sim, n);
    }
  }

  /** Alle Felder rund um eine Gebäudegrundfläche (Ausgänge ändern Kurven der Bänder davor). */
  refreshPerimeter(sim: Simulation, type: number, x: number, y: number, rot: number): void {
    const def = BUILDINGS[type];
    const w = footprintW(def, rot);
    const h = footprintH(def, rot);
    for (let ty = y - 1; ty <= y + h; ty++) {
      for (let tx = x - 1; tx <= x + w; tx++) {
        const inside = tx >= x && tx < x + w && ty >= y && ty < y + h;
        if (!inside && this.world.inBounds(tx, ty)) this.refreshTile(sim, this.world.index(tx, ty));
      }
    }
  }

  apply(visible: Uint16Array, count: number, force: boolean): void {
    for (const s of this.shapes) s.apply(visible, count, force);
  }

  /**
   * Schreibt die Item-Positionen sichtbarer Segmente in die Instanzpuffer.
   * `alpha` (0..1) schiebt bewegte Items bis zum nächsten Tick weiter, damit alles flüssig läuft.
   */
  updateItems(
    sim: Simulation,
    alpha: number,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    show: boolean,
  ): void {
    const counts = this.itemCounts;
    counts.fill(0);
    this.slats.begin();
    // Fortschritt der Simulation seit dem letzten Bild (in Ticks, steht in der Pause)
    const simTime = sim.tick + alpha;
    const simDt =
      this.lastSimTime < 0 || simTime < this.lastSimTime
        ? 0
        : Math.min(10, simTime - this.lastSimTime);
    this.lastSimTime = simTime;
    if (show) {
      const size = this.world.size;
      const segs = sim.belts.segments;
      if (this.slatOffset.length < segs.length) {
        const next = new Float32Array(segs.length * 2);
        next.set(this.slatOffset);
        this.slatOffset = next;
      }
      for (let s = 0; s < segs.length; s++) {
        const seg = segs[s];
        if (seg === null) continue;
        if (seg.maxX < minX || seg.minX > maxX || seg.maxY < minY || seg.minY > maxY) continue;
        // Leisten laufen nur, wenn Ware fährt (nicht leer, nicht ganz gestaut)
        if (seg.count > 0 && seg.active < seg.count)
          this.slatOffset[s] = (this.slatOffset[s] + simDt * seg.speed) % SLAT_GAP;
        this.addSlats(seg, this.slatOffset[s], size);
        if (seg.count === 0) continue;

        let move = 0;
        if (seg.active < seg.count) {
          const g = seg.gaps[seg.ring(seg.active)];
          const min = seg.active === 0 ? 0 : SPACING;
          move = Math.min(seg.speed * alpha, g - min);
        }
        let cum = 0;
        for (let k = 0; k < seg.count; k++) {
          const idx = seg.ring(k);
          cum += seg.gaps[idx];
          let pos = seg.lengthUnits - cum + (k >= seg.active ? move : 0);
          if (pos >= seg.lengthUnits) pos = seg.lengthUnits - 0.001;
          if (pos < 0) pos = 0;
          const ti = Math.floor(pos / UNIT);
          const f = pos / UNIT - ti;
          const tile = seg.tiles[ti];
          const cx = (tile % size) + 0.5;
          const cz = Math.floor(tile / size) + 0.5;
          let wx: number;
          let wz: number;
          if (f < 0.5) {
            const e = seg.entryDirs[ti];
            const t = 0.5 - f; // Anteil vor der Mitte
            wx = cx - DIR_X[e] * t;
            wz = cz - DIR_Y[e] * t;
          } else {
            const d = seg.dirs[ti];
            const t = f - 0.5;
            wx = cx + DIR_X[d] * t;
            wz = cz + DIR_Y[d] * t;
          }
          const item = seg.items[idx];
          const mesh = this.ensureCapacity(item, counts[item] + 1);
          const a = mesh.instanceMatrix.array as Float32Array;
          const o = counts[item] * 16;
          a[o] = 1;
          a[o + 1] = 0;
          a[o + 2] = 0;
          a[o + 3] = 0;
          a[o + 4] = 0;
          a[o + 5] = 1;
          a[o + 6] = 0;
          a[o + 7] = 0;
          a[o + 8] = 0;
          a[o + 9] = 0;
          a[o + 10] = 1;
          a[o + 11] = 0;
          a[o + 12] = wx;
          a[o + 13] = BELT_SURFACE;
          a[o + 14] = wz;
          a[o + 15] = 1;
          counts[item]++;
        }
      }
    }
    this.slats.end();
    for (let i = 0; i < ITEM_COUNT; i++) {
      const mesh = this.itemMeshes[i];
      if (mesh.count === 0 && counts[i] === 0) continue;
      mesh.count = counts[i];
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /** Querleisten eines Segments im Abstand eines halben Feldes, um `offset` verschoben. */
  private addSlats(seg: Segment, offset: number, size: number): void {
    const e = m.elements;
    for (let pos = offset + SLAT_GAP / 2; pos < seg.lengthUnits; pos += SLAT_GAP) {
      const ti = Math.floor(pos / UNIT);
      const f = pos / UNIT - ti;
      const tile = seg.tiles[ti];
      const cx = (tile % size) + 0.5;
      const cz = Math.floor(tile / size) + 0.5;
      let d: number;
      let wx: number;
      let wz: number;
      if (f < 0.5) {
        d = seg.entryDirs[ti];
        wx = cx - DIR_X[d] * (0.5 - f);
        wz = cz - DIR_Y[d] * (0.5 - f);
      } else {
        d = seg.dirs[ti];
        wx = cx + DIR_X[d] * (f - 0.5);
        wz = cz + DIR_Y[d] * (f - 0.5);
      }
      const c = YAW_COS[d];
      const sn = YAW_SIN[d];
      e[0] = c;
      e[1] = 0;
      e[2] = -sn;
      e[3] = 0;
      e[4] = 0;
      e[5] = 1;
      e[6] = 0;
      e[7] = 0;
      e[8] = sn;
      e[9] = 0;
      e[10] = c;
      e[11] = 0;
      e[12] = wx;
      e[13] = 0;
      e[14] = wz;
      e[15] = 1;
      this.slats.push(m);
    }
  }

  /** Vergrößert den Instanzpuffer eines Items bei Bedarf (selten, verdoppelt). */
  private ensureCapacity(item: number, needed: number): InstancedMesh {
    const mesh = this.itemMeshes[item];
    if (needed <= mesh.instanceMatrix.count) return mesh;
    const bigger = new InstancedMesh(mesh.geometry, this.material, mesh.instanceMatrix.count * 2);
    (bigger.instanceMatrix.array as Float32Array).set(mesh.instanceMatrix.array as Float32Array);
    bigger.frustumCulled = false;
    this.group.remove(mesh);
    mesh.dispose();
    this.group.add(bigger);
    this.itemMeshes[item] = bigger;
    return bigger;
  }

  dispose(): void {
    for (const s of this.shapes) s.dispose();
    for (const mesh of this.itemMeshes) mesh.dispose();
    this.slats.dispose();
    this.group.clear();
  }
}
