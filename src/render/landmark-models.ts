import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  SphereGeometry,
  type BufferGeometry,
} from 'three';
import { PALETTE } from '../data/palette';
import { colored, merge } from './geometry';

/**
 * Modelle des Uhrturms (3 × 3 Felder) und seiner Belohnungen (Brunnen, Musikpavillon).
 * Der Turm besteht aus einem Bauplatz (statische Gebäude-Instanz) und sechs Abschnitten, die
 * `LandmarkView` je nach Baufortschritt zusammensetzt. Ursprung = Mitte der Grundfläche,
 * „vorne“ = Süden (+z).
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

/** Dreht eine Geometrie um die Hochachse (Seite 0 = Süden, dann im Uhrzeigersinn von oben). */
function side(g: BufferGeometry, k: number): BufferGeometry {
  return g.rotateY((k * Math.PI) / 2);
}

/** Pyramidendach mit quadratischer Grundfläche `size`, Unterkante auf `y`. */
function pyramid(size: number, height: number, y: number, color: number): BufferGeometry {
  return colored(
    new ConeGeometry(size / Math.SQRT2, height, 4)
      .rotateY(Math.PI / 4)
      .translate(0, y + height / 2, 0),
    color,
  );
}

/** Mitte des Zifferblatts: Höhe und Abstand von der Turmmitte (für die Zeiger). */
export const CLOCK_Y = 4.85;
export const CLOCK_Z = 0.88;

/** Höhenbereich und halbe Breite je Abschnitt (für das Baugerüst). */
const STAGE_BOUNDS: readonly (readonly [number, number, number])[] = [
  [0.1, 0.65, 1.3],
  [0.65, 3.2, 0.95],
  [3.2, 4.3, 0.98],
  [4.3, 5.4, 0.95],
  [5.4, 6.7, 0.95],
  [6.7, 8.8, 1.05],
];

/** Bauplatz: Steinplatte, Bauschild und Materialstapel (verschwinden später im Fundament). */
export function clockTowerSite(): BufferGeometry {
  const parts = [
    box(2.74, 0.1, 2.74, 0, 0, 0, PALETTE.stoneWallDark),
    // Bauschild vorn links
    box(0.06, 0.6, 0.06, -0.75, 0.1, 0.9, PALETTE.woodDark),
    box(0.5, 0.32, 0.04, -0.75, 0.42, 0.93, PALETTE.trim),
    box(0.36, 0.05, 0.01, -0.75, 0.6, 0.955, PALETTE.towerBrick),
    box(0.3, 0.04, 0.01, -0.75, 0.5, 0.955, PALETTE.clockHand),
    // Steinstapel und Bretter
    box(0.5, 0.18, 0.4, 0.6, 0.1, -0.5, PALETTE.stoneWall),
    box(0.36, 0.14, 0.3, 0.6, 0.28, -0.5, PALETTE.stoneWallLight),
    box(0.8, 0.06, 0.24, -0.4, 0.1, -0.6, PALETTE.wood),
    box(0.8, 0.06, 0.24, -0.4, 0.16, -0.58, PALETTE.woodDark),
    // Pflöcke mit Schnur, die den Grundriss markieren
  ];
  for (const [x, z] of [
    [-1.1, -1.1],
    [1.1, -1.1],
    [1.1, 1.1],
    [-1.1, 1.1],
  ])
    parts.push(box(0.05, 0.3, 0.05, x, 0.1, z, PALETTE.woodDark));
  for (let k = 0; k < 4; k++)
    parts.push(side(box(2.2, 0.015, 0.015, 0, 0.32, 1.1, PALETTE.trim), k));
  return merge(parts);
}

/** Abschnitt 1: zweistufiger Sockel aus Naturstein mit Treppe nach Süden. */
function foundation(): BufferGeometry {
  const parts = [
    box(2.44, 0.22, 2.44, 0, 0.1, 0, PALETTE.stoneWallDark),
    box(2.16, 0.33, 2.16, 0, 0.32, 0, PALETTE.stoneWall),
    box(0.8, 0.11, 0.18, 0, 0.32, 1.17, PALETTE.stoneWallLight),
    box(0.8, 0.11, 0.1, 0, 0.43, 1.13, PALETTE.stoneWallLight),
    box(0.8, 0.11, 0.06, 0, 0.54, 1.11, PALETTE.stoneWallLight),
  ];
  // Hellere Steine als Muster an den Seiten des oberen Sockels
  for (let k = 0; k < 4; k++) {
    for (let j = 0; j < 4; j++) {
      const x = -0.75 + j * 0.5;
      if (k === 0 && Math.abs(x) < 0.5) continue; // Treppe
      parts.push(side(box(0.34, 0.12, 0.02, x, 0.42, 1.085, PALETTE.stoneWallLight), k));
    }
  }
  return merge(parts);
}

