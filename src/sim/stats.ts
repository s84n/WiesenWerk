import { STATS } from '../data/balance';
import { SIM_CONFIG } from '../data/config';
import { ITEM_COUNT } from '../data/items';
import type { Inventory } from './inventory';

const WINDOW = STATS.windowSeconds;

/**
 * Statistik: Produktion, Verbrauch und Anlieferung je Item, gemittelt über die letzte Minute
 * (Eimer je Sekunde, Ringpuffer), dazu Gesamtzahlen. Nur die Gesamtzahlen werden gespeichert.
 */
export class StatsSystem {
  /** Je Sekunde und Item: [Sekunde * ITEM_COUNT + Item]. */
  readonly produced = new Int32Array(WINDOW * ITEM_COUNT);
  readonly consumed = new Int32Array(WINDOW * ITEM_COUNT);
  readonly delivered = new Int32Array(WINDOW * ITEM_COUNT);
  /** Zu- und Abfluss des Vorrats (aus `Inventory.flowIn/flowOut`, je Sekunde abgeholt). */
  readonly stockIn = new Int32Array(WINDOW * ITEM_COUNT);
  readonly stockOut = new Int32Array(WINDOW * ITEM_COUNT);
  /** Gesamt seit Spielbeginn. */
  readonly totalProduced = new Float64Array(ITEM_COUNT);
  readonly harvested = new Float64Array(ITEM_COUNT);
  buildingsBuilt = 0;
  /** Wie viele Sekunden der Ringpuffer schon gefüllt ist (höchstens WINDOW). */
  filled = 1;
  private slot = 0;

  produce(item: number, amount: number): void {
    this.produced[this.slot * ITEM_COUNT + item] += amount;
    this.totalProduced[item] += amount;
  }

  consume(item: number, amount: number): void {
    this.consumed[this.slot * ITEM_COUNT + item] += amount;
  }

  deliver(item: number): void {
    this.delivered[this.slot * ITEM_COUNT + item]++;
  }

  harvest(item: number, amount: number): void {
    this.harvested[item] += amount;
    this.produce(item, amount);
  }

  /**
   * Nach jedem Tick: beim Sekundenwechsel den Vorrats-Fluss der vergangenen Sekunde in ihren
   * Eimer schreiben und den nächsten Eimer leeren.
   */
  tick(tick: number, inventory?: Inventory): void {
    if (tick % SIM_CONFIG.ticksPerSecond !== 0) return;
    if (inventory) {
      const o = this.slot * ITEM_COUNT;
      for (let i = 0; i < ITEM_COUNT; i++) {
        this.stockIn[o + i] = inventory.flowIn[i];
        this.stockOut[o + i] = inventory.flowOut[i];
      }
      inventory.flowIn.fill(0);
      inventory.flowOut.fill(0);
    }
    this.slot = (this.slot + 1) % WINDOW;
    const o = this.slot * ITEM_COUNT;
    this.produced.fill(0, o, o + ITEM_COUNT);
    this.consumed.fill(0, o, o + ITEM_COUNT);
    this.delivered.fill(0, o, o + ITEM_COUNT);
    this.stockIn.fill(0, o, o + ITEM_COUNT);
    this.stockOut.fill(0, o, o + ITEM_COUNT);
    if (this.filled < WINDOW) this.filled++;
  }

  /** Menge pro Minute aus einem der Eimer-Arrays. */
  perMinute(buckets: Int32Array, item: number): number {
    let sum = 0;
    for (let s = 0; s < WINDOW; s++) sum += buckets[s * ITEM_COUNT + item];
    return (sum * 60) / this.filled;
  }
}
