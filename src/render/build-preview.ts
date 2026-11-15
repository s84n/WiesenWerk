import {
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  LineBasicMaterial,
  LineSegments,
  RingGeometry,
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
import { beltDirectionMark, beltStraight } from './belt-models';
import { buildingGeometries, buildingMatrix } from './buildings-view';

const MAX_BELT_PREVIEW = 600;
const tint = new Color();

const m = new Matrix4();
const off = { x: 0, y: 0 };
const MAX_ARROWS = 12;
/** Höchstzahl gezeigter Verbindungslinien beim Bauen eines Mastes. */
const MAX_LINKS = 48;
/** Bauhilfe: halbe Kantenlänge des Feldrasters um den Mauszeiger (in Feldern). */
const GRID_RADIUS = 10;

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
  /** Mast: Kreis der Verbindungsreichweite und Linien zu Masten, die sich verbinden würden. */
  private readonly reachMaterial = new MeshBasicMaterial({
    color: PALETTE.poleReach,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    depthTest: false,
  });
  private readonly reach = new Mesh(undefined, this.reachMaterial);
  private readonly reachRings = new Map<number, RingGeometry>();
  private readonly linkPos = new Float32Array(MAX_LINKS * 6);
  private readonly links = new LineSegments(
    new BufferGeometry().setAttribute('position', new BufferAttribute(this.linkPos, 3)),
    new LineBasicMaterial({ color: PALETTE.poleReach, depthTest: false, transparent: true }),
  );
  private readonly beltGhosts: InstancedMesh;
  /** Kräftige Laufrichtung auf der Bandvorschau (über allem, damit sie nie verdeckt ist). */
  private readonly beltMarks: InstancedMesh;
  private readonly inMaterial = new MeshBasicMaterial({ color: PALETTE.portIn, depthTest: false });
  private readonly outMaterial = new MeshBasicMaterial({
    color: PALETTE.portOut,
    depthTest: false,
  });

  /** Feines Feldraster um den Mauszeiger, nach außen ausblendend (Bauhilfe). */
  private readonly grid = new LineSegments(
    buildGridGeometry(),
    new LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
    }),
  );

  /** Blaupause: je Gebäudetyp eine Instanz-Gruppe (wenige Zeichenaufrufe, auch bei vielen Gebäuden). */
  private readonly blueprintGhosts = new Map<number, InstancedMesh>();

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
    this.beltMarks = new InstancedMesh(
      beltDirectionMark(),
      new MeshBasicMaterial({ vertexColors: true, depthTest: false, transparent: true }),
      MAX_BELT_PREVIEW,
    );
    this.beltMarks.count = 0;
    this.beltMarks.frustumCulled = false;
    this.beltMarks.renderOrder = 5;
    this.range.renderOrder = 3;
    this.reach.renderOrder = 4;
    this.links.renderOrder = 4;
    this.links.frustumCulled = false;
    this.grid.renderOrder = 1;
    this.grid.frustumCulled = false;
    this.group.add(
      this.ghost,
      this.area,
      this.beltGhosts,
      this.beltMarks,
      this.grid,
      this.range,
      this.reach,
      this.links,
    );
    this.hide();
  }

  /** Vorschau eines Bandweges; `valid[i]` färbt jedes Feld grün oder rot. */
  showBeltPath(type: number, path: readonly BeltStep[], valid: readonly boolean[]): void {
    this.hide();
    if (path.length > 0) this.showGrid(path[path.length - 1].x, path[path.length - 1].y);
    // gleiche Vorschau für Wege und Zäune: Geometrie des gewählten Gebäudes
    this.beltGhosts.geometry = buildingGeometries()[type];
    const n = Math.min(path.length, MAX_BELT_PREVIEW);
    for (let i = 0; i < n; i++) {
      const p = path[i];
      this.beltGhosts.setMatrixAt(i, buildingMatrix(type, p.x, p.y, p.dir, m));
      this.beltGhosts.setColorAt(i, tint.setHex(valid[i] ? 0xc8ffc0 : 0xff9a8a));
    }
    this.beltGhosts.count = n;
    this.beltGhosts.instanceMatrix.needsUpdate = true;
    // Nur echte Bänder bekommen Richtungspfeile (Wege und Zäune haben keine Laufrichtung)
    if (BUILDINGS[type].behavior.kind === 'belt') {
      for (let i = 0; i < n; i++) {
        const p = path[i];
        m.makeRotationY((-p.dir * Math.PI) / 2);
        m.setPosition(p.x + 0.5, 0, p.y + 0.5);
        this.beltMarks.setMatrixAt(i, m);
      }
      this.beltMarks.count = n;
      this.beltMarks.instanceMatrix.needsUpdate = true;
    }
    if (this.beltGhosts.instanceColor) this.beltGhosts.instanceColor.needsUpdate = true;
    this.ghostMaterial.color.setHex(0xffffff);
  }

  /** Vorschau einer Blaupause; `valid[i]` färbt jedes Gebäude grün oder rot. */
  showBlueprint(
    list: readonly { building: number; x: number; y: number; rot: number }[],
    valid: readonly boolean[],
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    allValid: boolean,
  ): void {
    this.hide();
    const counts = new Map<number, number>();
    for (const p of list) counts.set(p.building, (counts.get(p.building) ?? 0) + 1);
    for (const [type, n] of counts) {
      let mesh = this.blueprintGhosts.get(type);
      if (!mesh || mesh.instanceMatrix.count < n) {
        if (mesh) {
          this.group.remove(mesh);
          mesh.dispose();
        }
        mesh = new InstancedMesh(
          buildingGeometries()[type],
          this.ghostMaterial,
          Math.max(16, n * 2),
        );
        mesh.frustumCulled = false;
        mesh.renderOrder = 2;
        mesh.setColorAt(0, tint.setHex(0xffffff));
        this.blueprintGhosts.set(type, mesh);
        this.group.add(mesh);
      }
      mesh.count = 0;
    }
    list.forEach((p, i) => {
      const mesh = this.blueprintGhosts.get(p.building)!;
      const k = mesh.count++;
      mesh.setMatrixAt(k, buildingMatrix(p.building, p.x, p.y, p.rot, m));
      mesh.setColorAt(k, tint.setHex(valid[i] ? 0xc8ffc0 : 0xff9a8a));
    });
    for (const mesh of this.blueprintGhosts.values()) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    this.ghostMaterial.color.setHex(0xffffff);
    this.showArea(x0, y0, x1, y1, allValid ? PALETTE.hintGood : PALETTE.hintWait);
  }

  /** Feldraster um das Feld (x, y) zeigen; Linien liegen auf den Feldkanten. */
  private showGrid(x: number, y: number): void {
    this.grid.position.set(x, 0.06, y);
    this.grid.visible = true;
  }

  hide(): void {
    for (const mesh of this.blueprintGhosts.values()) mesh.count = 0;
    this.ghost.visible = false;
    if (this.range) this.range.visible = false;
    if (this.reach) this.reach.visible = false;
    if (this.links) this.links.visible = false;
    if (this.beltGhosts) this.beltGhosts.count = 0;
    if (this.beltMarks) this.beltMarks.count = 0;
    if (this.grid) this.grid.visible = false;
    this.area.visible = false;
    for (const a of this.arrows) a.visible = false;
  }

  /** Zeigt ein Gebäude als Vorschau. */
  showBuilding(type: number, x: number, y: number, rot: number, valid: boolean): void {
    const def = BUILDINGS[type];
    this.range.visible = false;
    this.showGrid(x, y);
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

  /**
   * Mast: Kreis mit der Verbindungsreichweite um den Mittelpunkt (`cx`, `cz` in Feldern) und
   * Linien zu den Masten, mit denen sich der neue verbinden würde (`targets`: x, z im Wechsel).
   */
  showPoleReach(cx: number, cz: number, radius: number, targets: readonly number[]): void {
    let ring = this.reachRings.get(radius);
    if (!ring) {
      ring = new RingGeometry(radius - 0.22, radius, 128).rotateX(-Math.PI / 2);
      this.reachRings.set(radius, ring);
    }
    this.reach.geometry = ring;
    this.reach.position.set(cx, 0.09, cz);
    this.reach.visible = true;
    const n = Math.min(targets.length / 2, MAX_LINKS);
    for (let i = 0; i < n; i++) {
      const o = i * 6;
      this.linkPos[o] = cx;
      this.linkPos[o + 1] = 1.2;
      this.linkPos[o + 2] = cz;
      this.linkPos[o + 3] = targets[i * 2];
      this.linkPos[o + 4] = 1.2;
      this.linkPos[o + 5] = targets[i * 2 + 1];
    }
    const g = this.links.geometry;
    g.setDrawRange(0, n * 2);
    g.getAttribute('position').needsUpdate = true;
    this.links.visible = n > 0;
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

/**
 * Linien des Feldrasters (Kantenlänge 2 × GRID_RADIUS), je Feld ein Stück, damit die Deckkraft
 * nach außen abnehmen kann (Farbe mit Alphawert je Ecke).
 */
function buildGridGeometry(): BufferGeometry {
  const r = GRID_RADIUS;
  const pos: number[] = [];
  const col: number[] = [];
  const c = new Color(PALETTE.highlight);
  const alpha = (x: number, z: number): number =>
    Math.max(0, 0.42 * (1 - Math.hypot(x, z) / (r + 0.5)));
  const seg = (x0: number, z0: number, x1: number, z1: number): void => {
    pos.push(x0, 0, z0, x1, 0, z1);
    col.push(c.r, c.g, c.b, alpha(x0, z0), c.r, c.g, c.b, alpha(x1, z1));
  };
  for (let k = -r; k <= r; k++)
    for (let t = -r; t < r; t++) {
      seg(k, t, k, t + 1);
      seg(t, k, t + 1, k);
    }
  return new BufferGeometry()
    .setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
    .setAttribute('color', new BufferAttribute(new Float32Array(col), 4));
}
