import {
  AUTO_REFILL,
  CRAFTER_UPGRADE,
  EXTRACTOR_UPGRADE,
  MACHINES,
  POWER,
  TREES,
} from '../data/balance';
import { BUILDINGS, type BuildingDef } from '../data/buildings';
import { SIM_CONFIG } from '../data/config';
import { ITEMS, ITEM_ID, toAmounts, type ItemAmount } from '../data/items';
import {
  MAX_RECIPE_INPUTS,
  MAX_RECIPE_OUTPUTS,
  RECIPES,
  RECIPE_INPUTS,
  RECIPE_OUTPUTS,
  RECIPE_TICKS,
} from '../data/recipes';
import { DEPOSITS, PURITY, TileType } from '../data/world';
import type { BeltSystem } from './belts';
import type { LandmarkSystem } from './landmark';
import type { PowerSystem } from './power';
import type { ResearchSystem } from './research';
import type { StatsSystem } from './stats';
import {
  DIR_X,
  DIR_Y,
  footprintH,
  footprintW,
  rotateDir,
  rotateOffset,
  type BuildingStore,
} from './buildings';
import type { Inventory } from './inventory';
import type { TreeSystem } from './trees';
import type { World } from './world';

/** Zustand einer Maschine (für Anzeige und Symbole). */
export const MachineState = {
  Idle: 0,
  Working: 1,
  WaitingInput: 2,
  OutputBlocked: 3,
  NoRecipe: 4,
  NoPower: 5,
} as const;
export type MachineState = (typeof MachineState)[keyof typeof MachineState];

const off = { x: 0, y: 0 };
const SCALE = POWER.scale;
const WOOD = ITEM_ID[TREES.item];
const UPGRADE_COST = toAmounts(EXTRACTOR_UPGRADE.cost);
const CRAFTER_UPGRADE_COST = toAmounts(CRAFTER_UPGRADE.cost);

/**
 * Alle produzierenden Gebäude: Abbau (Bergwerk, Holzfäller), Verarbeitung (Rezepte) und Zentrale.
 * Daten als typisierte Arrays, Index = Gebäude-ID. Pro Art eine Liste, die in einer Schleife läuft.
 */
/** Ergebnis von `cycleOf` (wird vom Aufrufer wiederverwendet, keine Speicherzuweisung). */
export interface CycleInfo {
  fraction: number;
  remainingTicks: number;
  ticksPerItem: number;
}

export class MachineSystem {
  private cap = 0;
  recipe = new Int16Array(0);
  progress = new Int32Array(0);
  state = new Uint8Array(0);
  stateSince = new Int32Array(0);
  utilization = new Float32Array(0);
  inBuf = new Int32Array(0);
  outBuf = new Int32Array(0);
  /** Bergwerk/Holzfäller: erzeugtes Item und Ticks pro Item. */
  extractItem = new Int16Array(0);
  extractTicks = new Int32Array(0);
  /** Ausgang: Bandfeld davor und Richtung (−1 = kein Ausgang). */
  outTile = new Int32Array(0);
  outDir = new Uint8Array(0);
  /** Holzfäller: Bäume in Reichweite und aktueller Baum. */
  readonly treeLists: (Int32Array | null)[] = [];
  treeCursor = new Int32Array(0);
  /** Brenner: Art des Brennstoffs im Puffer (Menge in `inBuf[id*2]`) und verbleibende Energie in J. */
  fuelItem = new Int16Array(0);
  fuelEnergy = new Int32Array(0);
  /** Hat im letzten Tick voll gearbeitet (zieht vollen Strom, sonst 10 %). */
  drawFull = new Uint8Array(0);
  /** Braucht Strom (1) oder läuft immer (0). */
  needsPower = new Uint8Array(0);
  /** Bergwerk/Holzfäller auf Stufe 2 aufgewertet (1) oder nicht (0). */
  upgraded = new Uint8Array(0);
  /** Zentrale/Depot: Tick der letzten Anlieferung (nur für die Darstellung, nicht gespeichert). */
  lastDelivery = new Int32Array(0);
  /** Brenner: holt sich Brennstoff selbst aus dem Vorrat (1) oder nicht (0). */
  autoRefill = new Uint8Array(0);

