import {
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
  OctahedronGeometry,
  type BufferGeometry,
} from 'three';
import { PALETTE } from '../data/palette';
import { colored, merge } from './geometry';

/**
 * Low-Poly-Modelle aus Grundkörpern. Jedes Modell ist eine einzige verschmolzene Geometrie.
 * Ein Feld ist 1 × 1 Einheit groß.
 */

export function pineTree(): BufferGeometry {
  return merge([
    colored(new CylinderGeometry(0.07, 0.1, 0.4, 5).translate(0, 0.2, 0), PALETTE.trunk),
    colored(new ConeGeometry(0.42, 0.7, 7).translate(0, 0.65, 0), PALETTE.leafDark),
    colored(new ConeGeometry(0.33, 0.6, 7).translate(0, 1.0, 0), PALETTE.leaf),
    colored(new ConeGeometry(0.22, 0.45, 7).translate(0, 1.32, 0), PALETTE.leafLight),
  ]);
}

/** Vereinfachte Kiefer für große Entfernung. */
export function pineTreeLow(): BufferGeometry {
  return merge([colored(new ConeGeometry(0.4, 1.4, 5).translate(0, 0.85, 0), PALETTE.leaf)]);
}

/** Vereinfachter Laubbaum für große Entfernung. */
export function roundTreeLow(): BufferGeometry {
  return merge([colored(new OctahedronGeometry(0.45, 0).translate(0, 0.85, 0), PALETTE.leaf)]);
}

export function roundTree(): BufferGeometry {
  return merge([
    colored(new CylinderGeometry(0.07, 0.11, 0.55, 5).translate(0, 0.27, 0), PALETTE.trunk),
    colored(new IcosahedronGeometry(0.42, 0).translate(0, 0.85, 0), PALETTE.leaf),
    colored(new IcosahedronGeometry(0.28, 0).translate(0.16, 1.12, 0.06), PALETTE.leafLight),
  ]);
}

/** Heller Felsbrocken; die eigentliche Farbe kommt pro Instanz (instanceColor). */
export function boulder(): BufferGeometry {
  return merge([
    colored(new DodecahedronGeometry(0.3, 0).scale(1, 0.7, 1).translate(0, 0.12, 0), 0xffffff),
  ]);
}

/** Blüte; Farbe pro Instanz. */
export function flower(): BufferGeometry {
  return merge([
    colored(new OctahedronGeometry(0.07, 0).translate(0, 0.08, 0), 0xffffff),
    colored(new OctahedronGeometry(0.055, 0).translate(0.1, 0.06, 0.05), 0xffffff),
  ]);
}

export function grassTuft(): BufferGeometry {
  return merge([
    colored(new ConeGeometry(0.04, 0.22, 3).translate(0, 0.11, 0), PALETTE.meadowDark),
    colored(
      new ConeGeometry(0.035, 0.18, 3).rotateZ(0.35).translate(0.05, 0.08, 0.02),
      PALETTE.leafLight,
    ),
    colored(
      new ConeGeometry(0.035, 0.17, 3).rotateX(-0.35).translate(-0.03, 0.08, 0.05),
      PALETTE.leaf,
    ),
  ]);
}

/** Baumstumpf nach dem Fällen. */
export function treeStump(): BufferGeometry {
  return merge([
    colored(new CylinderGeometry(0.11, 0.13, 0.16, 6).translate(0, 0.08, 0), PALETTE.trunk),
    colored(new CylinderGeometry(0.1, 0.1, 0.02, 6).translate(0, 0.17, 0), PALETTE.wood),
  ]);
}
