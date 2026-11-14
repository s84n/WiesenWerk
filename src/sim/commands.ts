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
  | { type: 'harvest'; x: number; y: number };
