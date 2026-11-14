import { TREES } from '../data/balance';
import { SIM_CONFIG } from '../data/config';
import { TileType } from '../data/world';
import type { World } from './world';

/**
 * Zustand der Bäume: verbleibendes Holz pro Waldfeld und eine Warteschlange zum Nachwachsen.
 * Weil alle Bäume gleich lange brauchen, wachsen sie in der Reihenfolge nach, in der sie gefällt wurden.
 */
export class TreeSystem {
  /** Verbleibendes Holz pro Feld (0 = gefällt bzw. kein Baum). */
  readonly wood: Uint8Array;
  private readonly queueTile: Int32Array;
  private readonly queueTick: Float64Array;
  private head = 0;
  private tail = 0;
  private queued = 0;
  readonly regrowTicks: number;

  constructor(private readonly world: World) {
    const n = world.size * world.size;
    this.wood = new Uint8Array(n);
    this.queueTile = new Int32Array(n);
    this.queueTick = new Float64Array(n);
    this.regrowTicks = TREES.regrowSeconds * SIM_CONFIG.ticksPerSecond;
    for (let i = 0; i < n; i++)
      if (world.tiles[i] === TileType.Forest) this.wood[i] = TREES.woodPerTree;
  }

  hasTree(i: number): boolean {
    return this.wood[i] > 0;
  }

  /** Ein gefälltes Waldfeld ist baubar. */
  isFelled(i: number): boolean {
    return this.world.tiles[i] === TileType.Forest && this.wood[i] === 0;
  }

  /**
   * Nimmt Holz von einem Baum. Gibt die tatsächlich genommene Menge zurück und
   * meldet über `felled`, ob der Baum dabei gefällt wurde.
   */
  take(i: number, amount: number, tick: number): number {
    const have = this.wood[i];
    if (have === 0) return 0;
    const got = Math.min(have, amount);
    this.wood[i] = have - got;
    if (this.wood[i] === 0) this.enqueue(i, tick + this.regrowTicks);
    return got;
  }

  /** Lässt fällige Bäume nachwachsen. Ruft `onRegrow` für jedes nachgewachsene Feld auf. */
  update(tick: number, onRegrow: (i: number) => void): void {
    while (this.queued > 0 && this.queueTick[this.head] <= tick) {
      const i = this.queueTile[this.head];
      this.head = (this.head + 1) % this.queueTile.length;
      this.queued--;
      // Inzwischen bebaut (Feld ist dann keine Waldfläche mehr)? Dann bleibt es frei.
      if (this.world.tiles[i] === TileType.Forest && this.world.building[i] === 0) {
        this.wood[i] = TREES.woodPerTree;
        onRegrow(i);
      }
    }
  }

  private enqueue(i: number, due: number): void {
    this.queueTile[this.tail] = i;
    this.queueTick[this.tail] = due;
    this.tail = (this.tail + 1) % this.queueTile.length;
    this.queued++;
  }
}
