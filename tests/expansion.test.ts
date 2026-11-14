import { describe, expect, it } from 'vitest';
import { DAY_CONFIG, SIM_CONFIG } from '../src/data/config';
import { ITEM_ID } from '../src/data/items';
import { RECIPES } from '../src/data/recipes';
import { DEPOSITS, TileType } from '../src/data/world';
import { sunlightAt } from '../src/sim/daylight';
import { MachineState } from '../src/sim/machines';
import { PlaceResult, checkPlacement } from '../src/sim/placement';
import { deserialize, migrate, serialize } from '../src/sim/serialize';
import { Simulation } from '../src/sim/simulation';
import { generateWorld } from '../src/sim/worldgen';
import { B, build, makeSim, run, unlockAll } from './helpers';

const TPS = SIM_CONFIG.ticksPerSecond;
/** Tick zu einer Tageszeit (0 = Mitternacht, 0,5 = Mittag) am ersten Spieltag. */
function tickAt(time: number): number {
  const t = (time - DAY_CONFIG.startTime + 1) % 1;
  return Math.round(t * DAY_CONFIG.daySeconds * TPS);
}

function water(sim: Simulation, x0: number, y0: number, x1: number, y1: number): void {
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) sim.world.tiles[sim.world.index(x, y)] = TileType.Water;
}

describe('Wasserrad', () => {
  it('braucht Wasser an der Radseite', () => {
    const sim = unlockAll(makeSim());
    water(sim, 0, 10, 31, 12);
    // 2 × 2 bei (4, 8): Vorderseite (Süden) grenzt an y = 10 → Wasser
    expect(checkPlacement(sim, B.waterWheel, 4, 8, 0)).toBe(PlaceResult.Ok);
    // eine Reihe höher: kein Wasser an der Vorderseite
    expect(checkPlacement(sim, B.waterWheel, 4, 7, 0)).toBe(PlaceResult.NeedsWater);
    // gedreht (Vorderseite nach Norden) unterhalb des Wassers
    expect(checkPlacement(sim, B.waterWheel, 4, 13, 2)).toBe(PlaceResult.Ok);
    expect(checkPlacement(sim, B.waterWheel, 4, 13, 0)).toBe(PlaceResult.NeedsWater);
  });

  it('liefert Tag und Nacht gleichmäßig Strom', () => {
    const sim = unlockAll(makeSim());
    water(sim, 0, 10, 31, 12);
    build(sim, B.waterWheel, 4, 8);
    build(sim, B.pole, 6, 8);
    build(sim, B.furnace, 7, 7);
    run(sim, 2);
    const g = sim.power.gridOf[sim.buildingAt(6, 8)];
    expect(sim.power.capacity[g]).toBe(25_000);
    sim.tick = tickAt(0.0); // Mitternacht
    run(sim, 2);
    expect(sim.power.capacity[g]).toBe(25_000);
  });
});

describe('Solarfeld und Akku-Haus', () => {
  it('Sonne scheint mittags voll und nachts gar nicht', () => {
    expect(sunlightAt(tickAt(0.5), true)).toBe(1000);
    expect(sunlightAt(tickAt(0.05), true)).toBe(0);
    expect(sunlightAt(tickAt(0.95), true)).toBe(0);
    const dawn = sunlightAt(tickAt(0.26), true);
    expect(dawn).toBeGreaterThan(0);
    expect(dawn).toBeLessThan(1000);
    // Tag-Nacht-Wechsel aus: immer goldener Nachmittag
    expect(sunlightAt(tickAt(0.05), false)).toBe(1000);
  });

  it('Akku lädt mit Sonnenüberschuss und versorgt nachts die Maschinen', () => {
    const sim = unlockAll(makeSim());
    build(sim, B.solarPanel, 2, 2);
    build(sim, B.solarPanel, 4, 2);
    build(sim, B.battery, 2, 4);
    build(sim, B.pole, 4, 4);
    build(sim, B.furnace, 5, 5);
    const bat = sim.buildingAt(2, 4);
    const furnace = sim.buildingAt(5, 5);
    sim.tick = tickAt(0.5);
    run(sim, 20 * TPS);
    const stored = sim.machines.fuelEnergy[bat];
    // 40 kW Sonne, der wartende Ofen zieht 0,4 kW: der Akku lädt mit dem Überschuss von 39,6 kW
    expect(stored).toBeGreaterThan(39_000 * 19);
    expect(sim.power.flow[bat]).toBeGreaterThan(0);

    // Nacht: keine Sonne, Akku gibt ab, Ofen hat vollen Strom
    sim.tick = tickAt(0.02);
    for (let t = 0; t < 40; t++) {
      while (sim.machines.accept(furnace, ITEM_ID.copperOre));
      sim.step();
    }
    expect(sim.power.factorOf(furnace)).toBe(1000);
    expect(sim.power.flow[bat]).toBeLessThan(0);
    expect(sim.machines.fuelEnergy[bat]).toBeLessThan(stored);
    expect(sim.machines.state[sim.buildingAt(2, 2)]).toBe(MachineState.WaitingInput);
  });

  it('Brenner laufen erst, wenn Wind, Wasser, Sonne und Akkus nicht reichen', () => {
    const sim = unlockAll(makeSim());
    build(sim, B.solarPanel, 2, 2);
    build(sim, B.burner, 4, 2);
    build(sim, B.pole, 4, 4);
    build(sim, B.furnace, 5, 5);
    const burner = sim.buildingAt(4, 2);
    const furnace = sim.buildingAt(5, 5);
    sim.machines.addFuel(burner, ITEM_ID.wood, 5, 10);
    sim.tick = tickAt(0.5);
    for (let t = 0; t < 100; t++) {
      while (sim.machines.accept(furnace, ITEM_ID.copperOre));
      sim.step();
    }
    // Sonne (20 kW) deckt den Ofen (4 kW): Brenner verbrennt nichts
    expect(sim.machines.inBuf[burner * 2] + (sim.machines.fuelEnergy[burner] > 0 ? 1 : 0)).toBe(5);
    expect(sim.machines.fuelEnergy[burner]).toBe(120_000);
  });

  it('der Akku-Inhalt bleibt beim Speichern erhalten', () => {
    const sim = unlockAll(new Simulation(generateWorld(4711)));
    for (let i = 0; i < sim.inventory.amounts.length; i++) sim.inventory.add(i, 1000);
    const { startX: x, startY: y } = sim.world;
    build(sim, B.solarPanel, x - 3, y - 3);
    build(sim, B.battery, x - 1, y - 3);
    build(sim, B.pole, x - 1, y - 1);
    sim.tick = tickAt(0.5);
    run(sim, 60);
    const bat = sim.buildingAt(x - 1, y - 3);
    expect(sim.machines.fuelEnergy[bat]).toBeGreaterThan(0);
    const loaded = deserialize(migrate(serialize(sim, { name: 't', savedAt: 0 }, [0, 0, 0, 0])));
    expect(loaded.machines.fuelEnergy[bat]).toBe(sim.machines.fuelEnergy[bat]);
    run(sim, 100);
    run(loaded, 100);
    expect(loaded.machines.fuelEnergy[bat]).toBe(sim.machines.fuelEnergy[bat]);
  });
});

