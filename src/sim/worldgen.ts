import { DEPOSITS, TileType, WORLD_CONFIG, type DepositDef } from '../data/world';
import { SimplexNoise } from './noise';
import { Rng, deriveSeed } from './rng';
import { World } from './world';

const C = WORLD_CONFIG;

/**
 * Erzeugt eine Welt aus einem Seed. Gleicher Seed → gleiche Welt.
 * Jede Schicht (Relief, Seen, Wald, jedes Vorkommen) hat eine eigene Noise-Ebene.
 */
export function generateWorld(
  seed: number,
  size: number = C.size,
  deposits: readonly DepositDef[] = DEPOSITS,
): World {
  const world = new World(seed, size);
  const relief = new SimplexNoise(deriveSeed(seed, 'relief'));
  const lakes = new SimplexNoise(deriveSeed(seed, 'lakes'));
  const edgeKind = new SimplexNoise(deriveSeed(seed, 'edge'));
  const forest = new SimplexNoise(deriveSeed(seed, 'forest'));
  const { tiles, relief: height } = world;

  // 1. Grundgelände: Rand, Seen, Felsen, Wald, Wiese
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const r = relief.fbm(x * C.reliefScale, y * C.reliefScale, 4);
      const edgeDist = Math.min(x, y, size - 1 - x, size - 1 - y);
      const edgeT = Math.max(0, 1 - edgeDist / C.edgeMargin);
      const edgeValue = edgeT * edgeT * 1.6 + r * 0.35 * edgeT;

      if (edgeValue > C.edgeThreshold) {
        if (edgeKind.fbm(x / 30, y / 30, 2) > 0) {
          tiles[i] = TileType.Water;
        } else {
          tiles[i] = TileType.Rock;
          height[i] = toByte((edgeValue - C.edgeThreshold) * 0.9 + 0.25 + r * 0.2);
        }
      } else if (lakes.fbm(x * C.lakeScale, y * C.lakeScale, 3) < C.waterLevel) {
        tiles[i] = TileType.Water;
      } else if (r > C.rockLevel) {
        tiles[i] = TileType.Rock;
        height[i] = toByte(((r - C.rockLevel) / (1 - C.rockLevel)) * 1.4 + 0.1);
      } else if (forest.fbm(x * C.forestScale, y * C.forestScale, 3) > C.forestLevel) {
        tiles[i] = TileType.Forest;
      } else {
        tiles[i] = TileType.Meadow;
      }
    }
  }

  // 2. Vorkommen, jedes mit eigener Noise-Ebene. Frühere Einträge haben Vorrang.
  for (let d = 0; d < deposits.length; d++) {
    const def = deposits[d];
    const noise = new SimplexNoise(deriveSeed(seed, `deposit:${def.id}`));
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        if (tiles[i] !== TileType.Meadow && tiles[i] !== TileType.Forest) continue;
        const v = noise.fbm(x * def.noiseScale, y * def.noiseScale, 2) * 0.5 + 0.5;
        if (v < def.threshold) continue;
        const t = (v - def.threshold) / (1 - def.threshold);
        tiles[i] = TileType.Deposit;
        world.resource[i] = d + 1;
        world.purity[i] = t < C.purityPoorBelow ? 1 : t > C.purityRichAbove ? 3 : 2;
      }
    }
  }

  // 3. Startgebiet in der Kartenmitte
  prepareStartArea(world, seed, deposits);
  world.generated = true;
  return world;
}

function toByte(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v * 255)));
}

function prepareStartArea(world: World, seed: number, deposits: readonly DepositDef[]): void {
  const { size, tiles } = world;
  const sx = Math.floor(size / 2);
  const sy = Math.floor(size / 2);
  world.startX = sx;
  world.startY = sy;
  const rng = new Rng(deriveSeed(seed, 'start'));

  // Freie Wiese um den Startpunkt
  forEachInRadius(world, sx, sy, C.startClearRadius, (i) => {
    tiles[i] = TileType.Meadow;
    world.resource[i] = 0;
    world.purity[i] = 0;
    world.relief[i] = 0;
  });

  // Wald, Stein und Kupfer in unterschiedlichen Richtungen, damit sie sich nicht überlappen
  const baseAngle = rng.next() * Math.PI * 2;
  const targets = 1 + deposits.filter((d) => d.startGuarantee).length;
  let slot = 0;
  const angleFor = (): number =>
    baseAngle + (slot++ / targets) * Math.PI * 2 + rng.range(-0.3, 0.3);

  const forestCount = countInRadius(
    world,
    sx,
    sy,
    C.startForestSearchRadius,
    (i) => tiles[i] === TileType.Forest,
  );
  const forestAngle = angleFor();
  if (forestCount < C.startForestMinTiles) {
    stampBlob(world, rng, sx, sy, forestAngle, C.startForestDistance, C.startForestRadius, (i) => {
      if (tiles[i] === TileType.Deposit) return;
      tiles[i] = TileType.Forest;
      world.relief[i] = 0;
    });
  }

  for (let d = 0; d < deposits.length; d++) {
    const def = deposits[d];
    if (!def.startGuarantee) continue;
    const angle = angleFor();
    const have = countInRadius(
      world,
      sx,
      sy,
      C.startDepositSearchRadius,
      (i) => world.resource[i] === d + 1,
    );
    if (have >= C.startDepositMinTiles) continue;
    stampBlob(world, rng, sx, sy, angle, C.startDepositDistance, C.startDepositRadius, (i) => {
      if (tiles[i] === TileType.Deposit) return;
      tiles[i] = TileType.Deposit;
      world.resource[i] = d + 1;
      world.purity[i] = 2;
      world.relief[i] = 0;
    });
  }
}

/** Setzt einen runden, leicht ausgefransten Fleck in Richtung `angle`, außerhalb der freien Startwiese. */
function stampBlob(
  world: World,
  rng: Rng,
  sx: number,
  sy: number,
  angle: number,
  distance: number,
  radius: number,
  apply: (i: number) => void,
): void {
  const cx = Math.round(sx + Math.cos(angle) * distance);
  const cy = Math.round(sy + Math.sin(angle) * distance);
  const r = Math.ceil(radius) + 1;
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (!world.inBounds(x, y)) continue;
      const jitter = rng.range(-0.6, 0.6);
      if (Math.hypot(x - cx, y - cy) > radius + jitter) continue;
      if (Math.hypot(x - sx, y - sy) <= C.startClearRadius + 0.5) continue;
      apply(world.index(x, y));
    }
  }
}

function forEachInRadius(
  world: World,
  cx: number,
  cy: number,
  radius: number,
  fn: (i: number) => void,
): void {
  const r = Math.ceil(radius);
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (world.inBounds(x, y) && Math.hypot(x - cx, y - cy) <= radius) fn(world.index(x, y));
    }
  }
}

function countInRadius(
  world: World,
  cx: number,
  cy: number,
  radius: number,
  test: (i: number) => boolean,
): number {
  let n = 0;
  forEachInRadius(world, cx, cy, radius, (i) => {
    if (test(i)) n++;
  });
  return n;
}
