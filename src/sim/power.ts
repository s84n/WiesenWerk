import { EXTRACTOR_UPGRADE, POWER, WIND } from '../data/balance';
import { BUILDINGS, FREE_GENERATOR_KINDS } from '../data/buildings';
import { SIM_CONFIG } from '../data/config';
import { ITEMS } from '../data/items';
import { footprintH, footprintW, type BuildingStore } from './buildings';
import { MachineState, type MachineSystem } from './machines';
import type { ResearchSystem } from './research';
import { sunlightAt } from './daylight';
import { hash3Float } from './rng';
import type { StatsSystem } from './stats';
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
  winds: number[][] = [];
  poles: number[][] = [];
  capacity: number[] = [];
  demand: number[] = [];
  production: number[] = [];
  factor: number[] = [];
  /** Verlauf je Netz: Erzeugung und Verbrauch in W, eine Probe pro Sekunde (Ringpuffer). */
  history: Float64Array[] = [];
  historyPos = 0;
  /** Aktuelle Windstärke in Tausendsteln der Nennleistung (für alle Windräder gleich). */
  wind: number = SCALE;
  /** Aktuelle Sonnenstärke in Tausendsteln (für alle Solarfelder gleich). */
  sun: number = SCALE;
  /** Tag-Nacht-Wechsel an (sonst fester Nachmittag, Befehl `setDayCycle`). */
  dayCycle = true;
  /** Akkus je Netz. */
  batteries: number[][] = [];
  /** Was die Brenner im letzten Tick noch decken mussten (W), je Netz. */
  fuelNeed: number[] = [];
  /** Akku: Lade- (+) bzw. Entladeleistung (−) im letzten Tick in W, je Gebäude-ID. */
  flow = new Int32Array(0);

  constructor(
    private readonly world: World,
    private readonly store: BuildingStore,
    private readonly machines: MachineSystem,
  ) {
    this.coverage = new Int32Array(world.size * world.size).fill(-1);
  }

  setResearch(research: ResearchSystem, stats: StatsSystem): void {
    this.research = research;
    this.stats = stats;
  }
  private research!: ResearchSystem;
  private stats!: StatsSystem;

  markDirty(): void {
    this.dirty = true;
  }

  /** Netze neu berechnen, falls sich etwas geändert hat. */
  ensure(): void {
    if (this.dirty) this.rebuild();
  }

  /**
   * Bauvorschau: IDs aller Masten, mit denen sich ein Mast vom Typ `type` an (x, y) verbinden
   * würde (gleiche Regel wie beim Aufbau der Netze). Schreibt in `out` und gibt es zurück.
   */
  linksFor(type: number, x: number, y: number, rot: number, out: number[]): number[] {
    out.length = 0;
    this.ensure();
    const def = BUILDINGS[type];
    const own = poleRange(type);
    if (own <= 0) return out;
    const cx = 2 * x + footprintW(def, rot);
    const cy = 2 * y + footprintH(def, rot);
    for (const list of this.poles) {
      for (const id of list) {
        const range = 2 * Math.max(own, poleRange(this.store.type[id]));
        const ddx = cx - this.center2(id, true);
        const ddy = cy - this.center2(id, false);
        if (ddx * ddx + ddy * ddy <= range * range) out.push(id);
      }
    }
    return out;
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

  /**
   * Windstärke zum Tick: sanfter Übergang zwischen zufälligen Stärken (aus dem Seed, daher
   * bei jedem Laden gleich). Ganzzahlig in Tausendsteln.
   */
  windAt(tick: number): number {
    const period = WIND.periodSeconds * SIM_CONFIG.ticksPerSecond;
    const k = Math.floor(tick / period);
    const t = (tick - k * period) / period;
    const a = hash3Float(k, 7, this.world.seed);
    const b = hash3Float(k + 1, 7, this.world.seed);
    const smooth = t * t * (3 - 2 * t);
    const v = a + (b - a) * smooth;
    return Math.round(SCALE * (WIND.min + (WIND.max - WIND.min) * v));
  }

  tick(tick: number): void {
    this.ensure();
    const m = this.machines;
    const store = this.store;
    const tps = SIM_CONFIG.ticksPerSecond;
    this.wind = this.windAt(tick);
    this.sun = sunlightAt(tick, this.dayCycle);
    const use = this.research.powerUse;
    for (let g = 0; g < this.gridCount; g++) {
      // Brenner: ggf. nächsten Brennstoff anzünden, mögliche Erzeugung summieren
      const bs = this.burners[g];
      let fuelCap = 0;
      for (let k = 0; k < bs.length; k++) {
        const id = bs[k];
        // einmal pro Sekunde aus dem Vorrat nachfüllen (wenn eingeschaltet), aber nur, wenn
        // Wind, Wasser, Sonne und Akkus im letzten Tick nicht reichten
        if (m.autoRefill[id] && this.fuelNeed[g] > 0 && tick % tps === 0)
          m.autoRefuel(id, burnerBuffer(store.type[id]));
        if (m.fuelEnergy[id] <= 0 && m.inBuf[id * 2] > 0) {
          m.inBuf[id * 2]--;
          m.fuelEnergy[id] += ITEMS[m.fuelItem[id]].fuelValue * 1000;
          this.stats.consume(m.fuelItem[id], 1);
        }
        if (m.fuelEnergy[id] > 0) fuelCap += burnerWatts(store.type[id]);
      }
      // Wind, Wasser, Sonne: kostenlos, werden zuerst genutzt
      const ws = this.winds[g];
      let free = 0;
      for (let k = 0; k < ws.length; k++) free += this.freeWatts(ws[k]);

      // Verbrauch: arbeitende Maschinen voll, andere 10 %
      const cs = this.consumers[g];
      let dem = 0;
      for (let k = 0; k < cs.length; k++) {
        const id = cs[k];
        let w = Math.floor((BUILDINGS[store.type[id]].power * 1000 * use) / SCALE);
        if (m.upgraded[id]) w *= EXTRACTOR_UPGRADE.powerFactor;
        dem += m.drawFull[id] ? w : Math.round(w * POWER.idleShare);
      }

      // Akkus: Überschuss der freien Erzeuger laden, bei Mangel abgeben
      const as = this.batteries[g];
      let batteryOut = 0;
      let batteryCap = 0;
      const spare = Math.max(0, free - dem);
      let surplus = spare;
      let need = Math.max(0, dem - free);
      for (let k = 0; k < as.length; k++) {
        const id = as[k];
        const b = BUILDINGS[store.type[id]].behavior;
        if (b.kind !== 'battery') continue;
        const rate = b.rateKW * 1000;
        const maxJ = b.capacityKJ * 1000;
        const canGive = Math.min(rate, m.fuelEnergy[id] * tps);
        batteryCap += canGive;
        let flow = 0;
        if (surplus > 0) {
          const take = Math.min(rate, surplus, (maxJ - m.fuelEnergy[id]) * tps);
          surplus -= take;
          flow = take;
          m.fuelEnergy[id] += Math.floor(take / tps);
        } else if (need > 0) {
          const give = Math.min(canGive, need);
          need -= give;
          batteryOut += give;
          flow = -give;
          m.fuelEnergy[id] = Math.max(0, m.fuelEnergy[id] - Math.ceil(give / tps));
        }
        this.flow[id] = flow;
        m.setState(id, flow !== 0 ? MachineState.Working : MachineState.Idle);
        m.utilization[id] = maxJ > 0 ? m.fuelEnergy[id] / maxJ : 0;
      }

      // Brenner decken den Rest
      const cap = free + batteryCap + fuelCap;
      const factor = dem === 0 ? SCALE : Math.min(SCALE, Math.floor((cap * SCALE) / dem));
      const load = fuelCap === 0 ? 0 : Math.min(SCALE, Math.ceil((need * SCALE) / fuelCap));
      this.fuelNeed[g] = Math.max(0, dem - free - batteryOut);
      this.capacity[g] = cap;
      this.demand[g] = dem;
      this.production[g] = Math.min(cap, dem);
      this.factor[g] = factor;

      // Brenner verbrauchen nur so viel, wie das Netz abruft
      for (let k = 0; k < bs.length; k++) {
        const id = bs[k];
        if (m.fuelEnergy[id] > 0) {
          const burn = Math.floor((burnerWatts(store.type[id]) * load) / SCALE / tps);
          m.fuelEnergy[id] = Math.max(0, m.fuelEnergy[id] - burn);
          m.setState(id, load > 0 ? MachineState.Working : MachineState.Idle);
        } else {
          m.setState(id, m.inBuf[id * 2] > 0 ? MachineState.Idle : MachineState.WaitingInput);
        }
        m.utilization[id] +=
          ((m.fuelEnergy[id] > 0 ? load / SCALE : 0) - m.utilization[id]) * 0.005;
      }
      // Freie Erzeuger: Auslastung = genutzter Anteil (Verbrauch + Laden)
      const used = free === 0 ? 0 : Math.min(1, (Math.min(dem, free) + spare - surplus) / free);
      for (let k = 0; k < ws.length; k++) {
        const id = ws[k];
        const producing = this.freeWatts(id) > 0;
        m.setState(
          id,
          !producing
            ? MachineState.WaitingInput
            : used > 0
              ? MachineState.Working
              : MachineState.Idle,
        );
        m.utilization[id] += ((producing ? used : 0) - m.utilization[id]) * 0.005;
      }
    }

    // Erzeuger und Akkus ohne Netz
    this.markUnconnected(m.burners);
    this.markUnconnected(m.winds);
    this.markUnconnected(m.batteries);

    // Verlauf: eine Probe pro Sekunde
    if (tick % tps === 0) {
      this.historyPos = (this.historyPos + 1) % HISTORY;
      for (let g = 0; g < this.gridCount; g++) {
        this.history[g][this.historyPos * 2] = this.production[g];
        this.history[g][this.historyPos * 2 + 1] = this.demand[g];
      }
    }
  }

  private markUnconnected(list: readonly number[]): void {
    for (let n = 0; n < list.length; n++) {
      const id = list[n];
      if (this.gridOf[id] < 0) this.machines.setState(id, MachineState.NoPower);
    }
  }

  /** Leistung eines Wind-, Wasser- oder Solar-Erzeugers in diesem Tick (W). */
  freeWatts(id: number): number {
    const b = BUILDINGS[this.store.type[id]].behavior;
    if (b.kind === 'wind') return Math.floor((b.powerKW * 1000 * this.wind) / SCALE);
    if (b.kind === 'solar') return Math.floor((b.powerKW * 1000 * this.sun) / SCALE);
    if (b.kind === 'water') return b.powerKW * 1000;
    return 0;
  }

  /** Gespeicherte Energie eines Akkus in J und seine Größe. */
  batteryCharge(id: number): { stored: number; capacity: number } {
    const b = BUILDINGS[this.store.type[id]].behavior;
    return {
      stored: this.machines.fuelEnergy[id],
      capacity: b.kind === 'battery' ? b.capacityKJ * 1000 : 0,
    };
  }

  private rebuild(): void {
    this.dirty = false;
    this.version++;
    const store = this.store;
    if (this.gridOf.length < store.capacity) {
      this.gridOf = new Int32Array(store.capacity);
      this.flow = new Int32Array(store.capacity);
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
            // Abstand der Mittelpunkte (doppelte Koordinaten, damit 2 × 2-Masten ganzzahlig bleiben)
            const range = 2 * Math.max(poleRange(store.type[id]), poleRange(store.type[other]));
            const ddx = this.center2(id, true) - this.center2(other, true);
            const ddy = this.center2(id, false) - this.center2(other, false);
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
    this.winds = Array.from({ length: this.gridCount }, () => []);
    this.batteries = Array.from({ length: this.gridCount }, () => []);
    this.poles = Array.from({ length: this.gridCount }, () => []);
    for (const arr of [this.capacity, this.demand, this.production, this.factor, this.fuelNeed])
      arr.length = this.gridCount;
    this.fuelNeed.fill(0);
    this.capacity.fill(0);
    this.demand.fill(0);
    this.production.fill(0);
    this.factor.fill(SCALE);
    this.history = Array.from({ length: this.gridCount }, () => new Float64Array(HISTORY * 2));
    for (const id of poles) this.poles[this.gridOf[id]].push(id);

    // Versorgungsbereiche
    const size = this.world.size;
    for (const id of poles) {
      const def = BUILDINGS[store.type[id]];
      const b = def.behavior;
      const r = b.kind === 'pole' ? b.supplyRadius : 0;
      const g = this.gridOf[id];
      const x1 = store.x[id] + footprintW(def, store.rot[id]) - 1 + r;
      const y1 = store.y[id] + footprintH(def, store.rot[id]) - 1 + r;
      for (let y = store.y[id] - r; y <= y1; y++) {
        for (let x = store.x[id] - r; x <= x1; x++) {
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
      const kind = def.behavior.kind;
      const free = FREE_GENERATOR_KINDS.includes(kind);
      if (def.power <= 0 && kind !== 'burner' && kind !== 'battery' && !free) continue;
      const g = this.gridAtFootprint(id);
      this.gridOf[id] = g;
      if (g < 0) continue;
      const list =
        kind === 'burner'
          ? this.burners
          : kind === 'battery'
            ? this.batteries
            : free
              ? this.winds
              : this.consumers;
      list[g].push(id);
    }
  }

  /** Doppelte Mittelpunkt-Koordinate eines Gebäudes (x oder y). */
  private center2(id: number, xAxis: boolean): number {
    const s = this.store;
    const def = BUILDINGS[s.type[id]];
    return xAxis
      ? 2 * s.x[id] + footprintW(def, s.rot[id])
      : 2 * s.y[id] + footprintH(def, s.rot[id]);
  }

  /** Erzeuger im Netz (Brenner, Wind, Wasser, Sonne, Akkus). */
  generatorCount(g: number): number {
    return this.burners[g].length + this.winds[g].length + this.batteries[g].length;
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

function burnerBuffer(type: number): number {
  const b = BUILDINGS[type].behavior;
  return b.kind === 'burner' ? b.fuelBuffer : 0;
}

function poleRange(type: number): number {
  const b = BUILDINGS[type].behavior;
  return b.kind === 'pole' ? b.connectRange : 0;
}
