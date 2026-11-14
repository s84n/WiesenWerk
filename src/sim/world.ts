import { TileType, WORLD_CONFIG } from '../data/world';

/**
 * Das Raster der Welt. Jede Eigenschaft ist ein flaches Array, Index = y * size + x.
 * Das Gelände wird aus dem Seed erzeugt und nicht gespeichert.
 */
export class World {
  readonly size: number;
  readonly chunkSize: number;
  readonly chunksPerSide: number;

  /** Feldart (siehe `TileType`). */
  readonly tiles: Uint8Array;
  /** Rohstoff eines Vorkommens: Index in `DEPOSITS` + 1, 0 = keiner. */
  readonly resource: Uint8Array;
  /** Reinheit eines Vorkommens (Index in `PURITY`). */
  readonly purity: Uint8Array;
  /** Rein optische Höhe von Felsen und Hügeln (0..255). Hat keinen Einfluss auf die Logik. */
  readonly relief: Uint8Array;

  startX = 0;
  startY = 0;

  constructor(
    readonly seed: number,
    size: number = WORLD_CONFIG.size,
    chunkSize: number = WORLD_CONFIG.chunkSize,
  ) {
    if (size % chunkSize !== 0)
      throw new Error('Kartengröße muss ein Vielfaches der Chunkgröße sein.');
    this.size = size;
    this.chunkSize = chunkSize;
    this.chunksPerSide = size / chunkSize;
    const n = size * size;
    this.tiles = new Uint8Array(n);
    this.resource = new Uint8Array(n);
    this.purity = new Uint8Array(n);
    this.relief = new Uint8Array(n);
  }

  index(x: number, y: number): number {
    return y * this.size + x;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.size && y < this.size;
  }

  /** Index des Chunks, in dem das Feld liegt. */
  chunkOf(x: number, y: number): number {
    return Math.floor(y / this.chunkSize) * this.chunksPerSide + Math.floor(x / this.chunkSize);
  }

  isBuildableGround(index: number): boolean {
    return this.tiles[index] === TileType.Meadow;
  }
}
