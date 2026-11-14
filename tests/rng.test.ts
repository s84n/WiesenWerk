import { describe, expect, it } from 'vitest';
import { Rng, deriveSeed, hash3, hashString } from '../src/sim/rng';
import { SimplexNoise } from '../src/sim/noise';

describe('Zufallsgenerator', () => {
  it('liefert bei gleichem Seed die gleiche Folge', () => {
    const a = new Rng(1234);
    const b = new Rng(1234);
    for (let i = 0; i < 1000; i++) expect(a.nextU32()).toBe(b.nextU32());
  });

  it('liefert bei anderem Seed eine andere Folge', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    let same = 0;
    for (let i = 0; i < 100; i++) if (a.nextU32() === b.nextU32()) same++;
    expect(same).toBeLessThan(3);
  });

  it('bleibt im Bereich 0 bis 1 und ist grob gleichverteilt', () => {
    const rng = new Rng(99);
    const buckets = new Array(10).fill(0);
    for (let i = 0; i < 100_000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      buckets[Math.floor(v * 10)]++;
    }
    for (const b of buckets) expect(Math.abs(b - 10_000)).toBeLessThan(500);
  });

  it('hat feste Werte (schützt Seeds vor versehentlichen Änderungen)', () => {
    expect(hashString('wiesenwerk')).toBe(hashString('wiesenwerk'));
    expect(new Rng(42).nextU32()).toMatchInlineSnapshot(`2581720956`);
    expect(hash3(1, 2, 3)).toMatchInlineSnapshot(`1631111411`);
    expect(deriveSeed(42, 'relief')).toBe(deriveSeed(42, 'relief'));
    expect(deriveSeed(42, 'relief')).not.toBe(deriveSeed(42, 'lakes'));
  });
});

describe('Simplex-Noise', () => {
  it('ist deterministisch und bleibt etwa zwischen -1 und 1', () => {
    const a = new SimplexNoise(7);
    const b = new SimplexNoise(7);
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 20_000; i++) {
      const x = i * 0.173;
      const y = i * 0.0911;
      const v = a.noise(x, y);
      expect(v).toBe(b.noise(x, y));
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
    expect(min).toBeGreaterThan(-1.01);
    expect(max).toBeLessThan(1.01);
    expect(max - min).toBeGreaterThan(1.2);
  });

  it('ist weich: benachbarte Punkte haben ähnliche Werte', () => {
    const n = new SimplexNoise(3);
    for (let i = 0; i < 1000; i++) {
      const x = i * 0.37;
      expect(Math.abs(n.noise(x, 5) - n.noise(x + 0.01, 5))).toBeLessThan(0.1);
    }
  });
});
