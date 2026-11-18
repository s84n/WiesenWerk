import { COZY, POWER } from '../data/balance';
import { BUILDINGS } from '../data/buildings';
import { footprintH, footprintW, type BuildingStore } from './buildings';
import type { World } from './world';

const SCALE = POWER.scale;

/**
 * Gemütlichkeit: Gärten und Dekoration (`cozy` in den Gebäudedaten) machen Maschinen in ihrer
 * Nähe schneller, Bienenstöcke lassen Gärten schneller wachsen. Alles wird aus den Gebäuden
 * abgeleitet (nicht gespeichert) und nur nach Bauänderungen neu berechnet (`markDirty`, faul
 * über `ensure`).
 */
export class CozySystem {
  /** Tempo-Bonus je Gebäude-ID in Tausendsteln (0 … `COZY.maxBonus`). */
  bonus = new Uint16Array(0);
  /** Wachstumstempo je Garten in Tausendsteln (1000 = normal, mit Bienen mehr). */
  growth = new Uint16Array(0);
  /** Bienenstock: Zahl der bestäubten Gärten (für den Honig). */
  hiveGardens = new Uint16Array(0);
  /** Summe der Gemütlichkeit je Feld (für Anzeigen, ungedeckelt). */
  readonly field: Uint16Array;
  /** Erhöht sich bei jeder Neuberechnung (für Anzeigen). */
  version = 0;
  private dirty = true;
  /** Markiert je Quelle bereits gezählte Gebäude (Wert = Nummer der Quelle + 1). */
  private stamp = new Int32Array(0);

  constructor(
    private readonly world: World,
    private readonly store: BuildingStore,
  ) {
    this.field = new Uint16Array(world.size * world.size);
  }

  markDirty(): void {
    this.dirty = true;
  }

  ensure(): void {
    if (!this.dirty) return;
    this.dirty = false;
    this.rebuild();
  }

  /** Bonus einer Maschine (Tausendstel), rechnet bei Bedarf neu. */
  bonusOf(id: number): number {
    this.ensure();
    return id < this.bonus.length ? this.bonus[id] : 0;
  }

  /** Bestäubte Gärten eines Bienenstocks, rechnet bei Bedarf neu. */
  gardensOf(id: number): number {
    this.ensure();
    return id < this.hiveGardens.length ? this.hiveGardens[id] : 0;
  }

  /** Wachstumstempo eines Gartens (Tausendstel), rechnet bei Bedarf neu. */
  growthOf(id: number): number {
    this.ensure();
    return id < this.growth.length && this.growth[id] > 0 ? this.growth[id] : SCALE;
  }

  private rebuild(): void {
    const s = this.store;
    const cap = s.capacity;
    if (this.bonus.length < cap) {
      this.bonus = new Uint16Array(cap);
      this.growth = new Uint16Array(cap);
      this.hiveGardens = new Uint16Array(cap);
      this.stamp = new Int32Array(cap);
    } else {
      this.bonus.fill(0);
      this.growth.fill(0);
      this.hiveGardens.fill(0);
      this.stamp.fill(0);
    }
    this.field.fill(0);
    const sum = new Int32Array(cap);
    const { world } = this;
    const size = world.size;
    let source = 0;
    for (let id = 0; id < s.highWater; id++) {
      if (!s.alive[id]) continue;
      const def = BUILDINGS[s.type[id]];
      const b = def.behavior;
      const cozy = def.cozy;
      const bees = b.kind === 'beehive' ? b : null;
      if (!cozy && !bees) continue;
      const w = footprintW(def, s.rot[id]);
      const h = footprintH(def, s.rot[id]);
      // Gemütlichkeit und Bienen können verschiedene Reichweiten haben: je eine Runde
      for (let pass = 0; pass < 2; pass++) {
        const r = pass === 0 ? (cozy?.radius ?? -1) : (bees?.radius ?? -1);
        if (r < 0) continue;
        source++;
        const x0 = Math.max(0, s.x[id] - r);
        const y0 = Math.max(0, s.y[id] - r);
        const x1 = Math.min(size - 1, s.x[id] + w - 1 + r);
        const y1 = Math.min(size - 1, s.y[id] + h - 1 + r);
        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) {
            const t = y * size + x;
            if (pass === 0) this.field[t] = Math.min(65535, this.field[t] + cozy!.value);
            const other = world.building[t] - 1;
            if (other < 0 || other === id || this.stamp[other] === source) continue;
            this.stamp[other] = source;
            const kind = BUILDINGS[s.type[other]].behavior.kind;
            if (pass === 0) {
              if (kind === 'crafter' || kind === 'miner' || kind === 'lumberjack')
                sum[other] += cozy!.value;
            } else if (kind === 'garden') {
              // Mehrere Bienenstöcke helfen nicht mehr als einer
              this.growth[other] = SCALE + bees!.growthBoost;
              this.hiveGardens[id]++;
            }
          }
        }
      }
    }
    for (let id = 0; id < cap; id++) this.bonus[id] = Math.min(COZY.maxBonus, sum[id]);
    this.version++;
  }
}
