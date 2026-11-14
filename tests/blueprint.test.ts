import { describe, expect, it } from 'vitest';
import { RECIPES } from '../src/data/recipes';
import { blueprintCost, copyArea, placeBlueprint, rotateBlueprint } from '../src/sim/blueprint';
import { B, belt, build, line, makeSim } from './helpers';

describe('Blaupausen', () => {
  it('kopiert Gebäude samt Drehung und Rezept und fügt sie woanders ein', () => {
    const sim = makeSim(48);
    build(sim, B.furnace, 4, 4, 0);
    const f = sim.buildingAt(4, 4);
    const ingot = RECIPES.findIndex((r) => r.key === 'copperIngot');
    sim.enqueue({ type: 'setRecipe', building: f, recipe: ingot });
    belt(sim, line(4, 6, 2, 3)); // Band vom Ausgang nach Süden
    const bp = copyArea(sim, 3, 3, 6, 9)!;
    expect(bp.entries.length).toBe(4);
    expect(bp.w).toBe(2);
    expect(bp.h).toBe(5);
    expect(bp.entries[0].building).toBe(B.furnace); // Gebäude vor Bändern

    const before = sim.buildingCount;
    sim.enqueue({ type: 'buildMany', list: placeBlueprint(bp, 20, 20) });
    sim.flushCommands();
    expect(sim.buildingCount).toBe(before + 4);
    const copy = sim.buildingAt(20, 20);
    expect(sim.buildings.type[copy]).toBe(B.furnace);
    expect(sim.machines.recipe[copy]).toBe(ingot);
    const beltId = sim.buildingAt(20, 24);
    expect(sim.buildings.type[beltId]).toBe(B.beltMk1);
    expect(sim.buildings.rot[beltId]).toBe(2);
    expect(sim.events.some((e) => e.type === 'blueprintPlaced' && e.built === 4)).toBe(true);
  });

  it('dreht im Uhrzeigersinn: aus einem Band nach Süden wird eines nach Westen', () => {
    const sim = makeSim(48);
    build(sim, B.furnace, 4, 4, 0);
    belt(sim, line(4, 6, 2, 3));
    const bp = rotateBlueprint(copyArea(sim, 4, 4, 5, 8)!);
    expect(bp.w).toBe(5);
    expect(bp.h).toBe(2);
    const furnace = bp.entries.find((e) => e.building === B.furnace)!;
    expect(furnace.rot).toBe(1);
    // Ofen lag oben (dy 0..1): nach der Drehung rechts (dx 3..4)
    expect(furnace.dx).toBe(3);
    expect(furnace.dy).toBe(0);
    const belts = bp.entries.filter((e) => e.building === B.beltMk1);
    expect(belts.every((e) => e.rot === 3)).toBe(true);
    expect(belts.map((e) => e.dx).sort()).toEqual([0, 1, 2]);
    // viermal gedreht = wie vorher
    const orig = copyArea(sim, 4, 4, 5, 8)!;
    expect(rotateBlueprint(rotateBlueprint(rotateBlueprint(bp)))).toEqual(orig);
  });

  it('überspringt blockierte Felder, kopiert die Zentrale nicht und rechnet die Kosten zusammen', () => {
    const sim = makeSim(48);
    build(sim, B.hq, 10, 10);
    build(sim, B.furnace, 14, 10);
    const bp = copyArea(sim, 10, 10, 15, 12)!;
    expect(bp.entries.length).toBe(1);
    expect(blueprintCost(bp)).toEqual([{ item: 1, amount: 20 }]);
    // auf den Ofen selbst einfügen: blockiert
    sim.enqueue({ type: 'buildMany', list: placeBlueprint(bp, 14, 10) });
    sim.flushCommands();
    expect(sim.events.some((e) => e.type === 'blueprintPlaced' && e.built === 0)).toBe(true);
    expect(copyArea(sim, 0, 0, 3, 3)).toBeNull();
  });
});
