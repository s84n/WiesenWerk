import { BUILDING_ID } from '../src/data/buildings';
import { ITEM_COUNT } from '../src/data/items';
import { TileType } from '../src/data/world';
import type { BeltStep } from '../src/sim/commands';
import { Simulation } from '../src/sim/simulation';
import { World } from '../src/sim/world';

export const B = BUILDING_ID;

/** Testwelt aus lauter Wiese mit reichlich Vorrat. */
export function makeSim(size = 32): Simulation {
  const w = new World(1, size, 16);
  w.tiles.fill(TileType.Meadow);
  const sim = new Simulation(w);
  for (let i = 0; i < ITEM_COUNT; i++) sim.inventory.add(i, 10_000);
  return sim;
}

/** Wie `makeSim`, aber mit unbegrenztem Strom. */
export function makePoweredSim(size = 32): Simulation {
  return unlimitedPower(makeSim(size));
}

export function setDeposit(sim: Simulation, x: number, y: number, resource = 2, purity = 2): void {
  const i = sim.world.index(x, y);
  sim.world.tiles[i] = TileType.Deposit;
  sim.world.resource[i] = resource;
  sim.world.purity[i] = purity;
}

/** Gerades Band von (x, y) aus `length` Felder in Richtung `dir`. */
export function line(x: number, y: number, dir: number, length: number): BeltStep[] {
  const dx = [0, 1, 0, -1][dir];
  const dy = [-1, 0, 1, 0][dir];
  return Array.from({ length }, (_, i) => ({ x: x + dx * i, y: y + dy * i, dir }));
}

export function build(sim: Simulation, building: number, x: number, y: number, rot = 0): void {
  sim.enqueue({ type: 'build', building, x, y, rot });
  sim.flushCommands();
}

export function belt(sim: Simulation, path: BeltStep[]): void {
  sim.enqueue({ type: 'buildBelt', building: B.beltMk1, path });
  sim.flushCommands();
}

export function run(sim: Simulation, ticks: number): void {
  for (let t = 0; t < ticks; t++) sim.step();
}

/** Für Tests, in denen Strom nicht das Thema ist: alle Maschinen laufen mit vollem Tempo. */
export function unlimitedPower(sim: Simulation): Simulation {
  sim.power.factorOf = () => 1000;
  return sim;
}
