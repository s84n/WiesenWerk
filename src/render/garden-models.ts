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
 * Gärten (Ausbaurunde Gemütlichkeit): feste Teile als Gebäudemodell (Beetrahmen, Erde, Zaun,
 * Glashaus), die wachsenden Pflanzen als eigene kleine Modelle, die `GardenView` je nach
 * Wachstum einsetzt und skaliert. Ursprung = Mitte der Grundfläche, vorne = +z.
 * Blätter nutzen die Laubfarben, damit sie im Wind wiegen (Shader in `atmosphere.ts`).
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

/** Holzrahmen eines Beetes (Breite × Tiefe) mit Erde darin. */
function bedFrame(w: number, d: number, x: number, z: number): BufferGeometry[] {
  const t = 0.07;
  const h = 0.14;
  return [
    box(w, h, t, x, 0, z - d / 2 + t / 2, PALETTE.wood),
    box(w, h, t, x, 0, z + d / 2 - t / 2, PALETTE.wood),
    box(t, h, d - 2 * t, x - w / 2 + t / 2, 0, z, PALETTE.woodDark),
    box(t, h, d - 2 * t, x + w / 2 - t / 2, 0, z, PALETTE.woodDark),
    box(w - 2 * t, 0.1, d - 2 * t, x, 0, z, PALETTE.gardenSoil),
  ];
}

/** Gemüsebeet 2 × 2: zwei Hochbeete mit Furchen, Weg dazwischen, Gießkanne und Werkzeugkiste. */
export function vegetableBed(): BufferGeometry {
  const parts = [
    ...bedFrame(1.6, 0.7, 0, -0.45),
    ...bedFrame(1.6, 0.7, 0, 0.45),
    // Furchen
    box(1.4, 0.02, 0.06, 0, 0.1, -0.6, PALETTE.gardenSoilDark),
    box(1.4, 0.02, 0.06, 0, 0.1, -0.3, PALETTE.gardenSoilDark),
    box(1.4, 0.02, 0.06, 0, 0.1, 0.3, PALETTE.gardenSoilDark),
    box(1.4, 0.02, 0.06, 0, 0.1, 0.6, PALETTE.gardenSoilDark),
    // Trittplatten am Rand
    box(0.18, 0.03, 0.18, 0.88, 0, -0.05, PALETTE.pathStone),
    box(0.18, 0.03, 0.18, 0.88, 0, 0.2, PALETTE.pathStone),
    // Gießkanne
    colored(new CylinderGeometry(0.06, 0.07, 0.12, 7).translate(-0.86, 0.06, 0.82), PALETTE.patina),
    box(0.12, 0.02, 0.02, -0.78, 0.1, 0.82, PALETTE.patina),
  ];
  return merge(parts);
}

/** Blumenwiese 2 × 2: Rasenstück mit Feldsteinen am Rand und einem kleinen Holzschild. */
export function flowerMeadow(): BufferGeometry {
  const parts = [box(1.86, 0.05, 1.86, 0, 0, 0, PALETTE.meadowLight)];
  const stones: [number, number, number][] = [
    [-0.9, -0.7, 0.12],
    [-0.55, -0.92, 0.1],
    [0.88, 0.6, 0.13],
    [0.5, 0.92, 0.09],
    [0.92, -0.85, 0.1],
    [-0.92, 0.85, 0.11],
  ];
  for (const [x, z, r] of stones)
    parts.push(
      colored(new IcosahedronGeometry(r, 0).scale(1, 0.55, 1).translate(x, 0.05, z), PALETTE.rock),
    );
  // Schild
  parts.push(box(0.04, 0.32, 0.04, 0.8, 0.05, 0.8, PALETTE.woodDark));
  parts.push(box(0.26, 0.14, 0.03, 0.8, 0.3, 0.82, PALETTE.wood));
  return merge(parts);
}

