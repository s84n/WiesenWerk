import {
  BoxGeometry,
  ConeGeometry,
  Group,
  IcosahedronGeometry,
  Matrix4,
  OctahedronGeometry,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { BUILDINGS, type Behavior } from '../data/buildings';
import { RECLAIM_CONFIG, SIM_CONFIG } from '../data/config';
import { PALETTE } from '../data/palette';
import { hash3Float } from '../sim/rng';
import type { Simulation } from '../sim/simulation';
import { buildingMatrix } from './buildings-view';
import { FrameInstances } from './frame-instances';
import { colored, merge } from './geometry';
import { ROUTES, type ViewRect } from './machine-animations';

const mB = new Matrix4();
const mL = new Matrix4();
const m = new Matrix4();
const pos = new Vector3();
const scl = new Vector3();
const q = new Quaternion();
const UP = new Vector3(0, 1, 0);

/** Diese Gebäude bewachsen (größere Bauten; Bänder, Masten, Deko und Gärten nicht). */
const RECLAIMS: ReadonlySet<Behavior['kind']> = new Set<Behavior['kind']>([
  'hq',
  'miner',
  'lumberjack',
  'crafter',
  'burner',
  'storage',
  'depot',
  'dispenser',
  'wind',
  'water',
  'solar',
  'battery',
]);

/** Abstand der möglichen Pflanzplätze entlang des Sockels. */
const SPACING = 0.3;
/** Höchstens dieser Anteil der Plätze wird besetzt (es bleibt luftig). */
const DENSITY = 0.65;

type Part = 'grass' | 'flowerA' | 'flowerB' | 'ivy' | 'trail';

function grassTuft(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    parts.push(
      colored(
        new ConeGeometry(0.025, 0.2 + (k % 3) * 0.04, 3, 1, true)
          .translate(0, 0.1, 0)
          .rotateZ(0.25)
          .rotateY(a),
        k % 2 ? PALETTE.leafLight : PALETTE.leaf,
      ),
    );
  }
  return merge(parts);
}

function flowerTuft(a: number, b: number): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const spots: [number, number, number, number][] = [
    [0, 0, 0.16, a],
    [0.05, 0.04, 0.12, b],
    [-0.05, 0.03, 0.14, a],
  ];
  for (const [x, z, h, c] of spots) {
    parts.push(
      colored(new ConeGeometry(0.008, h, 3, 1, true).translate(x, h / 2, z), PALETTE.leafDark),
    );
    parts.push(colored(new OctahedronGeometry(0.035, 0).translate(x, h, z), c));
  }
  parts.push(colored(new ConeGeometry(0.05, 0.08, 4, 1, true).translate(0, 0.04, 0), PALETTE.leaf));
  return merge(parts);
}

/** Efeubusch, der sich an die Hauswand drückt (ausgewachsen gut einen halben Meter hoch). */
function ivy(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const clumps: [number, number, number, number][] = [
    [0, 0.1, 0, 0.14],
    [0.08, 0.24, -0.03, 0.11],
    [-0.06, 0.34, 0.02, 0.1],
    [0.03, 0.48, -0.02, 0.08],
  ];
  clumps.forEach(([x, y, z, r], k) =>
    parts.push(
      colored(
        new IcosahedronGeometry(r, 0).translate(x, y, z),
        k % 2 ? PALETTE.hedge : PALETTE.leafDark,
      ),
    ),
  );
  return merge(parts);
}

/**
 * Natur erobert zurück: Je länger ein Gebäude steht (`buildings.built`), desto mehr Gras,
 * Blumen und Efeu wachsen an seinem Sockel; auf den Wegen der Arbeiter (`ROUTES`) entsteht ein
 * Trampelpfad. Reine Darstellung, nur nah herangezoomt und nur für den sichtbaren Ausschnitt,
 * neu gesetzt `RECLAIM_CONFIG.updatesPerSecond`-mal je Sekunde.
 */
export class OvergrowthView {
  readonly group = new Group();
  private readonly parts = new Map<Part, FrameInstances>();
  private last = -Infinity;
  private shown = false;

  constructor(material: Material) {
    const make: Record<Part, () => BufferGeometry> = {
      grass: grassTuft,
      flowerA: () => flowerTuft(PALETTE.flowerYellow, PALETTE.flowerWhite),
      flowerB: () => flowerTuft(PALETTE.flowerViolet, PALETTE.flowerPink),
      ivy,
      trail: () => colored(new BoxGeometry(1, 0.03, 1).translate(0, 0.015, 0), PALETTE.trail),
    };
    for (const [name, f] of Object.entries(make))
      this.parts.set(name as Part, new FrameInstances(f(), material, this.group));
  }

