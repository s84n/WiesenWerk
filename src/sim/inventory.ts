import { ITEM_COUNT, type ItemAmount } from '../data/items';

/**
 * Der globale Vorrat. Alles Gesammelte und Gelieferte landet hier; Baukosten werden hieraus bezahlt.
 */
export class Inventory {
  readonly amounts = new Int32Array(ITEM_COUNT);
  /** Wird bei jeder Änderung erhöht, damit die Oberfläche nur bei Bedarf neu zeichnet. */
  version = 0;
  /**
   * Zu- und Abfluss seit dem letzten Abholen durch die Statistik (je Item). Daraus entsteht die
   * Anzeige „+x / −y pro Minute“. Nicht gespeichert.
   */
  readonly flowIn = new Int32Array(ITEM_COUNT);
  readonly flowOut = new Int32Array(ITEM_COUNT);

  get(item: number): number {
    return this.amounts[item];
  }

  add(item: number, amount: number): void {
    this.amounts[item] += amount;
    if (amount > 0) this.flowIn[item] += amount;
    else this.flowOut[item] -= amount;
    this.version++;
  }

  canAfford(cost: readonly ItemAmount[]): boolean {
    for (let i = 0; i < cost.length; i++) {
      if (this.amounts[cost[i].item] < cost[i].amount) return false;
    }
    return true;
  }

  /** Zieht die Kosten ab. Vorher `canAfford` prüfen. */
  pay(cost: readonly ItemAmount[]): void {
    for (let i = 0; i < cost.length; i++) {
      this.amounts[cost[i].item] -= cost[i].amount;
      this.flowOut[cost[i].item] += cost[i].amount;
    }
    this.version++;
  }

  refund(cost: readonly ItemAmount[]): void {
    for (let i = 0; i < cost.length; i++) {
      this.amounts[cost[i].item] += cost[i].amount;
      this.flowIn[cost[i].item] += cost[i].amount;
    }
    this.version++;
  }
}
