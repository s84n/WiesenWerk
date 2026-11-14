import { START_INVENTORY, HAND_MINING, TREES } from '../data/balance';
import { BUILDINGS, BUILDING_COSTS } from '../data/buildings';
import { ITEM_ID, toAmounts } from '../data/items';
import { DEPOSITS, TileType } from '../data/world';
import { BeltSystem } from './belts';
import { BuildingStore, footprintH, footprintW } from './buildings';
import type { BeltStep, Command } from './commands';
import type { SimEvent } from './events';
import { GoalSystem } from './goals';
import { Inventory } from './inventory';
import { LogisticsSystem } from './logistics';
import { MachineSystem } from './machines';
import { PowerSystem } from './power';
import { PlaceResult, checkPlacement } from './placement';
import { ResearchSystem } from './research';
import { StatsSystem } from './stats';
import { TreeSystem } from './trees';
import type { World } from './world';

/**
 * Der Spielzustand. Kennt weder three.js noch den Browser.
 * Änderungen nur über Befehle (`enqueue`).
 */
export class Simulation {
  /** Anzahl der seit Spielbeginn simulierten Ticks. */
  tick = 0;
  readonly inventory = new Inventory();
  readonly buildings = new BuildingStore();
  readonly trees: TreeSystem;
  readonly machines: MachineSystem;
  readonly belts: BeltSystem;
  readonly power: PowerSystem;
  readonly logistics: LogisticsSystem;
  readonly research: ResearchSystem;
  readonly stats = new StatsSystem();
  readonly goals = new GoalSystem();
  /** Anzahl lebender Gebäude je Typ. */
  readonly typeCount = new Int32Array(BUILDINGS.length);
  /** Ereignisse seit dem letzten Abholen. */
  readonly events: SimEvent[] = [];
  private readonly pending: Command[] = [];

  constructor(readonly world: World) {
    this.trees = new TreeSystem(world);
    this.machines = new MachineSystem(
      world,
      this.buildings,
      this.inventory,
      this.trees,
      this.onRegrow,
    );
    this.logistics = new LogisticsSystem(world, this.buildings);
    this.belts = new BeltSystem(world, this.buildings, this.deliver);
    this.machines.setBelts(this.belts);
    this.logistics.setBelts(this.belts);
    this.power = new PowerSystem(world, this.buildings, this.machines);
    this.machines.setPower(this.power);
    this.research = new ResearchSystem(this.inventory);
    this.machines.setResearch(this.research, this.stats);
    this.power.setResearch(this.research, this.stats);
    this.inventory.refund(toAmounts(START_INVENTORY));
  }

  get buildingCount(): number {
    return this.buildings.count;
  }
  get segmentCount(): number {
    return this.belts.segmentCount;
  }
  get itemCount(): number {
    return this.belts.itemCount;
  }

  isBelt(id: number): boolean {
    return BUILDINGS[this.buildings.type[id]].behavior.kind === 'belt';
  }

  enqueue(command: Command): void {
    this.pending.push(command);
  }

  /** Wendet alle wartenden Befehle an. Läuft vor jedem Tick und zusätzlich einmal pro Bild (auch in der Pause). */
  flushCommands(): void {
    for (let i = 0; i < this.pending.length; i++) this.apply(this.pending[i]);
    this.pending.length = 0;
  }

  /**
   * Ein Simulationsschritt. Reihenfolge: Befehle → Strom → Abbau und Maschinen → Logistik
   * (Verteiler, Lager …) → Bänder → Bäume → Statistik und Aufgaben.
   */
  step(): void {
    this.flushCommands();
    this.tick++;
    this.power.tick(this.tick);
    this.machines.update(this.tick);
    this.logistics.update();
    this.belts.tick();
    this.trees.update(this.tick, this.onRegrow);
    this.stats.tick(this.tick);
    this.goals.update(this, this.tick, this.onGoal);
  }

  /** Übergabe vom Band an ein Gebäude (je nach Art an Maschinen oder Logistik). */
  private readonly deliver = (id: number, item: number, port: number): boolean => {
    const kind = BUILDINGS[this.buildings.type[id]].behavior.kind;
    if (LogisticsSystem.handles(kind)) return this.logistics.accept(id, item, port);
    return this.machines.accept(id, item);
  };

  private readonly onGoal = (goal: number): void => {
    this.events.push({ type: 'goalCompleted', goal });
  };

  clearEvents(): void {
    this.events.length = 0;
  }

