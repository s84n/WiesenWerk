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
import { SLIDERS, SMOKE, SPINNERS } from './building-models';
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

/** Was ein Arbeiter in der Hand hat. */
type WorkerKind = 'axe' | 'plain' | 'log' | 'crate' | 'plank' | 'can' | 'basket';
const WORKER_KINDS: readonly WorkerKind[] = [
  'axe',
  'plain',
  'log',
  'crate',
  'plank',
  'can',
  'basket',
];

/**
 * Arbeitsweg an einem Gebäude (Punkte in Gebäudekoordinaten, x und z, ungedreht; vorne = +z).
 * Ablauf je Durchgang: hinlaufen (mit `carryOut`), am Ziel arbeiten, zurück (mit `carryBack`),
 * kurz verschnaufen. Steht das Gebäude still, wartet der Arbeiter am Startpunkt.
 */
export interface Route {
  points: readonly (readonly [number, number])[];
  carryOut?: WorkerKind;
  carryBack?: WorkerKind;
  /** Sekunden je Durchgang. */
  cycle: number;
  /** Versatz im Ablauf (0..1), damit mehrere Arbeiter nicht gleichzeitig laufen. */
  offset?: number;
}

export const ROUTES: Record<string, readonly Route[]> = {
  // schaufelt Erz in die glühende Öffnung
  furnace: [
    {
      points: [
        [0.8, 1.2],
        [0.15, 1.08],
      ],
      carryOut: 'crate',
      cycle: 6,
    },
  ],
  // bringt Brennholz vom Stapel an der Seite zum Feuerloch
  burner: [
    {
      points: [
        [1.15, -0.55],
        [1.15, 0.95],
        [-0.15, 0.95],
      ],
      carryOut: 'log',
      cycle: 7,
    },
  ],
  // trägt Bretter aus der Tür zum Stapel daneben
  workshop: [
    {
      points: [
        [0.2, 1.08],
        [0.9, 1.2],
      ],
      carryOut: 'plank',
      cycle: 7,
    },
  ],
  // Gießer bringt Kohle zum Ofen und holt den Stahl am Abstich ab
  foundry: [
    {
      points: [
        [1.55, -0.9],
        [1.55, 1.6],
        [0.35, 1.6],
      ],
      carryOut: 'crate',
      carryBack: 'plank',
      cycle: 9,
    },
  ],
  // Wartung am Akku-Haus
  battery: [
    {
      points: [
        [-0.85, 0.85],
        [0.6, 0.85],
      ],
      cycle: 12,
    },
  ],
  // zwei Arbeiter holen Teile von den Trichtern und bringen sie zum Tor
  assembler: [
    {
      points: [
        [-0.25, 1.7],
        [-1.65, 1.7],
        [-1.65, -1.2],
      ],
      carryBack: 'crate',
      cycle: 10,
    },
    {
      points: [
        [0.25, 1.7],
        [1.65, 1.7],
        [1.65, -1.2],
      ],
      carryBack: 'crate',
      cycle: 10,
      offset: 0.5,
    },
  ],
  // Lager-Varianten und Depots: Träger mit Kisten
  storageSplit: [
    {
      points: [
        [0.3, 1.08],
        [0.95, 1.2],
      ],
      carryOut: 'crate',
      cycle: 6,
    },
  ],
  storageMerge: [
    {
      points: [
        [0.3, 1.08],
        [0.95, 1.2],
      ],
      carryOut: 'crate',
      cycle: 6,
    },
  ],
  storageLarge: [
    {
      points: [
        [-0.4, 1.6],
        [-1.7, 1.6],
        [-1.7, -0.6],
      ],
      carryOut: 'crate',
      cycle: 8,
    },
  ],
  // trägt Kisten aus dem Schuppen zur Rutsche
  dispenser: [
    {
      points: [
        [0.55, 0.45],
        [-0.15, 0.5],
      ],
      carryOut: 'crate',
      cycle: 3,
    },
  ],
  // Bauleute schleppen Material am Uhrturm entlang, solange etwas angeliefert wird
  clockTower: [
    {
      points: [
        [1.35, 1.35],
        [-0.4, 1.38],
      ],
      carryOut: 'crate',
      cycle: 6,
    },
    {
      points: [
        [-1.38, -1.3],
        [-1.38, 0.5],
      ],
      carryOut: 'crate',
      cycle: 7,
    },
  ],
  // Träger bringen die Ware Richtung Zentrale weg und kommen leer zurück
  depot: [
    {
      points: [
        [0.6, 1.15],
        [0.6, 2.6],
        [1.6, 3.2],
      ],
      carryOut: 'crate',
      cycle: 7,
    },
  ],
  depotLarge: [
    {
      points: [
        [1.0, 1.65],
        [1.0, 3.0],
        [2.0, 3.6],
      ],
      carryOut: 'crate',
      cycle: 7,
    },
    {
      points: [
        [-1.0, 1.65],
        [-1.0, 3.0],
        [-2.0, 3.6],
      ],
      carryOut: 'crate',
      cycle: 8,
      offset: 0.5,
    },
  ],
  // Gärtner gießen die Beete und tragen die Ernte heim
  vegetableBed: [
    {
      points: [
        [0.88, 0.95],
        [0.88, -0.75],
        [-0.6, -0.92],
      ],
      carryOut: 'can',
      cycle: 11,
    },
  ],
  flowerMeadow: [
    {
      points: [
        [1.05, 0.3],
        [0.2, 0.15],
        [-0.4, -0.35],
      ],
      carryOut: 'can',
      cycle: 13,
    },
  ],
  orchard: [
    {
      points: [
        [0, 1.65],
        [0, 0.5],
        [-0.4, -0.35],
      ],
      carryBack: 'basket',
      cycle: 12,
    },
    {
      points: [
        [0.3, 1.65],
        [0.3, 1.0],
        [0.75, 0.15],
      ],
      carryOut: 'can',
      cycle: 14,
      offset: 0.5,
    },
  ],
  greenhouse: [
    {
      points: [
        [0, 1.6],
        [0, 0.9],
        [0, -0.9],
      ],
      carryOut: 'can',
      carryBack: 'basket',
      cycle: 12,
    },
  ],
  // Bäcker schiebt Bleche in den Ofen und trägt Kuchen zum Tisch
  bakery: [
    {
      points: [
        [0.15, 0.75],
        [0.62, 0.25],
        [-0.45, 0.95],
      ],
      carryBack: 'crate',
      cycle: 8,
    },
  ],
  // schaufelt Grünzeug in die Kästen
  composter: [
    {
      points: [
        [0.75, 0.75],
        [0.2, 0.35],
        [-0.55, 0.35],
      ],
      carryOut: 'basket',
      cycle: 9,
    },
  ],
  // stapelt Kisten vor dem Lager
  storage: [
    {
      points: [
        [0.3, 1.08],
        [0.9, 1.15],
      ],
      carryOut: 'crate',
      cycle: 6,
    },
  ],
};

