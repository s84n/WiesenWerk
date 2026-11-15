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
      DEPOSITS.forEach((def, d) => {
        // Stein und Kupfer direkt am Start, Eisen, Kohle und Sand etwas weiter weg
        const r = def.late ? (def.nearStart ?? 0) : 26;
        expect(countAround(w, r, (i) => w.resource[i] === d + 1)).toBeGreaterThanOrEqual(5);
        if (def.late)
          expect(countAround(w, WORLD_CONFIG.lateClearRadius, (i) => w.resource[i] === d + 1)).toBe(
            0,
          );
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
      late: true,
    };
    const before = generateWorld(999);
    const after = generateWorld(999, WORLD_CONFIG.size, [...DEPOSITS, extra]);
    for (let i = 0; i < before.tiles.length; i++) {
      if (before.resource[i] > 0) expect(after.resource[i]).toBe(before.resource[i]);
    }
    expect(after.resource.some((r) => r === DEPOSITS.length + 1)).toBe(true);
  });
});

describe('Kartengrößen', () => {
  it('erzeugt auch große und riesige Karten mit Startgebiet in der Mitte', () => {
    for (const size of [384, 512]) {
      const w = generateWorld(77, size);
      expect(w.size).toBe(size);
      expect(w.startX).toBe(size / 2);
      expect(w.tiles[w.index(w.startX, w.startY)]).toBe(0); // Wiese am Start
    }
  });

  it('lässt alte Fassungen der Generierung Feld für Feld unverändert', () => {
    // Prüfsummen vor Einführung von Fassung 3: alte Spielstände behalten ihre Landschaft
    const expected: [number, number, number, number][] = [
      [1, 1, 256, -1641897089],
      [1, 4711, 512, 1069520116],
      [2, 1, 256, -1541465924],
      [2, 4711, 256, 1385421160],
      [2, 99, 512, -2006270261],
    ];
    for (const [version, seed, size, sum] of expected)
      expect(checksum(generateWorld(seed, size, DEPOSITS, version))).toBe(sum);
  });

  it('bietet ab Fassung 3 deutlich mehr zusammenhängenden Bauplatz', () => {
    // Größtes freies Wiesenquadrat (Seitenlänge in Feldern)
    const largestMeadowSquare = (w: World): number => {
      const n = w.size;
      const side = new Int32Array(n * n);
      let best = 0;
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
          const i = y * n + x;
          if (w.tiles[i] !== TileType.Meadow) continue;
          side[i] = x > 0 && y > 0 ? 1 + Math.min(side[i - 1], side[i - n], side[i - n - 1]) : 1;
          best = Math.max(best, side[i]);
        }
      return best;
    };
    for (const seed of [1, 4711, 99]) {
      const old = largestMeadowSquare(generateWorld(seed, 256, DEPOSITS, 2));
      const now = largestMeadowSquare(generateWorld(seed, 256, DEPOSITS, 3));
      expect(now).toBeGreaterThanOrEqual(20);
      expect(now).toBeGreaterThan(old);
    }
  });

  it('hat ab Fassung 3 keine winzigen Erz-, Fels- oder Baumsprenkel', () => {
    for (const seed of [4711, 1, 99, 2024]) {
      const w = generateWorld(seed, 256, DEPOSITS, 3);
      const n = w.size;
      const seen = new Uint8Array(n * n);
      for (let start = 0; start < n * n; start++) {
        const t = w.tiles[start];
        if (seen[start] || (t !== TileType.Deposit && t !== TileType.Rock && t !== TileType.Forest))
          continue;
        const res = w.resource[start];
        const stack = [start];
        seen[start] = 1;
        let count = 0;
        let edge = false;
        while (stack.length) {
          const i = stack.pop()!;
          count++;
          const x = i % n;
          const y = (i - x) / n;
          if (x === 0 || y === 0 || x === n - 1 || y === n - 1) edge = true;
          for (const j of [x > 0 ? i - 1 : -1, x < n - 1 ? i + 1 : -1, i - n, i + n])
            if (j >= 0 && j < n * n && !seen[j] && w.tiles[j] === t && w.resource[j] === res) {
              seen[j] = 1;
              stack.push(j);
            }
        }
        // Wald und Felsen: mindestens 12 Felder, Vorkommen mindestens 4 (Rand garantierter Flecken)
        if (!edge) expect(count).toBeGreaterThanOrEqual(t === TileType.Deposit ? 4 : 12);
      }
    }
  });
});
