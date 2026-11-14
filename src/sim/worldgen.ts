import {
  DEPOSITS,
  TileType,
  WORLD_CONFIG,
  WORLD_GEN,
  WORLD_GEN_VERSION,
  type DepositDef,
} from '../data/world';
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
  genVersion: number = WORLD_GEN_VERSION,
): World {
  const world = new World(seed, size);
  world.genVersion = genVersion;
  const G = WORLD_GEN[Math.min(WORLD_GEN.length, Math.max(1, genVersion)) - 1];
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
      } else if (lakes.fbm(x * G.lakeScale, y * G.lakeScale, 3) < G.waterLevel) {
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

  // 1b. Kleine Tümpel im Inland zu Wiese (Gewässer, die den Rand berühren, bleiben)
  if (G.minLakeTiles > 0) removeSmallLakes(world, G.minLakeTiles);

  // 2. Vorkommen, jedes mit eigener Noise-Ebene. Frühere Einträge haben Vorrang.
  for (let d = 0; d < deposits.length; d++) {
    const def = deposits[d];
    if (def.late) continue;
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

  // 4. Späte Vorkommen (Eisen, Kohle, Sand): nur auf Wiese/Wald außerhalb des Startgebiets,
  // damit die Welt bestehender Spielstände sonst unverändert bleibt
  for (let d = 0; d < deposits.length; d++) {
    if (deposits[d].late) placeLateDeposit(world, seed, d, deposits[d]);
  }
  world.generated = true;
  return world;
}

function placeLateDeposit(world: World, seed: number, d: number, def: DepositDef): void {
  const { size, tiles } = world;
  const noise = new SimplexNoise(deriveSeed(seed, `deposit:${def.id}`));
  const sx = world.startX;
  const sy = world.startY;
  const clear2 = C.lateClearRadius * C.lateClearRadius;
  const free = (i: number, x: number, y: number): boolean =>
    (tiles[i] === TileType.Meadow || tiles[i] === TileType.Forest) &&
    (x - sx) * (x - sx) + (y - sy) * (y - sy) > clear2;
  let near = 0;
  const near2 = (def.nearStart ?? 0) * (def.nearStart ?? 0);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      if (!free(i, x, y)) continue;
      const v = noise.fbm(x * def.noiseScale, y * def.noiseScale, 2) * 0.5 + 0.5;
      if (v < def.threshold) continue;
      const t = (v - def.threshold) / (1 - def.threshold);
      tiles[i] = TileType.Deposit;
      world.resource[i] = d + 1;
      world.purity[i] = t < C.purityPoorBelow ? 1 : t > C.purityRichAbove ? 3 : 2;
      world.relief[i] = 0;
      if ((x - sx) * (x - sx) + (y - sy) * (y - sy) <= near2) near++;
    }
  }
  if (!def.nearStart || near >= C.startDepositMinTiles) return;
  // Kein Vorkommen in erreichbarer Nähe: einen kleinen Fleck setzen (Richtung aus dem Seed)
  const rng = new Rng(deriveSeed(seed, `late:${def.id}`));
  for (let attempt = 0; attempt < 12; attempt++) {
    const angle = rng.next() * Math.PI * 2;
    const dist = C.lateGuaranteeDistance + rng.range(-4, 8);
    const cx = Math.round(sx + Math.cos(angle) * dist);
    const cy = Math.round(sy + Math.sin(angle) * dist);
    let ok = 0;
    forEachInRadius(world, cx, cy, C.lateGuaranteeRadius, (i) => {
      if (free(i, i % size, Math.floor(i / size))) ok++;
    });
    if (ok < C.startDepositMinTiles) continue;
    forEachInRadius(world, cx, cy, C.lateGuaranteeRadius + rng.range(-0.4, 0.4), (i) => {
      if (!free(i, i % size, Math.floor(i / size))) return;
      tiles[i] = TileType.Deposit;
      world.resource[i] = d + 1;
      world.purity[i] = 2;
      world.relief[i] = 0;
    });
    return;
  }
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
  const targets = 1 + deposits.filter((d) => d.startGuarantee && !d.late).length;
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
    if (!def.startGuarantee || def.late) continue;
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

/** Macht zusammenhängende Wasserflächen mit weniger als `min` Feldern zu Wiese. */
function removeSmallLakes(world: World, min: number): void {
  const { size, tiles } = world;
  const seen = new Uint8Array(size * size);
  const stack: number[] = [];
  const body: number[] = [];
  for (let start = 0; start < tiles.length; start++) {
    if (seen[start] || tiles[start] !== TileType.Water) continue;
    body.length = 0;
    let touchesEdge = false;
    stack.push(start);
    seen[start] = 1;
    while (stack.length > 0) {
      const i = stack.pop()!;
      body.push(i);
      const x = i % size;
      const y = (i - x) / size;
      if (x === 0 || y === 0 || x === size - 1 || y === size - 1) touchesEdge = true;
      if (x > 0) visit(i - 1);
      if (x < size - 1) visit(i + 1);
      if (y > 0) visit(i - size);
      if (y < size - 1) visit(i + size);
    }
    if (!touchesEdge && body.length < min) for (const i of body) tiles[i] = TileType.Meadow;
  }
  function visit(j: number): void {
    if (seen[j] || tiles[j] !== TileType.Water) return;
    seen[j] = 1;
    stack.push(j);
  }
}
