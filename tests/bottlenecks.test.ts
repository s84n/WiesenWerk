import { describe, expect, it } from 'vitest';
import { ITEM_ID } from '../src/data/items';
import { RECIPES } from '../src/data/recipes';
import { Bottleneck, findBottlenecks } from '../src/sim/bottlenecks';
import { B, belt, build, line, makePoweredSim, makeSim, run, unlockAll } from './helpers';

const recipe = (key: string): number => RECIPES.findIndex((r) => r.key === key);

describe('Engpass-Anzeige', () => {
  it('fasst wartende Maschinen nach Art und fehlender Zutat zusammen', () => {
    const sim = makePoweredSim();
    for (const x of [2, 5, 8]) {
      build(sim, B.workshop, x, 2);
      sim.enqueue({
        type: 'setRecipe',
        building: sim.buildingAt(x, 2),
        recipe: recipe('copperWire'),
      });
    }
    build(sim, B.furnace, 2, 8);
    sim.enqueue({
      type: 'setRecipe',
      building: sim.buildingAt(2, 8),
      recipe: recipe('stoneBrick'),
    });
    sim.flushCommands();
    run(sim, 60);
    const groups = findBottlenecks(sim);
    expect(groups[0]).toMatchObject({
      type: B.workshop,
      reason: Bottleneck.Missing,
      item: ITEM_ID.copperIngot,
    });
    expect(groups[0].ids).toHaveLength(3);
    expect(groups[1]).toMatchObject({ type: B.furnace, item: ITEM_ID.stone });
  });

  it('kurze Pausen zwischen zwei Durchläufen zählen nicht als Engpass', () => {
    const sim = makePoweredSim();
    build(sim, B.workshop, 2, 2);
    const id = sim.buildingAt(2, 2);
    sim.enqueue({ type: 'setRecipe', building: id, recipe: recipe('plank') });
    sim.flushCommands();
    // Holz kommt laufend nach, die Bretter werden abgeholt: arbeitet durchgehend
    for (let t = 0; t < 400; t++) {
      sim.machines.accept(id, ITEM_ID.wood);
      sim.machines.outBuf[id * 2] = 0;
      sim.step();
    }
    expect(findBottlenecks(sim)).toHaveLength(0);
  });

  it('erkennt fehlendes Band, falsche Richtung und fehlenden Strom', () => {
    const sim = unlockAll(makeSim(32));
    // Holzfäller ohne Band (Lager voll) → kein Band am Ausgang
    for (let k = 0; k < 6; k++) {
      const t = sim.world.index(10 + k, 2);
      sim.world.tiles[t] = 1;
      sim.trees.wood[t] = 4;
    }
    build(sim, B.lumberjack, 12, 4);
    const lj = sim.buildingAt(12, 4);
    sim.machines.outBuf[lj * 2] = 50;
    run(sim, 60);
    const noBelt = findBottlenecks(sim).find((g) => g.type === B.lumberjack)!;
    expect(noBelt.reason).toBe(Bottleneck.NoBelt);
    // Band in falscher Richtung vor dem Ausgang (Ausgang unten links, zeigt nach Süden)
    belt(sim, line(12, 7, 0, 2));
    run(sim, 60);
    expect(findBottlenecks(sim).find((g) => g.type === B.lumberjack)!.reason).toBe(
      Bottleneck.WrongWay,
    );
    // Werkstatt ohne Strom
    build(sim, B.workshop, 2, 12);
    sim.enqueue({ type: 'setRecipe', building: sim.buildingAt(2, 12), recipe: recipe('plank') });
    sim.flushCommands();
    sim.machines.accept(sim.buildingAt(2, 12), ITEM_ID.wood);
    run(sim, 60);
    expect(findBottlenecks(sim).some((g) => g.reason === Bottleneck.NoPower)).toBe(true);
  });
});
