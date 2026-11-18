import { describe, expect, it } from 'vitest';
import { BELTS, MACHINE_LEVELS } from '../src/data/balance';
import { BUILDINGS } from '../src/data/buildings';
import { SIM_CONFIG } from '../src/data/config';
import { ITEMS, ITEM_ID, toAmounts } from '../src/data/items';
import { LANDMARK_NEEDS } from '../src/data/landmark';
import { RECIPES, RECIPE_OUTPUTS } from '../src/data/recipes';
import { RESEARCH, RESEARCH_ID } from '../src/data/research';
import { DEPOSITS } from '../src/data/world';
import { TREES } from '../src/data/balance';
import { deserialize, migrate, serialize } from '../src/sim/serialize';
import { Simulation } from '../src/sim/simulation';
import { generateWorld } from '../src/sim/worldgen';
import { B, build, makePoweredSim, unlimitedPower, unlockAll } from './helpers';

/** Teile, die eine Werkstatt in `ticks` Ticks fertigt (Zutaten werden laufend nachgelegt). */
function produce(sim: Simulation, id: number, input: number, ticks: number): number {
  let made = 0;
  for (let t = 0; t < ticks; t++) {
    sim.machines.accept(id, input);
    sim.step();
    made += sim.machines.outBuf[id * 2];
    sim.machines.outBuf[id * 2] = 0;
  }
  return made;
}

