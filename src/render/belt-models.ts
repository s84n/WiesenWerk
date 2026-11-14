import { BoxGeometry, ConeGeometry, type BufferGeometry } from 'three';
import { PALETTE } from '../data/palette';
import { colored, merge } from './geometry';

/**
 * Bandmodelle für ein Feld. Ursprung = Feldmitte, Ausgang immer nach Norden (−z).
 * Die Lauffläche liegt auf Höhe `BELT_SURFACE`.
 */
export const BELT_SURFACE = 0.12;
const W = 0.74; // Breite der Lauffläche
const H = W / 2;

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

function arrow(z: number, rotY = 0): BufferGeometry {
  // flacher Pfeil auf der Lauffläche, zeigt nach −z
  const g = new ConeGeometry(0.14, 0.22, 3)
    .rotateX(-Math.PI / 2)
    .scale(1, 0.15, 1)
    .rotateY(rotY);
  return colored(g.translate(0, BELT_SURFACE + 0.01, z), PALETTE.beltArrow);
}

export function beltStraight(): BufferGeometry {
  return merge([
    box(W, 0.1, 1, 0, 0.02, 0, PALETTE.beltSurface),
    box(0.1, 0.16, 1, -0.42, 0, 0, PALETTE.beltFrame),
    box(0.1, 0.16, 1, 0.42, 0, 0, PALETTE.beltFrame),
    arrow(0),
  ]);
}

/** Kurve: `left` = Item kommt von Westen (fährt nach Osten) und biegt nach Norden ab; sonst von Osten. */
export function beltCurve(left: boolean): BufferGeometry {
  const s = left ? 1 : -1; // Spiegelung über die Lage der Teile, nicht über die Geometrie
  return merge([
    // Querband vom Eingangsrand bis über die Mitte
    box(0.5 + H, 0.1, W, s * (-0.5 + (0.5 + H) / 2), 0.02, 0, PALETTE.beltSurface),
    // kurzes Stück zum Nordrand
    box(W, 0.1, 0.5 - H, 0, 0.02, -0.5 + (0.5 - H) / 2, PALETTE.beltSurface),
    // Außenränder (Süden und gegenüber dem Eingang)
    box(1, 0.16, 0.1, 0, 0, 0.42, PALETTE.beltFrame),
    box(0.1, 0.16, 1, s * 0.42, 0, 0, PALETTE.beltFrame),
    // Eckpfosten innen
    box(0.1, 0.16, 0.1, s * -0.42, 0, -0.42, PALETTE.beltFrame),
    arrow(-0.18),
  ]);
}
