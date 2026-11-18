import { describe, expect, it } from 'vitest';
import { COZY, POWER } from '../src/data/balance';
import { BUILDINGS } from '../src/data/buildings';
import { SIM_CONFIG } from '../src/data/config';
import { ITEM_COUNT, ITEM_ID } from '../src/data/items';
import { DEPOSITS } from '../src/data/world';
import type { CycleInfo } from '../src/sim/machines';
import { PlaceResult, checkPlacement } from '../src/sim/placement';
import { deserialize, serialize } from '../src/sim/serialize';
import { Simulation } from '../src/sim/simulation';
import { generateWorld } from '../src/sim/worldgen';
import { B, build, makePoweredSim, makeSim, run, unlimitedPower, unlockAll } from './helpers';

const TPS = SIM_CONFIG.ticksPerSecond;

function gardenDef(key: string): { growSeconds: number; ripeSeconds: number } {
  const b = BUILDINGS[B[key]].behavior;
  if (b.kind !== 'garden') throw new Error('kein Garten');
  return b;
}

describe('Gärten', () => {
  it('Gemüsebeet und Blumenwiese sind von Anfang an baubar', () => {
    const sim = makeSim();
    expect(sim.research.buildingUnlocked[B.vegetableBed]).toBe(1);
    expect(sim.research.buildingUnlocked[B.flowerMeadow]).toBe(1);
    expect(sim.research.buildingUnlocked[B.orchard]).toBe(0);
  });

  it('wachsen heran, stehen reif da und werden dann geerntet', () => {
    const sim = makeSim();
    build(sim, B.vegetableBed, 4, 4);
    const id = sim.buildingAt(4, 4);
    const { growSeconds, ripeSeconds } = gardenDef('vegetableBed');
    run(sim, (growSeconds * TPS) / 2);
    expect(sim.machines.gardenGrowth(id)).toBeCloseTo(0.5, 2);
    run(sim, (growSeconds * TPS) / 2);
    expect(sim.machines.gardenGrowth(id)).toBe(1);
    expect(sim.machines.fuelEnergy[id]).toBe(0);
    run(sim, ripeSeconds * TPS);
    // geerntet und neu gesät
    expect(sim.machines.fuelEnergy[id]).toBe(1);
    expect(sim.machines.gardenGrowth(id)).toBe(0);
  });

  it('wachsen mit einem Bienenstock in der Nähe anderthalbmal so schnell', () => {
    const sim = unlockAll(makeSim());
    build(sim, B.vegetableBed, 4, 4);
    build(sim, B.vegetableBed, 25, 25);
    build(sim, B.beehive, 7, 4);
    const near = sim.buildingAt(4, 4);
    const far = sim.buildingAt(25, 25);
    run(sim, 100);
    expect(sim.machines.progress[near]).toBe(150 * POWER.scale);
    expect(sim.machines.progress[far]).toBe(100 * POWER.scale);
    // zwei Bienenstöcke helfen nicht mehr als einer
    build(sim, B.beehive, 4, 7);
    run(sim, 100);
    expect(sim.machines.progress[near]).toBe(300 * POWER.scale);
  });
});