/** Bienenstock: geflochtener Korb (Strohringe) auf einem Holzbänkchen. */
export function beehive(): BufferGeometry {
  const parts = [
    box(0.08, 0.22, 0.08, -0.25, 0, -0.18, PALETTE.woodDark),
    box(0.08, 0.22, 0.08, 0.25, 0, -0.18, PALETTE.woodDark),
    box(0.08, 0.22, 0.08, -0.25, 0, 0.18, PALETTE.woodDark),
    box(0.08, 0.22, 0.08, 0.25, 0, 0.18, PALETTE.woodDark),
    box(0.7, 0.06, 0.5, 0, 0.22, 0, PALETTE.wood),
  ];
  const rings = [0.24, 0.23, 0.21, 0.17, 0.11];
  for (let k = 0; k < rings.length; k++) {
    const r = rings[k];
    const next = rings[k + 1] ?? r * 0.4;
    parts.push(
      colored(
        new CylinderGeometry(next, r, 0.1, 10).translate(0, 0.33 + k * 0.1, 0),
        k % 2 ? PALETTE.strawDark : PALETTE.straw,
      ),
    );
  }
  // Flugloch
  parts.push(box(0.09, 0.05, 0.02, 0, 0.29, 0.235, PALETTE.beeStripe));
  return merge(parts);
}

/** Obstgarten 3 × 3: Wiese, niedriger Staketenzaun mit Tor, Leiter und Erntekorb. */
export function orchard(): BufferGeometry {
  const parts = [box(2.84, 0.04, 2.84, 0, 0, 0, PALETTE.meadowLight)];
  const half = 1.38;
  // Zaunpfähle rundherum, vorne in der Mitte ein Tor (Lücke)
  for (let k = 0; k <= 10; k++) {
    const u = -half + (k * 2 * half) / 10;
    parts.push(box(0.05, 0.3, 0.05, u, 0, -half, PALETTE.trim));
    parts.push(box(0.05, 0.3, 0.05, -half, 0, u, PALETTE.trim));
    parts.push(box(0.05, 0.3, 0.05, half, 0, u, PALETTE.trim));
    if (Math.abs(u) > 0.3) parts.push(box(0.05, 0.3, 0.05, u, 0, half, PALETTE.trim));
  }
  parts.push(box(2 * half, 0.04, 0.03, 0, 0.2, -half, PALETTE.trim));
  parts.push(box(0.03, 0.04, 2 * half, -half, 0.2, 0, PALETTE.trim));
  parts.push(box(0.03, 0.04, 2 * half, half, 0.2, 0, PALETTE.trim));
  parts.push(box(half - 0.3, 0.04, 0.03, -(half + 0.3) / 2, 0.2, half, PALETTE.trim));
  parts.push(box(half - 0.3, 0.04, 0.03, (half + 0.3) / 2, 0.2, half, PALETTE.trim));
  // Erntekorb und angelehnte Leiter
  parts.push(
    colored(
      new CylinderGeometry(0.13, 0.1, 0.14, 8).translate(0.55, 0.04, 1.05),
      PALETTE.strawDark,
    ),
  );
  parts.push(box(0.18, 0.04, 0.18, 0.55, 0.16, 1.05, PALETTE.apple));
  const lean = 0.25;
  for (const x of [-0.95, -0.75])
    parts.push(
      colored(
        new BoxGeometry(0.04, 0.9, 0.04).translate(0, 0.45, 0).rotateX(-lean).translate(x, 0, 1.0),
        PALETTE.wood,
      ),
    );
  for (let k = 0; k < 4; k++) {
    const h = 0.15 + k * 0.2;
    parts.push(
      box(0.22, 0.03, 0.03, -0.85, h * Math.cos(lean), 1.0 - h * Math.sin(lean), PALETTE.wood),
    );
  }
  return merge(parts);
}

