import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  PlaneGeometry,
  ExtrudeGeometry,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  type BufferGeometry,
} from 'three';
import { PALETTE } from '../data/palette';
import { BELT_LIFT, beltStraight } from './belt-models';
import { colored, merge } from './geometry';
import {
  beehive,
  coverPreview,
  flowerMeadow,
  greenhouse,
  orchard,
  vegetableBed,
} from './garden-models';
import { bandstand, clockTowerFull, clockTowerSite, fountain } from './landmark-models';

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

/**
 * Kleine Hängelampe an einer Wand, die nach Süden (+z) zeigt: Arm aus der Wand bei (x, y, wallZ),
 * darunter ein Glas in Fensterlicht-Farbe (leuchtet nachts über den Shader, keine echte Lichtquelle).
 */
function wallLamp(x: number, y: number, wallZ: number): BufferGeometry[] {
  return [
    box(0.04, 0.04, 0.2, x, y, wallZ + 0.1, PALETTE.woodDark),
    box(0.015, 0.08, 0.015, x, y - 0.08, wallZ + 0.18, PALETTE.metalDark),
    box(0.1, 0.03, 0.1, x, y - 0.11, wallZ + 0.18, PALETTE.metalDark),
    box(0.11, 0.13, 0.11, x, y - 0.24, wallZ + 0.18, PALETTE.windowLight),
  ];
}

/** Hängelampe unter einem Dach oder Balken bei (x, y = Aufhängung, z). */
function hangingLamp(x: number, y: number, z: number): BufferGeometry[] {
  return [
    box(0.015, 0.16, 0.015, x, y - 0.16, z, PALETTE.metalDark),
    box(0.11, 0.03, 0.11, x, y - 0.19, z, PALETTE.metalDark),
    box(0.11, 0.13, 0.11, x, y - 0.32, z, PALETTE.windowLight),
  ];
}

function pyramidRoof(size: number, height: number, y: number, color: number): BufferGeometry {
  return colored(
    new ConeGeometry(size / Math.SQRT2, height, 4)
      .rotateY(Math.PI / 4)
      .translate(0, y + height / 2, 0),
    color,
  );
}

/**
 * Bruchsteinwand: Steinplatten in drei Grautönen knapp vor einer Wandfläche.
 * `axis` = Richtung der Fläche ('z': Fläche zeigt nach +z bzw. −z bei negativem `face`).
 * Die Muster sind fest (gleiches Aussehen bei jedem Laden).
 */
const STONE_TONES = [PALETTE.stoneWallLight, PALETTE.stoneWallDark, PALETTE.stoneWall];
function rubbleFace(
  axis: 'x' | 'z',
  face: number,
  from: number,
  to: number,
  y0: number,
  y1: number,
  center: number,
): BufferGeometry[] {
  const parts: BufferGeometry[] = [];
  const rows = Math.max(2, Math.round((y1 - y0) / 0.17));
  const rowH = (y1 - y0) / rows;
  for (let r = 0; r < rows; r++) {
    let u = from + (r % 2 ? 0.08 : 0);
    let k = r * 3;
    while (u < to - 0.06) {
      const w = Math.min(to - u, 0.18 + ((k * 37) % 5) * 0.035);
      const tone = STONE_TONES[(k * 7 + r) % 3];
      const h = rowH - 0.03;
      const cy = y0 + r * rowH + 0.015;
      const mid = u + w / 2;
      // Flache Platte knapp vor der Wand (2 Dreiecke statt 12 für einen Quader)
      const plate = new PlaneGeometry(w - 0.025, h).translate(0, h / 2, 0);
      if (axis === 'z') {
        if (face < 0) plate.rotateY(Math.PI);
        plate.translate(mid + center, cy, face + Math.sign(face) * 0.012);
      } else {
        plate.rotateY((Math.sign(face) * Math.PI) / 2);
        plate.translate(face + Math.sign(face) * 0.012, cy, mid + center);
      }
      parts.push(colored(plate, tone));
      u += w;
      k++;
    }
  }
  return parts;
}

