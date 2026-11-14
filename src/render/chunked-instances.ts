import {
  Color,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  type BufferGeometry,
  type Material,
} from 'three';

/**
 * Viele gleiche Objekte (z. B. alle Kiefern) in einem einzigen `InstancedMesh` – ein Zeichenaufruf.
 * Die Instanzen sind nach Chunks sortiert gespeichert. Nur Instanzen sichtbarer Chunks werden
 * in den Grafikpuffer kopiert (Culling pro Chunk).
 */
export class ChunkedInstances {
  readonly mesh: InstancedMesh;
  /** Optionale vereinfachte Variante für große Entfernung; teilt sich die Instanzdaten mit `mesh`. */
  readonly lodMesh: InstancedMesh | null = null;
  private readonly matrices: Float32Array;
  private readonly colors: Float32Array | null;
  /** Startindex jedes Chunks in den Quell-Arrays; Länge = Chunks + 1. */
  private readonly chunkStart: Uint32Array;
  /** Ausgeblendete Instanzen (z. B. gefällte Bäume). */
  private readonly hidden: Uint8Array;
  /** Zuordnung Schlüssel (z. B. Feldindex) → Instanz. */
  private readonly byKey = new Map<number, number>();
  /** Wird bei Änderungen gesetzt, damit der Puffer neu befüllt wird. */
  dirty = true;

  constructor(
    geometry: BufferGeometry,
    material: Material,
    builder: InstanceBuilder,
    options: { castShadow: boolean; lodGeometry?: BufferGeometry },
  ) {
    const { matrices, colors, chunkStart, keys } = builder.finish();
    this.hidden = new Uint8Array(keys.length);
    for (let i = 0; i < keys.length; i++) if (keys[i] >= 0) this.byKey.set(keys[i], i);
    this.matrices = matrices;
    this.colors = colors;
    this.chunkStart = chunkStart;
    const capacity = Math.max(1, matrices.length / 16);
    this.mesh = new InstancedMesh(geometry, material, capacity);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false; // Wir cullen selbst pro Chunk.
    this.mesh.castShadow = options.castShadow;
    this.mesh.receiveShadow = true;
    if (colors) {
      this.mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    }
    if (options.lodGeometry) {
      const lod = new InstancedMesh(options.lodGeometry, material, 1);
      lod.instanceMatrix = this.mesh.instanceMatrix;
      lod.instanceColor = this.mesh.instanceColor;
      lod.count = 0;
      lod.frustumCulled = false;
      lod.castShadow = false;
      lod.receiveShadow = false;
      lod.visible = false;
      this.lodMesh = lod;
    }
  }

  /** Schaltet zwischen voller und vereinfachter Darstellung um. */
  setLowDetail(low: boolean): void {
    if (!this.lodMesh) return;
    this.lodMesh.visible = low;
    this.mesh.visible = !low;
  }

  /** Blendet die Instanz mit diesem Schlüssel aus oder ein. */
  setHidden(key: number, hidden: boolean): void {
    const i = this.byKey.get(key);
    if (i === undefined || (this.hidden[i] === 1) === hidden) return;
    this.hidden[i] = hidden ? 1 : 0;
    this.dirty = true;
  }

  /** Kopiert die Instanzen der sichtbaren Chunks in den Grafikpuffer. */
  applyVisible(visible: Uint16Array, visibleCount: number): void {
    this.dirty = false;
    const hidden = this.hidden;
    const dstM = this.mesh.instanceMatrix.array as Float32Array;
    const dstC = this.mesh.instanceColor ? (this.mesh.instanceColor.array as Float32Array) : null;
    const srcM = this.matrices;
    const srcC = this.colors;
    let n = 0;
    for (let v = 0; v < visibleCount; v++) {
      const chunk = visible[v];
      const from = this.chunkStart[chunk];
      const to = this.chunkStart[chunk + 1];
      for (let i = from; i < to; i++) {
        if (hidden[i]) continue;
        const s = i * 16;
        const d = n * 16;
        for (let k = 0; k < 16; k++) dstM[d + k] = srcM[s + k];
        if (dstC && srcC) {
          dstC[n * 3] = srcC[i * 3];
          dstC[n * 3 + 1] = srcC[i * 3 + 1];
          dstC[n * 3 + 2] = srcC[i * 3 + 2];
        }
        n++;
      }
    }
    this.mesh.count = n;
    if (this.lodMesh) this.lodMesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.dispose();
    if (this.lodMesh) {
      this.lodMesh.geometry.dispose();
      this.lodMesh.dispose();
    }
  }
}

/** Sammelt Instanzen beim Aufbau und sortiert sie anschließend nach Chunk. */
export class InstanceBuilder {
  private readonly chunks: number[] = [];
  private readonly mats: number[] = [];
  private readonly cols: number[] = [];
  private readonly keys: number[] = [];

  constructor(
    private readonly chunkCount: number,
    private readonly withColor: boolean,
  ) {}

  add(chunk: number, matrix: Matrix4, color?: Color, key = -1): void {
    this.chunks.push(chunk);
    this.keys.push(key);
    for (let k = 0; k < 16; k++) this.mats.push(matrix.elements[k]);
    if (this.withColor) {
      this.cols.push(color ? color.r : 1, color ? color.g : 1, color ? color.b : 1);
    }
  }

  finish(): {
    matrices: Float32Array;
    colors: Float32Array | null;
    chunkStart: Uint32Array;
    keys: Int32Array;
  } {
    const n = this.chunks.length;
    const chunkStart = new Uint32Array(this.chunkCount + 1);
    for (const c of this.chunks) chunkStart[c + 1]++;
    for (let c = 0; c < this.chunkCount; c++) chunkStart[c + 1] += chunkStart[c];
    const fill = chunkStart.slice(0, this.chunkCount);
    const matrices = new Float32Array(n * 16);
    const colors = this.withColor ? new Float32Array(n * 3) : null;
    const keys = new Int32Array(n);
    for (let i = 0; i < n; i++) {
      const dst = fill[this.chunks[i]]++;
      keys[dst] = this.keys[i];
      for (let k = 0; k < 16; k++) matrices[dst * 16 + k] = this.mats[i * 16 + k];
      if (colors) {
        colors[dst * 3] = this.cols[i * 3];
        colors[dst * 3 + 1] = this.cols[i * 3 + 1];
        colors[dst * 3 + 2] = this.cols[i * 3 + 2];
      }
    }
    return { matrices, colors, chunkStart, keys };
  }
}
