import { Group, Matrix4, MeshBasicMaterial, Quaternion, Vector3, type Material } from 'three';
import { BUILDINGS } from '../data/buildings';
import { PALETTE } from '../data/palette';
import { DIR_X, DIR_Y, rotateDir, rotateOffset } from '../sim/buildings';
import type { Simulation } from '../sim/simulation';
import type { World } from '../sim/world';
import { DynamicChunkedInstances } from './dynamic-instances';
import { chevron } from './geometry';

const m = new Matrix4();
const pos = new Vector3();
const q = new Quaternion();
const one = new Vector3(1, 1, 1);
const UP = new Vector3(0, 1, 0);
const off = { x: 0, y: 0 };
/** Abstand der Pfeilmitte von der Mitte des Anschlussfeldes (liegt knapp vor dem Gebäude). */
const OFFSET = 0.78;
/** Höchstzahl an Anschlüssen je Gebäude (für eindeutige Schlüssel). */
const MAX_PORTS = 12;

/** Dezenter flacher Winkel knapp über dem Boden, zeigt nach +z. */
function arrow(color: number) {
  return chevron(0.38, 0.16, 0.06, 0.012, 0.035, color).rotateY(Math.PI);
}

/**
 * Dauerhafte Pfeile vor den Bandanschlüssen gebauter Gebäude: orange = Ausgang (zeigt nach außen),
 * blau = Eingang (zeigt hinein). Liegt ein Band davor, verdeckt es den Pfeil – freie Anschlüsse
 * bleiben so gut sichtbar.
 */
export class PortMarkers {
  readonly group = new Group();
  private readonly inputs: DynamicChunkedInstances;
  private readonly outputs: DynamicChunkedInstances;
  private readonly material: Material;
  /** Kräftige Farben, solange gebaut wird (Bauhilfe): Anschlüsse leuchten auf. */
  private readonly brightIn = new MeshBasicMaterial({ color: PALETTE.portIn });
  private readonly brightOut = new MeshBasicMaterial({ color: PALETTE.portOut });
  private highlighted = false;

  constructor(
    private readonly world: World,
    material: Material,
  ) {
    const chunks = world.chunksPerSide * world.chunksPerSide;
    this.material = material;
    this.inputs = new DynamicChunkedInstances(arrow(PALETTE.portMarkerIn), material, chunks, false);
    this.outputs = new DynamicChunkedInstances(
      arrow(PALETTE.portMarkerOut),
      material,
      chunks,
      false,
    );
    this.group.add(this.inputs.group, this.outputs.group);
  }

  /** Bauhilfe: freie Anschlüsse aller Gebäude kräftig statt dezent zeigen. */
  setHighlight(on: boolean): void {
    if (on === this.highlighted) return;
    this.highlighted = on;
    this.inputs.setMaterial(on ? this.brightIn : this.material);
    this.outputs.setMaterial(on ? this.brightOut : this.material);
  }

  added(sim: Simulation, id: number): void {
    const b = sim.buildings;
    const def = BUILDINGS[b.type[id]];
    const rot = b.rot[id];
    def.ports.forEach((port, i) => {
      if (i >= MAX_PORTS) return;
      rotateOffset(def, rot, port.x, port.y, off);
      const d = rotateDir(port.dir, rot);
      const tx = b.x[id] + off.x;
      const ty = b.y[id] + off.y;
      pos.set(tx + 0.5 + DIR_X[d] * OFFSET, 0, ty + 0.5 + DIR_Y[d] * OFFSET);
      const outward = Math.atan2(DIR_X[d], DIR_Y[d]);
      q.setFromAxisAngle(UP, port.kind === 'out' ? outward : outward + Math.PI);
      m.compose(pos, q, one);
      const chunk = this.world.chunkOf(
        Math.min(this.world.size - 1, Math.max(0, tx)),
        Math.min(this.world.size - 1, Math.max(0, ty)),
      );
      (port.kind === 'out' ? this.outputs : this.inputs).add(id * MAX_PORTS + i, chunk, m);
    });
  }

  removed(id: number): void {
    for (let i = 0; i < MAX_PORTS; i++) {
      this.inputs.remove(id * MAX_PORTS + i);
      this.outputs.remove(id * MAX_PORTS + i);
    }
  }

  apply(visible: Uint16Array, count: number, force: boolean): void {
    this.inputs.apply(visible, count, force);
    this.outputs.apply(visible, count, force);
  }

  dispose(): void {
    this.inputs.dispose();
    this.outputs.dispose();
    this.group.clear();
  }
}