  readonly crafters: number[] = [];
  readonly extractors: number[] = [];
  readonly burners: number[] = [];
  /** Freie Erzeuger: Windräder, Wasserräder, Solarfelder (Reihenfolge egal, nicht gespeichert). */
  readonly winds: number[] = [];
  /** Akku-Häuser (Ladung in `fuelEnergy` in J; Reihenfolge egal, nicht gespeichert). */
  readonly batteries: number[] = [];
  /** Depots (für die Träger-Animation; Reihenfolge egal, nicht gespeichert). */
  readonly depots: number[] = [];
  /**
   * Ausgabestellen, immer nach ID sortiert: Bei knappem Vorrat entscheidet die Reihenfolge, wer
   * zuerst bekommt. So ist sie auch nach dem Laden gleich, ohne sie zu speichern.
   */
  readonly dispensers: number[] = [];
  /** Alle Listen zusammen (für Darstellung, ohne jedes Bild ein neues Array zu bauen). */
  readonly lists: readonly number[][] = [
    this.crafters,
    this.extractors,
    this.burners,
    this.winds,
    this.batteries,
    this.dispensers,
  ];
  /** Gelieferte Items je Typ (für Statistik und Tests). */
  delivered = 0;

  tick = 0;

  constructor(
    private readonly world: World,
    private readonly store: BuildingStore,
    private readonly inventory: Inventory,
    private readonly trees: TreeSystem,
    private readonly onTreeChanged: (tile: number) => void,
  ) {}

  setBelts(belts: BeltSystem): void {
    this.belts = belts;
  }
  setPower(power: PowerSystem): void {
    this.power = power;
  }
  setResearch(research: ResearchSystem, stats: StatsSystem): void {
    this.research = research;
    this.stats = stats;
  }
  setLandmark(landmark: LandmarkSystem): void {
    this.landmark = landmark;
  }
  private belts!: BeltSystem;
  private landmark!: LandmarkSystem;
  private power!: PowerSystem;
  private research!: ResearchSystem;
  private stats!: StatsSystem;

  /** Tempo (0..1000) einer Maschine nach Stromversorgung. */
  private speedOf(id: number): number {
    return this.needsPower[id] ? this.power.factorOf(id) : SCALE;
  }

  // ---------------------------------------------------------------- Lebenszyklus

  added(id: number): void {
    this.ensureCapacity(this.store.capacity);
    const def = BUILDINGS[this.store.type[id]];
    const b = def.behavior;
    this.recipe[id] = -1;
    this.progress[id] = 0;
    this.utilization[id] = 0;
    this.inBuf.fill(0, id * MAX_RECIPE_INPUTS, (id + 1) * MAX_RECIPE_INPUTS);
    this.outBuf.fill(0, id * MAX_RECIPE_OUTPUTS, (id + 1) * MAX_RECIPE_OUTPUTS);
    this.treeLists[id] = null;
    this.fuelItem[id] = -1;
    this.fuelEnergy[id] = 0;
    this.drawFull[id] = 0;
    this.upgraded[id] = 0;
    this.autoRefill[id] = b.kind === 'burner' ? 1 : 0;
    this.needsPower[id] = def.power > 0 ? 1 : 0;
    this.setupOutput(id, def);
    this.setState(id, MachineState.Idle);

    if (b.kind === 'crafter') {
      this.crafters.push(id);
      this.setState(id, MachineState.NoRecipe);
    } else if (b.kind === 'miner') {
      this.setupMiner(id, def, b.itemsPerMinute);
      this.extractors.push(id);
    } else if (b.kind === 'burner') {
      this.burners.push(id);
      this.setState(id, MachineState.WaitingInput);
    } else if (b.kind === 'wind' || b.kind === 'water' || b.kind === 'solar') {
      this.winds.push(id);
    } else if (b.kind === 'battery') {
      this.batteries.push(id);
    } else if (b.kind === 'depot' || b.kind === 'landmark') {
      this.depots.push(id);
      this.lastDelivery[id] = -1000;
    } else if (b.kind === 'dispenser') {
      this.extractTicks[id] = Math.round((60 * SIM_CONFIG.ticksPerSecond) / b.itemsPerMinute);
      let k = this.dispensers.length;
      while (k > 0 && this.dispensers[k - 1] > id) k--;
      this.dispensers.splice(k, 0, id);
      this.setState(id, MachineState.NoRecipe);
    } else if (b.kind === 'lumberjack') {
      this.extractItem[id] = WOOD;
      this.extractTicks[id] = Math.round((60 * SIM_CONFIG.ticksPerSecond) / b.itemsPerMinute);
      this.treeLists[id] = this.treesInRange(id, def, b.radius);
      this.treeCursor[id] = 0;
      this.extractors.push(id);
    }
  }