describe('Gemütlichkeit', () => {
  it('macht Maschinen in der Nähe schneller, höchstens um den Deckel', () => {
    const sim = makePoweredSim();
    build(sim, B.furnace, 10, 10);
    const furnace = sim.buildingAt(10, 10);
    expect(sim.cozy.bonusOf(furnace)).toBe(0);
    build(sim, B.flowerMeadow, 13, 10);
    const value = BUILDINGS[B.flowerMeadow].cozy!.value;
    expect(sim.cozy.bonusOf(furnace)).toBe(value);
    // viele Gärten: gedeckelt
    build(sim, B.flowerMeadow, 7, 10);
    build(sim, B.flowerMeadow, 10, 13);
    build(sim, B.flowerMeadow, 10, 7);
    build(sim, B.vegetableBed, 13, 13);
    expect(sim.cozy.bonusOf(furnace)).toBe(COZY.maxBonus);
  });

  it('wirkt nur in Reichweite und verschwindet beim Abriss', () => {
    const sim = makePoweredSim();
    build(sim, B.furnace, 2, 2);
    const furnace = sim.buildingAt(2, 2);
    build(sim, B.flowerMeadow, 20, 20);
    expect(sim.cozy.bonusOf(furnace)).toBe(0);
    build(sim, B.flowerMeadow, 5, 2);
    expect(sim.cozy.bonusOf(furnace)).toBeGreaterThan(0);
    sim.enqueue({ type: 'demolish', x: 5, y: 2 });
    sim.flushCommands();
    expect(sim.cozy.bonusOf(furnace)).toBe(0);
  });

  it('verkürzt die Zeit je Teil', () => {
    const sim = makePoweredSim();
    build(sim, B.furnace, 10, 10);
    const furnace = sim.buildingAt(10, 10);
    sim.enqueue({ type: 'setRecipe', building: furnace, recipe: 0 });
    sim.flushCommands();
    const info: CycleInfo = { fraction: 0, remainingTicks: 0, ticksPerItem: 0 };
    sim.machines.cycleOf(furnace, info);
    const before = info.ticksPerItem;
    for (const [x, y] of [
      [13, 10],
      [7, 10],
      [10, 13],
      [10, 7],
    ])
      build(sim, B.flowerMeadow, x, y);
    sim.machines.cycleOf(furnace, info);
    expect(info.ticksPerItem).toBeLessThan(before);
    expect(info.ticksPerItem).toBeGreaterThanOrEqual(Math.floor(before / 1.1));
  });

  it('Dekoration zählt auch', () => {
    const sim = unlockAll(makePoweredSim());
    build(sim, B.furnace, 10, 10);
    build(sim, B.ornamentalTree, 12, 10);
    expect(sim.cozy.bonusOf(sim.buildingAt(10, 10))).toBe(BUILDINGS[B.ornamentalTree].cozy!.value);
  });
});

describe('Gärten im Spielstand', () => {
  it('behalten Wachstum und Ernten und laufen exakt gleich weiter', () => {
    const sim = unlockAll(unlimitedPower(new Simulation(generateWorld(4711, undefined, DEPOSITS))));
    for (let i = 0; i < ITEM_COUNT; i++) sim.inventory.add(i, 1000);
    const c = sim.world.size >> 1;
    const spots: [number, number, number][] = [];
    for (const type of [B.vegetableBed, B.beehive, B.furnace, B.flowerMeadow]) {
      search: for (let y = c - 30; y < c + 30; y++)
        for (let x = c - 30; x < c + 30; x++)
          if (checkPlacement(sim, type, x, y, 0) === PlaceResult.Ok) {
            build(sim, type, x, y);
            spots.push([type, x, y]);
            break search;
          }
    }
    expect(spots.length).toBe(4);
    run(sim, 20 * 250);
    const bed = sim.buildingAt(spots[0][1], spots[0][2]);
    const saved = serialize(sim, { name: 'Test', savedAt: 0 }, [0, 0, 0]);
    const loaded = unlimitedPower(deserialize(JSON.parse(JSON.stringify(saved))));
    expect(loaded.machines.progress[bed]).toBe(sim.machines.progress[bed]);
    expect(loaded.machines.fuelEnergy[bed]).toBe(sim.machines.fuelEnergy[bed]);
    expect(loaded.machines.gardens).toEqual(sim.machines.gardens);
    run(sim, 20 * 60);
    run(loaded, 20 * 60);
    expect(loaded.machines.progress[bed]).toBe(sim.machines.progress[bed]);
    expect(JSON.stringify(serialize(loaded, saved.meta, [0, 0, 0]))).toBe(
      JSON.stringify(serialize(sim, saved.meta, [0, 0, 0])),
    );
  });
});

