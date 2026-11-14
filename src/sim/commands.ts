/**
 * Befehle sind der einzige Weg, den Spielzustand zu ändern. Oberfläche und Eingabe
 * erzeugen Befehle, die Simulation wendet sie zwischen zwei Ticks an.
 */
export type Command =
  | { type: 'build'; building: number; x: number; y: number; rot: number }
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
  /** Blendet die Aufgabenliste aus oder ein. */
  | { type: 'setGoalsHidden'; hidden: boolean };

export interface BeltStep {
  x: number;
  y: number;
  dir: number;
}
