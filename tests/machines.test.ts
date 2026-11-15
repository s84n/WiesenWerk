import { describe, expect, it } from 'vitest';
import { ITEM_ID } from '../src/data/items';
import { TileType } from '../src/data/world';
import { MachineState, type CycleInfo } from '../src/sim/machines';
import { RECIPE_TICKS } from '../src/data/recipes';
import { B, build, makePoweredSim as makeSim, run, setDeposit } from './helpers';

describe('Maschinen', () => {
  it('Schmelzofen wartet ohne Rezept und verarbeitet nach Rezeptwahl im festen Takt', () => {
    const sim = makeSim();
    build(sim, B.furnace, 4, 4);
    const id = sim.buildingAt(4, 4);
    run(sim, 2);
    expect(sim.machines.state[id]).toBe(MachineState.NoRecipe);
    sim.enqueue({ type: 'setRecipe', building: id, recipe: 0 });
    sim.flushCommands();
    // Erz direkt anliefern (wie vom Band)
    expect(sim.machines.accept(id, ITEM_ID.copperOre)).toBe(true);
    expect(sim.machines.accept(id, ITEM_ID.copperOre)).toBe(true);
    expect(sim.machines.accept(id, ITEM_ID.copperOre)).toBe(false); // Puffer voll (2 Durchläufe)
    expect(sim.machines.accept(id, ITEM_ID.stone)).toBe(false); // passt nicht zum Rezept
    run(sim, 1);
    expect(sim.machines.state[id]).toBe(MachineState.Working);
    run(sim, 40);
    expect(sim.machines.outBuf[id * 2]).toBe(1);
    run(sim, 40);
    expect(sim.machines.outBuf[id * 2]).toBe(2);
    // Ausgang voll (kein Band): wartet
    run(sim, 5);
    expect(sim.machines.state[id]).not.toBe(MachineState.Working);
  });

  it('erstattet beim Rezeptwechsel und beim Abriss den Pufferinhalt', () => {
    const sim = makeSim();
    build(sim, B.furnace, 4, 4);
    const id = sim.buildingAt(4, 4);
    const ore = ITEM_ID.copperOre;
    const before = sim.inventory.get(ore);
    sim.machines.accept(id, ore); // wählt Rezept automatisch
    sim.machines.accept(id, ore);
    expect(sim.machines.recipe[id]).toBe(0);
    sim.enqueue({ type: 'setRecipe', building: id, recipe: 1 });
    sim.flushCommands();
    expect(sim.inventory.get(ore)).toBe(before + 2);
    sim.machines.accept(id, ITEM_ID.stone);
    const stone = sim.inventory.get(ITEM_ID.stone);
    sim.enqueue({ type: 'demolish', x: 4, y: 4 });
    sim.flushCommands();
    expect(sim.inventory.get(ITEM_ID.stone)).toBe(stone + 1 + 20); // Puffer + Baukosten
  });

  it('lehnt Rezepte anderer Maschinen ab', () => {
    const sim = makeSim();
    build(sim, B.furnace, 4, 4);
    const id = sim.buildingAt(4, 4);
    sim.enqueue({ type: 'setRecipe', building: id, recipe: 3 }); // Bretter = Werkstatt
    sim.flushCommands();
    expect(sim.machines.recipe[id]).toBe(-1);
  });

  it('Werkstatt macht aus 1 Holz 2 Bretter', () => {
    const sim = makeSim();
    build(sim, B.workshop, 4, 4);
    const id = sim.buildingAt(4, 4);
    expect(sim.machines.accept(id, ITEM_ID.wood)).toBe(true);
    run(sim, 41);
    expect(sim.machines.outBuf[id * 2]).toBe(2);
  });

  it('Bergwerk richtet sich nach der Reinheit des Vorkommens', () => {
    for (const [purity, ticks] of [
      [1, 80],
      [2, 40],
      [3, 20],
    ]) {
      const sim = makeSim();
      setDeposit(sim, 4, 4, 1, purity);
      build(sim, B.miner, 4, 4);
      const id = sim.buildingAt(4, 4);
      expect(sim.machines.extractItem[id]).toBe(ITEM_ID.stone);
      expect(sim.machines.extractTicks[id]).toBe(ticks);
    }
  });

  it('Holzfäller fällt Bäume in Reichweite und wartet, wenn keine mehr da sind', () => {
    const sim = makeSim();
    const tree = sim.world.index(10, 5);
    sim.world.tiles[tree] = TileType.Forest;
    sim.trees.wood[tree] = 4;
    const far = sim.world.index(20, 20);
    sim.world.tiles[far] = TileType.Forest;
    sim.trees.wood[far] = 4;
    build(sim, B.lumberjack, 4, 4); // Reichweite x 0..9, y 0..9 → (10,5) liegt außerhalb
    const id = sim.buildingAt(4, 4);
    run(sim, 100);
    expect(sim.machines.state[id]).toBe(MachineState.WaitingInput);

    // Baum in Reichweite
    const near = sim.world.index(8, 5);
    sim.world.tiles[near] = TileType.Forest;
    sim.trees.wood[near] = 4;
    sim.enqueue({ type: 'demolish', x: 4, y: 4 });
    sim.flushCommands();
    build(sim, B.lumberjack, 4, 4);
    const id2 = sim.buildingAt(4, 4);
    run(sim, 80); // 2 Holz
    expect(sim.trees.wood[near]).toBe(2);
    expect(sim.machines.outBuf[id2 * 2]).toBe(2);
    expect(sim.trees.wood[far]).toBe(4);
  });

  it('Holzfäller ohne Band sammelt bis zu 50 Holz in seiner Hütte, ganz ohne Strom', () => {
    const sim = makeSim(48);
    sim.power.factorOf = () => 0; // kein Strom im ganzen Spiel – der Holzfäller braucht keinen
    for (let y = 0; y < 14; y++)
      for (let x = 10; x < 14; x++) {
        const t = sim.world.index(x, y);
        sim.world.tiles[t] = TileType.Forest;
        sim.trees.wood[t] = 4;
      }
    build(sim, B.lumberjack, 8, 4);
    const id = sim.buildingAt(8, 4);
    run(sim, 20 * 60 * 2); // 2 Minuten: 60 Holz möglich, Platz für 50
    expect(sim.machines.outBuf[id * 2]).toBe(50);
    expect(sim.machines.state[id]).toBe(MachineState.OutputBlocked);
    // Abriss gibt das gelagerte Holz zurück
    const wood = sim.inventory.get(ITEM_ID.wood);
    sim.enqueue({ type: 'demolish', x: 8, y: 4 });
    sim.flushCommands();
    expect(sim.inventory.get(ITEM_ID.wood)).toBe(wood + 50 + 10);
  });

  it('meldet Fortschritt und Restzeit des aktuellen Teils passend zum echten Takt', () => {
    const sim = makeSim();
    build(sim, B.furnace, 4, 4);
    const id = sim.buildingAt(4, 4);
    const info: CycleInfo = { fraction: 0, remainingTicks: 0, ticksPerItem: 0 };
    sim.machines.cycleOf(id, info);
    expect(info.ticksPerItem).toBe(0); // noch kein Rezept
    sim.machines.accept(id, ITEM_ID.copperOre); // wählt das Rezept automatisch
    const ticks = RECIPE_TICKS[sim.machines.recipe[id]];
    run(sim, 1); // Durchlauf beginnt
    sim.machines.cycleOf(id, info);
    expect(info.ticksPerItem).toBe(ticks);
    expect(info.remainingTicks).toBe(ticks);
    expect(info.fraction).toBe(0);
    // Bis kurz vor Schluss zählt die Restzeit herunter, dann kommt das Teil genau pünktlich heraus
    run(sim, ticks - 1);
    sim.machines.cycleOf(id, info);
    expect(info.remainingTicks).toBe(1);
    expect(info.fraction).toBeGreaterThan(0.9);
    expect(sim.machines.outBuf[id * 2]).toBe(0);
    run(sim, 1);
    expect(sim.machines.outBuf[id * 2]).toBe(1);
  });
});
