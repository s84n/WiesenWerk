/**
 * Befehle sind der einzige Weg, den Spielzustand zu ändern. Oberfläche und Eingabe
 * erzeugen Befehle, die Simulation wendet sie zwischen zwei Ticks an.
 */
export type Command =
  /** Baut ein Gebäude; `recipe` (optional) wird gleich gewählt (Pipette, Rückgängig). */
  | { type: 'build'; building: number; x: number; y: number; rot: number; recipe?: number }
  /** Reißt das Gebäude ab, das auf Feld (x, y) steht. */
  | { type: 'demolish'; x: number; y: number }
  /** Reißt alle Gebäude ab, die das Rechteck berühren (Ecken einschließlich). */
  | { type: 'demolishArea'; x0: number; y0: number; x1: number; y1: number }
  /** Abbau von Hand auf Feld (x, y). */
  | { type: 'harvest'; x: number; y: number }
  /**
   * Baut Felder entlang eines Weges (Bänder, Wege, Zäune). Vorhandene Bänder werden gedreht,
   * eine andere Bandstufe ersetzt sie.
   */
  | { type: 'buildLine'; building: number; path: readonly BeltStep[] }
  /** Wählt das Rezept einer Maschine (−1 = keins). */
  | { type: 'setRecipe'; building: number; recipe: number }
  /** Füllt einen Brenner aus dem Vorrat mit Brennstoff. */
  | { type: 'refuel'; building: number; item: number }
  /** Erforscht einen Knoten (Index in `RESEARCH`). */
  | { type: 'research'; node: number }
  /** Kauft die nächste Stufe einer wiederholbaren Verbesserung (Index in `UPGRADES`). */
  | { type: 'buyUpgrade'; upgrade: number }
  /** Wertet Bergwerk oder Holzfäller auf Stufe 2 auf. */
  | { type: 'upgradeBuilding'; building: number }
  /** Brenner holt Brennstoff selbst aus dem Vorrat (an/aus). */
  | { type: 'setAutoRefill'; building: number; on: boolean }
  /** Blendet die Aufgabenliste aus oder ein. */
  | { type: 'setGoalsHidden'; hidden: boolean }
  /** Tag-Nacht-Wechsel an/aus (Einstellung des Spielers; bestimmt den Sonnenstand für Solarfelder). */
  | { type: 'setDayCycle'; on: boolean }
  /** Blaupause: mehrere Gebäude auf einmal bauen (blockierte oder zu teure werden übersprungen). */
  | { type: 'buildMany'; list: readonly BlueprintPlacement[] };

export interface BeltStep {
  x: number;
  y: number;
  dir: number;
}

/** Ein Gebäude einer eingefügten Blaupause (Weltkoordinaten). */
export interface BlueprintPlacement {
  building: number;
  x: number;
  y: number;
  rot: number;
  recipe: number;
}
