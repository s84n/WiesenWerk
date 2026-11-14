import {
  Color,
  ConeGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
} from 'three';
import { BUILDINGS } from '../data/buildings';
import { PALETTE } from '../data/palette';
import { DIR_X, DIR_Y, footprintH, footprintW, rotateDir, rotateOffset } from '../sim/buildings';
import type { BeltStep } from '../sim/commands';
import { beltStraight } from './belt-models';
import { buildingGeometries, buildingMatrix } from './buildings-view';

const MAX_BELT_PREVIEW = 600;
const tint = new Color();

const m = new Matrix4();
const off = { x: 0, y: 0 };
const MAX_ARROWS = 8;

/**
 * Bauvorschau (halbtransparentes Gebäude, grün/rot), Anschlusspfeile und Markierungen
 * für Abbau und Abriss.
 */
export class BuildPreview {
  readonly group = new Group();
  private readonly ghostMaterial = new MeshLambertMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
  });
  private readonly ghost = new Mesh(undefined, this.ghostMaterial);
  private readonly areaMaterial = new MeshBasicMaterial({
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  private readonly area = new Mesh(
    new PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    this.areaMaterial,
  );
  private readonly arrows: Mesh[] = [];
  private readonly rangeMaterial = new MeshBasicMaterial({
    color: PALETTE.powerArea,
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
    depthTest: false,
  });
  private readonly range = new Mesh(
    new PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    this.rangeMaterial,
  );
  private readonly beltGhosts: InstancedMesh;
  private readonly inMaterial = new MeshBasicMaterial({ color: PALETTE.portIn, depthTest: false });
  private readonly outMaterial = new MeshBasicMaterial({
    color: PALETTE.portOut,
    depthTest: false,
  });

  constructor() {
    this.ghost.matrixAutoUpdate = false;
    this.ghost.renderOrder = 2;
    this.area.renderOrder = 3;
    const arrowGeo = new ConeGeometry(0.24, 0.5, 3).rotateX(Math.PI / 2).scale(1, 0.35, 1); // flacher Pfeil nach +z
    for (let i = 0; i < MAX_ARROWS; i++) {
      const a = new Mesh(arrowGeo, this.outMaterial);
      a.renderOrder = 4;
      a.visible = false;
      this.arrows.push(a);
      this.group.add(a);
    }
    this.beltGhosts = new InstancedMesh(beltStraight(), this.ghostMaterial, MAX_BELT_PREVIEW);
    this.beltGhosts.count = 0;
    this.beltGhosts.frustumCulled = false;
    this.beltGhosts.renderOrder = 2;
    this.beltGhosts.setColorAt(0, tint.setHex(0xffffff));
    this.range.renderOrder = 3;
    this.group.add(this.ghost, this.area, this.beltGhosts, this.range);
    this.hide();
  }

  /** Vorschau eines Bandweges; `valid[i]` färbt jedes Feld grün oder rot. */
  showBeltPath(type: number, path: readonly BeltStep[], valid: readonly boolean[]): void {
    this.hide();
    const n = Math.min(path.length, MAX_BELT_PREVIEW);
    for (let i = 0; i < n; i++) {
      const p = path[i];
      this.beltGhosts.setMatrixAt(i, buildingMatrix(type, p.x, p.y, p.dir, m));
      this.beltGhosts.setColorAt(i, tint.setHex(valid[i] ? 0xc8ffc0 : 0xff9a8a));
    }
    this.beltGhosts.count = n;
    this.beltGhosts.instanceMatrix.needsUpdate = true;
    if (this.beltGhosts.instanceColor) this.beltGhosts.instanceColor.needsUpdate = true;
    this.ghostMaterial.color.setHex(0xffffff);
  }

  hide(): void {
    this.ghost.visible = false;
    if (this.range) this.range.visible = false;
    if (this.beltGhosts) this.beltGhosts.count = 0;
    this.area.visible = false;
    for (const a of this.arrows) a.visible = false;
  }

  /** Zeigt ein Gebäude als Vorschau. */
  showBuilding(type: number, x: number, y: number, rot: number, valid: boolean): void {
    const def = BUILDINGS[type];
    this.showGhost(type, x, y, rot, valid ? 0xc8ffc0 : 0xff9a8a, 1);
    this.showArea(
      x,
      y,
      x + footprintW(def, rot) - 1,
      y + footprintH(def, rot) - 1,
      valid ? PALETTE.hintGood : PALETTE.hintBad,
    );

    let n = 0;
    for (const port of def.ports) {
      if (n >= MAX_ARROWS) break;
      rotateOffset(def, rot, port.x, port.y, off);
      const dir = rotateDir(port.dir, rot);
      const a = this.arrows[n++];
      a.position.set(
        x + off.x + 0.5 + DIR_X[dir] * 0.62,
        0.25,
        y + off.y + 0.5 + DIR_Y[dir] * 0.62,
      );
      // Ausgänge zeigen nach außen, Eingänge nach innen
      const outward = Math.atan2(DIR_X[dir], DIR_Y[dir]);
      a.rotation.set(0, port.kind === 'out' ? outward : outward + Math.PI, 0);
      a.material = port.kind === 'out' ? this.outMaterial : this.inMaterial;
      a.visible = true;
    }
    for (let i = n; i < MAX_ARROWS; i++) this.arrows[i].visible = false;
  }

  /** Zeigt zusätzlich einen Versorgungsbereich (Strommast). */
  showRange(x0: number, y0: number, x1: number, y1: number): void {
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    this.range.position.set(x0 + w / 2, 0.075, y0 + h / 2);
    this.range.scale.set(w, 1, h);
    this.range.visible = true;
  }

  /** Hebt ein bestehendes Gebäude rot hervor (Abrissmodus). */
  highlightBuilding(type: number, x: number, y: number, rot: number): void {
    this.hide();
    this.showGhost(type, x, y, rot, 0xff6a50, 1.06);
    const def = BUILDINGS[type];
    this.showArea(
      x,
      y,
      x + footprintW(def, rot) - 1,
      y + footprintH(def, rot) - 1,
      PALETTE.hintBad,
    );
  }

  private showGhost(
    type: number,
    x: number,
    y: number,
    rot: number,
    tint: number,
    scale: number,
  ): void {
    this.ghost.geometry = buildingGeometries()[type];
    buildingMatrix(type, x, y, rot, this.ghost.matrix);
    if (scale !== 1) this.ghost.matrix.multiply(m.makeScale(scale, scale, scale));
    this.ghost.visible = true;
    this.ghostMaterial.color.setHex(tint);
  }

  /** Markiert ein Rechteck von Feldern (Ecken einschließlich). */
  showArea(x0: number, y0: number, x1: number, y1: number, color: number): void {
    const minX = Math.min(x0, x1);
    const minY = Math.min(y0, y1);
    const w = Math.abs(x1 - x0) + 1;
    const h = Math.abs(y1 - y0) + 1;
    this.area.position.set(minX + w / 2, 0.08, minY + h / 2);
    this.area.scale.set(w, 1, h);
    this.areaMaterial.color.setHex(color);
    this.area.visible = true;
  }

  /** Nur die Flächenmarkierung zeigen (Abbau, Abriss). */
  showOnlyArea(x0: number, y0: number, x1: number, y1: number, color: number): void {
    this.hide();
    this.showArea(x0, y0, x1, y1, color);
  }
}
