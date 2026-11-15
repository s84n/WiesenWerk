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
  /**
   * Spätes Vorkommen (nach Phase 7 ergänzt): wird erst nach dem Startgebiet gesetzt, nur auf
   * Wiese oder Wald und nicht im Startgebiet. So bleibt die Welt alter Spielstände ringsum gleich.
   */
  late?: boolean;
  /** Spätes Vorkommen: Gibt es keines im Umkreis von `nearStart` Feldern, wird eines dort gesetzt. */
  nearStart?: number;
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
  {
    id: 'iron',
    item: 'ironOre',
    noiseScale: 1 / 16,
    threshold: 0.82,
    startGuarantee: false,
    oreColor: 'iron',
    groundColor: 'ironGround',
    late: true,
    nearStart: 40,
  },
  {
    id: 'coal',
    item: 'coal',
    noiseScale: 1 / 16,
    threshold: 0.83,
    startGuarantee: false,
    oreColor: 'coal',
    groundColor: 'coalGround',
    late: true,
    nearStart: 45,
  },
  {
    id: 'sand',
    item: 'sand',
    noiseScale: 1 / 14,
    threshold: 0.82,
    startGuarantee: false,
    oreColor: 'sandOre',
    groundColor: 'sandGround',
    late: true,
    nearStart: 45,
  },
];

/** Parameter der Weltgenerierung. */
/** Wählbare Kartengrößen beim neuen Spiel (Kantenlänge in Feldern, Vielfaches von 32). */
export const WORLD_SIZES = [
  { key: 'normal', size: 256 },
  { key: 'large', size: 384 },
  { key: 'huge', size: 512 },
] as const;

/**
 * Fassung der Weltgenerierung. Steht im Spielstand, damit alte Spiele ihre Landschaft behalten,
 * wenn sich die Erzeugung ändert (die Welt wird beim Laden aus dem Seed neu erzeugt).
 * Neue Fassung → Eintrag in `WORLD_GEN` anhängen und Nummer erhöhen.
 */
export const WORLD_GEN_VERSION = 3;

/** Einstellungen, die sich zwischen den Fassungen unterscheiden (Index = Fassung − 1). */
export const WORLD_GEN: readonly {
  /** Seen: Größe und Schwelle (niedriger = weniger Wasser). */
  lakeScale: number;
  waterLevel: number;
  /** Gewässer im Inland mit weniger Feldern werden zu Wiese (0 = alle behalten). */
  minLakeTiles: number;
  /** Felsen im Inland ab diesem Relief-Wert (höher = weniger Felsen). */
  rockLevel: number;
  /** Wälder: Größe und Schwelle (kleinere Größe = größere Wälder, höher = weniger Wald). */
  forestScale: number;
  forestLevel: number;
  /** Vorkommen: Faktor auf `noiseScale` (kleiner = weniger, größere Flecken) und Aufschlag auf `threshold`. */
  depositScale: number;
  depositShift: number;
  /** Flecken mit weniger Feldern werden zu Wiese (0 = alle behalten). */
  minDepositTiles: number;
  minRockTiles: number;
  minForestTiles: number;
}[] = [
  // 1: bis Herbst 2026
  {
    lakeScale: 1 / 38,
    waterLevel: -0.42,
    minLakeTiles: 0,
    rockLevel: 0.5,
    forestScale: 1 / 24,
    forestLevel: 0.18,
    depositScale: 1,
    depositShift: 0,
    minDepositTiles: 0,
    minRockTiles: 0,
    minForestTiles: 0,
  },
  // 2: etwa halb so viel Wasser, weniger und größere Seen, keine kleinen Tümpel (Auftraggeber)
  {
    lakeScale: 1 / 46,
    waterLevel: -0.49,
    minLakeTiles: 24,
    rockLevel: 0.5,
    forestScale: 1 / 24,
    forestLevel: 0.18,
    depositScale: 1,
    depositShift: 0,
    minDepositTiles: 0,
    minRockTiles: 0,
    minForestTiles: 0,
  },
  // 3: mehr zusammenhängender Bauplatz (Auftraggeber): weniger, dafür größere Vorkommen,
  // größere Wälder und Wiesen, weniger Felsen, keine Sprenkel aus Erz, Fels oder Bäumen
  {
    lakeScale: 1 / 46,
    waterLevel: -0.49,
    minLakeTiles: 24,
    rockLevel: 0.56,
    forestScale: 1 / 34,
    forestLevel: 0.24,
    depositScale: 0.55,
    depositShift: 0.03,
    minDepositTiles: 10,
    minRockTiles: 12,
    minForestTiles: 12,
  },
];

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
  /* Felsen- und Wald-Schwellen hängen von der Fassung ab, siehe WORLD_GEN. */

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
  /** Späte Vorkommen: Abstand zum Startpunkt (frei bleibt das Startgebiet) und Größe des garantierten Flecks. */
  lateClearRadius: 12,
  lateGuaranteeDistance: 28,
  lateGuaranteeRadius: 2.6,
} as const;
