import {
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from 'three';
import { BUILDINGS } from '../data/buildings';
import { PALETTE } from '../data/palette';
import { footprintH, footprintW } from '../sim/buildings';
import type { Simulation } from '../sim/simulation';
import { BIG_POLE_CABLE_HEIGHT, POLE_CABLE_HEIGHT } from './building-models';

const m = new Matrix4();
const q = new Quaternion();
const a = new Vector3();
const b = new Vector3();
const dir = new Vector3();
const mid = new Vector3();
const scale = new Vector3();
const X = new Vector3(1, 0, 0);
const col = new Color();
const SEGMENTS = 8;
const UPDATE_MS = 250;

/**
 * Stromkabel zwischen Masten (durchhängend) und die Strom-Ansicht:
 * Versorgungsbereiche der Masten und farbige Markierung der Gebäude
 * (grün = versorgt, gelb = zu wenig Strom, rot = kein Netz).
 */
export class PowerView {
  readonly group = new Group();
  private cables: InstancedMesh;
  private overlay: InstancedMesh;
  private readonly cableGeo = new BoxGeometry(1, 0.035, 0.035);
  private readonly cableMat = new MeshBasicMaterial({ color: PALETTE.cable });
  private readonly planeGeo = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private readonly overlayMat = new MeshBasicMaterial({
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    depthTest: false,
  });
  private shownVersion = -1;
  private lastOverlay = -Infinity;
  private overlayOn = false;

  constructor() {
    this.cables = this.makeCables(64);
    this.overlay = this.makeOverlay(64);
    this.overlay.visible = false;
  }

  /** Kabel neu aufbauen, wenn sich die Netze geändert haben. */
  update(sim: Simulation, now: number, overlay: boolean): void {
    const power = sim.power;
    power.ensure();
    if (power.version !== this.shownVersion) {
      this.shownVersion = power.version;
      this.rebuildCables(sim);
      this.lastOverlay = -Infinity;
    }
    if (overlay !== this.overlayOn) {
      this.overlayOn = overlay;
      this.overlay.visible = overlay;
      this.lastOverlay = -Infinity;
    }
    if (overlay && now - this.lastOverlay >= UPDATE_MS) {
      this.lastOverlay = now;
      this.rebuildOverlay(sim);
    }
  }

  /** Für eine neue Welt: alles neu. */
  reset(): void {
    this.shownVersion = -1;
  }

  private rebuildCables(sim: Simulation): void {
    const pairs = sim.power.cables;
    const st = sim.buildings;
    const needed = (pairs.length / 2) * SEGMENTS;
    if (needed > this.cables.instanceMatrix.count) {
      this.group.remove(this.cables);
      this.cables.dispose();
      this.cables = this.makeCables(Math.max(needed, this.cables.instanceMatrix.count * 2));
    }
    let n = 0;
    for (let k = 0; k < pairs.length; k += 2) {
      const p1 = pairs[k];
      const p2 = pairs[k + 1];
      const d1 = BUILDINGS[st.type[p1]];
      const d2 = BUILDINGS[st.type[p2]];
      const x1 = st.x[p1] + d1.size[0] / 2;
      const z1 = st.y[p1] + d1.size[1] / 2;
      const x2 = st.x[p2] + d2.size[0] / 2;
      const z2 = st.y[p2] + d2.size[1] / 2;
      const h1 = cableHeight(st.type[p1]);
      const h2 = cableHeight(st.type[p2]);
      const dist = Math.hypot(x2 - x1, z2 - z1);
      const sag = 0.12 + dist * 0.035;
      for (let s = 0; s < SEGMENTS; s++) {
        const t0 = s / SEGMENTS;
        const t1 = (s + 1) / SEGMENTS;
        a.set(
          x1 + (x2 - x1) * t0,
          h1 + (h2 - h1) * t0 - sag * 4 * t0 * (1 - t0),
          z1 + (z2 - z1) * t0,
        );
        b.set(
          x1 + (x2 - x1) * t1,
          h1 + (h2 - h1) * t1 - sag * 4 * t1 * (1 - t1),
          z1 + (z2 - z1) * t1,
        );
        dir.subVectors(b, a);
        const len = dir.length();
        dir.divideScalar(len);
        q.setFromUnitVectors(X, dir);
        mid.addVectors(a, b).multiplyScalar(0.5);
        scale.set(len, 1, 1);
        this.cables.setMatrixAt(n++, m.compose(mid, q, scale));
      }
    }
    this.cables.count = n;
    this.cables.instanceMatrix.needsUpdate = true;
  }

  private rebuildOverlay(sim: Simulation): void {
    const st = sim.buildings;
    const power = sim.power;
    let n = 0;
    const add = (x0: number, y0: number, w: number, h: number, color: number): void => {
      if (n >= this.overlay.instanceMatrix.count) this.growOverlay();
      m.makeScale(w, 1, h).setPosition(x0 + w / 2, 0.07, y0 + h / 2);
      this.overlay.setMatrixAt(n, m);
      this.overlay.setColorAt(n, col.setHex(color));
      n++;
    };
    for (let id = 0; id < st.highWater; id++) {
      if (!st.alive[id]) continue;
      const def = BUILDINGS[st.type[id]];
      const beh = def.behavior;
      const w = footprintW(def, st.rot[id]);
      const h = footprintH(def, st.rot[id]);
      if (beh.kind === 'pole') {
        const r = beh.supplyRadius;
        add(st.x[id] - r, st.y[id] - r, w + 2 * r, h + 2 * r, PALETTE.powerArea);
      } else if (
        beh.kind === 'wind' ||
        beh.kind === 'water' ||
        beh.kind === 'solar' ||
        beh.kind === 'battery'
      ) {
        add(st.x[id], st.y[id], w, h, power.gridOf[id] < 0 ? PALETTE.powerNone : PALETTE.powerOk);
      } else if (def.power > 0 || beh.kind === 'burner') {
        const g = power.gridOf[id];
        const color =
          g < 0
            ? PALETTE.powerNone
            : beh.kind === 'burner'
              ? sim.machines.fuelEnergy[id] > 0 || sim.machines.inBuf[id * 2] > 0
                ? PALETTE.powerOk
                : PALETTE.powerLow
              : power.factor[g] >= 1000
                ? PALETTE.powerOk
                : PALETTE.powerLow;
        add(st.x[id], st.y[id], w, h, color);
      }
    }
    this.overlay.count = n;
    this.overlay.instanceMatrix.needsUpdate = true;
    if (this.overlay.instanceColor) this.overlay.instanceColor.needsUpdate = true;
  }

  private makeCables(capacity: number): InstancedMesh {
    const mesh = new InstancedMesh(this.cableGeo, this.cableMat, capacity);
    mesh.count = 0;
    mesh.frustumCulled = false;
    this.group.add(mesh);
    return mesh;
  }

  private makeOverlay(capacity: number): InstancedMesh {
    const mesh = new InstancedMesh(this.planeGeo, this.overlayMat, capacity);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.renderOrder = 3;
    mesh.setColorAt(0, col.setHex(0xffffff));
    this.group.add(mesh);
    return mesh;
  }

  private growOverlay(): void {
    const old = this.overlay;
    const bigger = this.makeOverlay(old.instanceMatrix.count * 2);
    (bigger.instanceMatrix.array as Float32Array).set(old.instanceMatrix.array as Float32Array);
    if (old.instanceColor && bigger.instanceColor) {
      (bigger.instanceColor.array as Float32Array).set(old.instanceColor.array as Float32Array);
    }
    bigger.visible = old.visible;
    this.group.remove(old);
    old.dispose();
    this.overlay = bigger;
  }
}

/** Aufhängehöhe der Kabel je Masttyp. */
function cableHeight(type: number): number {
  return BUILDINGS[type].model === 'bigPole' ? BIG_POLE_CABLE_HEIGHT : POLE_CABLE_HEIGHT;
}
