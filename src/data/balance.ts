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

export const MACHINES = {
  /** Eingangspuffer fasst die Menge für so viele Durchläufe. */
  inputBufferCycles: 2,
  /** Ausgangspuffer fasst die Menge für so viele Durchläufe. */
  outputBufferCycles: 2,
  /** Lager von Bergwerk und Holzfäller (Items): arbeiten weiter, auch wenn das Band gerade stockt. */
  extractorBuffer: 50,
  /** Glättung der angezeigten Auslastung (Anteil pro Tick). */
  utilizationSmoothing: 0.005,
  /** Ein Problem wird erst nach so vielen Ticks als Symbol angezeigt. */
  problemDelayTicks: 30,
} as const;

export const BELTS = {
  /** Interne Längeneinheiten pro Feld. Ganze Zahlen halten die Bänder exakt. */
  unitsPerTile: 120,
  /** Mindestabstand zweier Items (halbes Feld). */
  minSpacing: 60,
} as const;

export const POWER = {
  /** Wartende oder blockierte Maschinen ziehen nur diesen Anteil ihres Verbrauchs. */
  idleShare: 0.1,
  /** Fester Faktor für Ganzzahl-Rechnung: 1000 = 100 % Tempo. */
  scale: 1000,
  /** Verlauf im Mast-Infofenster: so viele Sekunden. */
  historySeconds: 60,
} as const;

/** Brenner, die sich selbst aus dem Vorrat nachfüllen, halten nur so viel Brennstoff bereit. */
export const AUTO_REFILL = {
  /** Höchstens so viele Items im Puffer (der Rest bleibt im Vorrat zum Bauen und Forschen). */
  keep: 2,
} as const;

export const WIND = {
  /** Leistung schwankt zwischen diesen Anteilen der Nennleistung (Mittel = 1). */
  min: 0.7,
  max: 1.3,
  /** So viele Sekunden dauert ein Wechsel zwischen zwei Windstärken. */
  periodSeconds: 40,
} as const;

/** Aufwertung von Bergwerk und Holzfäller auf Stufe 2 (nach Forschung „Tiefbau“). */
export const EXTRACTOR_UPGRADE = {
  cost: { motor: 5 } as Partial<Record<ItemKey, number>>,
  /** Tempo und Stromverbrauch auf Stufe 2 (Vielfaches). */
  speedFactor: 2,
  powerFactor: 2,
} as const;

/** Statistik: Produktion und Verbrauch werden über so viele Sekunden gemittelt. */
export const STATS = {
  windowSeconds: 60,
} as const;

/** Solarfelder: Sonnenaufgang und -untergang als Tageszeit (passend zum Licht in der Darstellung). */
export const SOLAR = {
  riseStart: 0.2,
  riseEnd: 0.32,
  setStart: 0.7,
  setEnd: 0.82,
} as const;
