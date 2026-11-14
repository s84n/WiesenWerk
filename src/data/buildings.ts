import { toAmounts, type ItemAmount, type ItemKey } from './items';
import type { MachineKind } from './recipes';

/** Richtungen: 0 = Norden (−y), 1 = Osten (+x), 2 = Süden (+y), 3 = Westen (−x). */
export type Dir = 0 | 1 | 2 | 3;

/** Anschlusspunkt für Bänder an der Kante eines Feldes des Gebäudes (ungedreht). */
export interface PortDef {
  x: number;
  y: number;
  dir: Dir;
  kind: 'in' | 'out';
}

/** Was ein Gebäude tut. Die Simulation kennt nur diese Arten, keine einzelnen Gebäude. */
export type Behavior =
  | { kind: 'hq' }
  | { kind: 'miner'; itemsPerMinute: number }
  | { kind: 'lumberjack'; itemsPerMinute: number; radius: number }
  | { kind: 'crafter'; machine: MachineKind }
  | { kind: 'belt'; tilesPerSecond: number; tier: number };

export type BuildCategory = 'extraction' | 'production' | 'logistics' | 'energy' | 'decoration';

export interface BuildingDef {
  key: string;
  /** Größe in Feldern (ungedreht): Breite in x, Tiefe in y. */
  size: readonly [number, number];
  category: BuildCategory;
  cost: Partial<Record<ItemKey, number>>;
  /**
   * 'ground' = freie Wiese oder gefällter Wald, 'deposit' = mindestens ein Feld auf einem Vorkommen,
   * 'groundOrDeposit' = beides erlaubt (Bänder).
   */
  placement: 'ground' | 'deposit' | 'groundOrDeposit';
  behavior: Behavior;
  /** Höchstens ein Gebäude dieser Art pro Welt. */
  unique?: boolean;
  ports: readonly PortDef[];
  /** Name des 3D-Modells in `src/render/building-models.ts`. */
  model: string;
  /** Von Spielbeginn an verfügbar (sonst per Forschung, ab Phase 6). */
  availableFromStart: boolean;
}

/**
 * Gebäude in fester Reihenfolge. Neue Einträge hinten anhängen (Index = Typ-ID im Spielstand).
 */
export const BUILDINGS: readonly BuildingDef[] = [
  {
    key: 'hq',
    size: [3, 3],
    category: 'logistics',
    cost: {},
    placement: 'ground',
    unique: true,
    behavior: { kind: 'hq' },
    ports: [
      { x: 1, y: 0, dir: 0, kind: 'in' },
      { x: 2, y: 1, dir: 1, kind: 'in' },
      { x: 1, y: 2, dir: 2, kind: 'in' },
      { x: 0, y: 1, dir: 3, kind: 'in' },
    ],
    model: 'hq',
    availableFromStart: true,
  },
  {
    key: 'lumberjack',
    size: [2, 2],
    category: 'extraction',
    cost: { wood: 10, stone: 5 },
    placement: 'ground',
    behavior: { kind: 'lumberjack', itemsPerMinute: 30, radius: 4 },
    ports: [{ x: 0, y: 1, dir: 2, kind: 'out' }],
    model: 'lumberjack',
    availableFromStart: true,
  },
  {
    key: 'miner',
    size: [2, 2],
    category: 'extraction',
    cost: { wood: 10, stone: 10 },
    placement: 'deposit',
    behavior: { kind: 'miner', itemsPerMinute: 30 },
    ports: [{ x: 0, y: 1, dir: 2, kind: 'out' }],
    model: 'miner',
    availableFromStart: true,
  },
  {
    key: 'furnace',
    size: [2, 2],
    category: 'production',
    cost: { stone: 20 },
    placement: 'ground',
    behavior: { kind: 'crafter', machine: 'furnace' },
    ports: [
      { x: 0, y: 0, dir: 0, kind: 'in' },
      { x: 0, y: 1, dir: 2, kind: 'out' },
    ],
    model: 'furnace',
    availableFromStart: true,
  },
  {
    key: 'workshop',
    size: [2, 2],
    category: 'production',
    cost: { wood: 15, copperIngot: 5 },
    placement: 'ground',
    behavior: { kind: 'crafter', machine: 'workshop' },
    ports: [
      { x: 0, y: 0, dir: 0, kind: 'in' },
      { x: 0, y: 1, dir: 2, kind: 'out' },
    ],
    model: 'workshop',
    availableFromStart: true,
  },
  {
    key: 'beltMk1',
    size: [1, 1],
    category: 'logistics',
    cost: { wood: 1 },
    placement: 'groundOrDeposit',
    behavior: { kind: 'belt', tilesPerSecond: 0.5, tier: 1 },
    ports: [],
    model: 'belt',
    availableFromStart: true,
  },
];

export const BUILDING_ID = Object.fromEntries(BUILDINGS.map((b, i) => [b.key, i])) as Record<
  string,
  number
>;

/** Baukosten jedes Gebäudetyps mit numerischen Item-IDs (Index = Typ-ID). */
export const BUILDING_COSTS: readonly ItemAmount[][] = BUILDINGS.map((b) => toAmounts(b.cost));

export const CATEGORIES: readonly BuildCategory[] = [
  'extraction',
  'production',
  'logistics',
  'energy',
  'decoration',
];
