import { START_INVENTORY, HAND_MINING, TREES } from '../data/balance';
import { BUILDINGS, BUILDING_COSTS } from '../data/buildings';
import { ITEM_ID, toAmounts } from '../data/items';
import { DEPOSITS, TileType } from '../data/world';
import { BuildingStore, footprintH, footprintW } from './buildings';
import type { Command } from './commands';
import type { SimEvent } from './events';
import { Inventory } from './inventory';
import { PlaceResult, checkPlacement } from './placement';
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
  /** Anzahl lebender Gebäude je Typ. */
  readonly typeCount = new Int32Array(BUILDINGS.length);
  /** Ereignisse seit dem letzten Abholen. */
  readonly events: SimEvent[] = [];
  private readonly pending: Command[] = [];

  // Zähler für die Debug-Anzeige; werden in späteren Phasen befüllt.
  segmentCount = 0;
  itemCount = 0;

  constructor(readonly world: World) {
    this.trees = new TreeSystem(world);
    this.inventory.refund(toAmounts(START_INVENTORY));
  }

  get buildingCount(): number {
    return this.buildings.count;
  }

  enqueue(command: Command): void {
    this.pending.push(command);
  }

  /** Wendet alle wartenden Befehle an. Läuft vor jedem Tick und zusätzlich einmal pro Bild (auch in der Pause). */
  flushCommands(): void {
    for (let i = 0; i < this.pending.length; i++) this.apply(this.pending[i]);
    this.pending.length = 0;
  }

  step(): void {
    this.flushCommands();
    this.tick++;
    this.trees.update(this.tick, this.onRegrow);
  }

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
    }
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
        if (world.tiles[i] === TileType.Forest) world.tiles[i] = TileType.Meadow;
      }
    }
    this.typeCount[type]++;
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
    for (let ty = y; ty < y + h; ty++) {
      for (let tx = x; tx < x + w; tx++) this.world.building[this.world.index(tx, ty)] = 0;
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
      this.events.push({ type: 'harvested', item, amount: got });
      if (!this.trees.hasTree(i)) this.events.push({ type: 'treeChanged', tile: i });
    } else {
      const item = ITEM_ID[DEPOSITS[this.world.resource[i] - 1].item];
      this.inventory.add(item, amount);
      this.events.push({ type: 'harvested', item, amount });
    }
  }
}
