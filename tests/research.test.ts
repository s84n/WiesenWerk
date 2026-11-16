import { LANDMARK_STAGES } from '../src/data/landmark';
import { describe, expect, it } from 'vitest';
import { BUILDINGS, BUILDING_COSTS } from '../src/data/buildings';
import { ITEMS, ITEM_COUNT, ITEM_ID } from '../src/data/items';
import { RECIPES, RECIPE_INPUTS, RECIPE_OUTPUTS } from '../src/data/recipes';
import {
  RESEARCH,
  RESEARCH_COSTS,
  RESEARCH_ID,
  UPGRADES,
  UPGRADE_ID,
  upgradeCost,
} from '../src/data/research';
import { GOALS } from '../src/data/goals';
import { MachineState } from '../src/sim/machines';
import { deserialize, migrate, serialize } from '../src/sim/serialize';
import { Simulation } from '../src/sim/simulation';
import { World } from '../src/sim/world';
import { TileType } from '../src/data/world';
import { generateWorld } from '../src/sim/worldgen';
import {
  B,
  belt,
  beltOf,
  build,
  line,
  makePoweredSim,
  makeSim,
  run,
  setDeposit,
  unlockAll,
} from './helpers';

const research = (sim: Simulation, key: string): void => {
  sim.enqueue({ type: 'research', node: RESEARCH_ID[key] });
  sim.flushCommands();
};

