import { Color, InstancedMesh, Matrix4, MeshBasicMaterial, OctahedronGeometry } from 'three';
import { MACHINES } from '../data/balance';
import { BUILDINGS } from '../data/buildings';
import { PALETTE } from '../data/palette';
import { footprintH, footprintW } from '../sim/buildings';
import { MachineState } from '../sim/machines';
import type { Simulation } from '../sim/simulation';

const m = new Matrix4();
const col = new Color();
const UPDATE_MS = 250;

/**
 * Kleine schwebende Rauten über Maschinen mit Problemen:
 * gelb = wartet auf Nachschub, rot = Ausgang blockiert, blau = kein Rezept.
 */
export class StatusIcons {
  mesh: InstancedMesh;
  private readonly material = new MeshBasicMaterial({ color: 0xffffff });
  private readonly geometry = new OctahedronGeometry(0.2, 0).scale(1, 1.4, 1);
  private last = -Infinity;

  constructor() {
    this.mesh = this.create(64);
  }

  update(sim: Simulation, now: number): void {
    this.mesh.position.y = Math.sin(now / 400) * 0.08;
    if (now - this.last < UPDATE_MS) return;
    this.last = now;
    const ms = sim.machines;
    let n = 0;
    for (const list of ms.lists) {
      for (let k = 0; k < list.length; k++) {
        const id = list[k];
        const s = ms.state[id];
        if (s === MachineState.Working || s === MachineState.Idle) continue;
        if (sim.tick - ms.stateSince[id] < MACHINES.problemDelayTicks) continue;
        if (n >= this.mesh.instanceMatrix.count) this.grow();
        const b = sim.buildings;
        const def = BUILDINGS[b.type[id]];
        m.makeTranslation(
          b.x[id] + footprintW(def, b.rot[id]) / 2,
          2.4,
          b.y[id] + footprintH(def, b.rot[id]) / 2,
        );
        this.mesh.setMatrixAt(n, m);
        col.setHex(
          s === MachineState.OutputBlocked
            ? PALETTE.hintBad
            : s === MachineState.NoRecipe
              ? PALETTE.hintIdle
              : s === MachineState.NoPower
                ? PALETTE.hintPower
                : PALETTE.hintWait,
        );
        this.mesh.setColorAt(n, col);
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
    mesh.setColorAt(0, col.setHex(0xffffff));
    return mesh;
  }

  private grow(): void {
    const parent = this.mesh.parent;
    const bigger = this.create(this.mesh.instanceMatrix.count * 2);
    parent?.remove(this.mesh);
    this.mesh.dispose();
    parent?.add(bigger);
    this.mesh = bigger;
  }
}