  update(sim: Simulation, now: number, view: ViewRect, show: boolean): void {
    if (!show) {
      if (this.shown) {
        for (const p of this.parts.values()) {
          p.begin();
          p.end();
        }
        this.shown = false;
      }
      return;
    }
    if (this.shown && now - this.last < 1000 / RECLAIM_CONFIG.updatesPerSecond) return;
    this.last = now;
    this.shown = true;
    for (const p of this.parts.values()) p.begin();
    const b = sim.buildings;
    const ticksPerMinute = 60 * SIM_CONFIG.ticksPerSecond;
    const start = RECLAIM_CONFIG.startMinutes * ticksPerMinute;
    const span = (RECLAIM_CONFIG.fullMinutes - RECLAIM_CONFIG.startMinutes) * ticksPerMinute;
    for (let id = 0; id < b.highWater; id++) {
      if (!b.alive[id]) continue;
      const x = b.x[id];
      const y = b.y[id];
      if (x < view.minX - 3 || x > view.maxX + 1 || y < view.minY - 3 || y > view.maxY + 1)
        continue;
      const type = b.type[id];
      const def = BUILDINGS[type];
      if (!RECLAIMS.has(def.behavior.kind)) continue;
      const stage = Math.min(1, (sim.tick - b.built[id] - start) / span);
      if (stage <= 0) continue;
      buildingMatrix(type, x, y, b.rot[id], mB);
      this.plants(id, def.size[0], def.size[1], stage);
      if (stage > RECLAIM_CONFIG.trailFrom) this.trails(def.model, stage);
    }
    for (const p of this.parts.values()) p.end();
  }

  /** Gras und Blumen rund um den Sockel, Efeu an den Ecken (Gebäudekoordinaten, `mB` gesetzt). */
  private plants(id: number, w: number, h: number, stage: number): void {
    const hx = w / 2 - 0.08;
    const hz = h / 2 - 0.08;
    let k = 0;
    // vier Kanten im Uhrzeigersinn ablaufen
    const edges: [number, number, number, number][] = [
      [-hx, -hz, hx, -hz],
      [hx, -hz, hx, hz],
      [hx, hz, -hx, hz],
      [-hx, hz, -hx, -hz],
    ];
    for (const [ax, az, bx, bz] of edges) {
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.floor(len / SPACING));
      for (let i = 0; i < n; i++, k++) {
        const r = hash3Float(id, k, 53);
        if (r >= stage * DENSITY) continue;
        const u = (i + 0.5) / n;
        const kind = hash3Float(id, k, 59);
        const part: Part = kind < 0.55 ? 'grass' : kind < 0.8 ? 'flowerA' : 'flowerB';
        const jitter = (hash3Float(id, k, 61) - 0.5) * 0.08;
        const s = (0.6 + 0.6 * stage) * (0.85 + kind * 0.3);
        this.put(part, ax + (bx - ax) * u + jitter, az + (bz - az) * u - jitter, kind * 6.28, s);
      }
    }
    if (stage <= RECLAIM_CONFIG.ivyFrom) return;
    const ivyStage = (stage - RECLAIM_CONFIG.ivyFrom) / (1 - RECLAIM_CONFIG.ivyFrom);
    const corners: [number, number][] = [
      [-hx + 0.05, -hz + 0.05],
      [hx - 0.05, -hz + 0.05],
      [hx - 0.05, hz - 0.05],
      [-hx + 0.05, hz - 0.05],
    ];
    corners.forEach(([cx, cz], c) => {
      const r = hash3Float(id, c, 67);
      if (r > ivyStage * 1.3) return;
      // zur Gebäudemitte hin gedreht, damit sich der Busch an die Wand lehnt
      this.put('ivy', cx, cz, Math.atan2(-cx, -cz), 0.5 + 0.6 * Math.min(1, ivyStage + r * 0.3));
    });
  }

  /** Ausgetretene Pfade entlang der Arbeiterwege (breiter, je länger das Gebäude steht). */
  private trails(model: string, stage: number): void {
    const routes = ROUTES[model];
    if (!routes) return;
    const width = 0.1 + 0.14 * stage;
    for (const r of routes) {
      const pts = r.points;
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, az] = pts[i];
        const [bx, bz] = pts[i + 1];
        const len = Math.hypot(bx - ax, bz - az) + width;
        pos.set((ax + bx) / 2, 0.002 * i, (az + bz) / 2);
        q.setFromAxisAngle(UP, Math.atan2(bx - ax, bz - az));
        scl.set(width, 1, len);
        mL.compose(pos, q, scl);
        this.parts.get('trail')!.push(m.multiplyMatrices(mB, mL));
      }
    }
  }

  private put(part: Part, x: number, z: number, yaw: number, s: number): void {
    pos.set(x, 0, z);
    q.setFromAxisAngle(UP, yaw);
    scl.set(s, s, s);
    mL.compose(pos, q, scl);
    this.parts.get(part)!.push(m.multiplyMatrices(mB, mL));
  }

  dispose(): void {
    for (const p of this.parts.values()) p.dispose();
  }
}
