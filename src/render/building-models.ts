import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector2,
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
    // Halter des Sägeblatts (das Blatt selbst dreht sich, siehe SPINNERS)
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
    box(0.7, 0.55, 0.7, 0, 0.25, -0.35, PALETTE.wood),
    gableRoof(0.85, 0.85, 0.35, 0, 0.8, -0.35, PALETTE.roof),
    // Schienen aus dem Stollen (die Lore fährt darauf, siehe SLIDERS)
    box(0.04, 0.03, 1.05, 0.23, 0.25, 0.3, PALETTE.metalDark),
    box(0.04, 0.03, 1.05, 0.47, 0.25, 0.3, PALETTE.metalDark),
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
  ];
  return merge(parts);
}

function burner(): BufferGeometry {
  const parts = [
    box(1.85, 0.14, 1.85, 0, 0, 0, PALETTE.stone),
    box(1.3, 0.75, 1.15, -0.15, 0.14, 0.05, PALETTE.stone),
    box(1.1, 0.25, 0.95, -0.15, 0.89, 0.05, PALETTE.brick),
    // Feuerloch vorne
    box(0.5, 0.32, 0.05, -0.15, 0.3, 0.63, PALETTE.glow),
    box(0.66, 0.07, 0.1, -0.15, 0.62, 0.64, PALETTE.rockDark),
    // Schornstein
    colored(
      new CylinderGeometry(0.15, 0.19, 1.3, 6)
        .translate(0.25, 1.14 + 0.65 - 0.65, -0.25)
        .translate(0, 0.65, 0),
      PALETTE.brick,
    ),
    colored(new CylinderGeometry(0.2, 0.2, 0.08, 6).translate(0.25, 2.47, -0.25), PALETTE.roof),
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

function assembler(): BufferGeometry {
  const parts = [
    box(2.9, 0.14, 2.9, 0, 0, 0, PALETTE.stone),
    box(2.5, 1.05, 2.2, 0, 0.14, 0.1, PALETTE.cream),
    // Sheddach: drei Zacken mit Oberlichtern nach Norden (leuchten nachts)
    ...[0, 1, 2].flatMap((k) => {
      const south = 1.2 - k * 0.733;
      return [
        sawTooth(2.5, 0.733, 0.45, south, PALETTE.roof),
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
    // Tor (Süden) und Fenster
    box(0.7, 0.7, 0.05, 0, 0.14, 1.21, PALETTE.woodDark),
    box(0.4, 0.3, 0.04, -0.85, 0.6, 1.21, PALETTE.windowLight),
    box(0.4, 0.3, 0.04, 0.85, 0.6, 1.21, PALETTE.windowLight),
  ];
  return merge(parts);
}

/**
 * Tunnelband: steinernes Portal mit dunkler Öffnung und Bandrampe. Eingang: Rampe von Süden
 * hinab ins Portal im Norden. Ausgang: Portal im Süden, Rampe nach Norden hinauf.
 */
function tunnel(entrance: boolean): BufferGeometry {
  const dir = entrance ? -1 : 1; // Lage des Portals: Norden (−z) beim Eingang, Süden beim Ausgang
  const ramp = new BoxGeometry(0.74, 0.08, 0.75).rotateX(dir * 0.22).translate(0, 0.1, -dir * 0.1);
  return merge([
    box(0.96, 0.06, 0.96, 0, 0, 0, PALETTE.rockDark),
    colored(ramp, PALETTE.beltSurface),
    box(0.1, 0.16, 0.7, -0.42, 0, -dir * 0.12, PALETTE.beltFrame),
    box(0.1, 0.16, 0.7, 0.42, 0, -dir * 0.12, PALETTE.beltFrame),
    // Portal
    box(0.96, 0.55, 0.26, 0, 0, dir * 0.36, PALETTE.stone),
    box(0.62, 0.36, 0.05, 0, 0.04, dir * 0.22, PALETTE.rockDark),
    box(1.0, 0.1, 0.32, 0, 0.55, dir * 0.36, PALETTE.roof),
  ]);
}

/** Lager-Varianten: Schuppen mit farbigem Streifen am Giebel, damit man sie unterscheidet. */
function storageVariant(accent: number, doors: number): BufferGeometry {
  const parts = [
    box(1.85, 0.1, 1.85, 0, 0, 0, PALETTE.soil),
    box(1.6, 0.85, 1.3, 0, 0.1, -0.1, PALETTE.wood),
    gableRoof(1.5, 1.75, 0.5, 0, 0.95, -0.1, PALETTE.roof),
    box(1.62, 0.1, 0.04, 0, 0.78, 0.56, accent),
  ];
  for (let k = 0; k < doors; k++) {
    const x = doors === 1 ? -0.45 : -0.45 + k * 0.9;
    parts.push(box(0.5, 0.55, 0.04, x, 0.1, 0.56, PALETTE.woodDark));
  }
  parts.push(box(0.26, 0.24, 0.26, 0.7, 0.1, -0.85, PALETTE.woodDark));
  return merge(parts);
}

function storageLarge(): BufferGeometry {
  const parts = [
    box(2.9, 0.14, 2.9, 0, 0, 0, PALETTE.stone),
    box(2.6, 1.3, 2.3, 0, 0.14, -0.05, PALETTE.brick),
    gableRoof(2.5, 2.75, 0.75, 0, 1.44, -0.05, PALETTE.roof),
    box(0.8, 0.85, 0.05, -1, 0.14, 1.11, PALETTE.woodDark),
    box(0.8, 0.85, 0.05, 1, 0.14, 1.11, PALETTE.woodDark),
    box(0.5, 0.3, 0.04, 0, 0.8, 1.11, PALETTE.windowLight),
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
    box(1.85 * s, 0.12, 1.85 * s, 0, 0, 0, PALETTE.woodDark),
    box(1.75 * s, 0.04, 1.75 * s, 0, 0.12, 0, PALETTE.wood),
  ];
  for (const [x, z] of [
    [-0.75, -0.75],
    [0.75, -0.75],
    [-0.75, 0.75],
    [0.75, 0.75],
  ])
    parts.push(box(0.1, 1.0, 0.1, x * s, 0.16, z * s, PALETTE.woodDark));
  parts.push(gableRoof(1.8 * s, 1.85 * s, 0.45, 0, 1.16, 0, PALETTE.roof));
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
  // Schild mit Kupferplatte
  parts.push(box(0.05, 0.6, 0.05, 0.85 * s, 0.16, 0.95 * s, PALETTE.woodDark));
  parts.push(box(0.4, 0.22, 0.04, 0.85 * s, 0.6, 0.95 * s, PALETTE.copper));
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

function storage(): BufferGeometry {
  const parts = [
    box(1.85, 0.1, 1.85, 0, 0, 0, PALETTE.soil),
    box(1.5, 0.85, 1.3, 0, 0.1, -0.15, PALETTE.wood),
    gableRoof(1.45, 1.65, 0.5, 0, 0.95, -0.15, PALETTE.roof),
    box(0.6, 0.6, 0.04, 0, 0.1, 0.51, PALETTE.woodDark),
  ];
  // Kisten vor dem Schuppen
  parts.push(box(0.32, 0.3, 0.32, -0.6, 0.1, 0.65, PALETTE.woodDark));
  parts.push(box(0.28, 0.26, 0.28, 0.62, 0.1, 0.62, PALETTE.wood));
  parts.push(box(0.24, 0.22, 0.24, 0.62, 0.36, 0.62, PALETTE.woodDark));
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
        PALETTE.beltArrow,
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
      PALETTE.beltArrow,
    ),
  ]);
}

function bridge(): BufferGeometry {
  return merge([
    // unteres Band (Nord → Süd)
    box(0.74, 0.1, 1, 0, 0.02, 0, PALETTE.beltSurface),
    // Rampe des oberen Bandes (West → Ost) auf Stützen
    box(1, 0.08, 0.74, 0, 0.62, 0, PALETTE.beltSurface),
    box(1, 0.12, 0.08, 0, 0.58, 0.41, PALETTE.beltFrame),
    box(1, 0.12, 0.08, 0, 0.58, -0.41, PALETTE.beltFrame),
    box(0.1, 0.62, 0.1, -0.44, 0, 0.41, PALETTE.woodDark),
    box(0.1, 0.62, 0.1, 0.44, 0, 0.41, PALETTE.woodDark),
    box(0.1, 0.62, 0.1, -0.44, 0, -0.41, PALETTE.woodDark),
    box(0.1, 0.62, 0.1, 0.44, 0, -0.41, PALETTE.woodDark),
  ]);
}

function windTurbine(): BufferGeometry {
  const parts = [
    box(1.2, 0.16, 1.2, 0, 0, 0, PALETTE.stone),
    colored(new CylinderGeometry(0.1, 0.2, 3.4, 8).translate(0, 0.16 + 1.7, 0), PALETTE.cream),
    box(0.3, 0.26, 0.55, 0, 3.5, 0, PALETTE.cream),
  ];
  return merge(parts);
}

// ---------------------------------------------------------------- Eisen, Stahl, neue Stromarten

/** Gießerei: dunkler Hochofen mit zwei Trichtern, glühendem Abstich vorne und hohem Schlot. */
function foundry(): BufferGeometry {
  return merge([
    box(2.9, 0.14, 2.9, 0, 0, 0, PALETTE.stone),
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

/** Wasserrad: Mühlenhaus aus Holz, das Rad steht vorne (Süden) im Wasser. */
function waterWheelHouse(): BufferGeometry {
  return merge([
    box(1.8, 0.12, 1.3, 0, 0, -0.25, PALETTE.stone),
    box(1.4, 0.85, 1.0, -0.1, 0.12, -0.3, PALETTE.wood),
    gableRoof(1.2, 1.6, 0.55, -0.1, 0.97, -0.3, PALETTE.roof),
    box(0.3, 0.28, 0.04, -0.4, 0.45, 0.21, PALETTE.windowLight),
    // Achslager auf zwei Pfosten am Ufer
    box(0.14, 0.7, 0.14, -0.55, 0, 0.75, PALETTE.woodDark),
    box(0.14, 0.7, 0.14, 0.55, 0, 0.75, PALETTE.woodDark),
    colored(
      new CylinderGeometry(0.17, 0.17, 0.35, 8).rotateZ(Math.PI / 2).translate(0.82, 0.42, -0.1),
      PALETTE.copper,
    ),
  ]);
}

/** Solarfeld: zwei schräg gestellte Paneele auf einem Gestell. */
function solarPanel(): BufferGeometry {
  const parts = [box(1.85, 0.06, 1.85, 0, 0, 0, PALETTE.soil)];
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
  return merge(parts);
}

/** Akku-Haus: Betonblock mit grünen Speicherzellen und Leuchtanzeige. */
function battery(): BufferGeometry {
  const parts = [
    box(1.85, 0.12, 1.85, 0, 0, 0, PALETTE.stone),
    box(1.5, 0.9, 1.3, 0, 0.12, -0.1, PALETTE.cream),
    box(1.6, 0.1, 1.4, 0, 1.02, -0.1, PALETTE.metalDark),
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

/** Kennzeichen für aufgewertete Gebäude (Stufe 2): kupfernes Zahnrad auf einem Mast. */
export function upgradeBadge(): BufferGeometry {
  const parts = [
    colored(new CylinderGeometry(0.03, 0.03, 0.5, 5).translate(0.7, 0.25, 0.7), PALETTE.metalDark),
    colored(
      new CylinderGeometry(0.16, 0.16, 0.06, 10).rotateX(Math.PI / 2).translate(0.7, 0.6, 0.7),
      PALETTE.copper,
    ),
  ];
  for (let k = 0; k < 6; k++) {
    const tooth = new BoxGeometry(0.06, 0.08, 0.06).translate(0, 0.19, 0);
    tooth.rotateZ((k * Math.PI) / 3).translate(0.7, 0.6, 0.7);
    parts.push(colored(tooth, PALETTE.copper));
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
  miner: { make: wheel, offset: [0, 1.6, -0.25], axis: 'z', speed: 0.5 },
  workshop: {
    make: () => gear(0.3, 8, PALETTE.copper),
    offset: [0.84, 0.6, -0.1],
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
  miner: { make: cart, from: [0.35, 0.25, -0.15], to: [0.35, 0.25, 0.65], period: 4 },
};

/** Rauch steigt aus diesen Punkten (Schornsteine), solange das Gebäude arbeitet. */
export const SMOKE: Record<string, readonly [number, number, number]> = {
  furnace: [0.45, 2.05, -0.4],
  burner: [0.25, 2.55, -0.25],
  foundry: [0.95, 3.25, -0.6],
};

const MODELS: Record<string, () => BufferGeometry> = {
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