  /** Vor dem Abriss: gibt den Inhalt der Puffer zurück (wird erstattet). */
  removed(id: number): ItemAmount[] {
    const result: ItemAmount[] = [];
    const def = BUILDINGS[this.store.type[id]];
    const kind = def.behavior.kind;
    if (kind === 'crafter') {
      remove(this.crafters, id);
      const r = this.recipe[id];
      if (r >= 0) this.collectBuffers(id, r, result);
      if (this.upgraded[id]) for (const a of CRAFTER_UPGRADE_COST) result.push({ ...a });
    } else if (kind === 'wind' || kind === 'water' || kind === 'solar') {
      remove(this.winds, id);
    } else if (kind === 'battery') {
      remove(this.batteries, id);
    } else if (kind === 'depot' || kind === 'landmark') {
      remove(this.depots, id);
    } else if (kind === 'dispenser') {
      remove(this.dispensers, id);
      const n = this.outBuf[id * MAX_RECIPE_OUTPUTS];
      if (n > 0 && this.recipe[id] >= 0) result.push({ item: this.recipe[id], amount: n });
    } else if (kind === 'burner') {
      remove(this.burners, id);
      const n = this.inBuf[id * MAX_RECIPE_INPUTS];
      if (n > 0 && this.fuelItem[id] >= 0) result.push({ item: this.fuelItem[id], amount: n });
    } else if (kind === 'miner' || kind === 'lumberjack') {
      remove(this.extractors, id);
      const n = this.outBuf[id * MAX_RECIPE_OUTPUTS];
      if (n > 0) result.push({ item: this.extractItem[id], amount: n });
      // Abriss erstattet auch die Aufwertung
      if (this.upgraded[id]) for (const a of UPGRADE_COST) result.push({ ...a });
    }
    this.treeLists[id] = null;
    return result;
  }

  /** Kann dieses Gebäude auf Stufe 2 aufgewertet werden (ohne Kosten zu prüfen)? */
  canUpgrade(id: number): boolean {
    if (this.upgraded[id] !== 0) return false;
    const kind = BUILDINGS[this.store.type[id]].behavior.kind;
    if (kind === 'miner' || kind === 'lumberjack') return this.research.extractorUpgrade;
    if (kind === 'crafter') return this.research.crafterUpgrade;
    return false;
  }

  /** Kosten der Aufwertung auf Stufe 2 (Abbau bzw. Verarbeitung). */
  upgradeCost(id: number): readonly ItemAmount[] {
    return BUILDINGS[this.store.type[id]].behavior.kind === 'crafter'
      ? CRAFTER_UPGRADE_COST
      : UPGRADE_COST;
  }

  /** Wertet ein Gebäude auf Stufe 2 auf (doppeltes Tempo, doppelter Strom). */
  upgrade(id: number): boolean {
    if (!this.canUpgrade(id)) return false;
    const cost = this.upgradeCost(id);
    if (!this.inventory.canAfford(cost)) return false;
    this.inventory.pay(cost);
    this.upgraded[id] = 1;
    return true;
  }

  /** Abbau pro Minute (mit Stufe und Verbesserungen, bei vollem Strom). */
  extractPerMinute(id: number): number {
    if (this.extractItem[id] < 0) return 0;
    const boost = this.extractBoost(id);
    return (60 * SIM_CONFIG.ticksPerSecond * boost) / SCALE / this.extractTicks[id];
  }