/** Abschnitt 2: Turmschaft aus Ziegeln mit hellen Eckquadern, Tor und schmalen Fenstern. */
function walls(): BufferGeometry {
  const parts = [box(1.6, 2.55, 1.6, 0, 0.65, 0, PALETTE.towerBrick)];
  // Eckquader abwechselnd lang und kurz
  for (const [x, z] of [
    [-0.8, -0.8],
    [0.8, -0.8],
    [0.8, 0.8],
    [-0.8, 0.8],
  ]) {
    for (let j = 0; j < 7; j++) {
      const long = j % 2 === 0;
      const w = long ? 0.3 : 0.2;
      parts.push(
        box(
          Math.abs(x) > 0 ? w : 0.2,
          0.17,
          w,
          x - Math.sign(x) * (w / 2 - 0.02),
          0.75 + j * 0.34,
          z - Math.sign(z) * (w / 2 - 0.02),
          PALETTE.trim,
        ),
      );
    }
  }
  // Tor im Süden mit Rundbogen
  parts.push(box(0.64, 0.98, 0.03, 0, 0.65, 0.805, PALETTE.trim));
  parts.push(box(0.5, 0.82, 0.04, 0, 0.65, 0.815, PALETTE.woodDark));
  parts.push(
    colored(
      new CylinderGeometry(0.25, 0.25, 0.04, 10, 1, false, -Math.PI / 2, Math.PI)
        .rotateX(Math.PI / 2)
        .translate(0, 1.47, 0.815),
      PALETTE.woodDark,
    ),
  );
  parts.push(box(0.04, 0.6, 0.01, 0, 0.72, 0.84, PALETTE.wood));
  // Fenster (leuchten nachts) auf allen Seiten
  for (let k = 0; k < 4; k++) {
    parts.push(side(box(0.24, 0.48, 0.03, 0, 2.15, 0.805, PALETTE.trim), k));
    parts.push(side(box(0.15, 0.38, 0.03, 0, 2.2, 0.815, PALETTE.windowLight), k));
    if (k !== 0) {
      parts.push(side(box(0.2, 0.34, 0.03, 0, 1.15, 0.805, PALETTE.trim), k));
      parts.push(side(box(0.12, 0.26, 0.03, 0, 1.19, 0.815, PALETTE.windowLight), k));
    }
  }
  // Gesims
  parts.push(box(1.7, 0.06, 1.7, 0, 3.12, 0, PALETTE.trim));
  return merge(parts);
}

/** Abschnitt 3: Turmstube in Fachwerk mit Fenstern. */
function chamber(): BufferGeometry {
  const parts = [
    box(1.88, 0.1, 1.88, 0, 3.2, 0, PALETTE.stoneWallLight),
    box(1.7, 0.9, 1.7, 0, 3.3, 0, PALETTE.houseWall),
    box(1.82, 0.1, 1.82, 0, 4.2, 0, PALETTE.woodDark),
  ];
  for (let k = 0; k < 4; k++) {
    for (const x of [-0.82, 0, 0.82])
      parts.push(side(box(0.08, 0.9, 0.03, x, 3.3, 0.86, PALETTE.woodDark), k));
    parts.push(side(box(1.7, 0.06, 0.03, 0, 3.92, 0.86, PALETTE.woodDark), k));
    for (const x of [-0.42, 0.42]) {
      parts.push(side(box(0.32, 0.36, 0.02, x, 3.44, 0.86, PALETTE.windowFrame), k));
      parts.push(side(box(0.24, 0.28, 0.03, x, 3.48, 0.865, PALETTE.windowLight), k));
    }
  }
  return merge(parts);
}

