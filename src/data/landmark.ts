import { toAmounts, type ItemAmount, type ItemKey } from './items';

/**
 * Das Wahrzeichen: der Uhrturm. Er wächst in Bauabschnitten, die sich jeweils Waren wünschen.
 * Ganz ohne Druck: Man liefert, wann man will (per Band oder aus dem Vorrat), und bekommt für
 * jeden fertigen Abschnitt eine kleine Belohnung. Der Fortschritt gehört der Welt, nicht dem
 * Gebäude – wer den Turm abreißt und woanders neu baut, macht dort weiter.
 *
 * Reihenfolge = Bauabfolge; im Spielstand steht nur die Zahl der fertigen Abschnitte. Neue
 * Abschnitte deshalb nur hinten anhängen.
 */
export interface LandmarkStage {
  key: string;
  /** Was dieser Abschnitt braucht. */
  needs: Partial<Record<ItemKey, number>>;
  /** Belohnung, sobald er fertig ist. */
  reward: {
    /** Dauerhaft schnellere Verarbeitung (Anteil, 0,05 = +5 %). */
    crafterSpeed?: number;
    /** Dauerhaft schnellerer Abbau (Anteil). */
    extractorSpeed?: number;
    /** Gebäude, die freigeschaltet werden. */
    buildings?: readonly string[];
    /** Die Uhr läuft (Zeiger nach der echten Uhrzeit). */
    clock?: boolean;
    /** Die Glocke schlägt zur vollen Stunde. */
    bell?: boolean;
  };
}

export const LANDMARK_STAGES: readonly LandmarkStage[] = [
  {
    key: 'foundation',
    needs: { stone: 120, wood: 120 },
    reward: { extractorSpeed: 0.05 },
  },
  {
    key: 'walls',
    needs: { stoneBrick: 150, plank: 150 },
    reward: { buildings: ['fountain'] },
  },
  {
    key: 'chamber',
    needs: { frame: 40, copperWire: 150, copperSheet: 60 },
    reward: { crafterSpeed: 0.05 },
  },
  {
    key: 'clockwork',
    needs: { clockwork: 30, ironPlate: 60, coil: 40 },
    reward: { clock: true, extractorSpeed: 0.05 },
  },
  {
    key: 'belfry',
    needs: { lens: 40, glass: 60, ironPlate: 80, controlUnit: 20 },
    reward: { bell: true, crafterSpeed: 0.05 },
  },
  {
    key: 'spire',
    needs: { steelFrame: 60, copperSheet: 200, instrument: 10 },
    reward: { buildings: ['bandstand'], crafterSpeed: 0.05, extractorSpeed: 0.05 },
  },
];

/** Bedarf je Abschnitt mit numerischen Item-IDs. */
export const LANDMARK_NEEDS: readonly ItemAmount[][] = LANDMARK_STAGES.map((s) =>
  toAmounts(s.needs),
);
