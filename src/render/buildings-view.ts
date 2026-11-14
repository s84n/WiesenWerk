import { Group, Matrix4, Quaternion, Vector3, type BufferGeometry, type Material } from 'three';
import { BUILDINGS } from '../data/buildings';
import { footprintH, footprintW } from '../sim/buildings';
import type { Simulation } from '../sim/simulation';
import type { World } from '../sim/world';
import { buildingModel, upgradeBadge } from './building-models';
import { DynamicChunkedInstances } from './dynamic-instances';

const m = new Matrix4();
const pos = new Vector3();
const quat = new Quaternion();
const one = new Vector3(1, 1, 1);
const up = new Vector3(0, 1, 0);

/** Geometrien der Gebäudemodelle mit beweglichen Teilen in Ruhestellung (Vorschau, Icons). */
let geometryCache: BufferGeometry[] | null = null;
export function buildingGeometries(): BufferGeometry[] {
  geometryCache ??= BUILDINGS.map((def) =>
    buildingModel(def.model, def.size[0], def.size[1], true),
  );
  return geometryCache;
}

/** Geometrien ohne bewegliche Teile (die zeichnet `MachineAnimations`). */
let staticCache: BufferGeometry[] | null = null;
function staticGeometries(): BufferGeometry[] {
  staticCache ??= BUILDINGS.map((def) => buildingModel(def.model, def.size[0], def.size[1]));
  return staticCache;
}

/** Transformationsmatrix eines Gebäudes (Mitte der Grundfläche, Drehung). */
export function buildingMatrix(
  type: number,
  x: number,
  y: number,
  rot: number,
  out: Matrix4,
): Matrix4 {
  const def = BUILDINGS[type];
  pos.set(x + footprintW(def, rot) / 2, 0, y + footprintH(def, rot) / 2);
  quat.setFromAxisAngle(up, (-rot * Math.PI) / 2);
  return out.compose(pos, quat, one);
}

/**
 * Alle gebauten Gebäude: pro Gebäudetyp ein Instanz-Mesh (ein Zeichenaufruf je Typ).
 */
export class BuildingsView {
  readonly group = new Group();
  private readonly perType: DynamicChunkedInstances[];
  /** Kennzeichen „Stufe 2“ auf aufgewerteten Gebäuden. */
  private readonly badges: DynamicChunkedInstances;

  constructor(
    private readonly world: World,
    material: Material,
  ) {
    const chunks = world.chunksPerSide * world.chunksPerSide;
    this.perType = staticGeometries().map((g) => new DynamicChunkedInstances(g, material, chunks));
    for (const t of this.perType) this.group.add(t.group);
    this.badges = new DynamicChunkedInstances(upgradeBadge(), material, chunks, false);
    this.group.add(this.badges.group);
  }

  added(sim: Simulation, id: number): void {
    const b = sim.buildings;
    const type = b.type[id];
    buildingMatrix(type, b.x[id], b.y[id], b.rot[id], m);
    this.perType[type].add(id, this.world.chunkOf(b.x[id], b.y[id]), m);
    this.refreshBadge(sim, id);
  }

  /** Zeigt oder entfernt das Kennzeichen „Stufe 2“. */
  refreshBadge(sim: Simulation, id: number): void {
    this.badges.remove(id);
    if (!sim.machines.upgraded[id]) return;
    const b = sim.buildings;
    buildingMatrix(b.type[id], b.x[id], b.y[id], 0, m);
    this.badges.add(id, this.world.chunkOf(b.x[id], b.y[id]), m);
  }

  removed(id: number, type: number): void {
    this.perType[type].remove(id);
    this.badges.remove(id);
  }

  apply(visible: Uint16Array, count: number, force: boolean): void {
    for (const t of this.perType) t.apply(visible, count, force);
    this.badges.apply(visible, count, force);
  }

  dispose(): void {
    // Geometrien gehören dem Cache und bleiben erhalten.
    for (const t of this.perType) t.dispose();
    this.badges.dispose();
    this.group.clear();
  }
}
