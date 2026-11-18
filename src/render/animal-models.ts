import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  SphereGeometry,
  type BufferGeometry,
} from 'three';
import { PALETTE } from '../data/palette';
import { colored, merge } from './geometry';

/**
 * Tiere und kleine Überraschungen (Ausbaurunde Gemütlichkeit Schritt 4). Blick nach +z,
 * Unterkante auf y = 0, maßstäblich etwas größer, damit man sie zwischen den Gebäuden sieht.
 */

function box(w: number, h: number, d: number, x: number, y: number, z: number, c: number) {
  return colored(new BoxGeometry(w, h, d).translate(x, y + h / 2, z), c);
}

/** Schafweide 3 × 3: Wiese, Holzzaun mit Gatter, Unterstand, Heuballen und Wassertrog. */
export function sheepPasture(): BufferGeometry {
  const parts = [box(2.86, 0.04, 2.86, 0, 0, 0, PALETTE.meadowLight)];
  const half = 1.38;
  for (let k = 0; k <= 6; k++) {
    const u = -half + (k * 2 * half) / 6;
    parts.push(box(0.07, 0.42, 0.07, u, 0, -half, PALETTE.woodDark));
    parts.push(box(0.07, 0.42, 0.07, -half, 0, u, PALETTE.woodDark));
    parts.push(box(0.07, 0.42, 0.07, half, 0, u, PALETTE.woodDark));
    if (Math.abs(u) > 0.3) parts.push(box(0.07, 0.42, 0.07, u, 0, half, PALETTE.woodDark));
  }
  for (const y of [0.16, 0.32]) {
    parts.push(box(2 * half, 0.05, 0.04, 0, y, -half, PALETTE.wood));
    parts.push(box(0.04, 0.05, 2 * half, -half, y, 0, PALETTE.wood));
    parts.push(box(0.04, 0.05, 2 * half, half, y, 0, PALETTE.wood));
    parts.push(box(half - 0.3, 0.05, 0.04, -(half + 0.3) / 2, y, half, PALETTE.wood));
    parts.push(box(half - 0.3, 0.05, 0.04, (half + 0.3) / 2, y, half, PALETTE.wood));
  }
  // Unterstand hinten links: Pfosten und schräges Brettdach
  for (const [x, z] of [
    [-1.15, -1.15],
    [-0.35, -1.15],
    [-1.15, -0.55],
    [-0.35, -0.55],
  ])
    parts.push(box(0.06, z < -1 ? 0.62 : 0.5, 0.06, x, 0, z, PALETTE.woodDark));
  parts.push(
    colored(
      new BoxGeometry(0.95, 0.05, 0.8).rotateX(0.18).translate(-0.75, 0.6, -0.85),
      PALETTE.barnRed,
    ),
  );
  // Heuballen und Trog
  parts.push(
    colored(
      new CylinderGeometry(0.17, 0.17, 0.32, 10).rotateZ(Math.PI / 2).translate(-0.75, 0.2, -0.85),
      PALETTE.hay,
    ),
  );
  parts.push(box(0.5, 0.14, 0.18, 0.85, 0.04, -1.05, PALETTE.woodDark));
  parts.push(box(0.42, 0.02, 0.12, 0.85, 0.17, -1.05, PALETTE.water));
  return merge(parts);
}

/** Schaf: wolliger Körper, dunkler Kopf und Beine. */
export function sheep(): BufferGeometry {
  return merge([
    colored(
      new IcosahedronGeometry(0.15, 1).scale(1, 0.85, 1.3).translate(0, 0.22, 0),
      PALETTE.wool,
    ),
    colored(new IcosahedronGeometry(0.09, 0).translate(0.04, 0.3, -0.06), PALETTE.woolShade),
    box(0.09, 0.09, 0.12, 0, 0.22, 0.21, PALETTE.sheepFace),
    box(0.04, 0.03, 0.03, -0.06, 0.29, 0.19, PALETTE.sheepFace),
    box(0.04, 0.03, 0.03, 0.06, 0.29, 0.19, PALETTE.sheepFace),
    box(0.04, 0.11, 0.04, -0.07, 0, 0.1, PALETTE.sheepFace),
    box(0.04, 0.11, 0.04, 0.07, 0, 0.1, PALETTE.sheepFace),
    box(0.04, 0.11, 0.04, -0.07, 0, -0.1, PALETTE.sheepFace),
    box(0.04, 0.11, 0.04, 0.07, 0, -0.1, PALETTE.sheepFace),
  ]);
}

