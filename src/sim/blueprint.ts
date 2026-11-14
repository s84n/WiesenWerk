import { BUILDINGS, BUILDING_COSTS } from '../data/buildings';
import type { ItemAmount } from '../data/items';
import { footprintH, footprintW } from './buildings';
import type { BlueprintPlacement } from './commands';
import type { Simulation } from './simulation';

/** Ein Gebäude in einer Blaupause, relativ zur linken oberen Ecke. */
export interface BlueprintEntry {
  building: number;
  dx: number;
  dy: number;
  rot: number;
  recipe: number;
}

/** Kopierter Fabrikteil: Größe des umschließenden Rechtecks und die Gebäude darin. */
export interface Blueprint {
  w: number;
  h: number;
  entries: BlueprintEntry[];
}

/**
 * Kopiert alle Gebäude, die das Rechteck (Ecken einschließlich) berühren – außer einmaligen wie
 * der Zentrale. Gibt `null` zurück, wenn dort nichts steht.
 */
export function copyArea(
  sim: Simulation,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): Blueprint | null {
  const minX = Math.max(0, Math.min(x0, x1));
  const maxX = Math.min(sim.world.size - 1, Math.max(x0, x1));
  const minY = Math.max(0, Math.min(y0, y1));
  const maxY = Math.min(sim.world.size - 1, Math.max(y0, y1));
  const ids = new Set<number>();
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const id = sim.buildingAt(x, y);
      if (id >= 0 && !BUILDINGS[sim.buildings.type[id]].unique) ids.add(id);
    }
  }
  if (ids.size === 0) return null;
  const b = sim.buildings;
  let bx0 = Infinity;
  let by0 = Infinity;
  let bx1 = -Infinity;
  let by1 = -Infinity;
  for (const id of ids) {
    const def = BUILDINGS[b.type[id]];
    bx0 = Math.min(bx0, b.x[id]);
    by0 = Math.min(by0, b.y[id]);
    bx1 = Math.max(bx1, b.x[id] + footprintW(def, b.rot[id]) - 1);
    by1 = Math.max(by1, b.y[id] + footprintH(def, b.rot[id]) - 1);
  }
  // Gebäude vor Bändern, damit Maschinen zuerst stehen; sonst in ID-Reihenfolge
  const sorted = [...ids].sort(
    (a, c) => Number(isBelt(b.type[a])) - Number(isBelt(b.type[c])) || a - c,
  );
  return {
    w: bx1 - bx0 + 1,
    h: by1 - by0 + 1,
    entries: sorted.map((id) => ({
      building: b.type[id],
      dx: b.x[id] - bx0,
      dy: b.y[id] - by0,
      rot: b.rot[id],
      recipe: BUILDINGS[b.type[id]].behavior.kind === 'crafter' ? sim.machines.recipe[id] : -1,
    })),
  };
}

function isBelt(type: number): boolean {
  return BUILDINGS[type].behavior.kind === 'belt';
}

/** Dreht eine Blaupause um 90° im Uhrzeigersinn (wie R beim Bauen). */
export function rotateBlueprint(bp: Blueprint): Blueprint {
  return {
    w: bp.h,
    h: bp.w,
    entries: bp.entries.map((e) => {
      const def = BUILDINGS[e.building];
      const h = footprintH(def, e.rot);
      return { ...e, dx: bp.h - e.dy - h, dy: e.dx, rot: (e.rot + 1) & 3 };
    }),
  };
}

/** Weltkoordinaten der Gebäude, wenn die linke obere Ecke bei (x, y) liegt. */
export function placeBlueprint(bp: Blueprint, x: number, y: number): BlueprintPlacement[] {
  return bp.entries.map((e) => ({
    building: e.building,
    x: x + e.dx,
    y: y + e.dy,
    rot: e.rot,
    recipe: e.recipe,
  }));
}

/** Gesamtkosten einer Blaupause. */
export function blueprintCost(bp: Blueprint): ItemAmount[] {
  const sum = new Map<number, number>();
  for (const e of bp.entries)
    for (const c of BUILDING_COSTS[e.building]) sum.set(c.item, (sum.get(c.item) ?? 0) + c.amount);
  return [...sum].map(([item, amount]) => ({ item, amount }));
}
