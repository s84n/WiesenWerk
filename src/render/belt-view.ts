import { Group, InstancedMesh, Matrix4, type Material } from 'three';
import { BELTS } from '../data/balance';
import { BUILDINGS } from '../data/buildings';
import { ITEM_COUNT } from '../data/items';
import { DIR_X, DIR_Y, footprintH, footprintW } from '../sim/buildings';
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

  constructor(
    private readonly world: World,
    private readonly material: Material,
  ) {
    const chunks = world.chunksPerSide * world.chunksPerSide;
    this.shapes = [beltStraight(), beltCurve(true), beltCurve(false)].map(
      (g) => new DynamicChunkedInstances(g, material, chunks, false),
    );
    for (const s of this.shapes) this.group.add(s.group);
    this.tileId = new Int32Array(world.size * world.size).fill(-1);
    this.tileShape = new Int8Array(world.size * world.size);
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
    const shape = turn === 3 ? SHAPE_LEFT : turn === 1 ? SHAPE_RIGHT : SHAPE_STRAIGHT;
    const b = sim.buildings;
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
    if (show) {
      const size = this.world.size;
      const segs = sim.belts.segments;
      for (let s = 0; s < segs.length; s++) {
        const seg = segs[s];
        if (seg === null || seg.count === 0) continue;
        if (seg.maxX < minX || seg.minX > maxX || seg.maxY < minY || seg.minY > maxY) continue;

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
    for (let i = 0; i < ITEM_COUNT; i++) {
      const mesh = this.itemMeshes[i];
      if (mesh.count === 0 && counts[i] === 0) continue;
      mesh.count = counts[i];
      mesh.instanceMatrix.needsUpdate = true;
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
    this.group.clear();
  }
}