describe('Forschung', () => {
  it('bezahlt Knoten aus dem Vorrat und beachtet Voraussetzungen', () => {
    const sim = makeSim();
    const planks = sim.inventory.get(ITEM_ID.plank);
    research(sim, 'sheetMetal'); // braucht Logistik I
    expect(sim.research.done[RESEARCH_ID.sheetMetal]).toBe(0);
    research(sim, 'logistics1');
    expect(sim.research.done[RESEARCH_ID.logistics1]).toBe(1);
    expect(sim.inventory.get(ITEM_ID.plank)).toBe(planks - 50);
    expect(sim.research.buildingUnlocked[B.splitter]).toBe(1);
    research(sim, 'sheetMetal');
    expect(sim.research.done[RESEARCH_ID.sheetMetal]).toBe(1);
    expect(sim.events.filter((e) => e.type === 'researched')).toHaveLength(2);
  });

  it('erforscht nichts ohne genug Vorrat', () => {
    const w = new World(1, 32, 16);
    w.tiles.fill(TileType.Meadow);
    const sim = new Simulation(w);
    research(sim, 'logistics1');
    expect(sim.research.doneCount).toBe(0);
  });

  it('Rezepte sind erst nach der Forschung wählbar', () => {
    const sim = makePoweredSim();
    build(sim, B.furnace, 4, 4);
    const id = sim.buildingAt(4, 4);
    const charcoal = RECIPES.findIndex((r) => r.key === 'charcoal');
    sim.enqueue({ type: 'setRecipe', building: id, recipe: charcoal });
    sim.flushCommands();
    expect(sim.machines.recipe[id]).toBe(-1);
    research(sim, 'charcoal');
    sim.enqueue({ type: 'setRecipe', building: id, recipe: charcoal });
    sim.flushCommands();
    expect(sim.machines.recipe[id]).toBe(charcoal);
  });

  it('wiederholbare Verbesserungen werden je Stufe 50 % teurer, Effizienz endet bei Stufe 10', () => {
    expect(upgradeCost(0, 0).map((a) => a.amount)).toEqual([50, 50]);
    expect(upgradeCost(0, 1).map((a) => a.amount)).toEqual([75, 75]);
    expect(upgradeCost(0, 2).map((a) => a.amount)).toEqual([113, 113]);
    const sim = unlockAll(makeSim());
    for (let i = 0; i < ITEM_COUNT; i++) sim.inventory.add(i, 10_000_000);
    const eff = UPGRADE_ID.efficiency;
    for (let k = 0; k < 15; k++) sim.enqueue({ type: 'buyUpgrade', upgrade: eff });
    sim.flushCommands();
    expect(sim.research.levels[eff]).toBe(10);
    expect(sim.research.powerUse).toBe(700);
  });

  it('Maschinentempo-Verbesserung macht Schmelzöfen 5 % schneller je Stufe', () => {
    const count = (levels: number): number => {
      const sim = unlockAll(makePoweredSim());
      for (let k = 0; k < levels; k++)
        sim.enqueue({ type: 'buyUpgrade', upgrade: UPGRADE_ID.machineSpeed });
      sim.flushCommands();
      build(sim, B.furnace, 4, 4);
      const id = sim.buildingAt(4, 4);
      sim.enqueue({ type: 'setRecipe', building: id, recipe: 0 });
      sim.flushCommands();
      let done = 0;
      for (let t = 0; t < 4000; t++) {
        sim.machines.accept(id, ITEM_ID.copperOre);
        sim.step();
        done += sim.machines.outBuf[id * 2];
        sim.machines.outBuf[id * 2] = 0;
      }
      return done;
    };
    const base = count(0);
    expect(base).toBeGreaterThanOrEqual(99);
    expect(base).toBeLessThanOrEqual(100);
    // 4 Stufen = +20 %; ganze Ticks je Durchlauf runden etwas ab
    const fast = count(4);
    expect(fast / base).toBeGreaterThan(1.14);
    expect(fast / base).toBeLessThanOrEqual(1.2);
  });

  it('Tiefbau: Bergwerk auf Stufe 2 baut doppelt so schnell ab und braucht doppelt Strom', () => {
    const sim = makePoweredSim();
    // ganzer Baum außer „Hochleistung“ (Stufe 3)
    sim.research.restore(
      RESEARCH.filter((r) => !r.level3).map((r) => r.key),
      {},
    );
    for (let y = 4; y < 6; y++) for (let x = 4; x < 6; x++) setDeposit(sim, x, y);
    build(sim, B.miner, 4, 4);
    const id = sim.buildingAt(4, 4);
    expect(sim.machines.extractPerMinute(id)).toBe(30);
    const motors = sim.inventory.get(ITEM_ID.motor);
    sim.enqueue({ type: 'upgradeBuilding', building: id });
    sim.flushCommands();
    expect(sim.machines.upgraded[id]).toBe(1);
    expect(sim.inventory.get(ITEM_ID.motor)).toBe(motors - 5);
    expect(sim.machines.extractPerMinute(id)).toBe(60);
    // zweites Aufwerten geht nicht
    sim.enqueue({ type: 'upgradeBuilding', building: id });
    sim.flushCommands();
    expect(sim.inventory.get(ITEM_ID.motor)).toBe(motors - 5);
    let made = 0;
    for (let t = 0; t < 1200; t++) {
      sim.step();
      made += sim.machines.outBuf[id * 2];
      sim.machines.outBuf[id * 2] = 0;
    }
    expect(made).toBe(60);
    sim.enqueue({ type: 'demolish', x: 4, y: 4 });
    sim.flushCommands();
    expect(sim.inventory.get(ITEM_ID.motor)).toBe(motors);
  });

  it('Manufaktur macht 15 Baurahmen pro Minute aus zwei Eingängen', () => {
    const sim = unlockAll(makePoweredSim());
    build(sim, B.assembler, 4, 4);
    const id = sim.buildingAt(4, 4);
    const frame = RECIPES.findIndex((r) => r.key === 'frame');
    sim.enqueue({ type: 'setRecipe', building: id, recipe: frame });
    sim.flushCommands();
    let made = 0;
    for (let t = 0; t < 1200; t++) {
      sim.machines.accept(id, ITEM_ID.plank);
      sim.machines.accept(id, ITEM_ID.stoneBrick);
      sim.step();
      made += sim.machines.outBuf[id * 2];
      sim.machines.outBuf[id * 2] = 0;
    }
    expect(made).toBeGreaterThanOrEqual(14);
    expect(made).toBeLessThanOrEqual(15);
  });
});

