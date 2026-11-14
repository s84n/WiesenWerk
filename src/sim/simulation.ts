/**
 * Der Spielzustand. Kennt weder three.js noch den Browser.
 * In Phase 0 zählt er nur Ticks und dreht ein Demo-Windrad, damit die Schleife sichtbar wird.
 */
export class Simulation {
  /** Anzahl der seit Spielbeginn simulierten Ticks. */
  tick = 0;

  /** Winkel des Demo-Windrads in Tausendstel Umdrehungen (ganzzahlig, deterministisch). */
  demoRotor = 0;
  /** Drehgeschwindigkeit des Demo-Windrads pro Tick. */
  static readonly DEMO_ROTOR_STEP = 7;

  // Zähler für die Debug-Anzeige; werden in späteren Phasen befüllt.
  buildingCount = 0;
  segmentCount = 0;
  itemCount = 0;

  step(): void {
    this.tick++;
    this.demoRotor = (this.demoRotor + Simulation.DEMO_ROTOR_STEP) % 1000;
  }
}
