import {
  InstancedMesh,
  type BufferGeometry,
  type Material,
  type Matrix4,
  type Object3D,
} from 'three';

/**
 * Ein `InstancedMesh`, das jedes Bild neu befüllt wird (bewegte Dinge wie Rauch, Arbeiter).
 * Wächst bei Bedarf (verdoppelt), sonst keine Speicherzuweisungen.
 */
export class FrameInstances {
  mesh: InstancedMesh;
  private n = 0;

  constructor(
    private readonly geometry: BufferGeometry,
    private readonly material: Material,
    private readonly parent: Object3D,
    capacity = 64,
  ) {
    this.mesh = this.create(capacity);
  }

  begin(): void {
    this.n = 0;
  }

  push(m: Matrix4): void {
    if (this.n >= this.mesh.instanceMatrix.count) this.grow();
    this.mesh.setMatrixAt(this.n++, m);
  }

  end(): void {
    this.mesh.visible = this.n > 0; // leere Gruppen kosten keinen Zeichenaufruf
    if (this.mesh.count === 0 && this.n === 0) return;
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.parent.remove(this.mesh);
    this.mesh.dispose();
  }

  private create(capacity: number): InstancedMesh {
    const mesh = new InstancedMesh(this.geometry, this.material, capacity);
    mesh.count = 0;
    mesh.frustumCulled = false;
    this.parent.add(mesh);
    return mesh;
  }

  private grow(): void {
    const old = this.mesh;
    const bigger = this.create(old.instanceMatrix.count * 2);
    (bigger.instanceMatrix.array as Float32Array).set(old.instanceMatrix.array as Float32Array);
    this.parent.remove(old);
    old.dispose();
    this.mesh = bigger;
  }
}
