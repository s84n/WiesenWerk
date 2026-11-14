import { describe, expect, it } from 'vitest';
import { DEPOSITS, TileType, WORLD_CONFIG, type DepositDef } from '../src/data/world';
import { generateWorld } from '../src/sim/worldgen';
import type { World } from '../src/sim/world';

function checksum(w: World): number {
  let h = 0;
  for (const arr of [w.tiles, w.resource, w.purity, w.relief]) {
    for (let i = 0; i < arr.length; i++) h = (Math.imul(h, 31) + arr[i]) | 0;
  }
  return h;
}

function countAround(w: World, radius: number, test: (i: number) => boolean): number {
  let n = 0;
  for (let y = w.startY - radius; y <= w.startY + radius; y++)
    for (let x = w.startX - radius; x <= w.startX + radius; x++)
      if (
        w.inBounds(x, y) &&
        Math.hypot(x - w.startX, y - w.startY) <= radius &&
        test(w.index(x, y))
      )
        n++;
  return n;
}

describe('Weltgenerator', () => {
  it('erzeugt aus gleichem Seed die gleiche Welt', () => {
    expect(checksum(generateWorld(4711))).toBe(checksum(generateWorld(4711)));
  });

  it('erzeugt aus anderem Seed eine andere Welt', () => {
    expect(checksum(generateWorld(1))).not.toBe(checksum(generateWorld(2)));
  });

  it('hat die eingestellte Größe und Chunk-Einteilung', () => {
    const w = generateWorld(5);
    expect(w.size).toBe(WORLD_CONFIG.size);
    expect(w.tiles.length).toBe(WORLD_CONFIG.size ** 2);
    expect(w.chunksPerSide).toBe(WORLD_CONFIG.size / WORLD_CONFIG.chunkSize);
  });

  it('funktioniert auch mit größeren Karten', () => {
    const w = generateWorld(5, 512);
    expect(w.chunksPerSide).toBe(32);
    expect(w.startX).toBe(256);
  });

  it('lässt den Kartenrand nicht bebaubar auslaufen', () => {
    const w = generateWorld(77);
    for (let k = 0; k < w.size; k++) {
      for (const [x, y] of [
        [k, 0],
        [k, w.size - 1],
        [0, k],
        [w.size - 1, k],
        [k, 2],
        [2, k],
      ]) {
        const t = w.tiles[w.index(x, y)];
        expect(t === TileType.Water || t === TileType.Rock).toBe(true);
      }
    }
  });

  it('garantiert ein brauchbares Startgebiet für viele Seeds', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const w = generateWorld(seed * 7919);
      // freie Wiese direkt am Start
      const clear = countAround(
        w,
        WORLD_CONFIG.startClearRadius,
        (i) => w.tiles[i] === TileType.Meadow,
      );
      const all = countAround(w, WORLD_CONFIG.startClearRadius, () => true);
      expect(clear).toBe(all);
      // Wald, Stein und Kupfer in der Nähe
      expect(countAround(w, 24, (i) => w.tiles[i] === TileType.Forest)).toBeGreaterThanOrEqual(20);
      DEPOSITS.forEach((_, d) => {
        expect(countAround(w, 26, (i) => w.resource[i] === d + 1)).toBeGreaterThanOrEqual(5);
      });
    }
  });

  it('enthält alle Feldarten in sinnvollen Anteilen', () => {
    const w = generateWorld(2024);
    const counts = [0, 0, 0, 0, 0];
    for (const t of w.tiles) counts[t]++;
    const share = (t: number): number => counts[t] / w.tiles.length;
    expect(share(TileType.Meadow)).toBeGreaterThan(0.35);
    expect(share(TileType.Forest)).toBeGreaterThan(0.08);
    expect(share(TileType.Water)).toBeGreaterThan(0.04);
    expect(share(TileType.Rock)).toBeGreaterThan(0.02);
    expect(share(TileType.Deposit)).toBeGreaterThan(0.01);
  });

  it('vergibt Reinheiten nur an Vorkommen', () => {
    const w = generateWorld(31);
    const seen = new Set<number>();
    for (let i = 0; i < w.tiles.length; i++) {
      if (w.tiles[i] === TileType.Deposit) {
        expect(w.resource[i]).toBeGreaterThan(0);
        expect(w.purity[i]).toBeGreaterThanOrEqual(1);
        seen.add(w.purity[i]);
      } else {
        expect(w.resource[i]).toBe(0);
        expect(w.purity[i]).toBe(0);
      }
    }
    expect(seen.size).toBe(3); // arm, normal und reich kommen vor
  });

  it('verändert bestehende Vorkommen nicht, wenn neue Rohstoffe dazukommen', () => {
    const extra: DepositDef = {
      id: 'iron-test',
      item: 'stone',
      noiseScale: 1 / 9,
      threshold: 0.8,
      startGuarantee: true,
      oreColor: 'rockDark',
      groundColor: 'soil',
    };
    const before = generateWorld(999);
    const after = generateWorld(999, WORLD_CONFIG.size, [...DEPOSITS, extra]);
    for (let i = 0; i < before.tiles.length; i++) {
      if (before.resource[i] > 0) expect(after.resource[i]).toBe(before.resource[i]);
    }
    expect(after.resource.some((r) => r === DEPOSITS.length + 1)).toBe(true);
  });
});