describe('Eisen, Kohle, Sand', () => {
  it('Gießerei macht aus Eisenbarren und Kohle Stahl', () => {
    const sim = unlockAll(makeSim());
    sim.power.factorOf = () => 1000;
    build(sim, B.foundry, 4, 4);
    const f = sim.buildingAt(4, 4);
    for (let k = 0; k < 2; k++) sim.machines.accept(f, ITEM_ID.ironIngot);
    sim.machines.accept(f, ITEM_ID.coal);
    expect(RECIPES[sim.machines.recipe[f]].key).toBe('steel');
    run(sim, 6 * TPS + 2);
    expect(sim.machines.outBuf[f * 2]).toBe(1);
  });

  it('Kohle ist ein Brennstoff', () => {
    const sim = makeSim();
    build(sim, B.burner, 4, 4);
    const b = sim.buildingAt(4, 4);
    expect(sim.machines.addFuel(b, ITEM_ID.coal, 3, 10)).toBe(3);
  });

  it('jede Welt hat Eisen, Kohle und Sand, und alte Spielstände bekommen sie nicht unter Gebäude', () => {
    const sim = new Simulation(generateWorld(321));
    for (let i = 0; i < sim.inventory.amounts.length; i++) sim.inventory.add(i, 1000);
    const w = sim.world;
    for (const key of ['iron', 'coal', 'sand']) {
      const d = DEPOSITS.findIndex((x) => x.id === key) + 1;
      expect(w.resource.some((r) => r === d)).toBe(true);
    }
    // Ein Eisenfeld suchen und so tun, als stünde dort in einem alten Spielstand ein Ofen
    const iron = DEPOSITS.findIndex((x) => x.id === 'iron') + 1;
    let tile = -1;
    for (let i = 0; i < w.tiles.length && tile < 0; i++) {
      const x = i % w.size;
      const y = Math.floor(i / w.size);
      if (w.resource[i] === iron && w.resource[i + 1] === iron) {
        // umgebende Felder vorübergehend zu Wiese machen, damit der Ofen dort stehen darf
        let ok = true;
        for (let dy = 0; dy < 2; dy++)
          for (let dx = 0; dx < 2; dx++) {
            const t = w.tiles[w.index(x + dx, y + dy)];
            if (t === TileType.Water || t === TileType.Rock) ok = false;
          }
        if (ok) tile = i;
      }
    }
    expect(tile).toBeGreaterThanOrEqual(0);
    const save = serialize(sim, { name: 't', savedAt: 0 }, [0, 0, 0, 0]);
    const x = tile % w.size;
    const y = Math.floor(tile / w.size);
    const old = JSON.parse(JSON.stringify(save));
    old.version = 4;
    delete old.depositLayers;
    // Ofen von Hand in die Gebäudeliste eintragen (ID 0)
    old.buildings.highWater = 1;
    old.buildings.list = [0, B.furnace, x, y, 0];
    old.machines.crafters = [0];
    old.machines.data = [0, -1, 0, 4, 0, 0, 0, 0, 0, 0, 0, -1, 0, 0, 0, 0];
    const loaded = deserialize(migrate(old));
    expect(loaded.world.tiles[tile]).toBe(TileType.Meadow);
    expect(loaded.world.resource[tile]).toBe(0);
    // Ein neuer Spielstand des geladenen Spiels behält das
    const again = deserialize(migrate(serialize(loaded, { name: 't', savedAt: 0 }, [0, 0, 0, 0])));
    expect(again.world.resource[tile]).toBe(0);
    expect(again.world.tiles[tile]).toBe(TileType.Meadow);
  });
});
