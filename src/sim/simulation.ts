import type { World } from './world';

/**
 * Der Spielzustand. Kennt weder three.js noch den Browser.
 */
export class Simulation {
  /** Anzahl der seit Spielbeginn simulierten Ticks. */
  tick = 0;

  // Zähler für die Debug-Anzeige; werden in späteren Phasen befüllt.
  buildingCount = 0;
  segmentCount = 0;
  itemCount = 0;

  constructor(readonly world: World) {}

  step(): void {
    this.tick++;
  }
}
