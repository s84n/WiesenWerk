import { BoxGeometry, type BufferGeometry } from 'three';
import { PALETTE } from '../data/palette';
import { chevron, colored, merge } from './geometry';

/**
 * Bandmodelle für ein Feld. Ursprung = Feldmitte, Ausgang immer nach Norden (−z).
 * Die Lauffläche liegt auf Höhe `BELT_SURFACE`.
 */
export const BELT_SURFACE = 0.12;
const W = 0.84; // Breite der Lauffläche
const H = W / 2;
/** Holzrahmen: schmale Leisten am Rand (außen bündig mit ±0,47 wie früher, nur halb so breit). */
const RAIL = 0.05;
const RAIL_H = 0.15;
const RAIL_X = 0.47 - RAIL / 2;

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

/** Farben je Bandstufe (1 bis 3): Rahmen und Pfeil. */
const TIER_COLORS: readonly { frame: number; arrow: number }[] = [
  { frame: PALETTE.beltFrame, arrow: PALETTE.beltArrow },
  { frame: PALETTE.beltFrameMk2, arrow: PALETTE.beltArrowMk2 },
  { frame: PALETTE.beltFrameMk3, arrow: PALETTE.beltArrowMk3 },
];

function arrow(z: number, color: number): BufferGeometry {
  // dezenter, flacher Winkel auf der Lauffläche (kaum heller als das Band), zeigt nach −z
  return chevron(0.26, 0.11, 0.035, 0.004, BELT_SURFACE, color).translate(0, 0, z);
}

export function beltStraight(tier = 1): BufferGeometry {
  const c = TIER_COLORS[tier - 1];
  return merge([
    box(W, 0.1, 1, 0, 0.02, 0, PALETTE.beltSurface),
    box(RAIL, RAIL_H, 1, -RAIL_X, 0, 0, c.frame),
    box(RAIL, RAIL_H, 1, RAIL_X, 0, 0, c.frame),
    arrow(0, c.arrow),
  ]);
}

/** Kurve: `left` = Item kommt von Westen (fährt nach Osten) und biegt nach Norden ab; sonst von Osten. */
export function beltCurve(left: boolean, tier = 1): BufferGeometry {
  const c = TIER_COLORS[tier - 1];
  const s = left ? 1 : -1; // Spiegelung über die Lage der Teile, nicht über die Geometrie
  return merge([
    // Querband vom Eingangsrand bis über die Mitte
    box(0.5 + H, 0.1, W, s * (-0.5 + (0.5 + H) / 2), 0.02, 0, PALETTE.beltSurface),
    // kurzes Stück zum Nordrand
    box(W, 0.1, 0.5 - H, 0, 0.02, -0.5 + (0.5 - H) / 2, PALETTE.beltSurface),
    // Außenränder (Süden und gegenüber dem Eingang)
    box(1, RAIL_H, RAIL, 0, 0, RAIL_X, c.frame),
    box(RAIL, RAIL_H, 1, s * RAIL_X, 0, 0, c.frame),
    // Eckpfosten innen
    box(RAIL, RAIL_H, RAIL, s * -RAIL_X, 0, -RAIL_X, c.frame),
    arrow(-0.18, c.arrow),
  ]);
}
