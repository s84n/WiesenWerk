import { MACHINES } from '../data/balance';
import { BUILDINGS } from '../data/buildings';
import { MAX_RECIPE_INPUTS, RECIPE_INPUTS } from '../data/recipes';
import { MachineState } from './machines';
import type { Simulation } from './simulation';

/** Warum eine Maschine nicht arbeitet (für die Engpass-Anzeige). */
export const Bottleneck = {
  /** Es fehlt eine Zutat bzw. Brennstoff (`item`). */
  Missing: 0,
  /** Am Ausgang liegt kein Band. */
  NoBelt: 1,
  /** Das Band am Ausgang läuft auf das Gebäude zu. */
  WrongWay: 2,
  /** Das Band am Ausgang ist voll. */
  BeltFull: 3,
  /** Kein Strom. */
  NoPower: 4,
  /** Kein Rezept bzw. kein Item gewählt. */
  NoRecipe: 5,
} as const;
export type Bottleneck = (typeof Bottleneck)[keyof typeof Bottleneck];

/** Maschinen gleicher Art mit demselben Problem. */
export interface BottleneckGroup {
  type: number;
  reason: Bottleneck;
  /** Fehlendes Item bei `Missing` (sonst −1). */
  item: number;
  ids: number[];
}

/** Warum der Ausgang blockiert ist: kein Band, falsche Richtung oder Band voll. */
export function outputBlockCause(sim: Simulation, id: number): Bottleneck {
  const tile = sim.machines.outTile[id];
  if (tile < 0) return Bottleneck.NoBelt;
  const seg = sim.belts.tileSegment[tile];
  if (seg < 0) return Bottleneck.NoBelt;
  const dir = sim.belts.segments[seg]!.dirs[sim.belts.tileIndex[tile]];
  if (dir === ((sim.machines.outDir[id] + 2) & 3)) return Bottleneck.WrongWay;
  return Bottleneck.BeltFull;
}

/**
 * Hat diese Maschine gerade ein echtes Problem? Kurze Pausen zwischen zwei Durchläufen zählen
 * nicht: Erst nach `MACHINES.problemDelayTicks` im selben Zustand gilt sie als blockiert.
 */
export function hasProblem(sim: Simulation, id: number): boolean {
  const m = sim.machines;
  const s = m.state[id];
  if (s === MachineState.Working || s === MachineState.Idle) return false;
  return sim.tick - m.stateSince[id] >= MACHINES.problemDelayTicks;
}

/** Was fehlt einer wartenden Maschine? (−1 = unbekannt) */
function missingItem(sim: Simulation, id: number): number {
  const m = sim.machines;
  const kind = BUILDINGS[sim.buildings.type[id]].behavior.kind;
  if (kind === 'crafter') {
    const r = m.recipe[id];
    if (r < 0) return -1;
    const inputs = RECIPE_INPUTS[r];
    for (let j = 0; j < inputs.length; j++)
      if (m.inBuf[id * MAX_RECIPE_INPUTS + j] < inputs[j].amount) return inputs[j].item;
    return -1;
  }
  if (kind === 'burner') return m.fuelItem[id];
  if (kind === 'dispenser') return m.recipe[id];
  return m.extractItem[id];
}

/**
 * Alle Maschinen mit Problemen, zusammengefasst nach Gebäudeart, Grund und fehlendem Item;
 * die größten Gruppen zuerst. Reine Abfrage, ändert nichts.
 */
export function findBottlenecks(sim: Simulation): BottleneckGroup[] {
  const m = sim.machines;
  const groups = new Map<string, BottleneckGroup>();
  for (const list of [m.crafters, m.extractors, m.burners, m.dispensers]) {
    for (let k = 0; k < list.length; k++) {
      const id = list[k];
      if (!hasProblem(sim, id)) continue;
      const s = m.state[id];
      let reason: Bottleneck;
      let item = -1;
      if (s === MachineState.WaitingInput) {
        reason = Bottleneck.Missing;
        item = missingItem(sim, id);
      } else if (s === MachineState.OutputBlocked) reason = outputBlockCause(sim, id);
      else if (s === MachineState.NoPower) reason = Bottleneck.NoPower;
      else reason = Bottleneck.NoRecipe;
      const type = sim.buildings.type[id];
      const key = `${type}/${reason}/${item}`;
      let g = groups.get(key);
      if (!g) {
        g = { type, reason, item, ids: [] };
        groups.set(key, g);
      }
      g.ids.push(id);
    }
  }
  return [...groups.values()].sort((a, b) => b.ids.length - a.ids.length || a.type - b.type);
}
