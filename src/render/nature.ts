import { Color, Group, Matrix4, Quaternion, Vector3, type Material } from 'three';
import { PALETTE } from '../data/palette';
import { RENDER_CONFIG } from '../data/config';
import { DEPOSITS, TileType } from '../data/world';
import { hash3Float } from '../sim/rng';
import type { Simulation } from '../sim/simulation';
import type { World } from '../sim/world';
import { ChunkedInstances, InstanceBuilder } from './chunked-instances';
import {
  boulder,
  flower,
  grassTuft,
  pineTree,
  pineTreeLow,
  roundTree,
  roundTreeLow,
  treeStump,
} from './models';
import { tileHeight } from './terrain-heights';

const m = new Matrix4();
const pos = new Vector3();
const quat = new Quaternion();
const scl = new Vector3();
const up = new Vector3(0, 1, 0);
const col = new Color();

const FLOWER_COLORS = [
  PALETTE.flowerYellow,
  PALETTE.flowerPink,
  PALETTE.flowerWhite,
  PALETTE.flowerViolet,
];

/**
 * Bäume, Felsbrocken, Blumen und Gras – alles als Instanzen, nach Chunks sortiert.
 * Position, Größe und Drehung kommen aus einem Hash des Feldes, sind also bei jedem Laden gleich.
 */
export class Nature {
  readonly group = new Group();
  private readonly layers: ChunkedInstances[] = [];
  private readonly details: ChunkedInstances[] = [];
  private readonly treeLayers: ChunkedInstances[];
  private readonly stumps: ChunkedInstances;

  constructor(world: World, heights: Float32Array, material: Material) {
    const { size, tiles, seed } = world;
    const chunks = world.chunksPerSide * world.chunksPerSide;
    const pines = new InstanceBuilder(chunks, false);
    const rounds = new InstanceBuilder(chunks, false);
    const rocks = new InstanceBuilder(chunks, true);
    const flowers = new InstanceBuilder(chunks, true);
    const tufts = new InstanceBuilder(chunks, false);
    const stumps = new InstanceBuilder(chunks, false);

    const place = (
      b: InstanceBuilder,
      chunk: number,
      x: number,
      y: number,
      h: number,
      scale: number,
      rot: number,
      color?: Color,
      key = -1,
    ): void => {
      pos.set(x, h, y);
      quat.setFromAxisAngle(up, rot);
      scl.set(scale, scale, scale);
      m.compose(pos, quat, scl);
      b.add(chunk, m, color, key);
    };

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        const chunk = world.chunkOf(x, y);
        const r = (salt: number): number => hash3Float(x, y, seed + salt);
        const h = tileHeight(heights, size, x, y);
        const t = tiles[i];

        if (t === TileType.Forest) {
          const scale = 0.8 + r(1) * 0.45;
          const builder = r(2) < 0.6 ? pines : rounds;
          const tx = x + 0.25 + r(3) * 0.5;
          const ty = y + 0.25 + r(4) * 0.5;
          const rot = r(5) * Math.PI * 2;
          place(builder, chunk, tx, ty, h, scale, rot, undefined, i);
          place(stumps, chunk, tx, ty, h, scale, rot, undefined, i);
        } else if (t === TileType.Deposit) {
          const def = DEPOSITS[world.resource[i] - 1];
          const purity = world.purity[i];
          const count = 1 + purity;
          for (let k = 0; k < count; k++) {
            const isOre = k === 0 || r(20 + k) < 0.5;
            col.setHex(isOre ? PALETTE[def.oreColor] : PALETTE.stone);
            const scale = (0.55 + r(30 + k) * 0.5) * (0.8 + purity * 0.15);
            place(
              rocks,
              chunk,
              x + 0.2 + r(40 + k) * 0.6,
              y + 0.2 + r(50 + k) * 0.6,
              h,
              scale,
              r(60 + k) * 6.28,
              col,
            );
          }
        } else if (t === TileType.Rock) {
          if (r(6) < 0.25) {
            col.setHex(PALETTE.rock);
            place(rocks, chunk, x + 0.5, y + 0.5, h - 0.05, 0.8 + r(7) * 0.9, r(8) * 6.28, col);
          }
        } else if (t === TileType.Meadow) {
          if (r(9) < RENDER_CONFIG.flowerDensity) {
            col.setHex(FLOWER_COLORS[Math.floor(r(10) * FLOWER_COLORS.length)]);
            place(
              flowers,
              chunk,
              x + 0.15 + r(11) * 0.7,
              y + 0.15 + r(12) * 0.7,
              h,
              0.9 + r(13) * 0.5,
              r(14) * 6.28,
              col,
            );
          }
          if (r(15) < RENDER_CONFIG.tuftDensity) {
            place(
              tufts,
              chunk,
              x + 0.1 + r(16) * 0.8,
              y + 0.1 + r(17) * 0.8,
              h,
              0.8 + r(18) * 0.6,
              r(19) * 6.28,
            );
          }
        }
      }
    }

    this.treeLayers = [
      new ChunkedInstances(pineTree(), material, pines, {
        castShadow: true,
        lodGeometry: pineTreeLow(),
      }),
      new ChunkedInstances(roundTree(), material, rounds, {
        castShadow: true,
        lodGeometry: roundTreeLow(),
      }),
    ];
    this.stumps = new ChunkedInstances(treeStump(), material, stumps, { castShadow: false });
    this.layers.push(
      ...this.treeLayers,
      this.stumps,
      new ChunkedInstances(boulder(), material, rocks, { castShadow: true }),
    );
    // Stümpfe sind anfangs alle ausgeblendet
    for (let i = 0; i < tiles.length; i++) {
      if (tiles[i] === TileType.Forest) this.stumps.setHidden(i, true);
    }
    this.details.push(
      new ChunkedInstances(flower(), material, flowers, { castShadow: false }),
      new ChunkedInstances(grassTuft(), material, tufts, { castShadow: false }),
    );
    for (const l of [...this.layers, ...this.details]) {
      this.group.add(l.mesh);
      if (l.lodMesh) this.group.add(l.lodMesh);
    }
  }

  /** Füllt die Instanzpuffer neu – bei geänderter Sichtbarkeit (`force`) oder nach Änderungen. */
  applyVisible(visible: Uint16Array, count: number, force: boolean): void {
    for (const l of this.layers) if (force || l.dirty) l.applyVisible(visible, count);
    for (const d of this.details) if (force || d.dirty) d.applyVisible(visible, count);
  }

  /** Aktualisiert Baum und Stumpf auf einem Feld nach dem Spielzustand. */
  refreshTile(sim: Simulation, tile: number): void {
    const forest = sim.world.tiles[tile] === TileType.Forest;
    const tree = forest && sim.trees.hasTree(tile);
    for (const l of this.treeLayers) l.setHidden(tile, !tree);
    this.stumps.setHidden(tile, tree || !forest || sim.world.building[tile] !== 0);
  }

  /** Vereinfachte Bäume für große Entfernung. */
  setLowDetail(low: boolean): void {
    for (const l of this.layers) l.setLowDetail(low);
  }

  /** Blendet Kleinkram aus, wenn weit herausgezoomt ist. */
  setDetailVisible(show: boolean): void {
    for (const d of this.details) d.mesh.visible = show;
  }

  dispose(): void {
    for (const l of [...this.layers, ...this.details]) l.dispose();
    this.group.clear();
  }
}