  /**
   * Stand des aktuellen Durchlaufs für die Anzeige (reine Abfrage): Anteil 0..1, verbleibende
   * Ticks und Ticks je Teil beim aktuellen Tempo (Strom, Forschung, Stufe). Ohne Fortschritt
   * (kein Strom, kein Rezept) sind die Tick-Werte 0. Nur für Abbau und Verarbeitung.
   */
  cycleOf(id: number, out: CycleInfo): CycleInfo {
    out.fraction = 0;
    out.remainingTicks = 0;
    out.ticksPerItem = 0;
    const kind = BUILDINGS[this.store.type[id]].behavior.kind;
    let full: number;
    let speed: number;
    let done: number;
    if (kind === 'crafter') {
      const r = this.recipe[id];
      if (r < 0) return out;
      // Verarbeitung: Fortschritt 1 beim Start, fertig sobald er die Dauer × 1000 übersteigt,
      // also nach genau Dauer × 1000 / Tempo weiteren Ticks
      full = RECIPE_TICKS[r] * SCALE;
      speed = Math.floor((this.speedOf(id) * this.craftBoost(id)) / SCALE);
      done = Math.max(0, this.progress[id] - 1);
    } else if (kind === 'miner' || kind === 'lumberjack') {
      if (this.extractItem[id] < 0) return out;
      full = this.extractTicks[id] * SCALE;
      speed = Math.floor((this.speedOf(id) * this.extractBoost(id)) / SCALE);
      done = this.progress[id];
    } else {
      return out;
    }
    out.fraction = Math.min(1, done / full);
    if (speed > 0) {
      out.ticksPerItem = Math.ceil(full / speed);
      out.remainingTicks = Math.max(0, Math.ceil((full - done) / speed));
    }
    return out;
  }

  /** Tempo-Faktor (Tausendstel) für Verarbeitung aus Stufe, Verbesserung und Uhrturm. */
  private craftBoost(id: number): number {
    return this.upgraded[id]
      ? CRAFTER_UPGRADE.speedFactor * this.research.crafterSpeed
      : this.research.crafterSpeed;
  }

  /** Tempo-Faktor (Tausendstel) für Abbau aus Stufe und Verbesserung. */
  private extractBoost(id: number): number {
    const tier = this.upgraded[id] ? EXTRACTOR_UPGRADE.speedFactor : 1;
    return tier * this.research.extractorSpeed;
  }

  /** Wählt ein Rezept. Der bisherige Pufferinhalt geht in den Vorrat. */
  setRecipe(id: number, recipe: number): boolean {
    const def = BUILDINGS[this.store.type[id]];
    if (def.behavior.kind === 'dispenser') return this.setDispenserItem(id, recipe);
    if (def.behavior.kind !== 'crafter') return false;
    if (recipe >= 0 && RECIPES[recipe]?.machine !== def.behavior.machine) return false;
    if (recipe >= 0 && !this.research.recipeUnlocked[recipe]) return false;
    const old = this.recipe[id];
    if (old === recipe) return true;
    if (old >= 0) {
      const back: ItemAmount[] = [];
      this.collectBuffers(id, old, back);
      // laufender Durchlauf: Zutaten zurückgeben
      if (this.progress[id] > 0) for (const a of RECIPE_INPUTS[old]) back.push({ ...a });
      this.inventory.refund(back);
    }
    this.recipe[id] = recipe;
    this.progress[id] = 0;
    this.inBuf.fill(0, id * MAX_RECIPE_INPUTS, (id + 1) * MAX_RECIPE_INPUTS);
    this.outBuf.fill(0, id * MAX_RECIPE_OUTPUTS, (id + 1) * MAX_RECIPE_OUTPUTS);
    this.setState(id, recipe < 0 ? MachineState.NoRecipe : MachineState.WaitingInput);
    return true;
  }

  /** Ausgabestellen, die gerade `item` ausgeben (für Hinweise in der Oberfläche). */
  dispensersOf(item: number): number {
    let n = 0;
    for (const id of this.dispensers) if (this.recipe[id] === item) n++;
    return n;
  }

