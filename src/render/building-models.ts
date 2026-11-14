import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  SphereGeometry,
  type BufferGeometry,
} from 'three';
import { PALETTE } from '../data/palette';
import { beltStraight } from './belt-models';
import { colored, merge } from './geometry';

/**
 * Gebäudemodelle aus Grundkörpern. Ursprung = Mitte der Grundfläche, ungedreht.
 * „Vorne“ ist Süden (+z), dort liegen meist die Ausgänge.
 * Bis Phase 6 sind es einfache, aber unterscheidbare Formen.
 */

/** Quader mit Unterkante auf Höhe `y`. */
function box(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  color: number,
): BufferGeometry {
  return colored(new BoxGeometry(w, h, d).translate(x, y + h / 2, z), color);
}

/** Satteldach entlang x, Unterkante auf Höhe `y`. */
function gableRoof(
  width: number,
  length: number,
  height: number,
  x: number,
  y: number,
  z: number,
  color: number,
): BufferGeometry {
  const r = 1;
  const g = new CylinderGeometry(r, r, length, 3).rotateX(-Math.PI / 2).rotateY(Math.PI / 2);
  // Dreieck: Spitze oben (y = r), Basis bei y = −r/2 mit Breite r·√3
  g.translate(0, r / 2, 0).scale(1, height / (1.5 * r), width / (Math.sqrt(3) * r));
  return colored(g.translate(x, y, z), color);
}

function pyramidRoof(size: number, height: number, y: number, color: number): BufferGeometry {
  return colored(
    new ConeGeometry(size / Math.SQRT2, height, 4)
      .rotateY(Math.PI / 4)
      .translate(0, y + height / 2, 0),
    color,
  );
}

function hq(): BufferGeometry {
  const parts = [
    box(2.9, 0.18, 2.9, 0, 0, 0, PALETTE.stone),
    box(2.3, 1.2, 2.3, 0, 0.18, 0, PALETTE.cream),
    pyramidRoof(2.7, 1.0, 1.38, PALETTE.roof),
    box(0.55, 0.9, 0.55, 0, 2.0, 0, PALETTE.wood),
    pyramidRoof(0.8, 0.5, 2.9, PALETTE.copper),
    colored(new CylinderGeometry(0.025, 0.025, 0.7, 4).translate(0, 3.65, 0), PALETTE.woodDark),
    box(0.4, 0.22, 0.02, 0.2, 3.65, 0, PALETTE.flag),
  ];
  // Tore an allen vier Seiten (dort liegen die Eingänge)
  for (let k = 0; k < 4; k++) {
    const door = new BoxGeometry(0.6, 0.75, 0.08).translate(0, 0.18 + 0.375, 1.16);
    door.rotateY((k * Math.PI) / 2);
    parts.push(colored(door, PALETTE.woodDark));
  }
  // Fenster
  for (const x of [-0.75, 0.75]) {
    parts.push(box(0.3, 0.3, 0.04, x, 0.75, 1.16, PALETTE.windowLight));
    parts.push(box(0.04, 0.3, 0.3, 1.16, 0.75, x, PALETTE.windowLight));
  }
  return merge(parts);
}

function lumberjack(): BufferGeometry {
  const parts = [
    box(1.85, 0.1, 1.85, 0, 0, 0, PALETTE.soil),
    box(1.1, 0.8, 0.95, -0.3, 0.1, -0.3, PALETTE.wood),
    gableRoof(1.25, 1.3, 0.55, -0.3, 0.9, -0.3, PALETTE.roof),
    box(0.3, 0.5, 0.04, -0.3, 0.1, 0.18, PALETTE.woodDark),
    // Sägeblatt
    colored(
      new CylinderGeometry(0.32, 0.32, 0.04, 12).rotateX(Math.PI / 2).translate(0.55, 0.55, -0.55),
      PALETTE.stone,
    ),
    box(0.12, 0.3, 0.12, 0.55, 0.1, -0.55, PALETTE.woodDark),
  ];
  // Holzstapel
  for (let k = 0; k < 3; k++) {
    const log = new CylinderGeometry(0.11, 0.11, 0.8, 6).rotateZ(Math.PI / 2);
    parts.push(
      colored(
        log.translate(0.45, 0.21 + (k === 2 ? 0.19 : 0), 0.35 + (k === 2 ? 0.11 : k * 0.22)),
        PALETTE.trunk,
      ),
    );
  }
  return merge(parts);
}

