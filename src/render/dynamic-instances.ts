import { Group, InstancedMesh, type BufferGeometry, type Material, type Matrix4 } from 'three';

interface ChunkList {
  ids: number[];
  matrices: number[];
}

/**
 * Instanzen, die sich zur Laufzeit ändern (z. B. Gebäude): pro Chunk eine Liste,
 * ein gemeinsames `InstancedMesh`. Nach Änderungen oder Kamerabewegung werden nur die
 * sichtbaren Chunks in den Grafikpuffer kopiert.
 */
export class DynamicChunkedInstances {
  readonly group = new Group();
  private mesh: InstancedMesh;
  private readonly chunks: ChunkList[];
  private readonly where = new Map<number, number>();
  private dirty = true;

  constructor(
    private readonly geometry: BufferGeometry,
    private readonly material: Material,
    chunkCount: number,
    private readonly castShadow = true,
  ) {
    this.chunks = Array.from({ length: chunkCount }, () => ({ ids: [], matrices: [] }));
    this.mesh = this.createMesh(64);
  }

  add(id: number, chunk: number, matrix: Matrix4): void {
    const list = this.chunks[chunk];
    list.ids.push(id);
    for (let k = 0; k < 16; k++) list.matrices.push(matrix.elements[k]);
    this.where.set(id, chunk);
    this.dirty = true;
  }

  remove(id: number): void {
    const chunk = this.where.get(id);
    if (chunk === undefined) return;
    this.where.delete(id);
    const list = this.chunks[chunk];
    const idx = list.ids.indexOf(id);
    const last = list.ids.length - 1;
    // Mit dem letzten Eintrag tauschen und kürzen
    list.ids[idx] = list.ids[last];
    for (let k = 0; k < 16; k++) list.matrices[idx * 16 + k] = list.matrices[last * 16 + k];
    list.ids.length = last;
    list.matrices.length = last * 16;
    this.dirty = true;
  }

  /** Füllt den Puffer neu, wenn sich etwas geändert hat oder `force` gesetzt ist. */
  apply(visible: Uint16Array, count: number, force: boolean): void {
    if (!this.dirty && !force) return;
    this.dirty = false;
    let total = 0;
    for (let v = 0; v < count; v++) total += this.chunks[visible[v]].ids.length;
    if (total > this.mesh.instanceMatrix.count) {
      this.group.remove(this.mesh);
      this.mesh.dispose();
      this.mesh = this.createMesh(Math.max(total, this.mesh.instanceMatrix.count * 2));
    }
    const dst = this.mesh.instanceMatrix.array as Float32Array;
    let n = 0;
    for (let v = 0; v < count; v++) {
      const src = this.chunks[visible[v]].matrices;
      for (let k = 0; k < src.length; k++) dst[n * 16 + k] = src[k];
      n += src.length / 16;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.dispose();
    this.group.clear();
  }

  private createMesh(capacity: number): InstancedMesh {
    const mesh = new InstancedMesh(this.geometry, this.material, capacity);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.castShadow = this.castShadow;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    return mesh;
  }
}