  /** Ausgabestelle: Item wählen (−1 = keins). Was schon bereitlag, geht zurück in den Vorrat. */
  private setDispenserItem(id: number, item: number): boolean {
    if (item < -1 || item >= ITEMS.length) return false;
    const old = this.recipe[id];
    if (old === item) return true;
    const slot = id * MAX_RECIPE_OUTPUTS;
    if (old >= 0 && this.outBuf[slot] > 0) this.inventory.add(old, this.outBuf[slot]);
    this.outBuf[slot] = 0;
    this.recipe[id] = item;
    this.progress[id] = 0;
    this.setState(id, item < 0 ? MachineState.NoRecipe : MachineState.WaitingInput);
    return true;
  }

  // ---------------------------------------------------------------- Übergabe vom Band

  /** Nimmt ein Item am Eingang an. Rückgabe: angenommen? */
  accept(id: number, item: number): boolean {
    const b = BUILDINGS[this.store.type[id]].behavior;
    if (b.kind === 'hq' || b.kind === 'depot' || b.kind === 'landmark') {
      // Uhrturm: Gebrauchtes zählt für den Bauabschnitt, alles andere geht in den Vorrat
      if (b.kind !== 'landmark' || !this.landmark.accept(item)) this.inventory.add(item, 1);
      this.delivered++;
      this.stats.deliver(item);
      this.lastDelivery[id] = this.tick;
      return true;
    }
    if (b.kind === 'burner') return this.addFuel(id, item, 1, b.fuelBuffer) === 1;
    if (b.kind !== 'crafter') return false;
    let r = this.recipe[id];
    if (r < 0) {
      // Noch kein Rezept: passt das Item zu genau einem freigeschalteten Rezept, wird es gewählt.
      r = this.autoRecipe(b.machine, item);
      if (r < 0) return false;
      this.setRecipe(id, r);
    }
    const inputs = RECIPE_INPUTS[r];
    for (let j = 0; j < inputs.length; j++) {
      if (inputs[j].item !== item) continue;
      const slot = id * MAX_RECIPE_INPUTS + j;
      if (this.inBuf[slot] >= inputs[j].amount * MACHINES.inputBufferCycles) return false;
      this.inBuf[slot]++;
      return true;
    }
    return false;
  }

  /**
   * Legt Brennstoff in einen Brenner. Gibt die angenommene Menge zurück.
   * Ein Brenner fasst immer nur eine Brennstoffart gleichzeitig.
   */
  addFuel(id: number, item: number, amount: number, limit: number): number {
    if (ITEMS[item].fuelValue <= 0) return 0;
    const slot = id * MAX_RECIPE_INPUTS;
    if (this.inBuf[slot] > 0 && this.fuelItem[id] !== item) return 0;
    const n = Math.max(0, Math.min(amount, limit - this.inBuf[slot]));
    if (n === 0) return 0;
    this.inBuf[slot] += n;
    this.fuelItem[id] = item;
    return n;
  }

  /**
   * Brenner füllt sich aus dem Vorrat nach, aber nur bis `AUTO_REFILL.keep` Items: zuerst die
   * Sorte, die schon darin liegt, sonst der erste vorrätige Brennstoff (Holz vor Holzkohle).
   * Wird nur aufgerufen, wenn das Netz Strom braucht.
   */
  autoRefuel(id: number, limit: number): void {
    const slot = id * MAX_RECIPE_INPUTS;
    const have = this.inBuf[slot];
    const keep = Math.min(limit, AUTO_REFILL.keep);
    if (have >= keep) return;
    let item = have > 0 ? this.fuelItem[id] : -1;
    if (item < 0) {
      for (let i = 0; i < ITEMS.length && item < 0; i++)
        if (ITEMS[i].fuelValue > 0 && this.inventory.get(i) > 0) item = i;
    }
    if (item < 0) return;
    const n = this.addFuel(id, item, Math.min(this.inventory.get(item), keep - have), limit);
    if (n > 0) this.inventory.pay([{ item, amount: n }]);
  }

  private autoRecipe(machine: string, item: number): number {
    let found = -1;
    for (let r = 0; r < RECIPES.length; r++) {
      if (RECIPES[r].machine !== machine || !this.research.recipeUnlocked[r]) continue;
      if (!RECIPE_INPUTS[r].some((a) => a.item === item)) continue;
      if (found >= 0) return -1; // mehrdeutig
      found = r;
    }
    return found;
  }

  // ---------------------------------------------------------------- Tick