/** Kleiner Arbeiter: Blick nach +z, Unterkante auf y = 0. */
function worker(kind: WorkerKind): BufferGeometry {
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, c: number) =>
    colored(new BoxGeometry(w, h, d).translate(x, y + h / 2, z), c);
  const parts = [
    box(0.07, 0.14, 0.07, -0.045, 0, 0, PALETTE.workerPants),
    box(0.07, 0.14, 0.07, 0.045, 0, 0, PALETTE.workerPants),
    box(0.17, 0.16, 0.1, 0, 0.14, 0, PALETTE.workerShirt),
    colored(new SphereGeometry(0.065, 6, 4).translate(0, 0.37, 0), PALETTE.skin),
    colored(new CylinderGeometry(0.05, 0.09, 0.05, 6).translate(0, 0.43, 0), PALETTE.hat),
  ];
  if (kind === 'log') {
    // Holzstamm auf der Schulter
    parts.push(
      colored(
        new CylinderGeometry(0.045, 0.045, 0.34, 6).rotateZ(Math.PI / 2).translate(0, 0.33, -0.04),
        PALETTE.trunk,
      ),
    );
  } else if (kind === 'axe') {
    // Axt in der rechten Hand
    parts.push(box(0.025, 0.24, 0.025, 0.11, 0.12, 0.05, PALETTE.woodDark));
    parts.push(box(0.025, 0.06, 0.08, 0.11, 0.32, 0.08, PALETTE.metal));
  } else if (kind === 'crate') {
    // Kiste vor dem Bauch
    parts.push(box(0.16, 0.12, 0.12, 0, 0.18, 0.1, PALETTE.wood));
    parts.push(box(0.17, 0.02, 0.13, 0, 0.25, 0.1, PALETTE.woodDark));
  } else if (kind === 'can') {
    // Gießkanne in der rechten Hand
    parts.push(
      colored(
        new CylinderGeometry(0.045, 0.05, 0.09, 7).translate(0.12, 0.1, 0.04),
        PALETTE.patina,
      ),
    );
    parts.push(box(0.02, 0.02, 0.09, 0.12, 0.13, 0.11, PALETTE.patina));
  } else if (kind === 'basket') {
    // Erntekorb mit Äpfeln vor dem Bauch
    parts.push(
      colored(new CylinderGeometry(0.09, 0.07, 0.09, 8).translate(0, 0.2, 0.1), PALETTE.strawDark),
    );
    parts.push(box(0.12, 0.03, 0.1, 0, 0.25, 0.1, PALETTE.apple));
  } else if (kind === 'plank') {
    // Bretter auf der Schulter
    parts.push(box(0.05, 0.03, 0.4, 0.07, 0.33, 0, PALETTE.itemPlank));
    parts.push(box(0.05, 0.03, 0.38, 0.07, 0.36, 0.01, PALETTE.wood));
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
  private readonly sliders = new Map<string, FrameInstances>();
  private readonly figures = new Map<WorkerKind, FrameInstances>();
  private phase = new Float32Array(256);
  private last = -1;
  /** Arbeitende Maschinen im Bild (für leise Arbeitsgeräusche). */
  workingInView = 0;
  /** Anteil der Partikel aus der Grafikstufe (0..1). */
  particles = 1;
  private readonly sparks: FrameInstances;

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
    this.sparks = new FrameInstances(
      merge([colored(new BoxGeometry(0.035, 0.035, 0.035), PALETTE.glow)]),
      material,
      this.group,
    );
    for (const kind of WORKER_KINDS)
      this.figures.set(kind, new FrameInstances(worker(kind), material, this.group));
    for (const [model, def] of Object.entries(SLIDERS))
      this.sliders.set(model, new FrameInstances(def.make(), material, this.group));
  }

  private allCache: FrameInstances[] | null = null;
  private all(): FrameInstances[] {
    return (this.allCache ??= [
      ...this.spinners.values(),
      ...this.sliders.values(),
      ...this.figures.values(),
      this.smoke,
      this.sparks,
    ]);
  }

  update(sim: Simulation, now: number, view: ViewRect, show: boolean): void {
    const dt = this.last < 0 ? 0 : Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const t = now / 1000;
    const parts = this.all();
    for (const p of parts) p.begin();
    this.workingInView = 0;
    if (show) {
      if (this.phase.length < sim.buildings.capacity) {
        const next = new Float32Array(sim.buildings.capacity);
        next.set(this.phase);
        this.phase = next;
      }
      const ms = sim.machines;
      for (const list of ms.lists) {
        for (let k = 0; k < list.length; k++) this.animate(sim, list[k], t, dt, view);
      }
      // Depots: Träger laufen, solange in letzter Zeit etwas ankam
      for (let k = 0; k < ms.depots.length; k++) {
        const id = ms.depots[k];
        if (!this.inView(sim, id, view)) continue;
        const b = sim.buildings;
        buildingMatrix(b.type[id], b.x[id], b.y[id], b.rot[id], mB);
        this.routes(BUILDINGS[b.type[id]].model, id, t, sim.tick - ms.lastDelivery[id] < 200);
      }
      // Lager: Arbeiter stapeln, solange etwas darin liegt
      const lg = sim.logistics;
      for (let k = 0; k < lg.storages.length; k++) {
        const id = lg.storages[k];
        if (!this.inView(sim, id, view)) continue;
        const b = sim.buildings;
        buildingMatrix(b.type[id], b.x[id], b.y[id], b.rot[id], mB);
        this.routes(BUILDINGS[b.type[id]].model, id, t, lg.qCount[id] > 0);
      }
    }
    for (const p of parts) p.end();
  }

  private inView(sim: Simulation, id: number, view: ViewRect): boolean {
    const x = sim.buildings.x[id];
    const y = sim.buildings.y[id];
    return x >= view.minX - 3 && x <= view.maxX + 1 && y >= view.minY - 3 && y <= view.maxY + 1;
  }

  /** Lore: fährt bei der Arbeit aus dem Stollen und zurück. */
  private slide(model: string, t: number, working: boolean, seed: number): void {
    const def = SLIDERS[model];
    if (!def) return;
    let u = 1;
    if (working) {
      const p = (t / def.period + seed) % 1;
      // hin, kurz stehen, zurück, kurz stehen
      u = p < 0.4 ? smooth(p / 0.4) : p < 0.5 ? 1 : p < 0.9 ? 1 - smooth((p - 0.5) / 0.4) : 0;
    }
    pos.set(
      def.from[0] + (def.to[0] - def.from[0]) * u,
      def.from[1] + (def.to[1] - def.from[1]) * u,
      def.from[2] + (def.to[2] - def.from[2]) * u,
    );
    mT.makeTranslation(pos.x, pos.y, pos.z);
    this.sliders.get(model)!.push(m.multiplyMatrices(mB, mT));
  }

  /** Arbeiter auf ihren Wegen am Gebäude (`mB` muss gesetzt sein). */
  private routes(model: string, id: number, t: number, working: boolean): void {
    const list = ROUTES[model];
    if (!list) return;
    const seed = hash3Float(id, 9, 23);
    for (const r of list) {
      const pts = r.points;
      const p = (t / r.cycle + (r.offset ?? 0) + seed) % 1;
      let kind: WorkerKind = 'plain';
      let along: number; // 0 = Start, 1 = Ziel
      let forward = true;
      let tilt = 0;
      let bob = 0;
      if (!working || p >= 0.85) {
        along = 0;
        forward = false;
      } else if (p < 0.3) {
        along = p / 0.3;
        kind = r.carryOut ?? 'plain';
        bob = Math.abs(Math.sin(t * 13)) * 0.03;
      } else if (p < 0.55) {
        along = 1;
        tilt = Math.max(0, Math.sin(t * 8)) * 0.4;
      } else {
        along = 1 - (p - 0.55) / 0.3;
        forward = false;
        kind = r.carryBack ?? 'plain';
        bob = Math.abs(Math.sin(t * 13)) * 0.03;
      }
      // Position auf dem Streckenzug (gleichmäßig je Teilstück)
      const segs = pts.length - 1;
      const f = Math.min(segs - 1e-6, along * segs);
      const i = Math.floor(f);
      const u = f - i;
      const ax = pts[i][0];
      const az = pts[i][1];
      const bx = pts[i + 1][0];
      const bz = pts[i + 1][1];
      v.set(ax + (bx - ax) * u, 0, az + (bz - az) * u).applyMatrix4(mB);
      const px = v.x;
      const pz = v.z;
      // Blickrichtung entlang des Teilstücks (Weltkoordinaten)
      const a = pos.set(ax, 0, az).applyMatrix4(mB);
      const ax2 = a.x;
      const az2 = a.z;
      const bw = pos.set(bx, 0, bz).applyMatrix4(mB);
      let yaw = Math.atan2(bw.x - ax2, bw.z - az2);
      if (!forward) yaw += Math.PI;
      pos.set(px, bob, pz);
      q.setFromAxisAngle(UP, yaw);
      if (tilt > 0) q.multiply(q2.setFromAxisAngle(AXES.x, tilt));
      scl.set(WORKER_SCALE, WORKER_SCALE, WORKER_SCALE);
      this.figures.get(kind)!.push(m.compose(pos, q, scl));
    }
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
    // Gärten klappern nicht (Arbeitsgeräusche nur für Maschinen)
    if (working && def.behavior.kind !== 'garden') this.workingInView++;
    buildingMatrix(type, x, y, b.rot[id], mB);

    // Drehende Teile: dauerhaft sichtbar, drehen nur bei der Arbeit (Windrad je nach Wind)
    const spin = SPINNERS[def.model];
    if (spin) {
      let speed = working ? 1 : 0;
      if (def.behavior.kind === 'wind')
        speed = (sim.power.wind / POWER.scale) * (working ? 1 : 0.4);
      // Das Wasser fließt immer: das Rad dreht sich auch ohne Bedarf, nur langsamer
      else if (def.behavior.kind === 'water') speed = working ? 1 : 0.5;
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
      const puffs = Math.max(2, Math.round(SMOKE_PUFFS * this.particles));
      for (let k = 0; k < puffs; k++) {
        const life = (t / SMOKE_LIFE + k / puffs + seed) % 1;
        v.set(chimney[0], chimney[1], chimney[2]).applyMatrix4(mB);
        pos.set(v.x + life * 0.35, v.y + life * 1.5, v.z + life * 0.12);
        const s = (0.5 + life * 1.3) * (1 - life * life * life * life);
        scl.set(s, s, s);
        q.setFromAxisAngle(UP, life * 3 + seed * 6);
        this.smoke.push(m.compose(pos, q, scl));
      }
    }

    // Funken an der glühenden Öffnung des Schmelzofens
    if (def.model === 'furnace' && working && this.particles > 0.5) {
      const seed = hash3Float(id, 4, 19);
      for (let k = 0; k < 4; k++) {
        const life = (t / 0.9 + k / 4 + seed) % 1;
        const side = hash3Float(id, k, 7) - 0.5;
        v.set(
          -0.1 + side * 0.4 + life * side * 0.3,
          0.45 + life * 0.7,
          0.78 + life * 0.25,
        ).applyMatrix4(mB);
        const s = 1 - life;
        scl.set(s, s, s);
        q.setFromAxisAngle(UP, life * 9);
        this.sparks.push(m.compose(v, q, scl));
      }
    }

    const seed = hash3Float(id, 1, 31);
    this.slide(def.model, t, working, seed);
    this.routes(def.model, id, t, working);
    if (def.behavior.kind === 'lumberjack') this.animateWorkers(sim, id, t, working);
  }

  /** Holzfäller: laufen zu einem Baum, fällen, tragen den Stamm zur Hütte. */
  private animateWorkers(sim: Simulation, id: number, t: number, working: boolean): void {
    const ms = sim.machines;
    const list = ms.treeLists[id];
    const size = sim.world.size;
    // Tür der Hütte (vorne links, gedreht mit dem Gebäude)
    // Start- und Wartepunkt rechts vorne – der Ausgang liegt links vorne, dort liegt das Band
    const home = v.set(0.7, 0, 1.2).applyMatrix4(mB);
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
        // Pause neben der Hütte (nicht auf dem Band vor dem Ausgang)
        v.set(1.25, 0, 0.6 - w * 0.45).applyMatrix4(mB);
        pos.set(v.x, 0, v.z);
        q.setFromAxisAngle(UP, (-sim.buildings.rot[id] * Math.PI) / 2);
        scl.set(WORKER_SCALE, WORKER_SCALE, WORKER_SCALE);
        this.figures.get('axe')!.push(m.compose(pos, q, scl));
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
      this.figures.get(carry ? 'log' : 'axe')!.push(m.compose(pos, q, scl));
    }
  }

  dispose(): void {
    for (const p of this.all()) p.dispose();
  }
}

function smooth(x: number): number {
  return x * x * (3 - 2 * x);
}
