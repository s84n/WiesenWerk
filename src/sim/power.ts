import { POWER } from '../data/balance';
import { BUILDINGS } from '../data/buildings';
import { SIM_CONFIG } from '../data/config';
import { ITEMS } from '../data/items';
import { footprintH, footprintW, type BuildingStore } from './buildings';
import { MachineState, type MachineSystem } from './machines';
import type { World } from './world';

const SCALE = POWER.scale;
const HISTORY = POWER.historySeconds;

/**
 * Stromnetze. Masten in Reichweite bilden ein Netz; Gebäude, deren Grundfläche den
 * Versorgungsbereich eines Mastes berührt, gehören dazu. Die Zugehörigkeit wird nur bei
 * Bauänderungen neu berechnet (`markDirty`). Pro Tick und Netz: eine Summe und ein Faktor.
 *
 * Alle Leistungen in Watt als ganze Zahlen, Faktoren in Tausendsteln (1000 = 100 %).
 */
export class PowerSystem {
  private dirty = true;
  /** Erhöht sich bei jedem Neuaufbau (für die Darstellung der Kabel). */
  version = 0;
  /** Netz je Gebäude-ID (−1 = keins). */
  gridOf = new Int32Array(0);
  /** Netz je Feld im Versorgungsbereich (−1 = keins). */
  readonly coverage: Int32Array;
  /** Kabel als Paare von Mast-IDs. */
  cables: number[] = [];

  // je Netz
  gridCount = 0;
  consumers: number[][] = [];
  burners: number[][] = [];
  poles: number[][] = [];
  capacity: number[] = [];
  demand: number[] = [];
  production: number[] = [];
  factor: number[] = [];
  /** Verlauf je Netz: Erzeugung und Verbrauch in W, eine Probe pro Sekunde (Ringpuffer). */
  history: Float64Array[] = [];
  historyPos = 0;

  constructor(
    private readonly world: World,
    private readonly store: BuildingStore,
    private readonly machines: MachineSystem,
  ) {
    this.coverage = new Int32Array(world.size * world.size).fill(-1);
  }

  markDirty(): void {
    this.dirty = true;
  }

  /** Netze neu berechnen, falls sich etwas geändert hat. */
  ensure(): void {
    if (this.dirty) this.rebuild();
  }

  /** Tempo-Faktor (0..1000) für ein Gebäude. */
  factorOf(id: number): number {
    const g = this.gridOf[id];
    return g < 0 ? 0 : this.factor[g];
  }

  /** Netz mit der größten möglichen Erzeugung (für die Kopfzeile) oder −1. */
  largestGrid(): number {
    this.ensure();
    let best = -1;
    for (let g = 0; g < this.gridCount; g++) {
      if (
        best < 0 ||
        this.capacity[g] > this.capacity[best] ||
        (this.capacity[g] === this.capacity[best] &&
          this.consumers[g].length > this.consumers[best].length)
      )
        best = g;
    }
    return best;
  }

  tick(tick: number): void {
    this.ensure();
    const m = this.machines;
    const store = this.store;
    const perTickDiv = SIM_CONFIG.ticksPerSecond;
    for (let g = 0; g < this.gridCount; g++) {
      // Brenner: ggf. nächsten Brennstoff anzünden, mögliche Erzeugung summieren
      const bs = this.burners[g];
      let cap = 0;
      for (let k = 0; k < bs.length; k++) {
        const id = bs[k];
        if (m.fuelEnergy[id] <= 0 && m.inBuf[id * 2] > 0) {
          m.inBuf[id * 2]--;
          m.fuelEnergy[id] += ITEMS[m.fuelItem[id]].fuelValue * 1000;
        }
        if (m.fuelEnergy[id] > 0) cap += burnerWatts(store.type[id]);
      }

      // Verbrauch: arbeitende Maschinen voll, andere 10 %
      const cs = this.consumers[g];
      let dem = 0;
      for (let k = 0; k < cs.length; k++) {
        const id = cs[k];
        const w = BUILDINGS[store.type[id]].power * 1000;
        dem += m.drawFull[id] ? w : Math.round(w * POWER.idleShare);
      }

      const factor = dem === 0 ? SCALE : Math.min(SCALE, Math.floor((cap * SCALE) / dem));
      const load = cap === 0 ? 0 : Math.min(SCALE, Math.ceil((dem * SCALE) / cap));
      this.capacity[g] = cap;
      this.demand[g] = dem;
      this.production[g] = Math.min(cap, dem);
      this.factor[g] = factor;

      // Brenner verbrauchen nur so viel, wie das Netz abruft
      for (let k = 0; k < bs.length; k++) {
        const id = bs[k];
        if (m.fuelEnergy[id] > 0) {
          const use = Math.floor((burnerWatts(store.type[id]) * load) / SCALE / perTickDiv);
          m.fuelEnergy[id] = Math.max(0, m.fuelEnergy[id] - use);
          m.setState(id, load > 0 ? MachineState.Working : MachineState.Idle);
        } else {
          m.setState(id, m.inBuf[id * 2] > 0 ? MachineState.Idle : MachineState.WaitingInput);
        }
        m.utilization[id] +=
          ((m.fuelEnergy[id] > 0 ? load / SCALE : 0) - m.utilization[id]) * 0.005;
      }
    }

    // Brenner ohne Netz
    for (let n = 0; n < m.burners.length; n++) {
      const id = m.burners[n];
      if (this.gridOf[id] < 0) m.setState(id, MachineState.NoPower);
    }

    // Verlauf: eine Probe pro Sekunde
    if (tick % SIM_CONFIG.ticksPerSecond === 0) {
      this.historyPos = (this.historyPos + 1) % HISTORY;
      for (let g = 0; g < this.gridCount; g++) {
        this.history[g][this.historyPos * 2] = this.production[g];
        this.history[g][this.historyPos * 2 + 1] = this.demand[g];
      }
    }
  }

