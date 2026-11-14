import { Box3, Frustum, Matrix4, Vector3, type Camera } from 'three';
import type { World } from '../sim/world';

const tmpMatrix = new Matrix4();
const tmpBox = new Box3();
const tmpMin = new Vector3();
const tmpMax = new Vector3();

/**
 * Ermittelt, welche Chunks im Bildausschnitt liegen. Ändert sich die Liste,
 * wird `version` erhöht – nur dann müssen Instanzpuffer neu befüllt werden.
 */
export class ChunkVisibility {
  readonly visible: Uint16Array;
  count = 0;
  version = 0;
  private readonly previous: Uint16Array;
  private readonly frustum = new Frustum();

  constructor(
    private readonly world: World,
    /** Höchste Objekthöhe über dem Boden, damit hohe Dinge am Rand nicht abgeschnitten werden. */
    private readonly maxHeight = 4,
  ) {
    const n = world.chunksPerSide * world.chunksPerSide;
    this.visible = new Uint16Array(n);
    this.previous = new Uint16Array(n);
  }

  update(camera: Camera): void {
    tmpMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(tmpMatrix);
    const { chunksPerSide, chunkSize } = this.world;

    const prevCount = this.count;
    this.previous.set(this.visible);
    let n = 0;
    for (let cy = 0; cy < chunksPerSide; cy++) {
      for (let cx = 0; cx < chunksPerSide; cx++) {
        tmpMin.set(cx * chunkSize, -1.5, cy * chunkSize);
        tmpMax.set((cx + 1) * chunkSize, this.maxHeight, (cy + 1) * chunkSize);
        tmpBox.set(tmpMin, tmpMax);
        if (this.frustum.intersectsBox(tmpBox)) this.visible[n++] = cy * chunksPerSide + cx;
      }
    }
    this.count = n;

    let changed = n !== prevCount;
    for (let i = 0; !changed && i < n; i++) changed = this.visible[i] !== this.previous[i];
    if (changed) this.version++;
  }
}
