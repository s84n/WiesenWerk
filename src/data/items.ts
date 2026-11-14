import type { PaletteKey } from './palette';

/**
 * Alle Items. Die numerische ID ist der Index in `ITEMS`.
 * Neue Items immer hinten anhängen, damit Spielstände gültig bleiben.
 */
export interface ItemDef {
  key: string;
  /** Feste Stoffe liegen auf Bändern, Flüssigkeiten (später) fließen in Rohren. */
  kind: 'solid' | 'fluid';
  color: PaletteKey;
  /** Energie in kJ beim Verbrennen (0 = kein Brennstoff). */
  fuelValue: number;
}

export const ITEMS = [
  { key: 'wood', kind: 'solid', color: 'itemWood', fuelValue: 120 },
  { key: 'stone', kind: 'solid', color: 'itemStone', fuelValue: 0 },
  { key: 'copperOre', kind: 'solid', color: 'itemCopperOre', fuelValue: 0 },
  { key: 'copperIngot', kind: 'solid', color: 'itemCopperIngot', fuelValue: 0 },
  { key: 'stoneBrick', kind: 'solid', color: 'itemBrick', fuelValue: 0 },
  { key: 'charcoal', kind: 'solid', color: 'itemCharcoal', fuelValue: 360 },
  { key: 'plank', kind: 'solid', color: 'itemPlank', fuelValue: 0 },
  { key: 'copperWire', kind: 'solid', color: 'itemWire', fuelValue: 0 },
  { key: 'copperSheet', kind: 'solid', color: 'itemSheet', fuelValue: 0 },
  { key: 'frame', kind: 'solid', color: 'itemFrame', fuelValue: 0 },
  { key: 'coil', kind: 'solid', color: 'itemCoil', fuelValue: 0 },
  { key: 'circuit', kind: 'solid', color: 'itemCircuit', fuelValue: 0 },
  { key: 'motor', kind: 'solid', color: 'itemMotor', fuelValue: 0 },
  { key: 'controlUnit', kind: 'solid', color: 'itemControl', fuelValue: 0 },
] as const satisfies readonly ItemDef[];

export type ItemKey = (typeof ITEMS)[number]['key'];

/** Numerische ID zu jedem Item-Schlüssel. */
export const ITEM_ID = Object.fromEntries(ITEMS.map((item, i) => [item.key, i])) as Record<
  ItemKey,
  number
>;

export const ITEM_COUNT = ITEMS.length;

/** Item-Menge mit numerischer ID, wie die Simulation sie nutzt. */
export interface ItemAmount {
  item: number;
  amount: number;
}

/** Wandelt `{ wood: 10, stone: 5 }` in eine Liste mit numerischen IDs um. */
export function toAmounts(map: Partial<Record<ItemKey, number>>): ItemAmount[] {
  return (Object.keys(map) as ItemKey[]).map((key) => ({
    item: ITEM_ID[key],
    amount: map[key] ?? 0,
  }));
}