describe('Strom-Ausbau', () => {
  it('Windrad liefert im Mittel 10 kW, sanft schwankend zwischen 7 und 13 kW', () => {
    const sim = unlockAll(makeSim(64));
    build(sim, B.windTurbine, 4, 4);
    build(sim, B.pole, 6, 4);
    let sum = 0;
    let min = Infinity;
    let max = 0;
    let lastCap = -1;
    let maxJump = 0;
    const n = 20 * 60 * 30;
    for (let t = 0; t < n; t++) {
      sim.step();
      const cap = sim.power.capacity[0];
      sum += cap;
      min = Math.min(min, cap);
      max = Math.max(max, cap);
      if (lastCap >= 0) maxJump = Math.max(maxJump, Math.abs(cap - lastCap));
      lastCap = cap;
    }
    expect(sum / n / 1000).toBeGreaterThan(8.5);
    expect(sum / n / 1000).toBeLessThan(11.5);
    expect(min).toBeGreaterThanOrEqual(7000);
    expect(max).toBeLessThanOrEqual(13000);
    expect(maxJump).toBeLessThan(50); // keine Sprünge (höchstens 0,05 kW je Tick)
  });

  it('großer Strommast verbindet sich über 32 Felder, der kleine nur über 14', () => {
    const sim = unlockAll(makeSim(64));
    build(sim, B.pole, 4, 4);
    build(sim, B.pole, 50, 4);
    sim.power.ensure();
    expect(sim.power.gridCount).toBe(2);
    build(sim, B.bigPole, 11, 8); // Mitte (12, 9): 8,7 Felder bis zum ersten Mast
    build(sim, B.bigPole, 42, 8); // Mitte (43, 9): 31 Felder bis zum anderen großen Mast
    sim.power.ensure();
    expect(sim.power.gridCount).toBe(1);
  });

  it('Effizienz senkt den Stromverbrauch', () => {
    const sim = unlockAll(makeSim());
    build(sim, B.furnace, 4, 4);
    build(sim, B.pole, 6, 4);
    build(sim, B.burner, 7, 4);
    sim.enqueue({ type: 'refuel', building: sim.buildingAt(7, 4), item: ITEM_ID.wood });
    sim.flushCommands();
    run(sim, 2);
    expect(sim.power.demand[0]).toBe(400); // wartet: 10 % von 4 kW
    for (let k = 0; k < 10; k++)
      sim.enqueue({ type: 'buyUpgrade', upgrade: UPGRADE_ID.efficiency });
    for (let i = 0; i < ITEM_COUNT; i++) sim.inventory.add(i, 10_000_000);
    run(sim, 2);
    expect(sim.power.demand[0]).toBe(280);
  });
});

describe('Statistik und Erste Schritte', () => {
  it('zählt Produktion und Verbrauch pro Minute', () => {
    const sim = makePoweredSim();
    build(sim, B.furnace, 4, 4);
    const id = sim.buildingAt(4, 4);
    sim.enqueue({ type: 'setRecipe', building: id, recipe: 0 });
    sim.flushCommands();
    for (let t = 0; t < 1200; t++) {
      sim.machines.accept(id, ITEM_ID.copperOre);
      sim.step();
      sim.machines.outBuf[id * 2] = 0;
    }
    const s = sim.stats;
    expect(Math.round(s.perMinute(s.produced, ITEM_ID.copperIngot))).toBeGreaterThanOrEqual(29);
    expect(Math.round(s.perMinute(s.consumed, ITEM_ID.copperOre))).toBeGreaterThanOrEqual(29);
    expect(Math.round(s.perMinute(s.consumed, ITEM_ID.copperOre))).toBeLessThanOrEqual(30);
    expect(s.buildingsBuilt).toBe(1);
  });

  it('hakt die Aufgaben der Reihe nach ab', () => {
    const sim = makeSim(48);
    const done = (): string[] => sim.goals.doneKeys();
    const tree = sim.world.index(30, 30);
    sim.world.tiles[tree] = TileType.Forest;
    sim.trees.wood[tree] = 4;
    for (let k = 0; k < 3; k++) {
      sim.world.tiles[tree + k] = TileType.Forest;
      sim.trees.wood[tree + k] = 4;
      for (let j = 0; j < 4; j++) sim.enqueue({ type: 'harvest', x: 30 + k, y: 30 });
    }
    sim.flushCommands();
    run(sim, 20);
    expect(done()).toEqual(['harvestWood']);
    for (let y = 4; y < 6; y++) for (let x = 4; x < 6; x++) setDeposit(sim, x, y);
    build(sim, B.miner, 4, 4);
    belt(sim, line(4, 6, 2, 3));
    build(sim, B.hq, 3, 9);
    build(sim, B.pole, 6, 4);
    build(sim, B.burner, 7, 4);
    sim.enqueue({ type: 'refuel', building: sim.buildingAt(7, 4), item: ITEM_ID.wood });
    // Holzfäller neben dem Mast, zwei Bäume in Reichweite
    for (const ty of [2, 3]) {
      const t = sim.world.index(11, ty);
      sim.world.tiles[t] = TileType.Forest;
      sim.trees.wood[t] = 4;
    }
    build(sim, B.lumberjack, 8, 2);
    run(sim, 400);
    expect(done()).toEqual([
      'harvestWood',
      'buildHq',
      'lumberjackWorking',
      'buildPower',
      'minerWorking',
      'beltToHq',
    ]);
    research(sim, 'charcoal');
    run(sim, 20);
    expect(done()).toHaveLength(GOALS.length);
    expect(sim.goals.allDone).toBe(true);
    expect(sim.events.filter((e) => e.type === 'goalCompleted').length).toBeGreaterThan(0);
  });
});

