import { toAmounts, type ItemAmount, type ItemKey } from './items';

/**
 * Forschungsbaum. Knoten werden sofort aus dem Vorrat bezahlt und gelten direkt.
 * Reihenfolge = ID im Spielstand ist egal (gespeichert wird der Schlüssel), neue Knoten trotzdem
 * hinten anhängen.
 */
/** Bereiche des Forschungsbaums, in dieser Reihenfolge als Reiter. */
export const RESEARCH_AREAS = ['production', 'logistics', 'energy', 'industry', 'beauty'] as const;
export type ResearchArea = (typeof RESEARCH_AREAS)[number];

export interface ResearchDef {
  key: string;
  /** Schlüssel der Knoten, die vorher erforscht sein müssen. */
  requires: readonly string[];
  cost: Partial<Record<ItemKey, number>>;
  /** Gebäude-Schlüssel, die freigeschaltet werden. */
  buildings?: readonly string[];
  /** Rezept-Schlüssel, die freigeschaltet werden. */
  recipes?: readonly string[];
  /** Schaltet die Aufwertung von Bergwerk und Holzfäller auf Stufe 2 frei. */
  extractorUpgrade?: boolean;
  /** Bereich (Reiter im Forschungsfenster). */
  area: ResearchArea;
  /** Platz innerhalb des Bereichs: Spalte und Zeile (höchstens 2 Zeilen, damit nichts scrollt). */
  pos: readonly [number, number];
}

export const RESEARCH: readonly ResearchDef[] = [
  {
    key: 'logistics1',
    requires: [],
    cost: { plank: 50, copperWire: 30 },
    buildings: ['merger', 'tunnelIn', 'tunnelOut'],
    area: 'logistics',
    pos: [0, 0],
  },
  {
    key: 'storage',
    requires: [],
    cost: { plank: 80, stoneBrick: 40 },
    buildings: ['storage', 'storageSplit', 'storageMerge'],
    area: 'logistics',
    pos: [0, 1],
  },
  {
    key: 'charcoal',
    requires: [],
    cost: { stoneBrick: 60 },
    recipes: ['charcoal'],
    area: 'production',
    pos: [0, 1],
  },
  {
    key: 'beauty1',
    requires: [],
    cost: { stoneBrick: 40, plank: 40 },
    buildings: ['path', 'lantern', 'flowerbed'],
    area: 'beauty',
    pos: [0, 0],
  },
  {
    key: 'sheetMetal',
    requires: ['logistics1'],
    cost: { copperIngot: 100 },
    recipes: ['copperSheet'],
    area: 'production',
    pos: [0, 0],
  },
  {
    key: 'assembler',
    requires: ['sheetMetal'],
    cost: { plank: 100, stoneBrick: 100, copperSheet: 50 },
    buildings: ['assembler'],
    recipes: ['frame', 'coil'],
    area: 'production',
    pos: [1, 0],
  },
  {
    key: 'wind',
    requires: ['assembler'],
    cost: { frame: 30, coil: 30 },
    buildings: ['windTurbine'],
    area: 'energy',
    pos: [0, 0],
  },
  {
    key: 'logistics2',
    requires: ['assembler'],
    cost: { frame: 60, copperSheet: 100 },
    buildings: ['beltMk2', 'bridge'],
    area: 'logistics',
    pos: [1, 0],
  },
  {
    key: 'electronics',
    requires: ['assembler'],
    cost: { coil: 60, copperWire: 100 },
    recipes: ['circuit'],
    area: 'production',
    pos: [2, 0],
  },
  {
    key: 'drives',
    requires: ['electronics'],
    cost: { circuit: 50, frame: 50 },
    recipes: ['motor', 'controlUnit'],
    area: 'production',
    pos: [3, 0],
  },
  {
    key: 'longDistance',
    requires: ['wind', 'drives'],
    cost: { coil: 40, motor: 20 },
    buildings: ['bigPole'],
    area: 'energy',
    pos: [1, 0],
  },
  {
    key: 'logistics3',
    requires: ['logistics2', 'drives'],
    cost: { motor: 60, controlUnit: 40 },
    buildings: ['beltMk3'],
    area: 'logistics',
    pos: [2, 0],
  },
  {
    key: 'deepMining',
    requires: ['drives'],
    cost: { motor: 80 },
    extractorUpgrade: true,
    area: 'production',
    pos: [4, 0],
  },
  {
    key: 'beauty2',
    requires: ['beauty1', 'assembler'],
    cost: { stoneBrick: 100, frame: 20 },
    buildings: ['fence', 'bench', 'ornamentalTree', 'pathColored'],
    area: 'beauty',
    pos: [1, 0],
  },
  {
    key: 'warehousing',
    requires: ['storage', 'assembler'],
    cost: { frame: 40, plank: 150 },
    buildings: ['storageLarge', 'depotLarge'],
    area: 'logistics',
    pos: [1, 1],
  },
  // Erweiterung nach Phase 7: Eisen, Glas, Stahl und neue Stromarten
  {
    key: 'ironworking',
    requires: [],
    cost: { copperIngot: 60, stoneBrick: 60 },
    recipes: ['ironIngot', 'gear'],
    area: 'industry',
    pos: [0, 0],
  },
  {
    key: 'glassmaking',
    requires: [],
    cost: { stoneBrick: 80, plank: 40 },
    recipes: ['glass'],
    area: 'industry',
    pos: [0, 1],
  },
  {
    key: 'waterPower',
    requires: ['ironworking'],
    cost: { gear: 40, plank: 80 },
    buildings: ['waterWheel'],
    area: 'energy',
    pos: [0, 1],
  },
  {
    key: 'steelmaking',
    requires: ['ironworking', 'assembler'],
    cost: { ironIngot: 100, frame: 20 },
    buildings: ['foundry'],
    recipes: ['steel'],
    area: 'industry',
    pos: [1, 0],
  },
  {
    key: 'solarPower',
    requires: ['glassmaking', 'electronics'],
    cost: { glass: 80, circuit: 30 },
    buildings: ['solarPanel'],
    area: 'energy',
    pos: [1, 1],
  },
  {
    key: 'batteries',
    requires: ['steelmaking', 'solarPower'],
    cost: { steel: 60, coil: 40 },
    buildings: ['battery'],
    area: 'energy',
    pos: [2, 1],
  },
];