/** Ein Zifferblatt nach Süden: dunkler Rand, helles Blatt, zwölf Striche. */
function clockFace(): BufferGeometry {
  const parts = [
    colored(
      new CylinderGeometry(0.5, 0.5, 0.04, 20).rotateX(Math.PI / 2).translate(0, CLOCK_Y, 0.82),
      PALETTE.clockHand,
    ),
    colored(
      new CylinderGeometry(0.45, 0.45, 0.04, 20).rotateX(Math.PI / 2).translate(0, CLOCK_Y, 0.835),
      PALETTE.clockFace,
    ),
  ];
  for (let h = 0; h < 12; h++) {
    const big = h % 3 === 0;
    const mark = new BoxGeometry(big ? 0.05 : 0.03, big ? 0.1 : 0.07, 0.02).translate(0, 0.36, 0);
    mark.rotateZ((-h * Math.PI) / 6).translate(0, CLOCK_Y, 0.86);
    parts.push(colored(mark, PALETTE.clockHand));
  }
  return merge(parts);
}

/** Abschnitt 4: Uhrgeschoss mit vier Zifferblättern (Zeiger zeichnet `LandmarkView`). */
function clockwork(): BufferGeometry {
  const parts = [
    box(1.6, 1.1, 1.6, 0, 4.3, 0, PALETTE.towerBrickDark),
    box(1.76, 0.1, 1.76, 0, 5.3, 0, PALETTE.stoneWallLight),
  ];
  const face = clockFace();
  for (let k = 0; k < 4; k++) parts.push(side(face.clone(), k));
  return merge(parts);
}

/** Abschnitt 5: offene Glockenstube mit Bronzeglocke. */
function belfry(): BufferGeometry {
  const parts = [
    box(1.6, 0.1, 1.6, 0, 5.4, 0, PALETTE.stoneWall),
    box(1.76, 0.14, 1.76, 0, 6.56, 0, PALETTE.stoneWallLight),
  ];
  for (const [x, z] of [
    [-0.66, -0.66],
    [0.66, -0.66],
    [0.66, 0.66],
    [-0.66, 0.66],
  ])
    parts.push(box(0.28, 1.06, 0.28, x, 5.5, z, PALETTE.towerBrick));
  for (let k = 0; k < 4; k++) {
    parts.push(side(box(1.6, 0.16, 0.26, 0, 6.4, 0.67, PALETTE.towerBrick), k));
    parts.push(side(box(1.04, 0.05, 0.06, 0, 5.5, 0.72, PALETTE.trim), k)); // Brüstung
    parts.push(side(box(1.04, 0.05, 0.06, 0, 5.8, 0.72, PALETTE.trim), k));
  }
  // Glocke am Joch
  parts.push(box(1.1, 0.08, 0.1, 0, 6.3, 0, PALETTE.woodDark));
  parts.push(
    colored(new CylinderGeometry(0.15, 0.32, 0.42, 12).translate(0, 5.9, 0), PALETTE.bronze),
  );
  parts.push(
    colored(new CylinderGeometry(0.07, 0.15, 0.16, 12).translate(0, 6.19, 0), PALETTE.bronze),
  );
  parts.push(
    colored(new CylinderGeometry(0.34, 0.34, 0.04, 12).translate(0, 5.7, 0), PALETTE.bronze),
  );
  parts.push(colored(new SphereGeometry(0.06, 6, 4).translate(0, 5.66, 0), PALETTE.metalDark));
  return merge(parts);
}

