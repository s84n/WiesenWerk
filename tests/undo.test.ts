import { describe, expect, it } from 'vitest';
import { UndoManager } from '../src/core/undo';
import { ITEM_ID } from '../src/data/items';
import type { Simulation } from '../src/sim/simulation';
import { B, line, makePoweredSim, unlockAll } from './helpers';

/** Wie im Spiel: Befehle anwenden, Ereignisse aufzeichnen, Liste leeren. */
function frame(sim: Simulation, undo: UndoManager): void {
  sim.flushCommands();
  undo.record(sim, sim.events);
  sim.clearEvents();
}

describe('Rückgängig', () => {
  it('reißt Gebautes wieder ab und baut Abgerissenes samt Rezept neu', () => {
    const sim = makePoweredSim();
    const undo = new UndoManager();
    const stone = sim.inventory.get(ITEM_ID.stone);
    sim.enqueue({ type: 'build', building: B.furnace, x: 4, y: 4, rot: 1, recipe: 1 });
    frame(sim, undo);
    const id = sim.buildingAt(4, 4);
    expect(sim.machines.recipe[id]).toBe(1); // Rezept beim Bauen gesetzt (Pipette)
    expect(sim.inventory.get(ITEM_ID.stone)).toBe(stone - 20);

    sim.enqueue({ type: 'demolish', x: 4, y: 4 });
    frame(sim, undo);
    expect(sim.buildingAt(4, 4)).toBe(-1);

    expect(undo.undo(sim)).toBe(1); // Abriss rückgängig
    frame(sim, undo);
    const again = sim.buildingAt(4, 4);
    expect(again).toBeGreaterThanOrEqual(0);
    expect(sim.buildings.rot[again]).toBe(1);
    expect(sim.machines.recipe[again]).toBe(1);

    expect(undo.undo(sim)).toBe(1); // Bau rückgängig
    frame(sim, undo);
    expect(sim.buildingAt(4, 4)).toBe(-1);
    expect(sim.inventory.get(ITEM_ID.stone)).toBe(stone);
    expect(undo.undo(sim)).toBe(0);
  });

  it('nimmt eine ganze Bandlinie und ein Aufwerten durch Überbauen zurück', () => {
    const sim = unlockAll(makePoweredSim());
    const undo = new UndoManager();
    sim.enqueue({ type: 'buildLine', building: B.beltMk1, path: line(2, 2, 2, 6) });
    frame(sim, undo);
    expect(sim.typeCount[B.beltMk1]).toBe(6);
    sim.enqueue({ type: 'buildLine', building: B.beltMk2, path: line(2, 2, 2, 6) });
    frame(sim, undo);
    expect(sim.typeCount[B.beltMk2]).toBe(6);
    undo.undo(sim);
    frame(sim, undo);
    expect(sim.typeCount[B.beltMk1]).toBe(6);
    expect(sim.typeCount[B.beltMk2]).toBe(0);
    undo.undo(sim);
    frame(sim, undo);
    expect(sim.typeCount[B.beltMk1]).toBe(0);
  });
});
