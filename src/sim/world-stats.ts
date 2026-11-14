import { TileType } from '../data/world';
import type { World } from './world';

/** Zählt Feldarten – für Tests und zum Abstimmen der Generator-Parameter. */
export function tileStats(world: World): Record<keyof typeof TileType, number> {
  const counts = { Meadow: 0, Forest: 0, Deposit: 0, Water: 0, Rock: 0 };
  const names = Object.keys(TileType) as (keyof typeof TileType)[];
  for (let i = 0; i < world.tiles.length; i++) counts[names[world.tiles[i]]]++;
  return counts;
}