  /** Gebäude-ID auf einem Feld oder −1. */
  buildingAt(x: number, y: number): number {
    if (!this.world.inBounds(x, y)) return -1;
    return this.world.building[this.world.index(x, y)] - 1;
  }

  /** Kann auf diesem Feld von Hand abgebaut werden? */
  isHarvestable(x: number, y: number): boolean {
    if (!this.world.inBounds(x, y)) return false;
    const i = this.world.index(x, y);
    if (this.world.building[i] !== 0) return false;
    const t = this.world.tiles[i];
    return t === TileType.Deposit || (t === TileType.Forest && this.trees.hasTree(i));
  }

  /** Meldet ein geändertes Baumfeld an die Darstellung. */
  private readonly onRegrow = (tile: number): void => {
    this.events.push({ type: 'treeChanged', tile });
  };

  private apply(cmd: Command): void {
    switch (cmd.type) {
      case 'build':
        this.build(cmd.building, cmd.x, cmd.y, cmd.rot);
        break;
      case 'demolish': {
        const id = this.buildingAt(cmd.x, cmd.y);
        if (id >= 0) this.demolish(id);
        break;
      }
      case 'demolishArea':
        this.demolishArea(cmd.x0, cmd.y0, cmd.x1, cmd.y1);
        break;
      case 'harvest':
        this.harvest(cmd.x, cmd.y);
        break;
      case 'buildLine':
        this.buildLine(cmd.building, cmd.path);
        break;
      case 'setRecipe':
        if (this.buildings.alive[cmd.building]) this.machines.setRecipe(cmd.building, cmd.recipe);
        break;
      case 'refuel':
        this.refuel(cmd.building, cmd.item);
        break;
      case 'research':
        if (this.research.research(cmd.node))
          this.events.push({ type: 'researched', node: cmd.node });
        break;
      case 'buyUpgrade':
        if (this.research.upgrade(cmd.upgrade))
          this.events.push({ type: 'upgraded', upgrade: cmd.upgrade });
        break;
      case 'upgradeBuilding':
        if (this.buildings.alive[cmd.building] && this.machines.upgrade(cmd.building)) {
          this.power.markDirty();
          this.events.push({ type: 'buildingUpgraded', id: cmd.building });
        }
        break;
      case 'setGoalsHidden':
        this.goals.setHidden(cmd.hidden);
        break;
    }
  }

  private refuel(id: number, item: number): void {
    if (!this.buildings.alive[id]) return;
    const b = BUILDINGS[this.buildings.type[id]].behavior;
    if (b.kind !== 'burner') return;
    const n = this.machines.addFuel(id, item, this.inventory.get(item), b.fuelBuffer);
    if (n > 0) this.inventory.pay([{ item, amount: n }]);
  }

  /**
   * Baut Felder entlang eines Weges (Bänder, Wege, Zäune). Vorhandene Bänder werden gedreht
   * und – bei anderer Bandstufe – ersetzt (Aufwerten durch Überbauen).
   */
  private buildLine(type: number, path: readonly BeltStep[]): void {
    const def = BUILDINGS[type];
    if (!def?.line) return;
    const isBelt = def.behavior.kind === 'belt';
    let failed = -1;
    for (const step of path) {
      const id = this.buildingAt(step.x, step.y);
      if (id >= 0 && isBelt && this.isBelt(id)) {
        const tile = this.world.index(step.x, step.y);
        const rot = step.dir & 3;
        if (this.buildings.type[id] !== type) {
          const r = this.replaceBelt(id, type, rot);
          if (r !== PlaceResult.Ok && (failed < 0 || r === PlaceResult.Cost)) failed = r;
        } else if (this.buildings.rot[id] !== rot) {
          // Vorhandenes Band: nur drehen
          this.buildings.rot[id] = rot;
          this.belts.beltChanged(tile);
          this.events.push({ type: 'buildingRotated', id });
        }
        continue;
      }
      if (id >= 0 && this.buildings.type[id] === type) continue;
      const result = checkPlacement(this, type, step.x, step.y, step.dir);
      if (result === PlaceResult.Ok) this.build(type, step.x, step.y, step.dir);
      else if (failed < 0 || result === PlaceResult.Cost) failed = result;
    }
    // Nur bei fehlendem Material melden; blockierte Felder werden still übersprungen.
    if (failed === PlaceResult.Cost)
      this.events.push({ type: 'commandFailed', reason: failed, buildingType: type });
  }

