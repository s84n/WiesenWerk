import { BUILDINGS, BUILDING_COSTS } from '../data/buildings';
import { TileType } from '../data/world';
import { DIR_X, DIR_Y, footprintH, footprintW, rotateDir } from './buildings';
import type { Simulation } from './simulation';

/** Ergebnis der Platzierungsprüfung. */
export const PlaceResult = {
  Ok: 0,
  OutOfBounds: 1,
  Blocked: 2,
  NeedsDeposit: 3,
  Unique: 4,
  Cost: 5,
  /** Noch nicht erforscht. */
  Locked: 6,
  /** Wasserrad: Vorderseite liegt nicht am Wasser. */
  NeedsWater: 7,
  /** Hecke/Rosenbogen: kein Band auf dem Feld. */
  NeedsBelt: 8,
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
  if (!sim.research.buildingUnlocked[type]) return PlaceResult.Locked;
  if (def.unique && sim.typeCount[type] > 0) return PlaceResult.Unique;

  const { world } = sim;
  if (def.placement === 'belt') {
    // Verkleidung: über ein Band, das noch nicht genau diese Verkleidung trägt
    if (!world.inBounds(x, y)) return PlaceResult.OutOfBounds;
    const i = world.index(x, y);
    const id = world.building[i] - 1;
    if (id < 0 || BUILDINGS[sim.buildings.type[id]].behavior.kind !== 'belt')
      return PlaceResult.NeedsBelt;
    if (sim.covers[i] === type + 1) return PlaceResult.Blocked;
    if (!sim.inventory.canAfford(BUILDING_COSTS[type])) return PlaceResult.Cost;
    return PlaceResult.Ok;
  }
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
        if (def.placement === 'ground' || def.placement === 'shore') return PlaceResult.Blocked;
        deposits++;
      } else if (!(t === TileType.Meadow || t === TileType.Forest)) {
        // Wald ist baubar: stehende Bäume werden beim Bauen gerodet
        return PlaceResult.Blocked;
      }
    }
  }
  if (def.placement === 'deposit' && deposits === 0) return PlaceResult.NeedsDeposit;
  if (def.placement === 'shore' && !frontTouchesWater(sim, x, y, w, h, rot))
    return PlaceResult.NeedsWater;
  if (!sim.inventory.canAfford(BUILDING_COSTS[type])) return PlaceResult.Cost;
  return PlaceResult.Ok;
}

/** Grenzt die Vorderseite (ungedreht Süden) an mindestens ein Wasserfeld? */
function frontTouchesWater(
  sim: Simulation,
  x: number,
  y: number,
  w: number,
  h: number,
  rot: number,
): boolean {
  const { world } = sim;
  const d = rotateDir(2, rot);
  for (let ty = y; ty < y + h; ty++) {
    for (let tx = x; tx < x + w; tx++) {
      const nx = tx + DIR_X[d];
      const ny = ty + DIR_Y[d];
      if (nx >= x && nx < x + w && ny >= y && ny < y + h) continue;
      if (world.inBounds(nx, ny) && world.tiles[world.index(nx, ny)] === TileType.Water)
        return true;
    }
  }
  return false;
}