/** Abschnitt 6: Turmspitze mit Patina, kleinen Ecktürmchen, goldener Kugel und Wetterfahne. */
function spire(): BufferGeometry {
  const parts = [
    pyramid(1.9, 2.0, 6.7, PALETTE.patina),
    colored(new SphereGeometry(0.11, 8, 6).translate(0, 8.72, 0), PALETTE.gold),
    colored(new CylinderGeometry(0.02, 0.02, 0.6, 5).translate(0, 8.95, 0), PALETTE.metalDark),
    // Wetterfahne: Pfeil mit Schwanz
    box(0.5, 0.035, 0.03, 0, 9.1, 0, PALETTE.gold),
    colored(
      new ConeGeometry(0.07, 0.14, 4).rotateZ(-Math.PI / 2).translate(0.29, 9.12, 0),
      PALETTE.gold,
    ),
    box(0.1, 0.12, 0.02, -0.22, 9.08, 0, PALETTE.gold),
  ];
  for (const [x, z] of [
    [-0.78, -0.78],
    [0.78, -0.78],
    [0.78, 0.78],
    [-0.78, 0.78],
  ]) {
    parts.push(box(0.16, 0.18, 0.16, x, 6.7, z, PALETTE.stoneWallLight));
    parts.push(
      colored(
        new ConeGeometry(0.11, 0.42, 4).rotateY(Math.PI / 4).translate(x, 7.09, z),
        PALETTE.patina,
      ),
    );
  }
  // Gauben mit Fensterchen auf jeder Seite
  for (let k = 0; k < 4; k++) {
    parts.push(side(box(0.3, 0.32, 0.3, 0, 7.05, 0.5, PALETTE.trim), k));
    parts.push(side(box(0.16, 0.2, 0.02, 0, 7.09, 0.655, PALETTE.windowLight), k));
    parts.push(side(pyramid(0.36, 0.22, 7.37, PALETTE.patina).translate(0, 0, 0.5), k));
  }
  return merge(parts);
}

const STAGE_MODELS = [foundation, walls, chamber, clockwork, belfry, spire];

let stageCache: BufferGeometry[] | null = null;
/** Geometrie je Abschnitt (Index = Abschnitt, nicht verschmolzen mit den anderen). */
export function clockTowerStages(): BufferGeometry[] {
  stageCache ??= STAGE_MODELS.map((make) => make());
  return stageCache;
}

/** Baugerüst um den Abschnitt `stage`, der gerade entsteht. */
export function clockTowerScaffold(stage: number): BufferGeometry {
  const [y0, y1, hw] = STAGE_BOUNDS[Math.min(stage, STAGE_BOUNDS.length - 1)];
  const top = y1 + 0.3;
  const parts: BufferGeometry[] = [];
  for (const [x, z] of [
    [-hw, -hw],
    [hw, -hw],
    [hw, hw],
    [-hw, hw],
  ])
    parts.push(box(0.06, top - y0, 0.06, x, y0, z, PALETTE.scaffold));
  const levels = Math.max(1, Math.round((top - y0) / 0.6));
  for (let j = 1; j <= levels; j++) {
    const y = y0 + ((top - y0) * j) / levels - 0.04;
    for (let k = 0; k < 4; k++) {
      parts.push(side(box(hw * 2 + 0.06, 0.04, 0.16, 0, y, hw, PALETTE.scaffold), k));
    }
  }
  // Diagonalstreben vorn und hinten
  for (const z of [-hw, hw]) {
    const len = Math.hypot(hw * 2, top - y0);
    const brace = new BoxGeometry(0.04, len, 0.04).rotateZ(Math.atan2(hw * 2, top - y0));
    parts.push(colored(brace.translate(0, (y0 + top) / 2, z), PALETTE.woodDark));
  }
  // Seilzug mit Eimer oben
  parts.push(box(0.05, 0.05, 0.7, hw, top, hw - 0.3, PALETTE.woodDark));
  parts.push(box(0.012, 0.7, 0.012, hw, top - 0.7, hw + 0.02, PALETTE.trim));
  parts.push(box(0.12, 0.12, 0.12, hw, top - 0.82, hw + 0.02, PALETTE.wood));
  return merge(parts);
}

/** Zeiger, nach oben (12 Uhr) zeigend, Drehpunkt im Ursprung. */
export function clockHand(long: boolean): BufferGeometry {
  const len = long ? 0.38 : 0.26;
  return colored(
    new BoxGeometry(long ? 0.035 : 0.05, len, 0.02).translate(0, len / 2 - 0.05, 0),
    PALETTE.clockHand,
  );
}

/** Der fertige Turm mit Zeigern auf 10:10 (Bauleiste, Vorschau). */
export function clockTowerFull(): BufferGeometry {
  const parts = [clockTowerSite(), ...clockTowerStages().map((g) => g.clone())];
  for (let k = 0; k < 4; k++) {
    const hour = clockHand(false).rotateZ((-10 / 12) * Math.PI * 2 - (10 / 60 / 12) * Math.PI * 2);
    const minute = clockHand(true).rotateZ((-10 / 60) * Math.PI * 2);
    for (const h of [hour, minute]) parts.push(side(h.translate(0, CLOCK_Y, CLOCK_Z), k));
  }
  return merge(parts);
}