  /** Ersetzt ein Bandfeld durch eine andere Bandstufe; Items bleiben liegen. */
  private replaceBelt(id: number, type: number, rot: number): PlaceResult {
    if (!this.research.buildingUnlocked[type]) return PlaceResult.Locked;
    const old = this.buildings.type[id];
    this.inventory.refund(BUILDING_COSTS[old]);
    if (!this.inventory.canAfford(BUILDING_COSTS[type])) {
      this.inventory.pay(BUILDING_COSTS[old]);
      return PlaceResult.Cost;
    }
    this.inventory.pay(BUILDING_COSTS[type]);
    this.buildings.type[id] = type;
    this.buildings.rot[id] = rot;
    this.typeCount[old]--;
    this.typeCount[type]++;
    this.belts.beltChanged(this.world.index(this.buildings.x[id], this.buildings.y[id]));
    this.events.push({ type: 'buildingReplaced', id, oldType: old });
    return PlaceResult.Ok;
  }

  private build(type: number, x: number, y: number, rot: number): void {
    rot &= 3;
    const result = checkPlacement(this, type, x, y, rot);
    if (result !== PlaceResult.Ok) {
      this.events.push({ type: 'commandFailed', reason: result, buildingType: type });
      return;
    }
    const def = BUILDINGS[type];
    this.inventory.pay(BUILDING_COSTS[type]);
    const id = this.buildings.add(type, x, y, rot);
    const { world } = this;
    const w = footprintW(def, rot);
    const h = footprintH(def, rot);
    for (let ty = y; ty < y + h; ty++) {
      for (let tx = x; tx < x + w; tx++) {
        const i = world.index(tx, ty);
        world.building[i] = id + 1;
        // Gefällter Wald wird beim Bebauen zu Wiese und wächst nicht mehr nach.
        if (world.tiles[i] === TileType.Forest) {
          world.tiles[i] = TileType.Meadow;
          world.changedTiles.add(i);
        }
      }
    }
    this.typeCount[type]++;
    this.stats.buildingsBuilt++;
    if (def.behavior.kind === 'belt') {
      this.belts.beltAdded(world.index(x, y));
    } else {
      this.machines.added(id);
      this.logistics.added(id);
      this.belts.buildingChanged();
      this.power.markDirty();
    }
    this.events.push({ type: 'buildingAdded', id });
  }

  private demolish(id: number): void {
    const b = this.buildings;
    if (!b.alive[id]) return;
    const type = b.type[id];
    const def = BUILDINGS[type];
    const x = b.x[id];
    const y = b.y[id];
    const rot = b.rot[id];
    const w = footprintW(def, rot);
    const h = footprintH(def, rot);
    if (def.behavior.kind !== 'belt') {
      this.inventory.refund(this.machines.removed(id));
      this.logistics.removed(id, (item, n) => this.inventory.add(item, n));
    }
    for (let ty = y; ty < y + h; ty++) {
      for (let tx = x; tx < x + w; tx++) this.world.building[this.world.index(tx, ty)] = 0;
    }
    if (def.behavior.kind === 'belt') {
      this.belts.beltRemoved(this.world.index(x, y), (item) => this.inventory.add(item, 1));
    } else {
      this.belts.buildingChanged();
      this.power.markDirty();
    }
    this.inventory.refund(BUILDING_COSTS[type]);
    b.remove(id);
    this.typeCount[type]--;
    this.events.push({ type: 'buildingRemoved', id, buildingType: type, x, y, rot });
  }

  private demolishArea(x0: number, y0: number, x1: number, y1: number): void {
    const minX = Math.max(0, Math.min(x0, x1));
    const maxX = Math.min(this.world.size - 1, Math.max(x0, x1));
    const minY = Math.max(0, Math.min(y0, y1));
    const maxY = Math.min(this.world.size - 1, Math.max(y0, y1));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const id = this.buildingAt(x, y);
        if (id >= 0) this.demolish(id);
      }
    }
  }

  private harvest(x: number, y: number): void {
    if (!this.isHarvestable(x, y)) return;
    const i = this.world.index(x, y);
    const amount = HAND_MINING.amountPerClick;
    if (this.world.tiles[i] === TileType.Forest) {
      const got = this.trees.take(i, amount, this.tick);
      const item = ITEM_ID[TREES.item];
      this.inventory.add(item, got);
      this.stats.harvest(item, got);
      this.events.push({ type: 'harvested', item, amount: got });
      if (!this.trees.hasTree(i)) this.events.push({ type: 'treeChanged', tile: i });
    } else {
      const item = ITEM_ID[DEPOSITS[this.world.resource[i] - 1].item];
      this.inventory.add(item, amount);
      this.stats.harvest(item, amount);
      this.events.push({ type: 'harvested', item, amount });
    }
  }
}
