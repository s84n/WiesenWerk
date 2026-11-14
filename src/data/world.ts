import type { ItemKey } from './items';
import type { PaletteKey } from './palette';

/** Feldarten. Die Zahl ist der Wert im Raster-Array. */
export const TileType = {
  Meadow: 0,
  Forest: 1,
  Deposit: 2,
  Water: 3,
  Rock: 4,
} as const;
export type TileType = (typeof TileType)[keyof typeof TileType];

/** Reinheit eines Vorkommens. Index = Wert im Reinheits-Array. */
export const PURITY = [
  { key: 'none', factor: 0 },
  { key: 'poor', factor: 0.5 },
  { key: 'normal', factor: 1 },
  { key: 'rich', factor: 2 },
] as const;

export interface DepositDef {
  /** Stabiler Schlüssel. Bestimmt auch die eigene Noise-Ebene, damit neue Vorkommen alte Seeds nicht verändern. */
  id: string;
  /** Größe der Flecken: kleiner = größere Flecken. */
  noiseScale: number;
  /** Ab diesem Noise-Wert (0..1) entsteht ein Vorkommen. Höher = seltener. */
  threshold: number;
  /** Item, das hier abgebaut wird. */
  item: ItemKey;
  /** Wird im Startgebiet garantiert. */
  startGuarantee: boolean;
  /** Farbe der Felsbrocken auf dem Vorkommen. */
  oreColor: PaletteKey;
  /** Farbe des Bodens unter dem Vorkommen. */
  groundColor: PaletteKey;
}

/**
 * Vorkommen in fester Reihenfolge. Neue Einträge immer hinten anhängen:
 * Frühere Vorkommen haben Vorrang, so bleiben bestehende Seeds stabil.
 * Der Wert im Rohstoff-Array ist Index + 1 (0 = kein Vorkommen).
 */
export const DEPOSITS: readonly DepositDef[] = [
  {
    id: 'stone',
    item: 'stone',
    noiseScale: 1 / 16,
    threshold: 0.79,
    startGuarantee: true,
    oreColor: 'stone',
    groundColor: 'rockDark',
  },
  {
    id: 'copper',
    item: 'copperOre',
    noiseScale: 1 / 16,
    threshold: 0.81,
    startGuarantee: true,
    oreColor: 'copper',
    groundColor: 'soil',
  },
];

/** Parameter der Weltgenerierung. */
/** Wählbare Kartengrößen beim neuen Spiel (Kantenlänge in Feldern, Vielfaches von 32). */
export const WORLD_SIZES = [
  { key: 'normal', size: 256 },
  { key: 'large', size: 384 },
  { key: 'huge', size: 512 },
] as const;

export const WORLD_CONFIG = {
  /** Kantenlänge der Karte in Feldern. */
  size: 256,
  /** Kantenlänge eines Chunks in Feldern. */
  chunkSize: 16,

  /** Breite des Randstreifens, in dem die Karte in Wasser und Hügel übergeht. */
  edgeMargin: 16,
  /** Ab diesem Randwert wird ein Feld zu Wasser oder Fels. */
  edgeThreshold: 0.55,

  /** Gelände-Relief: Größe der Strukturen und Schwelle für Felsen im Inland. */
  reliefScale: 1 / 46,
  rockLevel: 0.5,

  /** Seen: Größe und Schwelle (niedriger = weniger Wasser). */
  lakeScale: 1 / 38,
  waterLevel: -0.42,

  /** Wälder: Größe und Schwelle (höher = weniger Wald). */
  forestScale: 1 / 24,
  forestLevel: 0.18,

  /** Vorkommen: Grenzen der Reinheitsstufen innerhalb eines Flecks (0..1 über der Schwelle). */
  purityPoorBelow: 0.2,
  purityRichAbove: 0.6,

  /** Startgebiet */
  startClearRadius: 7,
  startForestMinTiles: 30,
  startForestSearchRadius: 22,
  startForestDistance: 13,
  startForestRadius: 4,
  startDepositMinTiles: 6,
  startDepositSearchRadius: 24,
  startDepositDistance: 13,
  startDepositRadius: 2.4,
} as const;
