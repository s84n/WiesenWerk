import { BUILDINGS, BUILDING_COSTS } from '../data/buildings';
import { TileType } from '../data/world';
import { footprintH, footprintW } from './buildings';
import type { Simulation } from './simulation';

/** Ergebnis der Platzierungsprüfung. */
export const PlaceResult = {
  Ok: 0,
  OutOfBounds: 1,
  Blocked: 2,
  NeedsDeposit: 3,
  Unique: 4,
  Cost: 5,
} as const;
export type PlaceResult = (typeof PlaceResult)[keyof typeof PlaceResult];

/**
 * Prüft, ob ein Gebäude an (x, y) mit Drehung `rot` gebaut werden kann.
 * Reine Abfrage ohne Änderungen – auch für die Bauvorschau genutzt.
 */
export function checkPlacement(
  sim: Simulation,
  type: number,
  x: number,
  y: number,
  rot: number,
): PlaceResult {
  const def = BUILDINGS[type];
  if (!def) return PlaceResult.Blocked;
  if (def.unique && sim.typeCount[type] > 0) return PlaceResult.Unique;

  const { world, trees } = sim;
  const w = footprintW(def, rot);
  const h = footprintH(def, rot);
  let deposits = 0;
  for (let ty = y; ty < y + h; ty++) {
    for (let tx = x; tx < x + w; tx++) {
      if (!world.inBounds(tx, ty)) return PlaceResult.OutOfBounds;
      const i = world.index(tx, ty);
      if (world.building[i] !== 0) return PlaceResult.Blocked;
      const t = world.tiles[i];
      if (t === TileType.Deposit) {
        if (def.placement !== 'deposit') return PlaceResult.Blocked;
        deposits++;
      } else if (!(t === TileType.Meadow || (t === TileType.Forest && trees.wood[i] === 0))) {
        return PlaceResult.Blocked;
      }
    }
  }
  if (def.placement === 'deposit' && deposits === 0) return PlaceResult.NeedsDeposit;
  if (!sim.inventory.canAfford(BUILDING_COSTS[type])) return PlaceResult.Cost;
  return PlaceResult.Ok;
}