/** Dorfbrunnen (2 × 2): runder Steintrog, Säule mit Schale. */
export function fountain(): BufferGeometry {
  const parts = [
    colored(new CylinderGeometry(0.82, 0.86, 0.32, 12).translate(0, 0.16, 0), PALETTE.stoneWall),
    colored(new CylinderGeometry(0.7, 0.7, 0.04, 12).translate(0, 0.28, 0), PALETTE.water),
    colored(
      new CylinderGeometry(0.86, 0.86, 0.05, 12).translate(0, 0.33, 0),
      PALETTE.stoneWallLight,
    ),
    colored(new CylinderGeometry(0.09, 0.12, 0.6, 8).translate(0, 0.55, 0), PALETTE.stoneWallLight),
    colored(new CylinderGeometry(0.34, 0.16, 0.14, 10).translate(0, 0.9, 0), PALETTE.stoneWall),
    colored(new CylinderGeometry(0.28, 0.28, 0.03, 10).translate(0, 0.96, 0), PALETTE.water),
    colored(new CylinderGeometry(0.05, 0.07, 0.22, 6).translate(0, 1.07, 0), PALETTE.copper),
    colored(new SphereGeometry(0.06, 6, 4).translate(0, 1.2, 0), PALETTE.patina),
  ];
  // Wasserstrahlen in den Trog
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2 + Math.PI / 4;
    parts.push(
      colored(
        new CylinderGeometry(0.02, 0.03, 0.62, 4).translate(
          Math.cos(a) * 0.32,
          0.62,
          Math.sin(a) * 0.32,
        ),
        PALETTE.water,
      ),
    );
  }
  return merge(parts);
}

/** Musikpavillon (3 × 3): achteckige Bühne, schlanke Säulen, Kupferdach. */
export function bandstand(): BufferGeometry {
  const parts = [
    colored(new CylinderGeometry(1.3, 1.36, 0.3, 8).translate(0, 0.15, 0), PALETTE.stoneWall),
    colored(new CylinderGeometry(1.24, 1.24, 0.05, 8).translate(0, 0.32, 0), PALETTE.wood),
    colored(new ConeGeometry(1.5, 0.85, 8).translate(0, 2.08, 0), PALETTE.patina),
    colored(new CylinderGeometry(1.5, 1.5, 0.1, 8).translate(0, 1.6, 0), PALETTE.trim),
    colored(new SphereGeometry(0.1, 6, 4).translate(0, 2.55, 0), PALETTE.gold),
    // Treppe
    box(0.7, 0.12, 0.3, 0, 0, 1.38, PALETTE.stoneWallLight),
  ];
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4 + Math.PI / 8;
    const x = Math.cos(a) * 1.12;
    const z = Math.sin(a) * 1.12;
    parts.push(
      colored(new CylinderGeometry(0.05, 0.05, 1.28, 6).translate(x, 0.98, z), PALETTE.trim),
    );
    // Geländer zwischen den Säulen (vorn offen)
    if (k === 1) continue;
    const b = a + Math.PI / 8;
    const rail = new BoxGeometry(0.86, 0.05, 0.04).rotateY(-b + Math.PI / 2);
    parts.push(
      colored(rail.translate(Math.cos(b) * 1.04, 0.62, Math.sin(b) * 1.04), PALETTE.woodDark),
    );
  }
  // Notenständer und ein Hocker
  parts.push(box(0.04, 0.45, 0.04, 0.2, 0.35, -0.2, PALETTE.metalDark));
  parts.push(box(0.26, 0.18, 0.02, 0.2, 0.78, -0.18, PALETTE.metalDark));
  parts.push(box(0.22, 0.24, 0.22, -0.25, 0.35, 0.1, PALETTE.woodDark));
  // Lampe unter dem Dach
  parts.push(box(0.015, 0.2, 0.015, 0, 1.4, 0, PALETTE.metalDark));
  parts.push(box(0.14, 0.16, 0.14, 0, 1.24, 0, PALETTE.windowLight));
  return merge(parts);
}
