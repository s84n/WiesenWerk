import { describe, expect, it } from 'vitest';
import { Simulation } from '../src/sim/simulation';

describe('Simulation', () => {
  it('ist deterministisch: gleiche Tickzahl ergibt gleichen Zustand', () => {
    const a = new Simulation();
    const b = new Simulation();
    for (let i = 0; i < 12345; i++) a.step();
    for (let i = 0; i < 12345; i++) b.step();
    expect(a.tick).toBe(12345);
    expect(a.demoRotor).toBe(b.demoRotor);
  });
});