  update(tick: number): void {
    this.tick = tick;
    const smooth = MACHINES.utilizationSmoothing;

    // Abbau
    for (let n = 0; n < this.extractors.length; n++) {
      const id = this.extractors[n];
      const slot = id * MAX_RECIPE_OUTPUTS;
      const power = this.speedOf(id);
      const speed = Math.floor((power * this.extractBoost(id)) / SCALE);
      const full = this.extractTicks[id] * SCALE;
      let working = false;
      if (this.outBuf[slot] >= MACHINES.extractorBuffer) {
        this.setState(id, MachineState.OutputBlocked);
      } else if (this.extractItem[id] < 0) {
        this.setState(id, MachineState.WaitingInput);
      } else if (power === 0) {
        this.setState(id, MachineState.NoPower);
      } else {
        this.progress[id] += speed;
        working = true;
        if (this.progress[id] >= full) {
          if (this.treeLists[id] === null || this.chopTree(id)) {
            this.outBuf[slot]++;
            this.stats.produce(this.extractItem[id], 1);
            this.progress[id] -= full;
            this.setState(id, MachineState.Working);
          } else {
            this.progress[id] = full;
            working = false;
            this.setState(id, MachineState.WaitingInput);
          }
        } else {
          this.setState(id, MachineState.Working);
        }
      }
      this.drawFull[id] = working ? 1 : 0;
      this.utilization[id] += ((working ? power / SCALE : 0) - this.utilization[id]) * smooth;
      this.pushOutput(id);
    }

    // Verarbeitung
    for (let n = 0; n < this.crafters.length; n++) {
      const id = this.crafters[n];
      const r = this.recipe[id];
      const power = this.speedOf(id);
      const speed = Math.floor((power * this.craftBoost(id)) / SCALE);
      let working = false;
      if (r < 0) {
        this.setState(id, MachineState.NoRecipe);
      } else if (this.progress[id] > 0) {
        // progress: 1 beim Start, dann + Tempo je Tick; fertig über Dauer × 1000
        const full = RECIPE_TICKS[r] * SCALE;
        if (this.progress[id] <= full) {
          if (power === 0) {
            this.setState(id, MachineState.NoPower);
          } else {
            this.progress[id] += speed;
            working = true;
            this.setState(id, MachineState.Working);
          }
        }
        if (this.progress[id] > full) {
          if (this.hasOutputSpace(id, r)) {
            const outs = RECIPE_OUTPUTS[r];
            for (let j = 0; j < outs.length; j++) {
              this.outBuf[id * MAX_RECIPE_OUTPUTS + j] += outs[j].amount;
              this.stats.produce(outs[j].item, outs[j].amount);
            }
            this.progress[id] = 0;
          } else {
            working = false;
            this.setState(id, MachineState.OutputBlocked);
          }
        }
      }
      if (r >= 0 && this.progress[id] === 0) {
        if (!this.hasOutputSpace(id, r)) {
          this.setState(id, MachineState.OutputBlocked);
        } else if (this.hasInputs(id, r)) {
          if (power === 0) {
            this.setState(id, MachineState.NoPower);
          } else {
            const ins = RECIPE_INPUTS[r];
            for (let j = 0; j < ins.length; j++) {
              this.inBuf[id * MAX_RECIPE_INPUTS + j] -= ins[j].amount;
              this.stats.consume(ins[j].item, ins[j].amount);
            }
            this.progress[id] = 1;
            working = true;
            this.setState(id, MachineState.Working);
          }
        } else if (!working) {
          this.setState(id, MachineState.WaitingInput);
        }
      }
      this.drawFull[id] = working ? 1 : 0;
      this.utilization[id] += ((working ? power / SCALE : 0) - this.utilization[id]) * smooth;
      this.pushOutput(id);
    }

    // Ausgabe aus dem Vorrat: alle `extractTicks` ein Item, solange Platz und Vorrat da sind
    for (let n = 0; n < this.dispensers.length; n++) {
      const id = this.dispensers[n];
      const item = this.recipe[id];
      const slot = id * MAX_RECIPE_OUTPUTS;
      let working = false;
      if (item < 0) {
        this.setState(id, MachineState.NoRecipe);
      } else if (this.outBuf[slot] >= MACHINES.dispenserBuffer) {
        this.setState(id, MachineState.OutputBlocked);
      } else {
        if (this.progress[id] < this.extractTicks[id]) this.progress[id]++;
        if (this.progress[id] >= this.extractTicks[id]) {
          if (this.inventory.get(item) > 0) {
            this.inventory.add(item, -1);
            this.outBuf[slot]++;
            this.progress[id] = 0;
            this.lastDelivery[id] = tick;
            working = true;
            this.setState(id, MachineState.Working);
          } else {
            this.setState(id, MachineState.WaitingInput);
          }
        } else if (this.state[id] !== MachineState.WaitingInput) {
          working = true;
          this.setState(id, MachineState.Working);
        }
      }
      this.utilization[id] += ((working ? 1 : 0) - this.utilization[id]) * smooth;
      if (this.outBuf[slot] > 0 && this.outTile[id] >= 0) {
        if (this.belts.insertFromBuilding(this.outTile[id], this.outDir[id], item))
          this.outBuf[slot]--;
      }
    }
  }

