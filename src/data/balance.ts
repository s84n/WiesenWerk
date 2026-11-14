import type { ItemKey } from './items';

/**
 * Balancing-Werte, die keinem einzelnen Gebäude gehören.
 */
export const START_INVENTORY: Partial<Record<ItemKey, number>> = {
  wood: 30,
  stone: 30,
  copperOre: 10,
};

export const HAND_MINING = {
  /** Items pro Klick. */
  amountPerClick: 1,
  /** Bei gedrückter Maustaste: Abstand zwischen zwei Ernten in Millisekunden (2 pro Sekunde). */
  holdIntervalMs: 500,
} as const;

export const TREES = {
  /** Item, das Bäume liefern. */
  item: 'wood' as ItemKey,
  /** Holz pro Baum. */
  woodPerTree: 4,
  /** Sekunden, bis ein gefällter Baum nachwächst. */
  regrowSeconds: 120,
} as const;
