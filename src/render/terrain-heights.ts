import { TileType } from '../data/world';
import type { World } from '../sim/world';
import { hash3Float } from '../sim/rng';

/**
 * Rein optische Höhen an den Ecken der Felder ((size+1)² Werte).
 * Baubare Felder bleiben fast flach, Felsen wölben sich auf, Wasser senkt sich ab.
 */
export function computeCornerHeights(world: World): Float32Array {
  const { size, tiles, relief, seed } = world;
  const side = size + 1;
  const h = new Float32Array(side * side);

  for (let cy = 0; cy <= size; cy++) {
    for (let cx = 0; cx <= size; cx++) {
      let groundSum = 0;
      let groundN = 0;
      let otherSum = 0;
      let otherN = 0;
      let water = false;
      let rock = false;
      for (let k = 0; k < 4; k++) {
        const tx = cx - 1 + (k & 1);
        const ty = cy - 1 + (k >> 1);
        if (tx < 0 || ty < 0 || tx >= size || ty >= size) continue;
        const i = ty * size + tx;
        const t = tiles[i];
        if (t === TileType.Water) {
          water = true;
          otherSum += -0.8;
          otherN++;
        } else if (t === TileType.Rock) {
          rock = true;
          otherSum += 0.3 + (relief[i] / 255) * 2.8;
          otherN++;
        } else {
          groundSum += t === TileType.Deposit ? 0.05 : 0.02;
          groundN++;
        }
      }
      const jitter = hash3Float(cx, cy, seed) - 0.5;
      let height: number;
      if (cx === 0 || cy === 0 || cx === size || cy === size) {
        height = -1.0; // Kartenrand fällt sanft ins Meer ab
      } else if (water) {
        height = groundN > 0 ? -0.36 : otherSum / otherN + jitter * 0.1;
      } else if (groundN > 0) {
        height = groundSum / groundN + jitter * 0.07;
      } else {
        height = otherSum / otherN + (rock ? jitter * 0.5 : 0);
      }
      h[cy * side + cx] = height;
    }
  }
  return h;
}

/** Mittlere Höhe eines Feldes aus seinen vier Ecken. */
export function tileHeight(heights: Float32Array, size: number, x: number, y: number): number {
  const side = size + 1;
  const i = y * side + x;
  return (heights[i] + heights[i + 1] + heights[i + side] + heights[i + side + 1]) * 0.25;
}
