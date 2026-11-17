import { BoxGeometry, type BufferGeometry } from 'three';
import { PALETTE } from '../data/palette';
import { chevron, colored, merge } from './geometry';

/**
 * Bandmodelle für ein Feld. Ursprung = Feldmitte, Ausgang immer nach Norden (−z).
 * Das Band steht auf einem Holzbock etwa einen Meter über dem Boden (Arbeiter sind ~0,46 hoch);
 * die Lauffläche liegt auf Höhe `BELT_SURFACE`.
 */
/** Höhe des Bandkörpers über dem Boden (Unterkante der Lauffläche). */
export const BELT_LIFT = 0.16;
export const BELT_SURFACE = BELT_LIFT + 0.12;
const W = 0.6; // Breite der Lauffläche (schlank, damit Bänder wenig verdecken)
const H = W / 2;
/** Holzrahmen: schmale Leisten an beiden Seiten der Lauffläche. */
const RAIL = 0.05;
const RAIL_H = 0.15;
const RAIL_X = H + RAIL / 2;
const RAIL_Y = BELT_LIFT;
/** Bock: zwei Beine unter den Leisten und eine Querstrebe. */
const LEG = 0.05;
const LEG_X = RAIL_X;

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

/** Holzbock unter der Feldmitte (Beine und Querstrebe in Rahmenfarbe). */
function trestle(color: number, z = 0): BufferGeometry[] {
  return [
    box(LEG, BELT_LIFT + 0.02, LEG, -LEG_X, 0, z, color),
    box(LEG, BELT_LIFT + 0.02, LEG, LEG_X, 0, z, color),
    box(2 * LEG_X, 0.035, 0.035, 0, BELT_LIFT * 0.4, z, color),
  ];
}

function arrow(z: number, color: number): BufferGeometry {
  // dezenter, flacher Winkel auf der Lauffläche (kaum heller als das Band), zeigt nach −z
  return chevron(0.22, 0.1, 0.03, 0.004, BELT_SURFACE, color).translate(0, 0, z);
}

/**
 * Deutliche Richtungsmarke für den Bandbau (Vorschau und vorhandene Bänder, solange das
 * Band-Werkzeug aktiv ist): zwei kräftige helle Winkel hintereinander, Spitze nach Norden.
 */
export function beltDirectionMark(): BufferGeometry {
  return merge([
    chevron(0.4, 0.18, 0.08, 0.02, BELT_SURFACE + 0.005, PALETTE.beltBuildArrow).translate(
      0,
      0,
      0.16,
    ),
    chevron(0.4, 0.18, 0.08, 0.02, BELT_SURFACE + 0.005, PALETTE.beltBuildArrow).translate(
      0,
      0,
      -0.12,
    ),
  ]);
}

export function beltStraight(tier = 1): BufferGeometry {
  const c = TIER_COLORS[tier - 1];
  return merge([
    box(W, 0.1, 1, 0, BELT_LIFT + 0.02, 0, PALETTE.beltSurface),
    box(RAIL, RAIL_H, 1, -RAIL_X, RAIL_Y, 0, c.frame),
    box(RAIL, RAIL_H, 1, RAIL_X, RAIL_Y, 0, c.frame),
    ...trestle(c.frame),
    arrow(0, c.arrow),
  ]);
}

/** Kurve: `left` = Item kommt von Westen (fährt nach Osten) und biegt nach Norden ab; sonst von Osten. */
export function beltCurve(left: boolean, tier = 1): BufferGeometry {
  const c = TIER_COLORS[tier - 1];
  const s = left ? 1 : -1; // Spiegelung über die Lage der Teile, nicht über die Geometrie
  return merge([
    // Querband vom Eingangsrand bis über die Mitte
    box(0.5 + H, 0.1, W, s * (-0.5 + (0.5 + H) / 2), BELT_LIFT + 0.02, 0, PALETTE.beltSurface),
    // kurzes Stück zum Nordrand
    box(W, 0.1, 0.5 - H, 0, BELT_LIFT + 0.02, -0.5 + (0.5 - H) / 2, PALETTE.beltSurface),
    // Außenränder: Süden (vom Eingangsrand bis zur Ecke) und gegenüber dem Eingang (Ecke bis Nordrand)
    box(
      0.5 + RAIL_X + RAIL / 2,
      RAIL_H,
      RAIL,
      s * (-0.5 + (0.5 + RAIL_X + RAIL / 2) / 2),
      RAIL_Y,
      RAIL_X,
      c.frame,
    ),
    box(
      RAIL,
      RAIL_H,
      0.5 + RAIL_X + RAIL / 2,
      s * RAIL_X,
      RAIL_Y,
      -0.5 + (0.5 + RAIL_X + RAIL / 2) / 2,
      c.frame,
    ),
    // Eckpfosten innen
    box(RAIL, RAIL_H, RAIL, s * -RAIL_X, RAIL_Y, -RAIL_X, c.frame),
    // Bock unter der Kurvenmitte, quer zur Diagonale
    box(LEG, BELT_LIFT + 0.02, LEG, s * -LEG_X, 0, -LEG_X, c.frame),
    box(LEG, BELT_LIFT + 0.02, LEG, s * LEG_X, 0, LEG_X, c.frame),
    arrow(-0.18, c.arrow),
  ]);
}
