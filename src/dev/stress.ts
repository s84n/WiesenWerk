import { BUILDING_ID } from '../data/buildings';
import { ITEM_COUNT, ITEM_ID } from '../data/items';
import { TileType } from '../data/world';
import type { BeltStep } from '../sim/commands';
import { Simulation } from '../sim/simulation';
import { World } from '../sim/world';

/**
 * Stresstest-Welt: erzeugt automatisch die Referenzfabrik aus dem Projektskript
 * (Maßstab 1: ca. 2.000 Maschinen und 20.000 Items auf Bändern; Maßstab 10: zehnmal so viel).
 * Läuft ohne Browser und wird auch vom automatischen Tick-Benchmark benutzt.
 *
 * Aufbau:
 * - Produktionsmodule (senkrecht): Bergwerk → Band → Schmelzofen → Band → Werkstatt → Band,
 *   daneben drei Strommasten und ein Biomassebrenner mit reichlich Holz
 * - Geschlossene Bandringe voller Items, die endlos kreisen
 */
export interface StressResult {
  sim: Simulation;
  machines: number;
  beltTiles: number;
}

const BELT_LEN = 4;
const MODULE_W = 5; // 2 Felder Maschinen, 2 Felder Strom (Masten, Brenner), 1 Feld Abstand
const MODULE_H = 6 + 3 * BELT_LEN + 1;
const RING_SIDE = 25; // Umfang 100 Felder → 200 Items
const RING_CELL = RING_SIDE + 2;

export function createStressSimulation(scale = 1): StressResult {
  const modules = Math.round(667 * scale);
  const rings = Math.round(100 * scale);

  // Kartengröße: Module oben, Ringe darunter
  let size = 256;
  for (;;) {
    const perRow = Math.floor((size - 4) / MODULE_W);
    const moduleRows = Math.ceil(modules / perRow);
    const ringsPerRow = Math.floor((size - 4) / RING_CELL);
    const ringRows = Math.ceil(rings / ringsPerRow);
    if (2 + moduleRows * MODULE_H + ringRows * RING_CELL + 2 <= size) break;
    size += 64;
  }

  const world = new World(42, size, 16);
  world.tiles.fill(TileType.Meadow);
  world.startX = world.startY = 8;
  const sim = new Simulation(world);
  for (let i = 0; i < ITEM_COUNT; i++) sim.inventory.add(i, 100_000_000);

  const belt = BUILDING_ID.beltMk1;
  const build = (b: number, x: number, y: number): void =>
    sim.enqueue({ type: 'build', building: b, x, y, rot: 0 });
  const line = (x: number, y: number, dir: number, n: number): BeltStep[] => {
    const dx = [0, 1, 0, -1][dir];
    const dy = [-1, 0, 1, 0][dir];
    return Array.from({ length: n }, (_, i) => ({ x: x + dx * i, y: y + dy * i, dir }));
  };

  // Produktionsmodule
  const perRow = Math.floor((size - 4) / MODULE_W);
  for (let m = 0; m < modules; m++) {
    const x = 2 + (m % perRow) * MODULE_W;
    const y = 2 + Math.floor(m / perRow) * MODULE_H;
    for (let dy = 0; dy < 2; dy++)
      for (let dx = 0; dx < 2; dx++) {
        const i = world.index(x + dx, y + dy);
        world.tiles[i] = TileType.Deposit;
        world.resource[i] = 2; // Kupfer
        world.purity[i] = 2;
      }
    build(BUILDING_ID.miner, x, y);
    sim.enqueue({ type: 'buildLine', building: belt, path: line(x, y + 2, 2, BELT_LEN) });
    const fy = y + 2 + BELT_LEN;
    build(BUILDING_ID.furnace, x, fy);
    sim.enqueue({ type: 'buildLine', building: belt, path: line(x, fy + 2, 2, BELT_LEN) });
    const wy = fy + 2 + BELT_LEN;
    build(BUILDING_ID.workshop, x, wy);
    sim.enqueue({ type: 'buildLine', building: belt, path: line(x, wy + 2, 2, BELT_LEN) });
    // Strom: Masten neben Bergwerk, Ofen und Werkstatt, Brenner dazwischen
    build(BUILDING_ID.pole, x + 2, y + 1);
    build(BUILDING_ID.pole, x + 2, fy + 1);
    build(BUILDING_ID.pole, x + 2, wy + 1);
    build(BUILDING_ID.burner, x + 2, fy + 3);
  }
  sim.flushCommands();
  // Brenner mit viel Holz füllen (am Puffer vorbei, nur für den Stresstest)
  for (const id of sim.machines.burners) {
    sim.machines.fuelItem[id] = ITEM_ID.wood;
    sim.machines.inBuf[id * 2] = 1_000_000;
  }

  // Bandringe voller Items
  const moduleRows = Math.ceil(modules / perRow);
  const ringTop = 2 + moduleRows * MODULE_H;
  const ringsPerRow = Math.floor((size - 4) / RING_CELL);
  const n = RING_SIDE - 1;
  const items = [
    ITEM_ID.copperOre,
    ITEM_ID.stone,
    ITEM_ID.wood,
    ITEM_ID.copperIngot,
    ITEM_ID.plank,
  ];
  for (let r = 0; r < rings; r++) {
    const x = 2 + (r % ringsPerRow) * RING_CELL;
    const y = ringTop + Math.floor(r / ringsPerRow) * RING_CELL;
    sim.enqueue({
      type: 'buildLine',
      building: belt,
      path: [
        ...line(x, y, 1, n),
        ...line(x + n, y, 2, n),
        ...line(x + n, y + n, 3, n),
        ...line(x, y + n, 0, n),
      ],
    });
    sim.flushCommands();
    const seg = sim.belts.tileSegment[world.index(x, y)];
    sim.belts.fill(seg, items[r % items.length]);
  }
  sim.clearEvents();

  const beltTiles = sim.belts.segments.reduce((n, seg) => n + (seg ? seg.length : 0), 0);
  return { sim, machines: modules * 3, beltTiles };
}