describe('Speichern mit Phase-6-Inhalten', () => {
  it('stellt Forschung, Logistik, Lager, Stufen und Statistik exakt wieder her', () => {
    const sim = unlockAll(new Simulation(generateWorld(4711)));
    for (let i = 0; i < ITEM_COUNT; i++) sim.inventory.add(i, 100_000);
    sim.enqueue({ type: 'buyUpgrade', upgrade: UPGRADE_ID.machineSpeed });
    sim.enqueue({ type: 'setGoalsHidden', hidden: true });
    // Kleine Logistik-Anlage auf freier Wiese in der Kartenmitte
    const x0 = sim.world.startX - 6;
    const y0 = sim.world.startY - 6;
    for (let y = y0 - 2; y < y0 + 16; y++)
      for (let x = x0 - 2; x < x0 + 16; x++) {
        sim.world.tiles[sim.world.index(x, y)] = TileType.Meadow;
        sim.world.changedTiles.add(sim.world.index(x, y));
      }
    belt(sim, line(x0 + 5, y0, 2, 4));
    build(sim, B.splitter, x0 + 5, y0 + 4);
    belt(sim, line(x0 + 4, y0 + 4, 3, 3));
    beltOf(sim, B.beltMk2, line(x0 + 6, y0 + 4, 1, 3));
    belt(sim, line(x0 + 5, y0 + 5, 2, 2));
    build(sim, B.storage, x0 + 5, y0 + 7);
    belt(sim, line(x0 + 5, y0 + 9, 2, 2));
    build(sim, B.merger, x0 + 5, y0 + 11);
    build(sim, B.windTurbine, x0 + 9, y0 + 9);
    build(sim, B.pole, x0 + 11, y0 + 8);
    build(sim, B.lantern, x0 + 1, y0 + 12);
    sim.belts.fill(sim.belts.tileSegment[sim.world.index(x0 + 5, y0)], ITEM_ID.plank);
    for (let k = 0; k < 40; k++)
      sim.logistics.accept(sim.buildingAt(x0 + 5, y0 + 7), ITEM_ID.stone, 0);
    run(sim, 300);

    const loaded = deserialize(migrate(JSON.parse(JSON.stringify(serialize(sim, META, CAM)))));
    const state = (s: Simulation): string => JSON.stringify(serialize(s, META, CAM));
    expect(state(loaded)).toBe(state(sim));
    expect(loaded.research.levels[UPGRADE_ID.machineSpeed]).toBe(1);
    expect(loaded.goals.hidden).toBe(true);
    for (let t = 0; t < 1000; t++) {
      sim.step();
      loaded.step();
    }
    expect(state(loaded)).toBe(state(sim));
  });
});

const META = { name: 'Test', savedAt: 0 };
const CAM = [1, 2, 3, 4];

