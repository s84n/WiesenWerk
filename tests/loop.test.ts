import { describe, expect, it } from 'vitest';
import { FixedStepLoop } from '../src/core/loop';

describe('FixedStepLoop', () => {
  const make = () => {
    let calls = 0;
    const loop = new FixedStepLoop(20, 5, () => calls++);
    return { loop, calls: () => calls };
  };

  it('führt 20 Ticks pro Sekunde aus, unabhängig von der Bildrate', () => {
    for (const fps of [30, 60, 144]) {
      const { loop, calls } = make();
      for (let i = 0; i < fps; i++) loop.advance(1000 / fps);
      expect(calls()).toBeGreaterThanOrEqual(19);
      expect(calls()).toBeLessThanOrEqual(20);
    }
  });

  it('holt höchstens fünf Ticks pro Bild nach und läuft dann langsamer', () => {
    const { loop, calls } = make();
    expect(loop.advance(1000)).toBe(5);
    expect(calls()).toBe(5);
    // Der Rückstand wird verworfen, nicht beim nächsten Bild nachgeholt.
    expect(loop.advance(0.001)).toBe(0);
    expect(loop.alpha).toBeLessThan(1);
  });

  it('läuft bei Spielgeschwindigkeit 3 dreimal so schnell', () => {
    const { loop, calls } = make();
    loop.speed = 3;
    for (let i = 0; i < 60; i++) loop.advance(1000 / 60);
    expect(calls()).toBeGreaterThanOrEqual(59);
    expect(calls()).toBeLessThanOrEqual(60);
  });

  it('führt im Pausenmodus keine Ticks aus', () => {
    const { loop, calls } = make();
    loop.paused = true;
    loop.advance(500);
    expect(calls()).toBe(0);
  });

  it('liefert alpha zwischen 0 und 1 für die Interpolation', () => {
    const { loop } = make();
    loop.advance(25);
    expect(loop.alpha).toBeCloseTo(0.5);
    loop.advance(25);
    expect(loop.alpha).toBeCloseTo(0);
  });
});