export const RESEARCH_ID = Object.fromEntries(RESEARCH.map((r, i) => [r.key, i])) as Record<
  string,
  number
>;
export const RESEARCH_COSTS: readonly ItemAmount[][] = RESEARCH.map((r) => toAmounts(r.cost));

/** Wiederholbare Verbesserungen nach dem Baum. Kosten steigen je Stufe um `growth`. */
export interface UpgradeDef {
  key: 'machineSpeed' | 'extractionSpeed' | 'efficiency';
  /** Erst verfügbar, wenn dieser Knoten erforscht ist. */
  requires: string;
  baseCost: Partial<Record<ItemKey, number>>;
  growth: number;
  /** Wirkung je Stufe (Anteil, z. B. 0.05 = 5 %). */
  perLevel: number;
  /** Höchste Stufe (Infinity = endlos). */
  maxLevel: number;
}

export const UPGRADES: readonly UpgradeDef[] = [
  {
    key: 'machineSpeed',
    requires: 'drives',
    baseCost: { motor: 50, controlUnit: 50 },
    growth: 1.5,
    perLevel: 0.05,
    maxLevel: Infinity,
  },
  {
    key: 'extractionSpeed',
    requires: 'drives',
    baseCost: { motor: 50, controlUnit: 50 },
    growth: 1.5,
    perLevel: 0.05,
    maxLevel: Infinity,
  },
  {
    key: 'efficiency',
    requires: 'drives',
    baseCost: { motor: 50, controlUnit: 50 },
    growth: 1.5,
    perLevel: 0.03,
    maxLevel: 10,
  },
];

export const UPGRADE_ID = Object.fromEntries(UPGRADES.map((u, i) => [u.key, i])) as Record<
  UpgradeDef['key'],
  number
>;

/** Kosten einer Verbesserung für die nächste Stufe (Stufe `level` → `level + 1`). */
export function upgradeCost(upgrade: number, level: number): ItemAmount[] {
  const u = UPGRADES[upgrade];
  const f = Math.pow(u.growth, level);
  return toAmounts(u.baseCost).map((a) => ({ item: a.item, amount: Math.round(a.amount * f) }));
}