describe('Endprodukte aus Eisen, Glas und Stahl', () => {
  it('jedes Item, das der Uhrturm wünscht, lässt sich gewinnen oder herstellen', () => {
    const raw = new Set<number>([ITEM_ID[TREES.item], ...DEPOSITS.map((d) => ITEM_ID[d.item])]);
    for (const r of RECIPES) for (const o of toAmounts(r.outputs)) raw.add(o.item);
    // Garten-Waren: Ernte der Gärten, Honig der Bienenstöcke
    for (const def of BUILDINGS) {
      if (def.behavior.kind === 'garden')
        for (const y of toAmounts(def.behavior.yields)) raw.add(y.item);
      if (def.behavior.kind === 'beehive') raw.add(ITEM_ID.honey);
    }
    for (const needs of LANDMARK_NEEDS) for (const n of needs) expect(raw.has(n.item)).toBe(true);
  });

  it('jedes neue Endprodukt hat eine Verwendung (Rezept, Forschung oder Uhrturm)', () => {
    const used = new Set<number>();
    for (const r of RECIPES) for (const i of toAmounts(r.inputs)) used.add(i.item);
    for (const r of RESEARCH) for (const c of toAmounts(r.cost)) used.add(c.item);
    for (const needs of LANDMARK_NEEDS) for (const n of needs) used.add(n.item);
    for (const c of MACHINE_LEVELS.crafterCost.flatMap((x) => toAmounts(x))) used.add(c.item);
    for (const key of [
      'ironPlate',
      'lens',
      'clockwork',
      'steelFrame',
      'instrument',
      'steel',
      'glass',
    ])
      expect(used.has(ITEM_ID[key as keyof typeof ITEM_ID])).toBe(true);
  });

  it('Rezepte werden durch die passende Forschung freigeschaltet', () => {
    const sim = makePoweredSim();
    const id = (key: string): number => RECIPES.findIndex((r) => r.key === key);
    expect(sim.research.recipeUnlocked[id('clockwork')]).toBe(0);
    sim.research.restore(
      [
        'logistics1',
        'sheetMetal',
        'assembler',
        'electronics',
        'drives',
        'ironworking',
        'precision',
      ],
      {},
    );
    expect(sim.research.recipeUnlocked[id('ironPlate')]).toBe(1);
    expect(sim.research.recipeUnlocked[id('clockwork')]).toBe(1);
    expect(sim.research.recipeUnlocked[id('instrument')]).toBe(0);
    expect(sim.research.crafterUpgrade).toBe(true);
    expect(RESEARCH[RESEARCH_ID.optics].requires).toContain('precision');
  });

  it('Maschinen auf Stufe 2 arbeiten doppelt so schnell und erstatten die Aufwertung', () => {
    const sim = makePoweredSim();
    build(sim, B.workshop, 4, 4);
    const id = sim.buildingAt(4, 4);
    const plank = RECIPES.findIndex((r) => r.key === 'plank');
    sim.enqueue({ type: 'setRecipe', building: id, recipe: plank });
    sim.enqueue({ type: 'upgradeBuilding', building: id });
    sim.flushCommands();
    expect(sim.machines.upgraded[id]).toBe(0); // ohne Feinmechanik nicht möglich
    const before = produce(sim, id, ITEM_ID.wood, 1200);

    unlockAll(sim);
    const clockwork = sim.inventory.get(ITEM_ID.clockwork);
    sim.enqueue({ type: 'upgradeBuilding', building: id });
    sim.flushCommands();
    expect(sim.machines.upgraded[id]).toBe(1);
    expect(sim.inventory.get(ITEM_ID.clockwork)).toBe(
      clockwork - MACHINE_LEVELS.crafterCost[0].clockwork!,
    );
    const after = produce(sim, id, ITEM_ID.wood, 1200);
    // ohne Aufwertung 30 Bretter pro Minute (abzüglich Anlauf), danach 60
    expect(before).toBeGreaterThanOrEqual(28);
    expect(after).toBe(60);

    // Stufe 3: viermal so schnell wie Stufe 1, Abriss erstattet beide Schritte
    const instruments = sim.inventory.get(ITEM_ID.instrument);
    sim.enqueue({ type: 'upgradeBuilding', building: id });
    sim.flushCommands();
    expect(sim.machines.upgraded[id]).toBe(2);
    expect(produce(sim, id, ITEM_ID.wood, 1200)).toBe(120);
    sim.enqueue({ type: 'upgradeBuilding', building: id });
    sim.flushCommands();
    expect(sim.machines.upgraded[id]).toBe(2); // höher geht es nicht

    sim.enqueue({ type: 'demolish', x: 4, y: 4 });
    sim.flushCommands();
    expect(sim.inventory.get(ITEM_ID.clockwork)).toBe(clockwork);
    expect(sim.inventory.get(ITEM_ID.instrument)).toBe(instruments);
  });

  it('Faustregel: drei Maschinen einer Stufe füllen ein Band derselben Stufe', () => {
    const perMinute = (tps: number): number =>
      Math.round(
        (Math.round((tps * BELTS.unitsPerTile) / SIM_CONFIG.ticksPerSecond) *
          SIM_CONFIG.ticksPerSecond *
          60) /
          BELTS.minSpacing,
      );
    const belts = BUILDINGS.filter((b) => b.behavior.kind === 'belt').map((b) =>
      b.behavior.kind === 'belt' ? perMinute(b.behavior.tilesPerSecond) : 0,
    );
    expect(belts).toEqual([90, 180, 360]);
    // Grundmaschinen: Bergwerk, Holzfäller, Kupferbarren, Draht, Bretter, Zahnrad je 30/min
    const miner = BUILDINGS.find((b) => b.key === 'miner')!.behavior;
    expect(miner.kind === 'miner' && miner.itemsPerMinute).toBe(30);
    for (const key of ['copperIngot', 'copperWire', 'plank', 'gear']) {
      const r = RECIPES.find((x) => x.key === key)!;
      const out = Object.values(r.outputs)[0]!;
      expect((out * 60) / r.seconds).toBe(30);
    }
    MACHINE_LEVELS.speed.forEach((f, level) => expect(3 * 30 * f).toBe(belts[level]));
  });

  it('die Aufwertung einer Maschine übersteht Speichern und Laden', () => {
    const sim = unlockAll(unlimitedPower(new Simulation(generateWorld(4711, undefined, DEPOSITS))));
    for (let i = 0; i < ITEMS.length; i++) sim.inventory.add(i, 100);
    const { startX: x, startY: y } = sim.world;
    build(sim, B.furnace, x + 4, y);
    const id = sim.buildingAt(x + 4, y);
    sim.enqueue({ type: 'upgradeBuilding', building: id });
    sim.flushCommands();
    const loaded = deserialize(
      migrate(JSON.parse(JSON.stringify(serialize(sim, { name: 't', savedAt: 0 }, [0, 0, 10, 0])))),
    );
    expect(loaded.machines.upgraded[id]).toBe(1);
    expect(RECIPE_OUTPUTS.length).toBe(RECIPES.length);
  });
});
