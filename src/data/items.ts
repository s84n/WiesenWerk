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
  /** Form auf dem Band (siehe `src/render/item-models.ts`). */
  shape: ItemShape;
}

export type ItemShape =
  | 'log'
  | 'chunk'
  | 'ore'
  | 'ingot'
  | 'brick'
  | 'charcoal'
  | 'plank'
  | 'wire'
  | 'sheet'
  | 'frame'
  | 'coil'
  | 'circuit'
  | 'motor'
  | 'control'
  | 'sand'
  | 'pane'
  | 'beam'
  | 'gear'
  | 'plate'
  | 'lens'
  | 'clockwork'
  | 'girder'
  | 'instrument'
  | 'apple'
  | 'vegetable'
  | 'jar'
  | 'bouquet'
  | 'cake'
  | 'sack';

export const ITEMS = [
  { key: 'wood', kind: 'solid', color: 'itemWood', fuelValue: 120, shape: 'log' },
  { key: 'stone', kind: 'solid', color: 'itemStone', fuelValue: 0, shape: 'chunk' },
  { key: 'copperOre', kind: 'solid', color: 'itemCopperOre', fuelValue: 0, shape: 'ore' },
  { key: 'copperIngot', kind: 'solid', color: 'itemCopperIngot', fuelValue: 0, shape: 'ingot' },
  { key: 'stoneBrick', kind: 'solid', color: 'itemBrick', fuelValue: 0, shape: 'brick' },
  { key: 'charcoal', kind: 'solid', color: 'itemCharcoal', fuelValue: 360, shape: 'charcoal' },
  { key: 'plank', kind: 'solid', color: 'itemPlank', fuelValue: 0, shape: 'plank' },
  { key: 'copperWire', kind: 'solid', color: 'itemWire', fuelValue: 0, shape: 'wire' },
  { key: 'copperSheet', kind: 'solid', color: 'itemSheet', fuelValue: 0, shape: 'sheet' },
  { key: 'frame', kind: 'solid', color: 'itemFrame', fuelValue: 0, shape: 'frame' },
  { key: 'coil', kind: 'solid', color: 'itemCoil', fuelValue: 0, shape: 'coil' },
  { key: 'circuit', kind: 'solid', color: 'itemCircuit', fuelValue: 0, shape: 'circuit' },
  { key: 'motor', kind: 'solid', color: 'itemMotor', fuelValue: 0, shape: 'motor' },
  { key: 'controlUnit', kind: 'solid', color: 'itemControl', fuelValue: 0, shape: 'control' },
  // Erweiterung nach Phase 7: Eisen, Kohle, Sand und daraus Stahl, Glas, Zahnräder
  { key: 'ironOre', kind: 'solid', color: 'itemIronOre', fuelValue: 0, shape: 'ore' },
  { key: 'coal', kind: 'solid', color: 'itemCoal', fuelValue: 600, shape: 'charcoal' },
  { key: 'sand', kind: 'solid', color: 'itemSand', fuelValue: 0, shape: 'sand' },
  { key: 'ironIngot', kind: 'solid', color: 'itemIronIngot', fuelValue: 0, shape: 'ingot' },
  { key: 'glass', kind: 'solid', color: 'itemGlass', fuelValue: 0, shape: 'pane' },
  { key: 'steel', kind: 'solid', color: 'itemSteel', fuelValue: 0, shape: 'beam' },
  { key: 'gear', kind: 'solid', color: 'itemGear', fuelValue: 0, shape: 'gear' },
  // Ausbaurunde Spielspaß: Endprodukte aus Eisen, Glas und Stahl
  { key: 'ironPlate', kind: 'solid', color: 'itemIronPlate', fuelValue: 0, shape: 'plate' },
  { key: 'lens', kind: 'solid', color: 'itemLens', fuelValue: 0, shape: 'lens' },
  { key: 'clockwork', kind: 'solid', color: 'itemClockwork', fuelValue: 0, shape: 'clockwork' },
  { key: 'steelFrame', kind: 'solid', color: 'itemSteelFrame', fuelValue: 0, shape: 'girder' },
  { key: 'instrument', kind: 'solid', color: 'itemInstrument', fuelValue: 0, shape: 'instrument' },
  // Ausbaurunde Gemütlichkeit: Garten-Waren
  { key: 'apple', kind: 'solid', color: 'itemApple', fuelValue: 0, shape: 'apple' },
  { key: 'vegetable', kind: 'solid', color: 'itemVegetable', fuelValue: 0, shape: 'vegetable' },
  { key: 'honey', kind: 'solid', color: 'itemHoney', fuelValue: 0, shape: 'jar' },
  { key: 'flowers', kind: 'solid', color: 'itemFlowers', fuelValue: 0, shape: 'bouquet' },
  { key: 'cake', kind: 'solid', color: 'itemCake', fuelValue: 0, shape: 'cake' },
  { key: 'compost', kind: 'solid', color: 'itemCompost', fuelValue: 0, shape: 'sack' },
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
