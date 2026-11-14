import {
  AdditiveBlending,
  CircleGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { PALETTE } from '../data/palette';
import { BUILDINGS } from '../data/buildings';
import { footprintH, footprintW } from '../sim/buildings';
import type { Simulation } from '../sim/simulation';
import type { World } from '../sim/world';
import { buildingModel, upgradeBadge } from './building-models';
import { DynamicChunkedInstances } from './dynamic-instances';

const m = new Matrix4();
const blob = new Matrix4();
const popScale = new Matrix4();
/** Dauer der Aufploppen-Animation in Millisekunden. */
const POP_MS = 380;
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
 * Lichtschein als Scheibe mit Farbverlauf: hell in der Mitte, schwarz am Rand. Mit additivem
 * Mischen wirkt Schwarz durchsichtig – so entsteht ein weicher Kreis ganz ohne Textur.
 */
function lightPool(): BufferGeometry {
  const g = new CircleGeometry(1.4, 24).rotateX(-Math.PI / 2).translate(0, 0.085, 0);
  const n = g.getAttribute('position').count;
  const colors = new Float32Array(n * 3);
  const c = new Color(PALETTE.lanternLight);
  const p = g.getAttribute('position');
  for (let i = 0; i < n; i++) {
    const r = Math.min(1, Math.hypot(p.getX(i), p.getZ(i)) / 1.4);
    const f = (1 - r) * (1 - r);
    colors[i * 3] = c.r * f;
    colors[i * 3 + 1] = c.g * f;
    colors[i * 3 + 2] = c.b * f;
  }
  g.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return g;
}

/**
 * Alle gebauten Gebäude: pro Gebäudetyp ein Instanz-Mesh (ein Zeichenaufruf je Typ).
 */
export class BuildingsView {
  readonly group = new Group();
  private readonly perType: DynamicChunkedInstances[];
  /** Kennzeichen „Stufe 2“ auf aufgewerteten Gebäuden. */
  private readonly badges: DynamicChunkedInstances;
  /** Dunkle Flecken unter Gebäuden, wenn echte Schatten aus sind (Stufe „Niedrig“). */
  private readonly blobs: DynamicChunkedInstances;

  constructor(
    private readonly world: World,
    material: Material,
  ) {
    const chunks = world.chunksPerSide * world.chunksPerSide;
    this.perType = staticGeometries().map((g) => new DynamicChunkedInstances(g, material, chunks));
    for (const t of this.perType) this.group.add(t.group);
    this.badges = new DynamicChunkedInstances(upgradeBadge(), material, chunks, false);
    this.blobs = new DynamicChunkedInstances(
      new CircleGeometry(0.5, 14).rotateX(-Math.PI / 2).translate(0, 0.02, 0),
      new MeshBasicMaterial({
        color: PALETTE.blobShadow,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      }),
      chunks,
      false,
    );
    this.blobs.group.visible = false;
    this.lights = new DynamicChunkedInstances(lightPool(), this.lightMaterial, chunks, false);
    this.group.add(this.badges.group, this.blobs.group, this.lights.group);
  }

  /** Nachtleuchten (0..1) für die Lichtscheine der Laternen. */
  setNightGlow(glow: number): void {
    this.lightMaterial.opacity = glow * 0.55;
    this.lights.group.visible = glow > 0.02;
  }

  /** Warmer Lichtschein unter Laternen (nur nachts sichtbar). */
  private readonly lights: DynamicChunkedInstances;
  private readonly lightMaterial = new MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: AdditiveBlending,
  });

  /** Gerade aufploppende Gebäude: ID, Typ, Startzeit. */
  private readonly popping: { id: number; type: number; start: number }[] = [];

  setBlobShadows(on: boolean): void {
    this.blobs.group.visible = on;
  }

  /** `pop`: mit kurzer Aufploppen-Animation (nur beim Bauen, nicht beim Laden). */
  added(sim: Simulation, id: number, pop = false): void {
    const b = sim.buildings;
    const type = b.type[id];
    buildingMatrix(type, b.x[id], b.y[id], b.rot[id], m);
    if (pop) {
      this.popping.push({ id, type, start: performance.now() });
      m.multiply(popScale.makeScale(0.01, 0.01, 0.01));
    }
    const chunk = this.world.chunkOf(b.x[id], b.y[id]);
    this.perType[type].add(id, chunk, m);
    this.refreshBadge(sim, id);
    const def = BUILDINGS[type];
    if (def.model === 'lantern') {
      blob.makeTranslation(b.x[id] + 0.5, 0, b.y[id] + 0.5);
      this.lights.add(id, chunk, blob);
    }
    // Schattenfleck: etwas größer als die Grundfläche, nach Südosten versetzt
    if (def.behavior.kind !== 'decor' || def.size[0] > 1) {
      const w = footprintW(def, b.rot[id]);
      const h = footprintH(def, b.rot[id]);
      blob
        .makeScale(w * 1.15, 1, h * 1.15)
        .setPosition(b.x[id] + w / 2 + 0.25, 0, b.y[id] + h / 2 + 0.2);
      this.blobs.add(id, chunk, blob);
    }
  }

  /** Zeigt oder entfernt das Kennzeichen „Stufe 2“. */
  refreshBadge(sim: Simulation, id: number): void {
    this.badges.remove(id);
    if (!sim.machines.upgraded[id]) return;
    const b = sim.buildings;
    buildingMatrix(b.type[id], b.x[id], b.y[id], 0, m);
    this.badges.add(id, this.world.chunkOf(b.x[id], b.y[id]), m);
  }

  /** Pro Bild: Aufploppen weiterführen (wächst mit kleinem Überschwingen auf volle Größe). */
  updatePop(sim: Simulation, now: number): void {
    const b = sim.buildings;
    for (let i = this.popping.length - 1; i >= 0; i--) {
      const p = this.popping[i];
      if (!b.alive[p.id] || b.type[p.id] !== p.type) {
        this.popping.splice(i, 1);
        continue;
      }
      const t = Math.min(1, (now - p.start) / POP_MS);
      const c = 1.9;
      const u = t - 1;
      const s = Math.max(0.01, 1 + (c + 1) * u * u * u + c * u * u); // „easeOutBack“
      buildingMatrix(p.type, b.x[p.id], b.y[p.id], b.rot[p.id], m);
      if (t < 1) m.multiply(popScale.makeScale(s, s, s));
      else this.popping.splice(i, 1);
      this.perType[p.type].setMatrix(p.id, m);
    }
  }

  removed(id: number, type: number): void {
    this.perType[type].remove(id);
    this.badges.remove(id);
    this.blobs.remove(id);
    this.lights.remove(id);
  }

  apply(visible: Uint16Array, count: number, force: boolean): void {
    for (const t of this.perType) t.apply(visible, count, force);
    this.badges.apply(visible, count, force);
    this.blobs.apply(visible, count, force);
    this.lights.apply(visible, count, force);
  }

  dispose(): void {
    // Geometrien gehören dem Cache und bleiben erhalten.
    for (const t of this.perType) t.dispose();
    this.badges.dispose();
    this.blobs.dispose();
    this.lights.dispose();
    this.group.clear();
  }
}