  private rebuild(): void {
    this.dirty = false;
    this.version++;
    const store = this.store;
    if (this.gridOf.length < store.capacity) {
      const next = new Int32Array(store.capacity);
      this.gridOf = next;
    }
    this.gridOf.fill(-1);
    this.coverage.fill(-1);
    this.cables = [];

    // Masten sammeln
    const poles: number[] = [];
    for (let id = 0; id < store.highWater; id++) {
      if (store.alive[id] && BUILDINGS[store.type[id]].behavior.kind === 'pole') poles.push(id);
    }

    // Union-Find über Masten in Reichweite (Eimer-Raster beschleunigt die Suche)
    const parent = poles.map((_, i) => i);
    const find = (i: number): number => {
      while (parent[i] !== i) i = parent[i] = parent[parent[i]];
      return i;
    };
    const CELL = 8;
    const buckets = new Map<number, number[]>();
    const key = (cx: number, cy: number): number => cy * 4096 + cx;
    poles.forEach((id, i) => {
      const k = key(Math.floor(store.x[id] / CELL), Math.floor(store.y[id] / CELL));
      let b = buckets.get(k);
      if (!b) buckets.set(k, (b = []));
      b.push(i);
    });
    let maxRange = 0;
    for (const id of poles) maxRange = Math.max(maxRange, poleRange(store.type[id]));
    const reach = Math.ceil(maxRange / CELL);
    poles.forEach((id, i) => {
      const cx = Math.floor(store.x[id] / CELL);
      const cy = Math.floor(store.y[id] / CELL);
      for (let dy = -reach; dy <= reach; dy++) {
        for (let dx = -reach; dx <= reach; dx++) {
          const b = buckets.get(key(cx + dx, cy + dy));
          if (!b) continue;
          for (const j of b) {
            if (j <= i) continue;
            const other = poles[j];
            const range = Math.max(poleRange(store.type[id]), poleRange(store.type[other]));
            const ddx = store.x[id] - store.x[other];
            const ddy = store.y[id] - store.y[other];
            if (ddx * ddx + ddy * ddy > range * range) continue;
            const a = find(i);
            const c = find(j);
            if (a !== c) {
              parent[Math.max(a, c)] = Math.min(a, c);
              this.cables.push(id, other); // nur Verbindungen, die Netze zusammenführen
            }
          }
        }
      }
    });

    // Netz-IDs in Reihenfolge der Masten vergeben
    const gridOfRoot = new Map<number, number>();
    this.gridCount = 0;
    poles.forEach((id, i) => {
      const r = find(i);
      let g = gridOfRoot.get(r);
      if (g === undefined) gridOfRoot.set(r, (g = this.gridCount++));
      this.gridOf[id] = g;
    });
    this.consumers = Array.from({ length: this.gridCount }, () => []);
    this.burners = Array.from({ length: this.gridCount }, () => []);
    this.poles = Array.from({ length: this.gridCount }, () => []);
    for (const arr of [this.capacity, this.demand, this.production, this.factor])
      arr.length = this.gridCount;
    this.capacity.fill(0);
    this.demand.fill(0);
    this.production.fill(0);
    this.factor.fill(SCALE);
    this.history = Array.from({ length: this.gridCount }, () => new Float64Array(HISTORY * 2));
    for (const id of poles) this.poles[this.gridOf[id]].push(id);

    // Versorgungsbereiche
    const size = this.world.size;
    for (const id of poles) {
      const b = BUILDINGS[store.type[id]].behavior;
      const r = b.kind === 'pole' ? b.supplyRadius : 0;
      const g = this.gridOf[id];
      for (let y = store.y[id] - r; y <= store.y[id] + r; y++) {
        for (let x = store.x[id] - r; x <= store.x[id] + r; x++) {
          if (x < 0 || y < 0 || x >= size || y >= size) continue;
          const t = y * size + x;
          if (this.coverage[t] < 0) this.coverage[t] = g;
        }
      }
    }

    // Verbraucher und Brenner zuordnen
    for (let id = 0; id < store.highWater; id++) {
      if (!store.alive[id]) continue;
      const def = BUILDINGS[store.type[id]];
      const isBurner = def.behavior.kind === 'burner';
      if (def.power <= 0 && !isBurner) continue;
      const g = this.gridAtFootprint(id);
      this.gridOf[id] = g;
      if (g < 0) continue;
      (isBurner ? this.burners : this.consumers)[g].push(id);
    }
  }

  private gridAtFootprint(id: number): number {
    const s = this.store;
    const def = BUILDINGS[s.type[id]];
    const size = this.world.size;
    for (let y = s.y[id]; y < s.y[id] + footprintH(def, s.rot[id]); y++) {
      for (let x = s.x[id]; x < s.x[id] + footprintW(def, s.rot[id]); x++) {
        const g = this.coverage[y * size + x];
        if (g >= 0) return g;
      }
    }
    return -1;
  }
}

function burnerWatts(type: number): number {
  const b = BUILDINGS[type].behavior;
  return b.kind === 'burner' ? b.powerKW * 1000 : 0;
}

function poleRange(type: number): number {
  const b = BUILDINGS[type].behavior;
  return b.kind === 'pole' ? b.connectRange : 0;
}