/** Gewächshaus 3 × 3: weißer Rahmen, Glasdach in Streifen, zwei Pflanztische, Hängelampen. */
export function greenhouse(): BufferGeometry {
  const W = 2.6;
  const D = 2.6;
  const wallH = 0.9;
  const ridge = 1.55;
  const parts = [
    box(W + 0.1, 0.12, D + 0.1, 0, 0, 0, PALETTE.stoneWallLight),
    // Pflanztische (Erde darauf) links und rechts, Gang in der Mitte
    box(0.8, 0.28, 2.2, -0.7, 0.12, 0, PALETTE.wood),
    box(0.72, 0.04, 2.1, -0.7, 0.4, 0, PALETTE.gardenSoil),
    box(0.8, 0.28, 2.2, 0.7, 0.12, 0, PALETTE.wood),
    box(0.72, 0.04, 2.1, 0.7, 0.4, 0, PALETTE.gardenSoil),
  ];
  const F = PALETTE.greenhouseFrame;
  // Eckpfosten und senkrechte Sprossen
  for (const x of [-W / 2, -W / 4, 0, W / 4, W / 2]) {
    parts.push(box(0.05, wallH, 0.05, x, 0.12, -D / 2, F));
    if (Math.abs(x) > 0.35) parts.push(box(0.05, wallH, 0.05, x, 0.12, D / 2, F));
  }
  for (const z of [-D / 2, -D / 4, 0, D / 4, D / 2]) {
    parts.push(box(0.05, wallH, 0.05, -W / 2, 0.12, z, F));
    parts.push(box(0.05, wallH, 0.05, W / 2, 0.12, z, F));
  }
  // Rahmen oben und Sockelleiste
  parts.push(box(W, 0.05, 0.05, 0, 0.12 + wallH, -D / 2, F));
  parts.push(box(W, 0.05, 0.05, 0, 0.12 + wallH, D / 2, F));
  parts.push(box(0.05, 0.05, D, -W / 2, 0.12 + wallH, 0, F));
  parts.push(box(0.05, 0.05, D, W / 2, 0.12 + wallH, 0, F));
  // Tür vorne (Rahmen)
  parts.push(box(0.7, 0.05, 0.05, 0, 0.12 + 0.82, D / 2, F));
  // Satteldach: Glasstreifen mit Sprossen, Lücken dazwischen zeigen die Pflanzen
  const slope = Math.atan2(ridge - wallH, W / 2);
  const len = Math.hypot(W / 2, ridge - wallH);
  for (const side of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const z = -D / 2 + 0.33 + k * 0.65;
      const pane = box(len, 0.02, 0.42, 0, 0, 0, PALETTE.glassPane)
        .rotateZ(side * -slope)
        .translate((side * W) / 4, 0.12 + (wallH + ridge) / 2, z);
      parts.push(pane);
    }
    for (let k = 0; k <= 4; k++) {
      const z = -D / 2 + k * 0.65;
      parts.push(
        box(len, 0.04, 0.05, 0, 0, 0, F)
          .rotateZ(side * -slope)
          .translate((side * W) / 4, 0.12 + (wallH + ridge) / 2 + 0.02, z),
      );
    }
  }
  parts.push(box(0.06, 0.06, D + 0.05, 0, 0.12 + ridge, 0, F));
  // Hängelampen unter dem First (leuchten nachts über die Fensterfarbe)
  for (const z of [-0.7, 0.7]) {
    parts.push(box(0.015, 0.3, 0.015, 0, 0.12 + ridge - 0.3, z, PALETTE.metalDark));
    parts.push(box(0.12, 0.12, 0.12, 0, 0.12 + ridge - 0.42, z, PALETTE.windowLight));
  }
  return merge(parts);
}

// ------------------------------------------------------------------ wachsende Pflanzen

/** Keimling: zwei kleine Blättchen. */
function sprout(): BufferGeometry {
  return merge([
    box(0.015, 0.06, 0.015, 0, 0, 0, PALETTE.seedling),
    box(0.08, 0.012, 0.035, -0.03, 0.06, 0, PALETTE.seedling),
    box(0.08, 0.012, 0.035, 0.03, 0.065, 0, PALETTE.seedling),
  ]);
}

