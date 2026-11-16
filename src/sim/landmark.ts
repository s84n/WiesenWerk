import { ITEMS, ITEM_COUNT, ITEM_ID } from '../data/items';
import { LANDMARK_NEEDS, LANDMARK_STAGES } from '../data/landmark';
import type { Inventory } from './inventory';
import type { ResearchSystem } from './research';
import type { StatsSystem } from './stats';

/**
 * Fortschritt am Uhrturm: wie viele Abschnitte fertig sind und was für den aktuellen schon
 * geliefert wurde. Gehört der Welt, nicht dem Gebäude (Abriss verliert nichts).
 */
export class LandmarkSystem {
  /** Fertige Abschnitte (= Index des aktuellen Abschnitts). */
  stage = 0;
  /** Schon gelieferte Menge je Item für den aktuellen Abschnitt. */
  readonly delivered = new Int32Array(ITEM_COUNT);
  /** Erhöht sich bei jeder Änderung (für die Oberfläche). */
  version = 0;

  constructor(
    private readonly inventory: Inventory,
    private readonly research: ResearchSystem,
    private readonly stats: StatsSystem,
    private readonly onStage: (stage: number) => void,
  ) {}

  get finished(): boolean {
    return this.stage >= LANDMARK_STAGES.length;
  }

  /** Wie viel von diesem Item der aktuelle Abschnitt noch braucht. */
  missing(item: number): number {
    if (this.finished) return 0;
    const needs = LANDMARK_NEEDS[this.stage];
    for (let k = 0; k < needs.length; k++) {
      if (needs[k].item === item) return Math.max(0, needs[k].amount - this.delivered[item]);
    }
    return 0;
  }

  /** Ein Item vom Band: wird es gebraucht, zählt es für den Abschnitt (Rückgabe true). */
  accept(item: number): boolean {
    if (this.missing(item) <= 0) return false;
    this.delivered[item]++;
    this.stats.consume(item, 1);
    this.version++;
    this.checkComplete();
    return true;
  }

  /** Steuert aus dem Vorrat bei, was der aktuelle Abschnitt noch braucht. Rückgabe: Anzahl Items. */
  contribute(): number {
    if (this.finished) return 0;
    const needs = LANDMARK_NEEDS[this.stage];
    let total = 0;
    for (let k = 0; k < needs.length; k++) {
      const item = needs[k].item;
      const n = Math.min(this.missing(item), this.inventory.get(item));
      if (n <= 0) continue;
      this.inventory.pay([{ item, amount: n }]);
      this.delivered[item] += n;
      this.stats.consume(item, n);
      total += n;
    }
    if (total > 0) {
      this.version++;
      this.checkComplete();
    }
    return total;
  }

  /** Stand aus einem Spielstand (Schlüssel der Items, damit sich IDs ändern dürfen). */
  restore(stage: number, delivered: Readonly<Record<string, number>>): void {
    this.stage = Math.max(0, Math.min(LANDMARK_STAGES.length, Math.floor(stage)));
    this.delivered.fill(0);
    for (const [key, n] of Object.entries(delivered)) {
      const id = ITEM_ID[key as keyof typeof ITEM_ID];
      if (id !== undefined && n > 0) this.delivered[id] = Math.floor(n);
    }
    this.research.setLandmarkStage(this.stage);
    this.version++;
  }

  deliveredMap(): Record<string, number> {
    const out: Record<string, number> = {};
    for (let i = 0; i < ITEM_COUNT; i++)
      if (this.delivered[i] > 0) out[ITEMS[i].key] = this.delivered[i];
    return out;
  }

  private checkComplete(): void {
    const needs = LANDMARK_NEEDS[this.stage];
    for (let k = 0; k < needs.length; k++)
      if (this.delivered[needs[k].item] < needs[k].amount) return;
    this.stage++;
    this.delivered.fill(0);
    this.research.setLandmarkStage(this.stage);
    this.version++;
    this.onStage(this.stage);
  }
}