/** Huhn: weißer Körper, roter Kamm, gelber Schnabel. */
export function chicken(): BufferGeometry {
  return merge([
    colored(
      new SphereGeometry(0.06, 6, 4).scale(1, 0.9, 1.2).translate(0, 0.08, 0),
      PALETTE.chicken,
    ),
    colored(new SphereGeometry(0.035, 5, 3).translate(0, 0.15, 0.05), PALETTE.chicken),
    box(0.015, 0.03, 0.04, 0, 0.18, 0.05, PALETTE.comb),
    colored(
      new ConeGeometry(0.012, 0.03, 4).rotateX(Math.PI / 2).translate(0, 0.15, 0.09),
      PALETTE.beak,
    ),
    box(0.03, 0.04, 0.03, 0, 0.09, -0.08, PALETTE.chicken),
    box(0.01, 0.04, 0.01, -0.02, 0, 0, PALETTE.beak),
    box(0.01, 0.04, 0.01, 0.02, 0, 0, PALETTE.beak),
  ]);
}

/** Katze, eingerollt dösend (Schwanz um den Körper). */
export function cat(): BufferGeometry {
  return merge([
    colored(
      new SphereGeometry(0.09, 7, 5).scale(1.3, 0.6, 1).translate(0, 0.05, 0),
      PALETTE.catFur,
    ),
    box(0.03, 0.02, 0.15, 0.03, 0.09, 0, PALETTE.catStripe),
    colored(new SphereGeometry(0.055, 6, 4).translate(0.1, 0.06, 0.05), PALETTE.catFur),
    colored(new ConeGeometry(0.018, 0.04, 4).translate(0.08, 0.12, 0.05), PALETTE.catStripe),
    colored(new ConeGeometry(0.018, 0.04, 4).translate(0.13, 0.12, 0.04), PALETTE.catStripe),
    colored(
      new CylinderGeometry(0.018, 0.022, 0.2, 5).rotateZ(Math.PI / 2).translate(-0.04, 0.02, 0.09),
      PALETTE.catStripe,
    ),
  ]);
}

/** Igel: stachliger brauner Rücken, helles Gesicht. */
export function hedgehog(): BufferGeometry {
  const parts = [
    colored(
      new SphereGeometry(0.07, 6, 4).scale(1, 0.7, 1.25).translate(0, 0.05, 0),
      PALETTE.hedgehog,
    ),
    colored(
      new ConeGeometry(0.03, 0.06, 5).rotateX(Math.PI / 2).translate(0, 0.04, 0.1),
      PALETTE.hedgehogFace,
    ),
    box(0.012, 0.012, 0.012, 0, 0.045, 0.13, PALETTE.sheepFace),
  ];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    parts.push(
      colored(
        new ConeGeometry(0.015, 0.05, 3).translate(
          Math.cos(a) * 0.04,
          0.1,
          Math.sin(a) * 0.05 - 0.02,
        ),
        PALETTE.sheepFace,
      ),
    );
  }
  return merge(parts);
}

/** Lagerfeuer: Steinkreis, Holzscheite, Flammen in Glutfarbe (leuchten nachts). */
export function campfire(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    parts.push(
      colored(
        new IcosahedronGeometry(0.07, 0).translate(Math.cos(a) * 0.28, 0.04, Math.sin(a) * 0.28),
        PALETTE.rock,
      ),
    );
  }
  for (let k = 0; k < 3; k++)
    parts.push(
      colored(
        new CylinderGeometry(0.035, 0.035, 0.36, 5)
          .rotateZ(Math.PI / 2)
          .rotateY((k * Math.PI) / 3)
          .translate(0, 0.05, 0),
        PALETTE.logDark,
      ),
    );
  parts.push(colored(new ConeGeometry(0.13, 0.36, 5).translate(0, 0.24, 0), PALETTE.glow));
  parts.push(
    colored(new ConeGeometry(0.07, 0.24, 5).translate(0.05, 0.2, 0.04), PALETTE.windowLight),
  );
  return merge(parts);
}

/** Glühbirne einer Lichterkette (Fensterlicht-Farbe: leuchtet nachts). */
export function bulb(): BufferGeometry {
  return merge([colored(new IcosahedronGeometry(0.045, 0), PALETTE.windowLight)]);
}

/** Bunte Glühbirne (Glutfarbe, leuchtet ebenfalls). */
export function bulbWarm(): BufferGeometry {
  return merge([colored(new IcosahedronGeometry(0.045, 0), PALETTE.glow)]);
}