describe('Garten-Waren', () => {
  function emptySim(): Simulation {
    const sim = makeSim();
    sim.inventory.amounts.fill(0);
    for (const key of ['wood', 'stone', 'plank'] as const) sim.inventory.add(ITEM_ID[key], 1000);
    return sim;
  }

  it('die Ernte kommt direkt in den Vorrat', () => {
    const sim = emptySim();
    build(sim, B.vegetableBed, 4, 4);
    const { growSeconds, ripeSeconds } = gardenDef('vegetableBed');
    run(sim, (growSeconds + ripeSeconds) * TPS);
    expect(sim.inventory.get(ITEM_ID.vegetable)).toBe(8);
    expect(sim.stats.totalProduced[ITEM_ID.vegetable]).toBe(8);
  });

  it('Kompost im Vorrat verdoppelt die nächste Ernte', () => {
    const sim = emptySim();
    build(sim, B.flowerMeadow, 4, 4);
    const { growSeconds, ripeSeconds } = gardenDef('flowerMeadow');
    sim.inventory.add(ITEM_ID.compost, 1);
    const cycle = (growSeconds + ripeSeconds) * TPS;
    run(sim, cycle); // erste Ernte normal, danach wird gedüngt
    expect(sim.inventory.get(ITEM_ID.flowers)).toBe(6);
    expect(sim.inventory.get(ITEM_ID.compost)).toBe(0);
    run(sim, cycle);
    expect(sim.inventory.get(ITEM_ID.flowers)).toBe(6 + 12);
    run(sim, cycle);
    expect(sim.inventory.get(ITEM_ID.flowers)).toBe(6 + 12 + 6);
  });

  it('Bienenstöcke machen Honig je bestäubtem Garten (gedeckelt)', () => {
    const sim = unlockAll(emptySim());
    build(sim, B.beehive, 10, 10);
    const hive = sim.buildingAt(10, 10);
    run(sim, 60 * TPS);
    expect(sim.inventory.get(ITEM_ID.honey)).toBe(0);
    build(sim, B.flowerMeadow, 7, 10);
    build(sim, B.flowerMeadow, 12, 10);
    expect(sim.machines.honeyPerMinute(hive)).toBe(2);
    run(sim, 60 * TPS);
    expect(sim.inventory.get(ITEM_ID.honey)).toBe(2);
    for (const [x, y] of [
      [10, 7],
      [10, 12],
      [7, 13],
    ])
      build(sim, B.flowerMeadow, x, y);
    expect(sim.machines.honeyPerMinute(hive)).toBe(4);
  });

  it('die Backstube backt aus Äpfeln und Honig Apfelkuchen', () => {
    const sim = unlockAll(makePoweredSim());
    build(sim, B.bakery, 10, 10);
    const bakery = sim.buildingAt(10, 10);
    for (let k = 0; k < 2; k++) sim.machines.accept(bakery, ITEM_ID.apple);
    sim.machines.accept(bakery, ITEM_ID.honey);
    run(sim, 8 * TPS);
    expect(sim.stats.totalProduced[ITEM_ID.cake]).toBe(1);
  });

  it('Bienenstöcke behalten ihren Honig-Fortschritt im Spielstand', () => {
    const sim = unlockAll(new Simulation(generateWorld(4711, undefined, DEPOSITS)));
    for (let i = 0; i < ITEM_COUNT; i++) sim.inventory.add(i, 1000);
    const c = sim.world.size >> 1;
    const placed: number[] = [];
    for (const type of [B.beehive, B.flowerMeadow]) {
      search: for (let y = c - 20; y < c + 20; y++)
        for (let x = c - 20; x < c + 20; x++)
          if (
            checkPlacement(sim, type, x, y, 0) === PlaceResult.Ok &&
            (placed.length === 0 || Math.abs(x - placed[0]) + Math.abs(y - placed[1]) < 5)
          ) {
            build(sim, type, x, y);
            placed.push(x, y);
            break search;
          }
    }
    const hive = sim.buildingAt(placed[0], placed[1]);
    run(sim, 700);
    expect(sim.machines.progress[hive]).toBeGreaterThan(0);
    const loaded = deserialize(
      JSON.parse(JSON.stringify(serialize(sim, { name: 'T', savedAt: 0 }, [0, 0, 0]))),
    );
    expect(loaded.machines.progress[hive]).toBe(sim.machines.progress[hive]);
  });
});
