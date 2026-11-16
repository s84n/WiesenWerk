import { Color, InstancedMesh, Matrix4, MeshBasicMaterial, PlaneGeometry } from 'three';
import { BUILDINGS } from '../data/buildings';
import { PALETTE } from '../data/palette';
import { hasProblem } from '../sim/bottlenecks';
import { footprintH, footprintW } from '../sim/buildings';
import { MachineState } from '../sim/machines';
import type { Simulation } from '../sim/simulation';

const m = new Matrix4();
const col = new Color();
const UPDATE_MS = 250;

/** Farbe je Zustand (kurze Pausen zwischen Durchläufen zählen als „arbeitet“). */
export function stateColor(sim: Simulation, id: number): number {
  if (!hasProblem(sim, id)) {
    return sim.machines.state[id] === MachineState.Idle ? PALETTE.hintNeutral : PALETTE.hintGood;
  }
  switch (sim.machines.state[id]) {
    case MachineState.WaitingInput:
      return PALETTE.hintWait;
    case MachineState.OutputBlocked:
      return PALETTE.hintBad;
    case MachineState.NoPower:
      return PALETTE.hintPower;
    default:
      return PALETTE.hintIdle;
  }
}

/**
 * Engpass-Ansicht (Taste B): färbt die Grundfläche jeder Maschine nach ihrem Zustand –
 * grün arbeitet, gelb wartet auf Nachschub, rot Ausgang blockiert, violett kein Strom,
 * blau kein Rezept. Viermal pro Sekunde neu, ein Zeichenaufruf.
 */
export class BottleneckView {
  mesh: InstancedMesh;
  private readonly geometry = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private readonly material = new MeshBasicMaterial({
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    depthTest: false,
  });
  private last = -Infinity;

  constructor() {
    this.mesh = this.create(64);
    this.mesh.visible = false;
  }

  update(sim: Simulation, now: number, on: boolean): void {
    this.mesh.visible = on;
    if (!on) {
      this.last = -Infinity;
      return;
    }
    if (now - this.last < UPDATE_MS) return;
    this.last = now;
    const ms = sim.machines;
    const b = sim.buildings;
    let n = 0;
    for (const list of [ms.crafters, ms.extractors, ms.burners, ms.dispensers]) {
      for (let k = 0; k < list.length; k++) {
        const id = list[k];
        if (n >= this.mesh.instanceMatrix.count) this.grow();
        const def = BUILDINGS[b.type[id]];
        const w = footprintW(def, b.rot[id]);
        const h = footprintH(def, b.rot[id]);
        m.makeScale(w - 0.1, 1, h - 0.1).setPosition(b.x[id] + w / 2, 0.08, b.y[id] + h / 2);
        this.mesh.setMatrixAt(n, m);
        this.mesh.setColorAt(n, col.setHex(stateColor(sim, id)));
        n++;
      }
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  private create(capacity: number): InstancedMesh {
    const mesh = new InstancedMesh(this.geometry, this.material, capacity);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.renderOrder = 3;
    mesh.setColorAt(0, col.setHex(0xffffff));
    return mesh;
  }

  private grow(): void {
    const parent = this.mesh.parent;
    const bigger = this.create(this.mesh.instanceMatrix.count * 2);
    bigger.visible = this.mesh.visible;
    parent?.remove(this.mesh);
    this.mesh.dispose();
    parent?.add(bigger);
    this.mesh = bigger;
  }
}