  private hasInputs(id: number, r: number): boolean {
    const ins = RECIPE_INPUTS[r];
    for (let j = 0; j < ins.length; j++)
      if (this.inBuf[id * MAX_RECIPE_INPUTS + j] < ins[j].amount) return false;
    return true;
  }

  private hasOutputSpace(id: number, r: number): boolean {
    const outs = RECIPE_OUTPUTS[r];
    for (let j = 0; j < outs.length; j++) {
      const limit = outs[j].amount * MACHINES.outputBufferCycles;
      if (this.outBuf[id * MAX_RECIPE_OUTPUTS + j] + outs[j].amount > limit) return false;
    }
    return true;
  }

  /** Legt höchstens ein Item pro Tick aus dem Ausgangspuffer auf das Band davor. */
  private pushOutput(id: number): void {
    const tile = this.outTile[id];
    if (tile < 0) return;
    const r = this.recipe[id];
    const slots = r >= 0 ? RECIPE_OUTPUTS[r].length : 1;
    for (let j = 0; j < slots; j++) {
      const slot = id * MAX_RECIPE_OUTPUTS + j;
      if (this.outBuf[slot] === 0) continue;
      const item = r >= 0 ? RECIPE_OUTPUTS[r][j].item : this.extractItem[id];
      if (!this.belts.insertFromBuilding(tile, this.outDir[id], item)) return;
      this.outBuf[slot]--;
      return;
    }
  }

  /** Nimmt 1 Holz von einem Baum in Reichweite. */
  private chopTree(id: number): boolean {
    const list = this.treeLists[id]!;
    if (list.length === 0) return false;
    for (let k = 0; k < list.length; k++) {
      const c = (this.treeCursor[id] + k) % list.length;
      const tile = list[c];
      if (this.world.tiles[tile] !== TileType.Forest || !this.trees.hasTree(tile)) continue;
      this.trees.take(tile, 1, this.tick);
      if (!this.trees.hasTree(tile)) {
        this.onTreeChanged(tile);
        this.treeCursor[id] = (c + 1) % list.length;
      } else {
        this.treeCursor[id] = c;
      }
      return true;
    }
    return false;
  }

  setState(id: number, s: MachineState): void {
    if (this.state[id] === s) return;
    this.state[id] = s;
    this.stateSince[id] = this.tick;
  }

  private collectBuffers(id: number, r: number, out: ItemAmount[]): void {
    RECIPE_INPUTS[r].forEach((a, j) => {
      const n = this.inBuf[id * MAX_RECIPE_INPUTS + j];
      if (n > 0) out.push({ item: a.item, amount: n });
    });
    RECIPE_OUTPUTS[r].forEach((a, j) => {
      const n = this.outBuf[id * MAX_RECIPE_OUTPUTS + j];
      if (n > 0) out.push({ item: a.item, amount: n });
    });
  }

