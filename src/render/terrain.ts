import { BufferGeometry, Color, Float32BufferAttribute, Group, Mesh, type Material } from 'three';
import { PALETTE } from '../data/palette';
import { RENDER_CONFIG } from '../data/config';
import { DEPOSITS, TileType } from '../data/world';
import { SimplexNoise } from '../sim/noise';
import { deriveSeed, hash3Float } from '../sim/rng';
import type { World } from '../sim/world';

const c = new Color();
const c2 = new Color();

/**
 * Gelände als verschmolzene Geometrie pro Block. Wird nur beim Erzeugen der Welt gebaut.
 */
export class Terrain {
  readonly group = new Group();

  constructor(world: World, heights: Float32Array, material: Material) {
    const block = RENDER_CONFIG.terrainBlockSize;
    const colors = computeTileColors(world);
    const blocks = world.size / block;
    for (let by = 0; by < blocks; by++) {
      for (let bx = 0; bx < blocks; bx++) {
        const geo = buildBlock(world, heights, colors, bx * block, by * block, block);
        const mesh = new Mesh(geo, material);
        mesh.receiveShadow = true;
        mesh.matrixAutoUpdate = false;
        this.group.add(mesh);
      }
    }
  }

  dispose(): void {
    for (const child of this.group.children) (child as Mesh).geometry.dispose();
    this.group.clear();
  }
}

/** Farbe jedes Feldes (RGB, 3 Werte pro Feld). */
function computeTileColors(world: World): Float32Array {
  const { size, tiles, relief, resource } = world;
  const variation = new SimplexNoise(deriveSeed(world.seed, 'render:meadow'));
  const out = new Float32Array(size * size * 3);

  const nearWater = (x: number, y: number): boolean => {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (world.inBounds(nx, ny) && tiles[ny * size + nx] === TileType.Water) return true;
      }
    return false;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const t = tiles[i];
      const v = variation.fbm(x / 18, y / 18, 2);
      switch (t) {
        case TileType.Meadow:
          if (nearWater(x, y)) c.setHex(PALETTE.sand);
          else if (v > 0) c.setHex(PALETTE.meadow).lerp(c2.setHex(PALETTE.meadowLight), v);
          else c.setHex(PALETTE.meadow).lerp(c2.setHex(PALETTE.meadowDark), -v);
          break;
        case TileType.Forest:
          c.setHex(PALETTE.forestFloor);
          break;
        case TileType.Deposit:
          c.setHex(PALETTE[DEPOSITS[resource[i] - 1].groundColor]);
          break;
        case TileType.Water:
          c.setHex(PALETTE.waterBed);
          break;
        default:
          c.setHex(PALETTE.rockDark).lerp(c2.setHex(PALETTE.rock), Math.min(1, relief[i] / 160));
      }
      // Kleine Helligkeitsunterschiede pro Feld
      const j = 0.96 + hash3Float(x, y, world.seed ^ 0x5bd1) * 0.08;
      out[i * 3] = c.r * j;
      out[i * 3 + 1] = c.g * j;
      out[i * 3 + 2] = c.b * j;
    }
  }
  return out;
}

function buildBlock(
  world: World,
  heights: Float32Array,
  colors: Float32Array,
  x0: number,
  y0: number,
  block: number,
): BufferGeometry {
  const { size } = world;
  const side = size + 1;
  const vertCount = block * block * 6;
  const pos = new Float32Array(vertCount * 3);
  const col = new Float32Array(vertCount * 3);
  let p = 0;

  const put = (cx: number, cy: number, ti: number): void => {
    pos[p] = cx;
    pos[p + 1] = heights[cy * side + cx];
    pos[p + 2] = cy;
    col[p] = colors[ti * 3];
    col[p + 1] = colors[ti * 3 + 1];
    col[p + 2] = colors[ti * 3 + 2];
    p += 3;
  };

  for (let y = y0; y < y0 + block; y++) {
    for (let x = x0; x < x0 + block; x++) {
      const ti = y * size + x;
      // Diagonale je nach Feld wechseln, damit kein sichtbares Muster entsteht
      if ((x + y) & 1) {
        put(x, y, ti);
        put(x, y + 1, ti);
        put(x + 1, y, ti);
        put(x + 1, y, ti);
        put(x, y + 1, ti);
        put(x + 1, y + 1, ti);
      } else {
        put(x, y, ti);
        put(x, y + 1, ti);
        put(x + 1, y + 1, ti);
        put(x, y, ti);
        put(x + 1, y + 1, ti);
        put(x + 1, y, ti);
      }
    }
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  return geo;
}
