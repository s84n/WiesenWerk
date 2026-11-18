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
  /** Ausgabestelle: so viele Items liegen fertig am Ausgang bereit. */
  dispenserBuffer: 2,
  /** Glättung der angezeigten Auslastung (Anteil pro Tick). */
  utilizationSmoothing: 0.005,
  /** Ein Problem wird erst nach so vielen Ticks als Symbol angezeigt. */
  problemDelayTicks: 30,
} as const;

export const BELTS = {
  /**
   * Interne Längeneinheiten pro Feld. Ganze Zahlen halten die Bänder exakt; 240 erlaubt das
   * Tempo 0,75 Felder/s (9 Einheiten je Tick). Bis Spielstand-Version 7 waren es 120.
   */
  unitsPerTile: 240,
  /** Mindestabstand zweier Items (halbes Feld). */
  minSpacing: 120,
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

type Cost = Partial<Record<ItemKey, number>>;

/**
 * Stufen von Abbau (Bergwerk, Holzfäller) und Fertigung (Schmelzofen, Werkstatt, Manufaktur,
 * Gießerei), je Gebäude per Befehl `upgradeBuilding`. Index = Stufe − 1 (`machines.upgraded`).
 *
 * Faustregel (Wunsch des Auftraggebers): Eine Grundmaschine liefert 30 Items pro Minute, ein Band
 * ist mit drei Maschinen voll – Mk1 (90/min) mit drei Maschinen der Stufe 1, Mk2 (180/min) mit
 * drei der Stufe 2, Mk3 (360/min) mit drei der Stufe 3.
 */
export const MACHINE_LEVELS = {
  /** Tempo je Stufe (Vielfaches). */
  speed: [1, 2, 4],
  /** Stromverbrauch je Stufe (Vielfaches): höhere Stufen sind sparsamer als mehr Maschinen. */
  power: [1, 2, 3],
  /** Kosten für den Schritt auf Stufe 2 bzw. 3 (Abbau: „Tiefbau“ bzw. „Hochleistung“). */
  extractorCost: [{ motor: 5 }, { steelFrame: 3, clockwork: 2 }] as readonly Cost[],
  /** Kosten für den Schritt auf Stufe 2 bzw. 3 (Fertigung: „Feinmechanik“ bzw. „Hochleistung“). */
  crafterCost: [
    { clockwork: 2, ironPlate: 4 },
    { steelFrame: 3, instrument: 1 },
  ] as readonly Cost[],
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

/**
 * Gemütlichkeit (Ausbaurunde Gemütlichkeit): Gärten und Dekoration machen Maschinen in ihrer
 * Nähe schneller. Nur Bonus, nie Strafe. Die Werte je Gebäude stehen in `cozy` (`buildings.ts`).
 */
export const COZY = {
  /** Höchster Tempo-Bonus in Tausendsteln (100 = +10 %). */
  maxBonus: 100,
} as const;