/** Junge Pflanze: lockere Blattrosette. */
function leafy(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    parts.push(
      colored(
        new ConeGeometry(0.05, 0.16, 4).rotateZ(0.7).translate(0.05, 0.06, 0).rotateY(a),
        k % 2 ? PALETTE.leafLight : PALETTE.leaf,
      ),
    );
  }
  return merge(parts);
}

/** Kohlkopf: runder Kopf in hellem Grün mit äußeren Blättern. */
function cabbage(): BufferGeometry {
  const parts = [
    colored(
      new IcosahedronGeometry(0.1, 1).scale(1, 0.85, 1).translate(0, 0.09, 0),
      PALETTE.cabbage,
    ),
  ];
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.4;
    parts.push(
      colored(
        new SphereGeometry(0.08, 5, 3, 0, Math.PI * 2, 0, Math.PI / 2)
          .scale(1.1, 0.5, 0.8)
          .translate(0.1, 0.02, 0)
          .rotateY(a),
        PALETTE.cabbageDark,
      ),
    );
  }
  return merge(parts);
}

/** Kürbis mit Ranke. */
function pumpkin(): BufferGeometry {
  return merge([
    colored(
      new SphereGeometry(0.11, 8, 5).scale(1.15, 0.8, 1.15).translate(0, 0.09, 0),
      PALETTE.pumpkin,
    ),
    box(0.025, 0.05, 0.025, 0, 0.17, 0, PALETTE.leafDark),
    colored(new ConeGeometry(0.06, 0.12, 4).rotateZ(1.2).translate(0.12, 0.04, 0.04), PALETTE.leaf),
  ]);
}

/** Blumenstängel mit Blättern (vor der Blüte). */
function stems(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const spots: [number, number, number][] = [
    [0, 0, 0.26],
    [0.07, 0.04, 0.2],
    [-0.06, 0.05, 0.22],
    [0.02, -0.07, 0.18],
  ];
  for (const [x, z, h] of spots) {
    parts.push(box(0.014, h, 0.014, x, 0, z, PALETTE.leafDark));
    parts.push(box(0.06, 0.01, 0.025, x + 0.02, h * 0.45, z, PALETTE.leaf));
  }
  return merge(parts);
}

/** Blüten als bunter Büschel (zwei Farbvarianten). */
function blooms(variant: number): BufferGeometry {
  const colors =
    variant === 0
      ? [PALETTE.flowerYellow, PALETTE.flowerPink, PALETTE.flowerWhite, PALETTE.flowerViolet]
      : [PALETTE.flowerViolet, PALETTE.flowerWhite, PALETTE.blossom, PALETTE.flowerYellow];
  const spots: [number, number, number][] = [
    [0, 0, 0.27],
    [0.07, 0.04, 0.21],
    [-0.06, 0.05, 0.23],
    [0.02, -0.07, 0.19],
  ];
  return merge(
    spots.map(([x, z, h], k) =>
      colored(new IcosahedronGeometry(0.045, 0).scale(1, 0.6, 1).translate(x, h, z), colors[k]),
    ),
  );
}

/** Apfelbaum (ausgewachsen 1 hoch): Stamm und runde Krone. */
function appleTree(): BufferGeometry {
  return merge([
    colored(new CylinderGeometry(0.05, 0.07, 0.5, 6).translate(0, 0.25, 0), PALETTE.trunk),
    colored(new IcosahedronGeometry(0.34, 1).scale(1, 0.85, 1).translate(0, 0.72, 0), PALETTE.leaf),
    colored(new IcosahedronGeometry(0.22, 1).translate(0.14, 0.88, 0.1), PALETTE.leafLight),
  ]);
}

/** Blüten auf der Krone (passend zu `appleTree`). */
function treeBlossoms(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  for (let k = 0; k < 14; k++) {
    const a = k * 2.4;
    const h = 0.55 + ((k * 37) % 10) * 0.04;
    const r = 0.3 + ((k * 13) % 5) * 0.012;
    parts.push(
      colored(
        new IcosahedronGeometry(0.05, 0).translate(Math.cos(a) * r, h, Math.sin(a) * r),
        k % 3 ? PALETTE.blossom : PALETTE.flowerWhite,
      ),
    );
  }
  return merge(parts);
}