function hq(): BufferGeometry {
  const parts = [
    box(2.74, 0.18, 2.74, 0, 0, 0, PALETTE.stone),
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

/** Holzfäller: Blockhütte aus runden Stämmen mit Moosdach, Holzstapel und Hackklotz. */
function lumberjack(): BufferGeometry {
  const cx = -0.3;
  const cz = -0.3;
  const w = 1.1;
  const d = 0.95;
  const parts = [
    box(1.72, 0.1, 1.72, 0, 0, 0, PALETTE.soil),
    // Kern der Hütte (hinter den Stämmen)
    box(w - 0.1, 0.8, d - 0.1, cx, 0.1, cz, PALETTE.logDark),
    gableRoof(1.3, 1.35, 0.55, cx, 0.9, cz, PALETTE.mossRoof),
    box(1.37, 0.05, 0.07, cx, 1.42, cz, PALETTE.mossRoofDark),
  ];
  // Stammlagen, abwechselnd hell und dunkel, an den Ecken überstehend
  for (let k = 0; k < 4; k++) {
    const y = 0.19 + k * 0.19;
    const tone = k % 2 ? PALETTE.logDark : PALETTE.logLight;
    const along = (len: number) => new CylinderGeometry(0.1, 0.1, len, 5);
    for (const side of [-1, 1]) {
      parts.push(
        colored(
          along(w + 0.16)
            .rotateZ(Math.PI / 2)
            .translate(cx, y, cz + (side * d) / 2),
          tone,
        ),
      );
      parts.push(
        colored(
          along(d + 0.16)
            .rotateX(Math.PI / 2)
            .translate(cx + (side * w) / 2, y + 0.09, cz),
          k % 2 ? PALETTE.logLight : PALETTE.logDark,
        ),
      );
    }
  }
  parts.push(
    // Tür und Lampe vorne
    box(0.3, 0.52, 0.05, cx, 0.1, cz + d / 2 + 0.07, PALETTE.woodDark),
    ...wallLamp(cx + 0.35, 0.78, cz + d / 2 + 0.08),
    // Halter des Sägeblatts (das Blatt selbst dreht sich, siehe SPINNERS)
    box(0.12, 0.3, 0.12, 0.55, 0.1, -0.55, PALETTE.woodDark),
    // Hackklotz mit Axt
    colored(new CylinderGeometry(0.14, 0.16, 0.22, 7).translate(-0.05, 0.21, 0.62), PALETTE.trunk),
    colored(
      new BoxGeometry(0.03, 0.34, 0.03).rotateZ(0.5).translate(-0.02, 0.43, 0.62),
      PALETTE.woodDark,
    ),
    colored(
      new BoxGeometry(0.1, 0.07, 0.03).rotateZ(0.5).translate(-0.1, 0.55, 0.62),
      PALETTE.metal,
    ),
  );
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

/**
 * Bergwerk: Förderturm und Hütte auf einem kleinen Holzfundament. Ringsum bleibt der Boden des
 * Vorkommens sichtbar, so erkennt man jedes Bergwerk einzeln.
 */
function miner(): BufferGeometry {
  const y0 = 0.08;
  const parts = [
    // Holzfundament unter Turm und Hütte
    box(1.12, y0, 0.95, 0, 0, -0.38, PALETTE.woodDark),
    box(1.04, 0.02, 0.87, 0, y0, -0.38, PALETTE.wood),
    // Förderturm
    box(0.12, 1.7, 0.12, -0.45, y0, -0.35, PALETTE.woodDark),
    box(0.12, 1.7, 0.12, 0.45, y0, -0.35, PALETTE.woodDark),
    box(1.05, 0.12, 0.16, 0, y0 + 1.65, -0.35, PALETTE.wood),
    box(0.7, 0.55, 0.7, 0, y0, -0.35, PALETTE.logDark),
    gableRoof(0.85, 0.85, 0.35, 0, y0 + 0.55, -0.35, PALETTE.mossRoof),
    ...wallLamp(0.45, y0 + 1.0, -0.29),
    // Schienen auf Schwellen aus dem Stollen (die Lore fährt darauf, siehe SLIDERS)
    box(0.04, 0.03, 1.05, 0.23, 0.02, 0.3, PALETTE.metalDark),
    box(0.04, 0.03, 1.05, 0.47, 0.02, 0.3, PALETTE.metalDark),
  ];
  for (let k = 0; k < 5; k++)
    parts.push(box(0.36, 0.02, 0.07, 0.35, 0, 0.0 + k * 0.2, PALETTE.woodDark));
  // kleine Abraumhalde vorne links
  for (const [x, z, r] of [
    [-0.45, 0.45, 0.16],
    [-0.25, 0.6, 0.12],
    [-0.55, 0.65, 0.1],
  ])
    parts.push(
      colored(
        new SphereGeometry(r, 5, 3).scale(1, 0.7, 1).translate(x, r * 0.5, z),
        PALETTE.stoneWallDark,
      ),
    );
  return merge(parts);
}

function furnace(): BufferGeometry {
  return merge([
    box(1.72, 0.12, 1.72, 0, 0, 0, PALETTE.stone),
    box(1.45, 0.9, 1.4, -0.1, 0.12, 0, PALETTE.brick),
    // flaches Metalldach mit Rand
    box(1.55, 0.06, 1.5, -0.1, 1.02, 0, PALETTE.metalDark),
    box(1.1, 0.3, 1.05, -0.1, 1.08, 0, PALETTE.metalRoof),
    colored(new CylinderGeometry(0.17, 0.22, 1.5, 6).translate(0.45, 1.15, -0.4), PALETTE.brick),
    colored(
      new CylinderGeometry(0.21, 0.21, 0.1, 6).translate(0.45, 1.95, -0.4),
      PALETTE.metalDark,
    ),
    // glühende Öffnung vorne
    box(0.5, 0.35, 0.05, -0.1, 0.3, 0.71, PALETTE.glow),
    box(0.7, 0.08, 0.12, -0.1, 0.65, 0.72, PALETTE.stone),
  ]);
}

/** Werkstatt: Bruchsteinhaus mit Schieferdach, großem Holztor, Amboss und Werkbank davor. */
function workshop(): BufferGeometry {
  const wz = -0.1; // Mitte des Hauses (z)
  const front = wz + 0.625;
  const parts = [
    box(1.72, 0.1, 1.72, 0, 0, 0, PALETTE.soil),
    // Sockel und Wandkern
    box(1.66, 0.14, 1.31, 0, 0.1, wz, PALETTE.stoneWallDark),
    box(1.6, 0.85, 1.25, 0, 0.1, wz, PALETTE.stoneWall),
    // Bruchsteine an den sichtbaren Seiten (Süden, Westen, Osten)
    ...rubbleFace('z', front + 0.005, -0.8, 0.8, 0.24, 0.95, 0),
    ...rubbleFace('x', -0.805, -0.625, 0.625, 0.24, 0.95, wz),
    ...rubbleFace('x', 0.805, -0.625, 0.625, 0.24, 0.95, wz),
    // Eckquader
    box(0.12, 0.85, 0.12, -0.8, 0.1, front - 0.04, PALETTE.stoneWallLight),
    box(0.12, 0.85, 0.12, 0.8, 0.1, front - 0.04, PALETTE.stoneWallLight),
    // Schieferdach mit Firstblech
    gableRoof(1.5, 1.8, 0.62, 0, 0.95, wz, PALETTE.slate),
    box(1.82, 0.05, 0.08, 0, 1.54, wz, PALETTE.slateDark),
    // großes Holztor mit Sturz
    box(0.62, 0.62, 0.05, -0.32, 0.1, front + 0.03, PALETTE.woodDark),
    box(0.04, 0.6, 0.06, -0.32, 0.11, front + 0.05, PALETTE.wood),
    box(0.74, 0.1, 0.07, -0.32, 0.72, front + 0.03, PALETTE.stoneWallLight),
    // Fenster mit Holzrahmen
    box(0.36, 0.34, 0.04, 0.42, 0.42, front + 0.02, PALETTE.woodDark),
    box(0.28, 0.26, 0.05, 0.42, 0.46, front + 0.02, PALETTE.windowLight),
    ...wallLamp(0.05, 0.82, front + 0.02),
    // Amboss auf einem Klotz
    colored(new CylinderGeometry(0.11, 0.13, 0.22, 7).translate(0.38, 0.21, 0.8), PALETTE.trunk),
    box(0.26, 0.08, 0.12, 0.38, 0.32, 0.8, PALETTE.anvil),
    box(0.12, 0.06, 0.08, 0.38, 0.4, 0.8, PALETTE.anvil),
    colored(
      new ConeGeometry(0.05, 0.14, 5).rotateZ(-Math.PI / 2).translate(0.56, 0.36, 0.8),
      PALETTE.anvil,
    ),
    // Werkbank links vorne
    box(0.36, 0.05, 0.2, -0.68, 0.36, 0.8, PALETTE.wood),
    box(0.04, 0.26, 0.04, -0.83, 0.1, 0.8, PALETTE.woodDark),
    box(0.04, 0.26, 0.04, -0.53, 0.1, 0.8, PALETTE.woodDark),
    box(0.1, 0.06, 0.08, -0.62, 0.41, 0.8, PALETTE.copper),
  ];
  return merge(parts);
}

function burner(): BufferGeometry {
  const parts = [
    box(1.72, 0.14, 1.72, 0, 0, 0, PALETTE.stone),
    box(1.3, 0.75, 1.15, -0.15, 0.14, 0.05, PALETTE.stone),
    box(1.1, 0.25, 0.95, -0.15, 0.89, 0.05, PALETTE.brick),
    box(1.16, 0.05, 1.01, -0.15, 1.14, 0.05, PALETTE.patina),
    // Feuerloch vorne
    box(0.5, 0.32, 0.05, -0.15, 0.3, 0.63, PALETTE.glow),
    box(0.66, 0.07, 0.1, -0.15, 0.62, 0.64, PALETTE.rockDark),
    // Schornstein mit Kupferdeckel
    colored(new CylinderGeometry(0.15, 0.19, 1.3, 6).translate(0.25, 1.79, -0.25), PALETTE.brick),
    colored(new CylinderGeometry(0.2, 0.2, 0.08, 6).translate(0.25, 2.47, -0.25), PALETTE.copper),
    colored(new ConeGeometry(0.22, 0.14, 6).translate(0.25, 2.6, -0.25), PALETTE.patina),
    // Kupferspule (Generator) an der Seite
    colored(
      new CylinderGeometry(0.18, 0.18, 0.4, 8).rotateZ(Math.PI / 2).translate(0.72, 0.42, 0.2),
      PALETTE.copper,
    ),
  ];
  // Holzscheite
  for (let k = 0; k < 3; k++) {
    const log = new CylinderGeometry(0.07, 0.07, 0.5, 6).rotateX(Math.PI / 2);
    parts.push(
      colored(
        log.translate(0.6 + (k % 2) * 0.14, 0.21 + (k === 2 ? 0.12 : 0), -0.55),
        PALETTE.trunk,
      ),
    );
  }
  return merge(parts);
}

/** Höhe, an der die Kabel am Mast hängen. */
export const POLE_CABLE_HEIGHT = 2.25;

function pole(): BufferGeometry {
  return merge([
    box(0.36, 0.08, 0.36, 0, 0, 0, PALETTE.stone),
    colored(
      new CylinderGeometry(0.06, 0.08, 2.35, 6).translate(0, 0.08 + 1.175, 0),
      PALETTE.woodDark,
    ),
    box(0.7, 0.07, 0.08, 0, 2.08, 0, PALETTE.wood),
    colored(new CylinderGeometry(0.04, 0.05, 0.12, 6).translate(-0.28, 2.21, 0), PALETTE.copper),
    colored(new CylinderGeometry(0.04, 0.05, 0.12, 6).translate(0.28, 2.21, 0), PALETTE.copper),
    colored(new CylinderGeometry(0.045, 0.045, 0.1, 6).translate(0, 2.47, 0), PALETTE.copper),
  ]);
}

// ---------------------------------------------------------------- ab Phase 6

/** Manufaktur: kleine Fabrik aus ockergelbem Klinker, dunkles Sheddach, blaue Fensterrahmen. */
function assembler(): BufferGeometry {
  const front = 0.1 + 1.1;
  const parts = [
    box(2.74, 0.14, 2.74, 0, 0, 0, PALETTE.stone),
    box(2.5, 1.05, 2.2, 0, 0.14, 0.1, PALETTE.ochre),
    // Klinkerbänder und Sockel
    box(2.54, 0.12, 2.24, 0, 0.14, 0.1, PALETTE.ochreDark),
    box(2.53, 0.04, 2.23, 0, 0.62, 0.1, PALETTE.ochreDark),
    box(2.53, 0.04, 2.23, 0, 1.0, 0.1, PALETTE.ochreDark),
    // Sheddach: drei Zacken mit Oberlichtern nach Norden (leuchten nachts)
    ...[0, 1, 2].flatMap((k) => {
      const south = 1.2 - k * 0.733;
      return [
        sawTooth(2.5, 0.733, 0.45, south, PALETTE.shedRoof),
        box(2.36, 0.26, 0.04, 0, 1.27, south - 0.733 + 0.025, PALETTE.windowLight),
      ];
    }),
    // Lüftungsschacht mit Lüfter (siehe SPINNERS)
    box(0.3, 0.5, 0.3, 0.9, 1.19, 0.75, PALETTE.metal),
    // Trichter für die beiden Eingänge (Norden)
    colored(new CylinderGeometry(0.3, 0.14, 0.45, 6).translate(-1, 1.0, -1.15), PALETTE.copper),
    colored(new CylinderGeometry(0.3, 0.14, 0.45, 6).translate(1, 1.0, -1.15), PALETTE.copper),
    box(0.16, 0.8, 0.16, -1, 0.14, -1.15, PALETTE.woodDark),
    box(0.16, 0.8, 0.16, 1, 0.14, -1.15, PALETTE.woodDark),
    // Tor (Süden) mit blauem Rahmen und Fenster
    box(0.82, 0.78, 0.04, 0, 0.14, front + 0.01, PALETTE.windowFrame),
    box(0.7, 0.7, 0.05, 0, 0.14, front + 0.02, PALETTE.woodDark),
    ...wallLamp(0, 0.98, front + 0.02),
  ];
  for (const x of [-0.85, 0.85]) {
    parts.push(box(0.5, 0.4, 0.04, x, 0.55, front + 0.01, PALETTE.windowFrame));
    parts.push(box(0.4, 0.3, 0.05, x, 0.6, front + 0.02, PALETTE.windowLight));
    parts.push(box(0.03, 0.3, 0.06, x, 0.6, front + 0.03, PALETTE.windowFrame));
  }
  return merge(parts);
}

/**
 * Tunnelband: steinernes Portal mit dunkler Öffnung und Bandrampe. Eingang: Rampe von Süden
 * hinab ins Portal im Norden. Ausgang: Portal im Süden, Rampe nach Norden hinauf.
 */
function tunnel(entrance: boolean): BufferGeometry {
  const dir = entrance ? -1 : 1; // Lage des Portals: Norden (−z) beim Eingang, Süden beim Ausgang
  // Rampe vom Bandbock (Bandhöhe am offenen Rand) hinab zur Portalöffnung
  const ramp = new BoxGeometry(0.6, 0.08, 0.8)
    .rotateX(dir * 0.36)
    .translate(0, BELT_LIFT - 0.02, -dir * 0.1);
  return merge([
    box(0.96, 0.06, 0.96, 0, 0, 0, PALETTE.rockDark),
    colored(ramp, PALETTE.beltSurface),
    box(0.05, 0.2, 0.7, -0.325, 0.06, -dir * 0.12, PALETTE.beltFrame),
    box(0.05, 0.2, 0.7, 0.325, 0.06, -dir * 0.12, PALETTE.beltFrame),
    // Portal
    box(0.96, 0.55, 0.26, 0, 0, dir * 0.36, PALETTE.stone),
    box(0.62, 0.36, 0.05, 0, 0.04, dir * 0.22, PALETTE.rockDark),
    box(1.0, 0.1, 0.32, 0, 0.55, dir * 0.36, PALETTE.roof),
  ]);
}

/** Ausgemusterte Lager-Varianten: kleine rote Scheune mit farbigem Band (Erkennung alter Stände). */
function storageVariant(accent: number, doors: number): BufferGeometry {
  const parts = barn(1.6, 0.85, 1.3, -0.1, PALETTE.barnRedDark, doors);
  parts.push(box(1.62, 0.1, 0.04, 0, 0.78, 0.56, accent));
  parts.push(box(0.26, 0.24, 0.26, 0.7, 0.1, -0.85, PALETTE.woodDark));
  return merge([box(1.72, 0.1, 1.72, 0, 0, 0, PALETTE.soil), ...parts]);
}

/**
 * Rote Scheune mit weißen Kanten und Scheunentoren mit weißem Kreuz (Süden).
 * `w`/`h`/`d` = Wandmaße, `cz` = Mitte (z), Dach in `roof`.
 */
function barn(
  w: number,
  h: number,
  d: number,
  cz: number,
  roof: number,
  doors: number,
): BufferGeometry[] {
  const front = cz + d / 2;
  const y0 = 0.1;
  const parts = [
    box(w, h, d, 0, y0, cz, PALETTE.barnRed),
    // weiße Eckbalken und Traufe
    ...[-1, 1].flatMap((sx) =>
      [-1, 1].map((sz) => box(0.07, h, 0.07, (sx * w) / 2, y0, cz + (sz * d) / 2, PALETTE.trim)),
    ),
    box(w + 0.04, 0.06, d + 0.04, 0, y0 + h - 0.06, cz, PALETTE.trim),
    gableRoof(d + 0.2, w + 0.2, h * 0.62, 0, y0 + h, cz, roof),
  ];
  const doorW = Math.min(0.62, (w - 0.3) / doors - 0.1);
  for (let k = 0; k < doors; k++) {
    const x = doors === 1 ? 0 : -w / 4 + (k * w) / 2;
    const dh = h * 0.72;
    parts.push(box(doorW + 0.08, dh + 0.06, 0.03, x, y0, front + 0.01, PALETTE.trim));
    parts.push(box(doorW, dh, 0.04, x, y0, front + 0.02, PALETTE.barnRedDark));
    const diag = Math.hypot(doorW, dh);
    const angle = Math.atan2(dh, doorW);
    for (const sgn of [-1, 1])
      parts.push(
        colored(
          new BoxGeometry(diag - 0.04, 0.045, 0.02)
            .rotateZ(sgn * angle)
            .translate(x, y0 + dh / 2, front + 0.045),
          PALETTE.trim,
        ),
      );
  }
  return parts;
}

/** Großlager: große rote Scheune mit Wellblechdach und zwei Toren. */
function storageLarge(): BufferGeometry {
  const parts = [
    box(2.74, 0.14, 2.74, 0, 0, 0, PALETTE.stone),
    ...barn(2.6, 1.3, 2.3, -0.05, PALETTE.tin, 2).map((g) => g.translate(0, 0.04, 0)),
    // Wellblech: Firstkappe und Rippen an der Giebelseite
    box(2.82, 0.06, 0.1, 0, 2.22, -0.05, PALETTE.tinDark),
    box(0.5, 0.3, 0.04, 0, 1.0, 1.12, PALETTE.windowLight),
    ...wallLamp(0, 1.32, 1.12),
  ];
  // Kistenstapel an der Seite
  for (let k = 0; k < 3; k++)
    parts.push(box(0.3, 0.28, 0.3, 1.3, 0.14 + k * 0.28, -1.1 + (k % 2) * 0.05, PALETTE.wood));
  return merge(parts);
}

/** Depot: offenes Vordach über einer Holzplattform mit Kisten und Handkarren. */
function depot(large: boolean): BufferGeometry {
  const s = large ? 1.5 : 1;
  const parts = [
    box(1.72 * s, 0.12, 1.72 * s, 0, 0, 0, PALETTE.woodDark),
    box(1.64 * s, 0.04, 1.64 * s, 0, 0.12, 0, PALETTE.wood),
  ];
  for (const [x, z] of [
    [-0.75, -0.75],
    [0.75, -0.75],
    [-0.75, 0.75],
    [0.75, 0.75],
  ])
    parts.push(box(0.1, 1.0, 0.1, x * s, 0.16, z * s, PALETTE.woodDark));
  // gestreifte Zeltplane: Dach aus Streifen in zwei Farben
  const stripes = 6;
  const len = 1.85 * s;
  for (let k = 0; k < stripes; k++) {
    const x = -len / 2 + (k + 0.5) * (len / stripes);
    parts.push(
      gableRoof(
        1.8 * s,
        len / stripes + 0.002,
        0.45,
        x,
        1.16,
        0,
        k % 2 ? PALETTE.tarpB : PALETTE.tarpA,
      ),
    );
  }
  // Kisten und Säcke
  parts.push(box(0.36, 0.3, 0.36, -0.35 * s, 0.16, -0.3 * s, PALETTE.wood));
  parts.push(box(0.3, 0.26, 0.3, -0.35 * s, 0.46, -0.3 * s, PALETTE.woodDark));
  parts.push(box(0.36, 0.3, 0.36, 0.25 * s, 0.16, -0.4 * s, PALETTE.wood));
  parts.push(
    colored(
      new SphereGeometry(0.17, 6, 4).scale(1, 0.75, 1).translate(0.4 * s, 0.28, 0.25 * s),
      PALETTE.cream,
    ),
  );
  // Handkarren
  parts.push(box(0.4, 0.14, 0.28, -0.3 * s, 0.3, 0.5 * s, PALETTE.wood));
  parts.push(
    colored(
      new CylinderGeometry(0.12, 0.12, 0.05, 8)
        .rotateZ(Math.PI / 2)
        .translate(-0.53 * s, 0.28, 0.5 * s),
      PALETTE.woodDark,
    ),
  );
  parts.push(
    colored(
      new CylinderGeometry(0.12, 0.12, 0.05, 8)
        .rotateZ(Math.PI / 2)
        .translate(-0.07 * s, 0.28, 0.5 * s),
      PALETTE.woodDark,
    ),
  );
  // Laterne unter dem Vordach
  parts.push(...hangingLamp(0.15 * s, 1.16, 0.1 * s));
  return merge(parts);
}

/**
 * Ausgabestelle: Lagerschuppen mit blauem Dach, aus dem eine Rutsche vorn links (am Ausgang)
 * Kisten aufs Band gibt.
 */
function dispenser(): BufferGeometry {
  const parts = [
    box(1.72, 0.12, 1.72, 0, 0, 0, PALETTE.woodDark),
    box(1.5, 0.9, 1.2, 0.1, 0.12, -0.25, PALETTE.cream),
    gableRoof(1.35, 1.65, 0.5, 0.1, 1.02, -0.25, PALETTE.dispenserRoof),
    // Tor zur Rutsche, darüber eine Lampe
    box(0.5, 0.55, 0.04, -0.5, 0.12, 0.36, PALETTE.woodDark),
    ...wallLamp(0.15, 0.8, 0.35),
    // Rutsche nach vorn (Süden) Richtung Ausgang
    colored(
      new BoxGeometry(0.46, 0.06, 0.75).rotateX(0.35).translate(-0.5, 0.32, 0.62),
      PALETTE.wood,
    ),
    box(0.04, 0.16, 0.75, -0.74, 0.26, 0.62, PALETTE.woodDark),
    box(0.04, 0.16, 0.75, -0.26, 0.26, 0.62, PALETTE.woodDark),
    // Kiste auf der Rutsche
    box(0.24, 0.2, 0.24, -0.5, 0.38, 0.55, PALETTE.wood),
    // Fässer und Säcke rechts vorn
    colored(new CylinderGeometry(0.16, 0.16, 0.38, 8).translate(0.55, 0.31, 0.6), PALETTE.woodDark),
    colored(
      new SphereGeometry(0.17, 6, 4).scale(1, 0.75, 1).translate(0.2, 0.26, 0.65),
      PALETTE.cream,
    ),
  ];
  return merge(parts);
}

/** Ein Zahn des Sheddachs: senkrechte Seite im Norden, Dachfläche fällt nach Süden ab. */
function sawTooth(width: number, depth: number, height: number, southZ: number, color: number) {
  const shape = new Shape([new Vector2(0, 0), new Vector2(depth, 0), new Vector2(depth, height)]);
  const g = new ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
  // Form-x zeigt nach Norden (−z), die Extrusion läuft entlang x
  g.rotateY(Math.PI / 2).translate(-width / 2, 1.19, southZ);
  return colored(g, color);
}

/** Lager: rote Scheune mit weißen Kanten, dunkelrotem Ziegeldach und Kisten davor. */
function storage(): BufferGeometry {
  const parts = [
    box(1.72, 0.1, 1.72, 0, 0, 0, PALETTE.soil),
    ...barn(1.5, 0.85, 1.3, -0.15, PALETTE.barnRedDark, 1),
    ...wallLamp(0.5, 0.78, 0.51),
  ];
  // Kisten vor der Scheune
  parts.push(box(0.32, 0.3, 0.32, -0.6, 0.1, 0.65, PALETTE.woodDark));
  parts.push(box(0.28, 0.26, 0.28, 0.4, 0.1, 0.68, PALETTE.wood));
  parts.push(box(0.24, 0.22, 0.24, 0.4, 0.36, 0.68, PALETTE.woodDark));
  return merge(parts);
}

function splitter(): BufferGeometry {
  return merge([
    box(0.86, 0.16, 0.86, 0, 0, 0, PALETTE.beltFrame),
    box(0.6, 0.25, 0.6, 0, 0.16, 0, PALETTE.metal),
    colored(new CylinderGeometry(0.2, 0.24, 0.2, 8).translate(0, 0.51, 0), PALETTE.copper),
    // drei kleine Pfeile nach Westen, Süden, Osten
    ...[Math.PI / 2, 0, -Math.PI / 2].map((r) =>
      colored(
        new ConeGeometry(0.12, 0.2, 3)
          .rotateX(Math.PI / 2)
          .scale(1, 0.4, 1)
          .translate(0, 0.43, 0.24)
          .rotateY(r),
        PALETTE.deviceArrow,
      ),
    ),
  ]);
}

function merger(): BufferGeometry {
  return merge([
    box(0.86, 0.16, 0.86, 0, 0, 0, PALETTE.beltFrame),
    colored(new CylinderGeometry(0.36, 0.22, 0.4, 8).translate(0, 0.36, 0), PALETTE.metal),
    colored(new CylinderGeometry(0.38, 0.38, 0.06, 8).translate(0, 0.58, 0), PALETTE.copper),
    colored(
      new ConeGeometry(0.12, 0.2, 3)
        .rotateX(Math.PI / 2)
        .scale(1, 0.4, 1)
        .translate(0, 0.2, 0.36),
      PALETTE.deviceArrow,
    ),
  ]);
}

function bridge(): BufferGeometry {
  // Unteres Band auf Bandhöhe, oberes Band hoch genug darüber, dass die Ware unten durchpasst
  const lo = BELT_LIFT;
  const hi = BELT_LIFT + 0.5;
  return merge([
    // unteres Band (Nord → Süd) auf kurzen Beinen
    box(0.6, 0.1, 1, 0, lo + 0.02, 0, PALETTE.beltSurface),
    box(0.05, 0.15, 1, -0.325, lo, 0, PALETTE.beltFrame),
    box(0.05, 0.15, 1, 0.325, lo, 0, PALETTE.beltFrame),
    box(0.05, lo + 0.02, 0.05, -0.325, 0, 0, PALETTE.beltFrame),
    box(0.05, lo + 0.02, 0.05, 0.325, 0, 0, PALETTE.beltFrame),
    // oberes Band (West → Ost) auf vier Stützen
    box(1, 0.08, 0.6, 0, hi + 0.04, 0, PALETTE.beltSurface),
    box(1, 0.12, 0.06, 0, hi, 0.34, PALETTE.beltFrame),
    box(1, 0.12, 0.06, 0, hi, -0.34, PALETTE.beltFrame),
    box(0.08, hi, 0.08, -0.44, 0, 0.42, PALETTE.woodDark),
    box(0.08, hi, 0.08, 0.44, 0, 0.42, PALETTE.woodDark),
    box(0.08, hi, 0.08, -0.44, 0, -0.42, PALETTE.woodDark),
    box(0.08, hi, 0.08, 0.44, 0, -0.42, PALETTE.woodDark),
  ]);
}

function windTurbine(): BufferGeometry {
  const parts = [
    box(1.2, 0.16, 1.2, 0, 0, 0, PALETTE.stone),
    colored(new CylinderGeometry(0.1, 0.2, 3.4, 8).translate(0, 0.16 + 1.7, 0), PALETTE.cream),
    // Patina-Ring am Fuß und Kupferhaube der Gondel
    colored(new CylinderGeometry(0.22, 0.22, 0.12, 8).translate(0, 0.22, 0), PALETTE.patina),
    box(0.3, 0.26, 0.55, 0, 3.5, 0, PALETTE.cream),
    box(0.32, 0.06, 0.57, 0, 3.76, 0, PALETTE.copper),
  ];
  return merge(parts);
}

// ---------------------------------------------------------------- Eisen, Stahl, neue Stromarten

/** Gießerei: dunkler Hochofen mit zwei Trichtern, glühendem Abstich vorne und hohem Schlot. */
function foundry(): BufferGeometry {
  return merge([
    box(2.74, 0.14, 2.74, 0, 0, 0, PALETTE.stone),
    box(2.3, 1.0, 2.0, -0.15, 0.14, 0.2, PALETTE.rockDark),
    box(2.1, 0.2, 1.8, -0.15, 1.14, 0.2, PALETTE.metalDark),
    // Hochofen-Turm
    colored(
      new CylinderGeometry(0.55, 0.7, 1.4, 8).translate(-0.15, 1.34 + 0.7, 0.1),
      PALETTE.brick,
    ),
    colored(new CylinderGeometry(0.6, 0.6, 0.12, 8).translate(-0.15, 2.8, 0.1), PALETTE.metalDark),
    // Schlot
    colored(
      new CylinderGeometry(0.16, 0.2, 2.0, 6).translate(0.95, 1.14 + 1.0, -0.6),
      PALETTE.metalDark,
    ),
    colored(new CylinderGeometry(0.21, 0.21, 0.1, 6).translate(0.95, 3.19, -0.6), PALETTE.roof),
    // Trichter für die beiden Eingänge (Norden)
    colored(new CylinderGeometry(0.3, 0.14, 0.45, 6).translate(-1, 1.0, -1.15), PALETTE.metal),
    colored(new CylinderGeometry(0.3, 0.14, 0.45, 6).translate(1, 1.0, -1.15), PALETTE.metal),
    box(0.16, 0.8, 0.16, -1, 0.14, -1.15, PALETTE.metalDark),
    box(0.16, 0.8, 0.16, 1, 0.14, -1.15, PALETTE.metalDark),
    // glühender Abstich vorne mit Rinne
    box(0.8, 0.4, 0.05, 0, 0.3, 1.21, PALETTE.glow),
    box(0.3, 0.06, 0.5, 0, 0.14, 1.4, PALETTE.glow),
    box(1.0, 0.1, 0.12, 0, 0.7, 1.22, PALETTE.stone),
    box(0.35, 0.3, 0.04, -0.85, 0.55, 1.21, PALETTE.windowLight),
  ]);
}

/** Wasserrad: Mühle mit Bruchstein-Unterbau, Holz-Obergeschoss und Strohdach; Rad vorne im Wasser. */
function waterWheelHouse(): BufferGeometry {
  const cx = -0.1;
  const cz = -0.3;
  const front = cz + 0.5;
  return merge([
    box(1.8, 0.12, 1.3, 0, 0, -0.25, PALETTE.stone),
    // Unterbau aus Bruchstein
    box(1.4, 0.42, 1.0, cx, 0.12, cz, PALETTE.stoneWall),
    ...rubbleFace('z', front + 0.005, -0.7, 0.7, 0.14, 0.52, cx),
    ...rubbleFace('x', cx - 0.705, -0.5, 0.5, 0.14, 0.52, cz),
    // Obergeschoss aus Holz mit Balken
    box(1.44, 0.46, 1.04, cx, 0.54, cz, PALETTE.wood),
    box(1.46, 0.05, 1.06, cx, 0.54, cz, PALETTE.woodDark),
    box(0.06, 0.46, 0.06, cx - 0.72, 0.54, front + 0.02, PALETTE.woodDark),
    box(0.06, 0.46, 0.06, cx + 0.72, 0.54, front + 0.02, PALETTE.woodDark),
    // Strohdach mit dunklerem First
    gableRoof(1.3, 1.7, 0.6, cx, 1.0, cz, PALETTE.thatch),
    box(1.72, 0.07, 0.1, cx, 1.56, cz, PALETTE.thatchDark),
    box(0.3, 0.26, 0.04, cx - 0.3, 0.66, front + 0.03, PALETTE.windowLight),
    // Achslager auf zwei Pfosten am Ufer
    box(0.14, 0.7, 0.14, -0.55, 0, 0.75, PALETTE.woodDark),
    box(0.14, 0.7, 0.14, 0.55, 0, 0.75, PALETTE.woodDark),
    colored(
      new CylinderGeometry(0.17, 0.17, 0.35, 8).rotateZ(Math.PI / 2).translate(0.82, 0.42, -0.1),
      PALETTE.copper,
    ),
    colored(
      new CylinderGeometry(0.19, 0.19, 0.06, 8).rotateZ(Math.PI / 2).translate(1.0, 0.42, -0.1),
      PALETTE.patina,
    ),
  ]);
}

/** Solarfeld: zwei schräg gestellte Paneele auf einem Gestell. */
function solarPanel(): BufferGeometry {
  const parts = [box(1.72, 0.06, 1.72, 0, 0, 0, PALETTE.soil)];
  for (const z of [-0.45, 0.45]) {
    parts.push(box(0.08, 0.35, 0.08, -0.75, 0.06, z + 0.2, PALETTE.metal));
    parts.push(box(0.08, 0.35, 0.08, 0.75, 0.06, z + 0.2, PALETTE.metal));
    parts.push(box(0.08, 0.6, 0.08, -0.75, 0.06, z - 0.2, PALETTE.metal));
    parts.push(box(0.08, 0.6, 0.08, 0.75, 0.06, z - 0.2, PALETTE.metal));
    const panel = merge([
      box(1.75, 0.05, 0.8, 0, -0.025, 0, PALETTE.solarFrame),
      ...[-0.6, -0.2, 0.2, 0.6].map((x) => box(0.36, 0.03, 0.7, x, 0.025, 0, PALETTE.solarCell)),
    ]);
    parts.push(panel.rotateX(-0.4).translate(0, 0.55, z));
  }
  parts.push(box(0.22, 0.2, 0.16, 0.82, 0.06, 0.86, PALETTE.copper));
  parts.push(box(0.25, 0.04, 0.19, 0.82, 0.26, 0.86, PALETTE.patina));
  return merge(parts);
}

/** Akku-Haus: Betonblock mit grünen Speicherzellen und Leuchtanzeige. */
function battery(): BufferGeometry {
  const parts = [
    box(1.72, 0.12, 1.72, 0, 0, 0, PALETTE.stone),
    box(1.5, 0.9, 1.3, 0, 0.12, -0.1, PALETTE.cream),
    box(1.6, 0.1, 1.4, 0, 1.02, -0.1, PALETTE.patina),
    // Anzeige vorne (leuchtet nachts)
    box(0.9, 0.12, 0.04, 0, 0.7, 0.56, PALETTE.windowLight),
  ];
  for (let k = 0; k < 3; k++) {
    const x = -0.5 + k * 0.5;
    parts.push(
      colored(
        new CylinderGeometry(0.17, 0.17, 0.55, 8).translate(x, 1.12 + 0.275, -0.1),
        PALETTE.battery,
      ),
    );
    parts.push(
      colored(new CylinderGeometry(0.07, 0.07, 0.1, 6).translate(x, 1.72, -0.1), PALETTE.copper),
    );
  }
  return merge(parts);
}

/** Höhe, an der die Kabel am großen Mast hängen. */
export const BIG_POLE_CABLE_HEIGHT = 4.1;

function bigPole(): BufferGeometry {
  const parts = [box(1.3, 0.12, 1.3, 0, 0, 0, PALETTE.stone)];
  // vier Beine, nach oben zusammenlaufend
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    const leg = new CylinderGeometry(0.04, 0.06, 4.0, 5);
    leg.rotateX(sz * 0.08).rotateZ(-sx * 0.08);
    parts.push(colored(leg.translate(sx * 0.32, 2.1, sz * 0.32), PALETTE.metalDark));
  }
  for (const h of [1.2, 2.4, 3.4])
    parts.push(box(0.7 - h * 0.09, 0.05, 0.05, 0, h, 0, PALETTE.metal));
  parts.push(box(1.5, 0.08, 0.1, 0, 3.95, 0, PALETTE.metalDark));
  for (const x of [-0.6, 0, 0.6])
    parts.push(
      colored(new CylinderGeometry(0.05, 0.06, 0.16, 6).translate(x, 4.1, 0), PALETTE.copper),
    );
  return merge(parts);
}

function path(): BufferGeometry {
  return merge([
    box(0.98, 0.05, 0.98, 0, 0, 0, PALETTE.pathStone),
    box(0.4, 0.02, 0.35, -0.2, 0.05, -0.22, PALETTE.stone),
    box(0.35, 0.02, 0.4, 0.24, 0.05, 0.2, PALETTE.stone),
  ]);
}

function pathColored(): BufferGeometry {
  return merge([
    box(0.98, 0.05, 0.98, 0, 0, 0, PALETTE.pathRed),
    box(0.44, 0.02, 0.44, -0.24, 0.05, -0.24, PALETTE.brick),
    box(0.44, 0.02, 0.44, 0.24, 0.05, 0.24, PALETTE.brick),
  ]);
}

function lantern(): BufferGeometry {
  return merge([
    box(0.3, 0.08, 0.3, 0, 0, 0, PALETTE.stone),
    colored(new CylinderGeometry(0.04, 0.05, 1.3, 6).translate(0, 0.73, 0), PALETTE.metalDark),
    box(0.22, 0.26, 0.22, 0, 1.38, 0, PALETTE.windowLight),
    pyramidRoof(0.3, 0.14, 1.64, PALETTE.metalDark),
  ]);
}

function flowerbed(): BufferGeometry {
  const parts = [
    box(0.9, 0.16, 0.9, 0, 0, 0, PALETTE.brick),
    box(0.74, 0.04, 0.74, 0, 0.14, 0, PALETTE.soilDark),
  ];
  const colors = [
    PALETTE.flowerYellow,
    PALETTE.flowerPink,
    PALETTE.flowerWhite,
    PALETTE.flowerViolet,
  ];
  for (let k = 0; k < 6; k++) {
    const x = -0.22 + (k % 3) * 0.22;
    const z = k < 3 ? -0.15 : 0.15;
    parts.push(
      colored(new CylinderGeometry(0.015, 0.015, 0.16, 4).translate(x, 0.26, z), PALETTE.leafDark),
    );
    parts.push(
      colored(new SphereGeometry(0.07, 5, 3).translate(x, 0.36, z), colors[k % colors.length]),
    );
  }
  return merge(parts);
}

function fence(): BufferGeometry {
  return merge([
    box(0.08, 0.5, 0.08, -0.42, 0, 0, PALETTE.woodDark),
    box(0.08, 0.5, 0.08, 0.42, 0, 0, PALETTE.woodDark),
    box(1, 0.06, 0.05, 0, 0.18, 0, PALETTE.wood),
    box(1, 0.06, 0.05, 0, 0.36, 0, PALETTE.wood),
  ]);
}

function bench(): BufferGeometry {
  return merge([
    box(0.08, 0.22, 0.3, -0.32, 0, 0, PALETTE.woodDark),
    box(0.08, 0.22, 0.3, 0.32, 0, 0, PALETTE.woodDark),
    box(0.8, 0.06, 0.34, 0, 0.22, 0, PALETTE.wood),
    box(0.8, 0.2, 0.05, 0, 0.32, -0.16, PALETTE.wood),
  ]);
}

function ornamentalTree(): BufferGeometry {
  return merge([
    box(0.6, 0.3, 0.6, 0, 0, 0, PALETTE.stone),
    box(0.5, 0.03, 0.5, 0, 0.3, 0, PALETTE.soilDark),
    colored(new CylinderGeometry(0.05, 0.07, 0.6, 5).translate(0, 0.6, 0), PALETTE.trunk),
    colored(new SphereGeometry(0.38, 7, 5).translate(0, 1.1, 0), PALETTE.hedge),
    colored(new SphereGeometry(0.22, 6, 4).translate(0.12, 1.4, 0.08), PALETTE.leafLight),
  ]);
}

/** Kennzeichen für aufgewertete Gebäude: Zahnrad auf einem Mast (Stufe 2 Kupfer, Stufe 3 Gold). */
export function upgradeBadge(color: number = PALETTE.copper): BufferGeometry {
  const parts = [
    colored(new CylinderGeometry(0.03, 0.03, 0.5, 5).translate(0.7, 0.25, 0.7), PALETTE.metalDark),
    colored(
      new CylinderGeometry(0.16, 0.16, 0.06, 10).rotateX(Math.PI / 2).translate(0.7, 0.6, 0.7),
      color,
    ),
  ];
  for (let k = 0; k < 6; k++) {
    const tooth = new BoxGeometry(0.06, 0.08, 0.06).translate(0, 0.19, 0);
    tooth.rotateZ((k * Math.PI) / 3).translate(0.7, 0.6, 0.7);
    parts.push(colored(tooth, color));
  }
  return merge(parts);
}

// ---------------------------------------------------------------- bewegliche Teile

function sawBlade(): BufferGeometry {
  const parts = [
    colored(new CylinderGeometry(0.32, 0.32, 0.04, 12).rotateX(Math.PI / 2), PALETTE.stone),
  ];
  for (let k = 0; k < 6; k++) {
    const tooth = new BoxGeometry(0.06, 0.08, 0.05).translate(0, 0.34, 0);
    parts.push(colored(tooth.rotateZ((k * Math.PI) / 3), PALETTE.metalDark));
  }
  return merge(parts);
}

function gear(radius: number, teeth: number, color: number): BufferGeometry {
  const parts = [
    colored(new CylinderGeometry(radius, radius, 0.08, 10).rotateZ(Math.PI / 2), color),
  ];
  for (let k = 0; k < teeth; k++) {
    const tooth = new BoxGeometry(0.08, 0.12, 0.12).translate(0, radius + 0.03, 0);
    parts.push(colored(tooth.rotateX((k * 2 * Math.PI) / teeth), color));
  }
  return merge(parts);
}

function wheel(): BufferGeometry {
  const parts = [
    colored(new TorusGeometry(0.3, 0.035, 4, 12), PALETTE.copper),
    colored(new CylinderGeometry(0.05, 0.05, 0.1, 6).rotateX(Math.PI / 2), PALETTE.metalDark),
  ];
  for (let k = 0; k < 3; k++) {
    parts.push(
      colored(new BoxGeometry(0.6, 0.04, 0.03).rotateZ((k * Math.PI) / 3), PALETTE.copper),
    );
  }
  return merge(parts);
}

/** Schaufelrad des Wasserrads (Achse x). */
function paddleWheel(): BufferGeometry {
  const parts = [
    colored(
      new TorusGeometry(0.62, 0.04, 4, 14).rotateY(Math.PI / 2).translate(-0.32, 0, 0),
      PALETTE.waterWheel,
    ),
    colored(
      new TorusGeometry(0.62, 0.04, 4, 14).rotateY(Math.PI / 2).translate(0.32, 0, 0),
      PALETTE.waterWheel,
    ),
    colored(new CylinderGeometry(0.07, 0.07, 1.25, 6).rotateZ(Math.PI / 2), PALETTE.metalDark),
  ];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    parts.push(
      colored(new BoxGeometry(0.7, 0.05, 0.2).translate(0, 0.6, 0).rotateX(a), PALETTE.wood),
      colored(
        new BoxGeometry(0.05, 0.6, 0.04).translate(-0.32, 0.3, 0).rotateX(a),
        PALETTE.woodDark,
      ),
      colored(
        new BoxGeometry(0.05, 0.6, 0.04).translate(0.32, 0.3, 0).rotateX(a),
        PALETTE.woodDark,
      ),
    );
  }
  return merge(parts);
}

function rotor(): BufferGeometry {
  const parts = [
    colored(
      new CylinderGeometry(0.08, 0.1, 0.16, 8).rotateX(Math.PI / 2).translate(0, 0, -0.09),
      PALETTE.copper,
    ),
  ];
  for (let k = 0; k < 3; k++) {
    const blade = new BoxGeometry(0.16, 1.25, 0.04).translate(0, 0.7, 0);
    parts.push(colored(blade.rotateZ((k * 2 * Math.PI) / 3), PALETTE.blade));
  }
  return merge(parts);
}

function fan(): BufferGeometry {
  const parts = [colored(new CylinderGeometry(0.06, 0.06, 0.12, 6), PALETTE.metalDark)];
  for (let k = 0; k < 4; k++) {
    parts.push(
      colored(
        new BoxGeometry(0.5, 0.03, 0.12).translate(0.25, 0.04, 0).rotateY((k * Math.PI) / 2),
        PALETTE.metal,
      ),
    );
  }
  return merge(parts);
}

/** Bewegliches Teil eines Gebäudes: Form, Drehpunkt (ungedreht, wie das Modell) und Achse. */
export interface SpinnerDef {
  make: () => BufferGeometry;
  offset: readonly [number, number, number];
  axis: 'x' | 'y' | 'z';
  /** Umdrehungen pro Sekunde bei der Arbeit. */
  speed: number;
}

export const SPINNERS: Record<string, SpinnerDef> = {
  lumberjack: { make: sawBlade, offset: [0.55, 0.55, -0.55], axis: 'z', speed: 1.6 },
  miner: { make: wheel, offset: [0, 1.43, -0.25], axis: 'z', speed: 0.5 },
  workshop: {
    make: () => gear(0.2, 8, PALETTE.copper),
    offset: [0.84, 0.5, -0.1],
    axis: 'x',
    speed: 0.4,
  },
  windTurbine: { make: rotor, offset: [0, 3.63, 0.43], axis: 'z', speed: 0.35 },
  assembler: { make: fan, offset: [0.9, 1.7, 0.75], axis: 'y', speed: 0.8 },
  waterWheel: { make: paddleWheel, offset: [0, 0.42, 0.85], axis: 'x', speed: -0.18 },
};

/** Lore mit Gestein (Ursprung = Mitte der Unterkante). */
function cart(): BufferGeometry {
  return merge([
    box(0.36, 0.2, 0.3, 0, 0.03, 0, PALETTE.woodDark),
    colored(
      new SphereGeometry(0.13, 5, 3).scale(1.2, 0.6, 0.9).translate(0, 0.24, 0),
      PALETTE.stone,
    ),
    colored(
      new CylinderGeometry(0.045, 0.045, 0.4, 6).rotateZ(Math.PI / 2).translate(0, 0.04, 0.09),
      PALETTE.metalDark,
    ),
    colored(
      new CylinderGeometry(0.045, 0.045, 0.4, 6).rotateZ(Math.PI / 2).translate(0, 0.04, -0.09),
      PALETTE.metalDark,
    ),
  ]);
}

/** Teil, das bei der Arbeit hin- und herfährt (Lore). Ruhestellung = `to`. */
export interface SliderDef {
  make: () => BufferGeometry;
  from: readonly [number, number, number];
  to: readonly [number, number, number];
  /** Sekunden für einmal hin und zurück. */
  period: number;
}

export const SLIDERS: Record<string, SliderDef> = {
  miner: { make: cart, from: [0.35, 0.05, -0.15], to: [0.35, 0.05, 0.65], period: 4 },
};

/** Rauch steigt aus diesen Punkten (Schornsteine), solange das Gebäude arbeitet. */
export const SMOKE: Record<string, readonly [number, number, number]> = {
  furnace: [0.45, 2.05, -0.4],
  burner: [0.25, 2.55, -0.25],
  foundry: [0.95, 3.25, -0.6],
};

const MODELS: Record<string, () => BufferGeometry> = {
  vegetableBed,
  flowerMeadow,
  beehive,
  orchard,
  greenhouse,
  hedgeCover: () => coverPreview('hedgeCover'),
  roseArch: () => coverPreview('roseArch'),
  // Uhrturm: als Gebäude-Instanz nur der Bauplatz, den Turm selbst zeichnet `LandmarkView`
  clockTower: clockTowerSite,
  fountain,
  bandstand,
  foundry,
  waterWheel: waterWheelHouse,
  solarPanel,
  battery,
  tunnelIn: () => tunnel(true),
  tunnelOut: () => tunnel(false),
  storageSplit: () => storageVariant(PALETTE.beltFrameMk2, 2),
  storageMerge: () => storageVariant(PALETTE.beltFrameMk3, 2),
  storageLarge,
  depot: () => depot(false),
  depotLarge: () => depot(true),
  dispenser,
  assembler,
  storage,
  splitter,
  merger,
  bridge,
  windTurbine,
  bigPole,
  path,
  pathColored,
  lantern,
  flowerbed,
  fence,
  bench,
  ornamentalTree,
  beltMk2: () => beltStraight(2),
  beltMk3: () => beltStraight(3),
  burner,
  pole,
  hq,
  lumberjack,
  miner,
  furnace,
  workshop,
  belt: () => beltStraight(1),
};

/** Bilder und Vorschau zeigen bei diesen Modellen das fertige Bauwerk. */
const PREVIEW_MODELS: Record<string, () => BufferGeometry> = { clockTower: clockTowerFull };

/**
 * Erzeugt das Modell zu einem Namen; unbekannte Namen ergeben einen einfachen Block.
 * `withMoving` setzt die beweglichen Teile in Ruhestellung dazu (für Bilder und Vorschau).
 */
export function buildingModel(
  name: string,
  w: number,
  h: number,
  withMoving = false,
): BufferGeometry {
  if (withMoving && PREVIEW_MODELS[name]) return PREVIEW_MODELS[name]();
  const make = MODELS[name];
  const base = make ? make() : merge([box(w - 0.15, 0.8, h - 0.15, 0, 0, 0, PALETTE.cream)]);
  if (!withMoving) return base;
  const parts = [base];
  const spin = SPINNERS[name];
  if (spin) parts.push(spin.make().translate(...spin.offset));
  const slide = SLIDERS[name];
  if (slide) parts.push(slide.make().translate(...slide.to));
  return parts.length > 1 ? merge(parts) : base;
}
