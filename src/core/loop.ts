/**
 * Spielschleife mit festem Zeitschritt.
 *
 * Die Darstellung ruft pro Bild `advance(ms)` auf. Daraus werden ganze Simulations-Ticks
 * gemacht (20 pro Sekunde mal Spielgeschwindigkeit). Der Rest bleibt im Akkumulator und
 * wird über `alpha` zum Interpolieren zwischen zwei Ticks genutzt.
 *
 * Die Klasse kennt weder Browser noch three.js und ist dadurch einfach testbar.
 */
export class FixedStepLoop {
  readonly tickMs: number;
  speed = 1;
  paused = false;
  /** Gesamtzahl der ausgeführten Ticks. */
  ticks = 0;
  /** Ticks, die im letzten `advance` ausgeführt wurden. */
  lastTickCount = 0;

  private accumulator = 0;

  constructor(
    ticksPerSecond: number,
    private readonly maxTicksPerFrame: number,
    private readonly onTick: () => void,
  ) {
    this.tickMs = 1000 / ticksPerSecond;
  }

  /** Lässt `frameMs` Millisekunden Echtzeit vergehen. Gibt die Zahl der Ticks zurück. */
  advance(frameMs: number): number {
    if (this.paused || frameMs <= 0) {
      this.lastTickCount = 0;
      return 0;
    }
    this.accumulator += frameMs * this.speed;

    let count = 0;
    while (this.accumulator >= this.tickMs && count < this.maxTicksPerFrame) {
      this.onTick();
      this.accumulator -= this.tickMs;
      count++;
    }
    // Zu weit zurück? Dann lieber langsamer laufen, als einzufrieren.
    if (this.accumulator >= this.tickMs) {
      this.accumulator = this.accumulator % this.tickMs;
    }
    this.ticks += count;
    this.lastTickCount = count;
    return count;
  }

  /** Anteil (0 bis 1) zwischen dem letzten und dem nächsten Tick, für weiche Bewegungen. */
  get alpha(): number {
    return this.accumulator / this.tickMs;
  }
}
