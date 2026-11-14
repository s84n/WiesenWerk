import { describe, expect, it } from 'vitest';
import { createStressSimulation } from '../src/dev/stress';

/**
 * Automatischer Tick-Benchmark mit der Referenzfabrik.
 * Budget laut Projektskript: unter 4 ms pro Tick. Der Test schlägt erst bei deutlicher
 * Verschlechterung fehl (Grenze mit Sicherheitsabstand für langsame Rechner).
 */
const LIMIT_MS = 8;

describe('Leistung', () => {
  it('Referenzfabrik: 2.000 Maschinen, 20.000 Items, Tick unter dem Budget', () => {
    const t0 = performance.now();
    const { sim, machines } = createStressSimulation(1);
    const buildMs = performance.now() - t0;
    expect(machines).toBeGreaterThanOrEqual(2000);
    expect(sim.itemCount).toBeGreaterThanOrEqual(19_000);

    for (let i = 0; i < 200; i++) sim.step(); // Aufwärmen
    const ticks = 400;
    const t1 = performance.now();
    for (let i = 0; i < ticks; i++) sim.step();
    const perTick = (performance.now() - t1) / ticks;

    console.log(
      `Referenzfabrik: ${machines} Maschinen, ${sim.buildingCount - machines} Bandfelder, ` +
        `${sim.segmentCount} Segmente, ${sim.itemCount} Items · Aufbau ${buildMs.toFixed(0)} ms · ` +
        `Tick ${perTick.toFixed(3)} ms`,
    );
    expect(perTick).toBeLessThan(LIMIT_MS);
  }, 60_000);
});