describe('Abnahme Phase 6: der Forschungsbaum ist von Spielbeginn an erreichbar', () => {
  it('jeder Knoten lässt sich mit dem bis dahin Freigeschalteten bezahlen', () => {
    // Was man herstellen kann: Rohstoffe plus Ausgänge freigeschalteter Rezepte mit gebauter Maschine
    const unlockedBuildings = new Set(
      BUILDINGS.filter((b) => b.availableFromStart).map((b) => b.key),
    );
    const unlockedRecipes = new Set(RECIPES.filter((r) => r.availableFromStart).map((r) => r.key));
    const done = new Set<string>();
    const machineOf: Record<string, string> = {
      furnace: 'furnace',
      workshop: 'workshop',
      assembler: 'assembler',
      foundry: 'foundry',
    };
    const producible = (): Set<number> => {
      const items = new Set([
        ITEM_ID.wood,
        ITEM_ID.stone,
        ITEM_ID.copperOre,
        ITEM_ID.ironOre,
        ITEM_ID.coal,
        ITEM_ID.sand,
      ]);
      for (let changed = true; changed;) {
        changed = false;
        RECIPES.forEach((r, i) => {
          if (!unlockedRecipes.has(r.key) || !unlockedBuildings.has(machineOf[r.machine])) return;
          // auch die Maschine selbst muss bezahlbar sein
          const machineCost = BUILDING_COSTS[BUILDINGS.findIndex((b) => b.key === r.machine)];
          if (!machineCost.every((c) => items.has(c.item))) return;
          if (!RECIPE_INPUTS[i].every((a) => items.has(a.item))) return;
          for (const o of RECIPE_OUTPUTS[i]) {
            if (!items.has(o.item)) {
              items.add(o.item);
              changed = true;
            }
          }
        });
      }
      return items;
    };
    for (let round = 0; round < RESEARCH.length; round++) {
      const items = producible();
      const next = RESEARCH.findIndex(
        (r, i) =>
          !done.has(r.key) &&
          r.requires.every((k) => done.has(k)) &&
          RESEARCH_COSTS[i].every((c) => items.has(c.item)),
      );
      expect(
        next,
        `kein erreichbarer Knoten mehr nach: ${[...done].join(', ')}`,
      ).toBeGreaterThanOrEqual(0);
      const node = RESEARCH[next];
      done.add(node.key);
      for (const b of node.buildings ?? []) unlockedBuildings.add(b);
      for (const r of node.recipes ?? []) unlockedRecipes.add(r);
      // Gebäude, die ein Knoten freischaltet, müssen mit dem Vorhandenen baubar sein
      for (const b of node.buildings ?? []) {
        const cost = BUILDING_COSTS[BUILDINGS.findIndex((d) => d.key === b)];
        const now = producible();
        expect(
          cost.every((c) => now.has(c.item)),
          `${b} nicht baubar`,
        ).toBe(true);
      }
    }
    expect(done.size).toBe(RESEARCH.length);
    // Verbesserungen sind danach bezahlbar
    const items = producible();
    for (const u of UPGRADES) {
      expect(
        Object.keys(u.baseCost).every((k) => items.has(ITEM_ID[k as keyof typeof ITEM_ID])),
      ).toBe(true);
    }
    expect(ITEMS.every((_, i) => items.has(i))).toBe(true);
  });

  it('spielt den ganzen Baum per Befehl durch', () => {
    const sim = makeSim();
    for (let i = 0; i < ITEM_COUNT; i++) sim.inventory.add(i, 100_000);
    for (let round = 0; round < RESEARCH.length; round++) {
      RESEARCH.forEach((_, i) => sim.enqueue({ type: 'research', node: i }));
      sim.flushCommands();
    }
    expect(sim.research.doneCount).toBe(RESEARCH.length);
    // alles freigeschaltet außer ausgemusterten Gebäuden (nur noch aus alten Spielständen) und
    // den Belohnungen des Uhrturms
    const rewards = new Set(LANDMARK_STAGES.flatMap((s) => s.reward.buildings ?? []));
    BUILDINGS.forEach((b, i) =>
      expect(sim.research.buildingUnlocked[i]).toBe(b.retired || rewards.has(b.key) ? 0 : 1),
    );
    expect(RECIPES.every((_, i) => sim.research.recipeUnlocked[i] === 1)).toBe(true);
    expect(sim.machines.state.length).toBeGreaterThanOrEqual(0);
    expect(MachineState.Working).toBe(1);
  });
});