function miner(): BufferGeometry {
  const parts = [
    box(1.85, 0.25, 1.85, 0, 0, 0, PALETTE.rockDark),
    // Förderturm
    box(0.12, 1.7, 0.12, -0.45, 0.25, -0.35, PALETTE.woodDark),
    box(0.12, 1.7, 0.12, 0.45, 0.25, -0.35, PALETTE.woodDark),
    box(1.05, 0.12, 0.16, 0, 1.9, -0.35, PALETTE.wood),
    colored(
      new CylinderGeometry(0.32, 0.32, 0.08, 10).rotateX(Math.PI / 2).translate(0, 1.6, -0.25),
      PALETTE.copper,
    ),
    box(0.7, 0.55, 0.7, 0, 0.25, -0.35, PALETTE.wood),
    gableRoof(0.85, 0.85, 0.35, 0, 0.8, -0.35, PALETTE.roof),
    // Lore mit Gestein
    box(0.5, 0.25, 0.35, 0.35, 0.3, 0.5, PALETTE.woodDark),
    colored(
      new SphereGeometry(0.17, 5, 3).scale(1.2, 0.6, 0.8).translate(0.35, 0.57, 0.5),
      PALETTE.stone,
    ),
  ];
  return merge(parts);
}

function furnace(): BufferGeometry {
  return merge([
    box(1.8, 0.12, 1.8, 0, 0, 0, PALETTE.stone),
    box(1.45, 0.9, 1.4, -0.1, 0.12, 0, PALETTE.brick),
    box(1.1, 0.35, 1.05, -0.1, 1.02, 0, PALETTE.roof),
    colored(new CylinderGeometry(0.17, 0.22, 1.5, 6).translate(0.45, 1.15, -0.4), PALETTE.brick),
    colored(new CylinderGeometry(0.21, 0.21, 0.1, 6).translate(0.45, 1.95, -0.4), PALETTE.roof),
    // glühende Öffnung vorne
    box(0.5, 0.35, 0.05, -0.1, 0.3, 0.71, PALETTE.glow),
    box(0.7, 0.08, 0.12, -0.1, 0.65, 0.72, PALETTE.stone),
  ]);
}

function workshop(): BufferGeometry {
  const parts = [
    box(1.85, 0.1, 1.85, 0, 0, 0, PALETTE.soil),
    box(1.6, 0.85, 1.25, 0, 0.1, -0.1, PALETTE.wood),
    gableRoof(1.45, 1.75, 0.6, 0, 0.95, -0.1, PALETTE.roof),
    box(0.5, 0.55, 0.04, -0.35, 0.1, 0.52, PALETTE.woodDark),
    box(0.3, 0.28, 0.04, 0.4, 0.45, 0.52, PALETTE.windowLight),
    // Zahnrad an der Seite
    colored(
      new CylinderGeometry(0.3, 0.3, 0.08, 10).rotateZ(Math.PI / 2).translate(0.84, 0.6, -0.1),
      PALETTE.copper,
    ),
  ];
  for (let k = 0; k < 8; k++) {
    const tooth = new BoxGeometry(0.08, 0.12, 0.12).translate(0, 0.33, 0);
    tooth.rotateX((k * Math.PI) / 4).translate(0.84, 0.6, -0.1);
    parts.push(colored(tooth, PALETTE.copper));
  }
  return merge(parts);
}

const MODELS: Record<string, () => BufferGeometry> = {
  hq,
  lumberjack,
  miner,
  furnace,
  workshop,
  belt: beltStraight,
};

/** Erzeugt das Modell zu einem Namen; unbekannte Namen ergeben einen einfachen Block. */
export function buildingModel(name: string, w: number, h: number): BufferGeometry {
  const make = MODELS[name];
  return make ? make() : merge([box(w - 0.15, 0.8, h - 0.15, 0, 0, 0, PALETTE.cream)]);
}
