import {
  BoxGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
  TorusGeometry,
  type BufferGeometry,
} from 'three';
import { ITEMS, type ItemShape } from '../data/items';
import { PALETTE } from '../data/palette';
import { colored, merge } from './geometry';

/**
 * Kleine Item-Formen für Bänder und Symbole. Unterkante auf y = 0, etwa 0,3 Felder groß.
 */
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

const SHAPES: Record<ItemShape, (c: number) => BufferGeometry[]> = {
  log: (c) => [
    colored(new CylinderGeometry(0.08, 0.08, 0.3, 6).rotateZ(Math.PI / 2).translate(0, 0.08, 0), c),
    colored(
      new CylinderGeometry(0.06, 0.06, 0.31, 6).rotateZ(Math.PI / 2).translate(0, 0.08, 0),
      PALETTE.wood,
    ),
  ],
  chunk: (c) => [
    colored(new DodecahedronGeometry(0.12, 0).scale(1, 0.75, 1).translate(0, 0.09, 0), c),
  ],
  ore: (c) => [
    colored(new IcosahedronGeometry(0.12, 0).translate(0, 0.11, 0), PALETTE.rockDark),
    colored(new IcosahedronGeometry(0.07, 0).translate(0.06, 0.15, 0.04), c),
    colored(new IcosahedronGeometry(0.06, 0).translate(-0.06, 0.08, -0.05), c),
  ],
  ingot: (c) => [box(0.26, 0.09, 0.13, 0, 0, 0, c), box(0.2, 0.03, 0.08, 0, 0.09, 0, c)],
  brick: (c) => [box(0.26, 0.11, 0.14, 0, 0, 0, c)],
  charcoal: (c) => [colored(new DodecahedronGeometry(0.1, 0).translate(0, 0.08, 0), c)],
  plank: (c) => [
    box(0.32, 0.04, 0.12, 0, 0, 0, c),
    box(0.3, 0.04, 0.12, 0.01, 0.04, 0.01, PALETTE.wood),
  ],
  wire: (c) => [
    colored(new TorusGeometry(0.09, 0.035, 4, 8).rotateX(Math.PI / 2).translate(0, 0.04, 0), c),
  ],
  sheet: (c) => [box(0.28, 0.03, 0.22, 0, 0, 0, c), box(0.26, 0.03, 0.2, 0, 0.03, 0, c)],
  frame: (c) => [
    box(0.26, 0.05, 0.05, 0, 0, 0.11, c),
    box(0.26, 0.05, 0.05, 0, 0, -0.11, c),
    box(0.05, 0.05, 0.26, 0.11, 0, 0, c),
    box(0.05, 0.05, 0.26, -0.11, 0, 0, c),
    box(0.06, 0.06, 0.06, 0, 0, 0, PALETTE.itemBrick),
  ],
  coil: (c) => [
    colored(new CylinderGeometry(0.1, 0.1, 0.14, 8).translate(0, 0.07, 0), c),
    colored(new CylinderGeometry(0.12, 0.12, 0.03, 8).translate(0, 0.015, 0), PALETTE.woodDark),
    colored(new CylinderGeometry(0.12, 0.12, 0.03, 8).translate(0, 0.14, 0), PALETTE.woodDark),
  ],
  circuit: (c) => [
    box(0.26, 0.04, 0.2, 0, 0, 0, c),
    box(0.1, 0.04, 0.08, 0.04, 0.04, 0, PALETTE.itemCharcoal),
  ],
  motor: (c) => [
    colored(
      new CylinderGeometry(0.09, 0.09, 0.22, 8).rotateZ(Math.PI / 2).translate(0, 0.12, 0),
      c,
    ),
    box(0.18, 0.04, 0.16, 0, 0, 0, PALETTE.itemFrame),
    colored(
      new CylinderGeometry(0.025, 0.025, 0.08, 6).rotateZ(Math.PI / 2).translate(0.14, 0.12, 0),
      PALETTE.copper,
    ),
  ],
  control: (c) => [
    box(0.22, 0.16, 0.18, 0, 0, 0, c),
    box(0.06, 0.04, 0.02, 0.04, 0.09, 0.09, PALETTE.windowLight),
  ],
  sand: (c) => [
    colored(new CylinderGeometry(0.04, 0.15, 0.12, 7).translate(0, 0.06, 0), c),
    colored(new CylinderGeometry(0.02, 0.06, 0.05, 6).translate(0.03, 0.14, 0.02), c),
  ],
  pane: (c) => [
    box(0.26, 0.03, 0.2, 0, 0, 0, c),
    box(0.26, 0.03, 0.2, 0.01, 0.035, 0.01, PALETTE.blade),
    box(0.24, 0.03, 0.18, 0, 0.07, 0, c),
  ],
  beam: (c) => [
    box(0.3, 0.03, 0.14, 0, 0, 0, c),
    box(0.3, 0.1, 0.03, 0, 0.03, 0, c),
    box(0.3, 0.03, 0.14, 0, 0.13, 0, c),
  ],
  gear: (c) => [
    colored(new CylinderGeometry(0.11, 0.11, 0.06, 10).translate(0, 0.03, 0), c),
    ...[0, 1, 2, 3, 4, 5].map((k) => {
      const a = (k / 6) * Math.PI * 2;
      return box(0.06, 0.06, 0.06, Math.cos(a) * 0.13, 0, Math.sin(a) * 0.13, c);
    }),
    colored(new CylinderGeometry(0.035, 0.035, 0.07, 6).translate(0, 0.03, 0), PALETTE.metalDark),
  ],
  // Eisenplatte: dicke Platte mit vier Nieten
  plate: (c) => [
    box(0.26, 0.05, 0.22, 0, 0, 0, c),
    ...[
      [-0.09, -0.07],
      [0.09, -0.07],
      [0.09, 0.07],
      [-0.09, 0.07],
    ].map(([x, z]) => box(0.035, 0.02, 0.035, x, 0.05, z, PALETTE.metalDark)),
  ],
  // Linse: flache Scheibe in einer Messingfassung
  lens: (c) => [
    colored(new CylinderGeometry(0.12, 0.12, 0.04, 12).translate(0, 0.02, 0), PALETTE.gold),
    colored(new CylinderGeometry(0.095, 0.095, 0.06, 12).scale(1, 1, 1).translate(0, 0.03, 0), c),
    colored(new CylinderGeometry(0.06, 0.06, 0.03, 10).translate(0, 0.065, 0), PALETTE.blade),
  ],
  // Uhrwerk: goldene Zahnräder auf einer Grundplatte
  clockwork: (c) => [
    box(0.26, 0.03, 0.22, 0, 0, 0, PALETTE.itemIronPlate),
    colored(new CylinderGeometry(0.08, 0.08, 0.04, 10).translate(-0.04, 0.05, -0.02), c),
    colored(new CylinderGeometry(0.055, 0.055, 0.04, 8).translate(0.08, 0.07, 0.05), c),
    ...[0, 1, 2, 3, 4, 5, 6, 7].map((k) => {
      const a = (k / 8) * Math.PI * 2;
      return box(0.03, 0.04, 0.03, -0.04 + Math.cos(a) * 0.09, 0.03, -0.02 + Math.sin(a) * 0.09, c);
    }),
    colored(
      new CylinderGeometry(0.02, 0.02, 0.1, 5).translate(-0.04, 0.06, -0.02),
      PALETTE.metalDark,
    ),
  ],
  // Stahlträger: zwei Doppel-T-Träger mit Querstreben
  girder: (c) => [
    box(0.32, 0.03, 0.06, 0, 0, -0.08, c),
    box(0.32, 0.08, 0.02, 0, 0.03, -0.08, c),
    box(0.32, 0.03, 0.06, 0, 0.11, -0.08, c),
    box(0.32, 0.03, 0.06, 0, 0, 0.08, c),
    box(0.32, 0.08, 0.02, 0, 0.03, 0.08, c),
    box(0.32, 0.03, 0.06, 0, 0.11, 0.08, c),
    box(0.04, 0.03, 0.2, -0.1, 0.14, 0, PALETTE.itemSteel),
    box(0.04, 0.03, 0.2, 0.1, 0.14, 0, PALETTE.itemSteel),
  ],
  // Messinstrument: Messinggehäuse mit Glasfenster und Zeiger
  instrument: (c) => [
    box(0.22, 0.03, 0.18, 0, 0, 0, PALETTE.woodDark),
    colored(new CylinderGeometry(0.09, 0.1, 0.12, 12).translate(0, 0.09, 0), c),
    colored(new CylinderGeometry(0.075, 0.075, 0.02, 12).translate(0, 0.155, 0), PALETTE.itemLens),
    box(0.012, 0.012, 0.06, 0, 0.165, 0.015, PALETTE.clockHand),
  ],
};

let cache: BufferGeometry[] | null = null;
/** Geometrie je Item (Index = Item-ID), einmal erzeugt und geteilt. */
export function itemGeometries(): BufferGeometry[] {
  cache ??= ITEMS.map((item) => merge(SHAPES[item.shape](PALETTE[item.color])));
  return cache;
}