  private setupOutput(id: number, def: BuildingDef): void {
    this.outTile[id] = -1;
    const rot = this.store.rot[id];
    for (const port of def.ports) {
      if (port.kind !== 'out') continue;
      rotateOffset(def, rot, port.x, port.y, off);
      const d = rotateDir(port.dir, rot);
      const x = this.store.x[id] + off.x + DIR_X[d];
      const y = this.store.y[id] + off.y + DIR_Y[d];
      this.outTile[id] = this.world.inBounds(x, y) ? this.world.index(x, y) : -1;
      this.outDir[id] = d;
      return;
    }
  }

  /** Bergwerk: Rohstoff mit den meisten Feldern darunter, beste Reinheit davon bestimmt das Tempo. */
  private setupMiner(id: number, def: BuildingDef, perMinute: number): void {
    const counts = new Map<number, { n: number; purity: number }>();
    const x0 = this.store.x[id];
    const y0 = this.store.y[id];
    const rot = this.store.rot[id];
    for (let y = y0; y < y0 + footprintH(def, rot); y++) {
      for (let x = x0; x < x0 + footprintW(def, rot); x++) {
        const i = this.world.index(x, y);
        const res = this.world.resource[i];
        if (res === 0) continue;
        const e = counts.get(res) ?? { n: 0, purity: 0 };
        e.n++;
        e.purity = Math.max(e.purity, this.world.purity[i]);
        counts.set(res, e);
      }
    }
    let best = 0;
    let bestN = 0;
    let purity = 0;
    for (const [res, e] of counts) {
      if (e.n > bestN || (e.n === bestN && res < best)) {
        best = res;
        bestN = e.n;
        purity = e.purity;
      }
    }
    if (best === 0) {
      this.extractItem[id] = -1;
      return;
    }
    this.extractItem[id] = ITEM_ID[DEPOSITS[best - 1].item];
    const rate = perMinute * PURITY[purity].factor;
    this.extractTicks[id] = Math.round((60 * SIM_CONFIG.ticksPerSecond) / rate);
  }

  /** Waldfelder im Umkreis des Holzfällers (quadratisch um die Grundfläche). */
  private treesInRange(id: number, def: BuildingDef, radius: number): Int32Array {
    const x0 = this.store.x[id];
    const y0 = this.store.y[id];
    const rot = this.store.rot[id];
    const list: number[] = [];
    for (let y = y0 - radius; y < y0 + footprintH(def, rot) + radius; y++) {
      for (let x = x0 - radius; x < x0 + footprintW(def, rot) + radius; x++) {
        if (!this.world.inBounds(x, y)) continue;
        const i = this.world.index(x, y);
        if (this.world.tiles[i] === TileType.Forest) list.push(i);
      }
    }
    return Int32Array.from(list);
  }

  private ensureCapacity(cap: number): void {
    if (cap <= this.cap) return;
    const grow = <T extends Int16Array | Int32Array | Uint8Array | Float32Array>(
      old: T,
      n: number,
    ): T => {
      const next = new (old.constructor as new (n: number) => T)(n);
      next.set(old);
      return next;
    };
    this.recipe = grow(this.recipe, cap);
    this.progress = grow(this.progress, cap);
    this.state = grow(this.state, cap);
    this.stateSince = grow(this.stateSince, cap);
    this.utilization = grow(this.utilization, cap);
    this.inBuf = grow(this.inBuf, cap * MAX_RECIPE_INPUTS);
    this.outBuf = grow(this.outBuf, cap * MAX_RECIPE_OUTPUTS);
    this.extractItem = grow(this.extractItem, cap);
    this.extractTicks = grow(this.extractTicks, cap);
    this.outTile = grow(this.outTile, cap);
    this.outDir = grow(this.outDir, cap);
    this.treeCursor = grow(this.treeCursor, cap);
    this.fuelItem = grow(this.fuelItem, cap);
    this.fuelEnergy = grow(this.fuelEnergy, cap);
    this.drawFull = grow(this.drawFull, cap);
    this.needsPower = grow(this.needsPower, cap);
    this.upgraded = grow(this.upgraded, cap);
    this.autoRefill = grow(this.autoRefill, cap);
    this.lastDelivery = grow(this.lastDelivery, cap);
    this.cap = cap;
  }
}

function remove(list: number[], id: number): void {
  const i = list.indexOf(id);
  if (i >= 0) {
    list[i] = list[list.length - 1];
    list.pop();
  }
}
