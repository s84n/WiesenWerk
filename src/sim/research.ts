import { POWER } from '../data/balance';
import { BUILDINGS, BUILDING_ID } from '../data/buildings';
import { LANDMARK_STAGES } from '../data/landmark';
import { RECIPES } from '../data/recipes';
import {
  RESEARCH,
  RESEARCH_COSTS,
  RESEARCH_ID,
  UPGRADES,
  UPGRADE_ID,
  upgradeCost,
} from '../data/research';
import type { Inventory } from './inventory';

const SCALE = POWER.scale;

/**
 * Forschungsstand: erforschte Knoten, Stufen der Verbesserungen und was dadurch freigeschaltet ist.
 * Abgeleitete Werte (`buildingUnlocked`, Tempo-Faktoren) werden nach jeder Änderung neu berechnet.
 */
export class ResearchSystem {
  readonly done = new Uint8Array(RESEARCH.length);
  readonly levels = new Int32Array(UPGRADES.length);
  readonly buildingUnlocked = new Uint8Array(BUILDINGS.length);
  readonly recipeUnlocked = new Uint8Array(RECIPES.length);
  extractorUpgrade = false;
  crafterUpgrade = false;
  /** Stufe 3 für Abbau und Fertigung erforscht. */
  level3 = false;
  /** Tempo-Faktoren in Tausendsteln (1000 = 100 %). */
  crafterSpeed: number = SCALE;
  extractorSpeed: number = SCALE;
  /** Stromverbrauch in Tausendsteln. */
  powerUse: number = SCALE;
  /** Erhöht sich bei jeder Änderung (für die Oberfläche). */
  version = 0;
  doneCount = 0;
  /** Fertige Abschnitte des Uhrturms (ihre Belohnungen fließen in Freischaltungen und Tempo ein). */
  private landmarkStage = 0;

  constructor(private readonly inventory: Inventory) {
    this.recompute();
  }

  /** Sind alle Voraussetzungen erfüllt und ist der Knoten noch offen? */
  isAvailable(node: number): boolean {
    if (this.done[node]) return false;
    return RESEARCH[node].requires.every((k) => this.done[RESEARCH_ID[k]] === 1);
  }

  /** Erforscht einen Knoten, wenn möglich und bezahlbar. */
  research(node: number): boolean {
    if (node < 0 || node >= RESEARCH.length || !this.isAvailable(node)) return false;
    if (!this.inventory.canAfford(RESEARCH_COSTS[node])) return false;
    this.inventory.pay(RESEARCH_COSTS[node]);
    this.done[node] = 1;
    this.recompute();
    return true;
  }

  isUpgradeAvailable(upgrade: number): boolean {
    const u = UPGRADES[upgrade];
    return this.done[RESEARCH_ID[u.requires]] === 1 && this.levels[upgrade] < u.maxLevel;
  }

  /** Kauft die nächste Stufe einer Verbesserung. */
  upgrade(upgrade: number): boolean {
    if (upgrade < 0 || upgrade >= UPGRADES.length || !this.isUpgradeAvailable(upgrade))
      return false;
    const cost = upgradeCost(upgrade, this.levels[upgrade]);
    if (!this.inventory.canAfford(cost)) return false;
    this.inventory.pay(cost);
    this.levels[upgrade]++;
    this.recompute();
    return true;
  }

  /** Stand aus einem Spielstand übernehmen (Schlüssel der Knoten, Stufen je Verbesserung). */
  restore(done: readonly string[], levels: Readonly<Record<string, number>>): void {
    this.done.fill(0);
    for (const key of done) {
      const id = RESEARCH_ID[key];
      if (id !== undefined) this.done[id] = 1;
    }
    this.levels.fill(0);
    UPGRADES.forEach((u, i) => {
      const n = levels[u.key];
      if (typeof n === 'number' && n > 0) this.levels[i] = Math.min(u.maxLevel, Math.floor(n));
    });
    this.recompute();
  }

  /** Belohnungen der fertigen Uhrturm-Abschnitte übernehmen. */
  setLandmarkStage(stage: number): void {
    this.landmarkStage = stage;
    this.recompute();
  }

  doneKeys(): string[] {
    return RESEARCH.filter((_, i) => this.done[i]).map((r) => r.key);
  }

  levelMap(): Record<string, number> {
    const out: Record<string, number> = {};
    UPGRADES.forEach((u, i) => {
      if (this.levels[i] > 0) out[u.key] = this.levels[i];
    });
    return out;
  }

  private recompute(): void {
    BUILDINGS.forEach((b, i) => (this.buildingUnlocked[i] = b.availableFromStart ? 1 : 0));
    RECIPES.forEach((r, i) => (this.recipeUnlocked[i] = r.availableFromStart ? 1 : 0));
    this.extractorUpgrade = false;
    this.crafterUpgrade = false;
    this.level3 = false;
    this.doneCount = 0;
    RESEARCH.forEach((r, i) => {
      if (!this.done[i]) return;
      this.doneCount++;
      for (const key of r.buildings ?? []) this.buildingUnlocked[BUILDING_ID[key]] = 1;
      for (const key of r.recipes ?? []) {
        const id = RECIPES.findIndex((x) => x.key === key);
        if (id >= 0) this.recipeUnlocked[id] = 1;
      }
      if (r.extractorUpgrade) this.extractorUpgrade = true;
      if (r.crafterUpgrade) this.crafterUpgrade = true;
      if (r.level3) this.level3 = true;
    });
    let crafterBonus = 0;
    let extractorBonus = 0;
    for (let k = 0; k < Math.min(this.landmarkStage, LANDMARK_STAGES.length); k++) {
      const r = LANDMARK_STAGES[k].reward;
      for (const key of r.buildings ?? []) this.buildingUnlocked[BUILDING_ID[key]] = 1;
      crafterBonus += r.crafterSpeed ?? 0;
      extractorBonus += r.extractorSpeed ?? 0;
    }
    const level = (key: keyof typeof UPGRADE_ID): number => this.levels[UPGRADE_ID[key]];
    const per = (key: keyof typeof UPGRADE_ID): number => UPGRADES[UPGRADE_ID[key]].perLevel;
    this.crafterSpeed = Math.round(
      SCALE * (1 + per('machineSpeed') * level('machineSpeed') + crafterBonus),
    );
    this.extractorSpeed = Math.round(
      SCALE * (1 + per('extractionSpeed') * level('extractionSpeed') + extractorBonus),
    );
    this.powerUse = Math.round(SCALE * (1 - per('efficiency') * level('efficiency')));
    this.version++;
  }
}