/** Rote Äpfel in der Krone. */
function apples(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  for (let k = 0; k < 9; k++) {
    const a = k * 2.1 + 0.5;
    const h = 0.55 + ((k * 29) % 8) * 0.04;
    const r = 0.33;
    parts.push(
      colored(
        new SphereGeometry(0.065, 6, 4).translate(Math.cos(a) * r, h, Math.sin(a) * r),
        PALETTE.apple,
      ),
    );
  }
  return merge(parts);
}

/** Biene: gelber Körper mit dunklen Streifen und hellen Flügeln. */
function bee(): BufferGeometry {
  return merge([
    box(0.05, 0.035, 0.07, 0, 0, 0, PALETTE.bee),
    box(0.052, 0.037, 0.014, 0, 0, 0.01, PALETTE.beeStripe),
    box(0.052, 0.037, 0.014, 0, 0, -0.018, PALETTE.beeStripe),
    box(0.1, 0.006, 0.03, 0, 0.03, 0, PALETTE.flowerWhite),
  ]);
}

export const PLANT_MODELS = {
  sprout,
  leafy,
  cabbage,
  pumpkin,
  stems,
  blooms0: () => blooms(0),
  blooms1: () => blooms(1),
  appleTree,
  treeBlossoms,
  apples,
  bee,
} as const;
export type PlantModel = keyof typeof PLANT_MODELS;

/** Was in einem Garten wächst und wo (Gebäudekoordinaten x, z). */
export interface GardenLayout {
  kind: 'vegetable' | 'flower' | 'tree';
  points: readonly (readonly [number, number])[];
}

function grid(xs: readonly number[], zs: readonly number[]): [number, number][] {
  const out: [number, number][] = [];
  for (const z of zs) for (const x of xs) out.push([x, z]);
  return out;
}

export const GARDEN_LAYOUTS: Record<string, readonly GardenLayout[]> = {
  vegetableBed: [
    { kind: 'vegetable', points: grid([-0.55, -0.18, 0.18, 0.55], [-0.6, -0.3, 0.3, 0.6]) },
  ],
  flowerMeadow: [
    {
      kind: 'flower',
      points: [
        [-0.6, -0.55],
        [-0.1, -0.65],
        [0.45, -0.5],
        [-0.45, -0.1],
        [0.05, -0.15],
        [0.55, 0.0],
        [-0.65, 0.4],
        [-0.15, 0.35],
        [0.3, 0.45],
        [0.0, 0.75],
        [-0.45, 0.75],
        [0.62, -0.75],
        [-0.3, -0.35],
        [0.3, -0.3],
        [-0.75, 0.1],
        [0.75, 0.3],
        [0.5, 0.75],
        [-0.25, 0.6],
      ],
    },
  ],
  orchard: [
    {
      kind: 'tree',
      points: [
        [-0.75, -0.75],
        [0.75, -0.75],
        [0, -0.1],
        [-0.75, 0.55],
        [0.75, 0.55],
      ],
    },
    {
      kind: 'flower',
      points: [
        [-0.2, 0.9],
        [0.25, 0.75],
        [1.05, 1.05],
        [-1.1, -0.1],
      ],
    },
  ],
  greenhouse: [
    { kind: 'vegetable', points: grid([-0.88, -0.52], [-0.8, -0.27, 0.27, 0.8]) },
    { kind: 'flower', points: grid([0.52, 0.88], [-0.8, -0.27, 0.27, 0.8]) },
  ],
};

/** Höhe der Pflanzfläche je Garten (Erde im Beet, auf dem Pflanztisch …). */
export const GARDEN_GROUND: Record<string, number> = {
  vegetableBed: 0.1,
  flowerMeadow: 0.05,
  orchard: 0.04,
  greenhouse: 0.44,
};
