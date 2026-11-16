import { toAmounts, type ItemAmount, type ItemKey } from './items';

/**
 * Aufgaben in Kapiteln, die durchs ganze Spiel führen. Immer nur das aktuelle Kapitel wird
 * gezeigt und geprüft (`src/sim/goals.ts`). Alles freiwillig und ohne Zeitdruck: Ein Kapitel
 * schenkt zum Abschluss ein paar Waren.
 */
export type GoalCondition =
  /** So viel von einem Item von Hand gesammelt. */
  | { kind: 'harvest'; item: ItemKey; amount: number }
  /** Von jedem dieser Gebäude mindestens eins gebaut. */
  | { kind: 'build'; buildings: readonly string[] }
  /** Ein Gebäude dieser Art arbeitet gerade. */
  | { kind: 'working'; building: string }
  /** So viele Items per Band in der Zentrale angekommen. */
  | { kind: 'delivered'; amount: number }
  /** So viele Forschungsknoten erforscht. */
  | { kind: 'research'; count: number }
  /** Dieser Forschungsknoten ist erforscht. */
  | { kind: 'researched'; node: string }
  /** So viel von einem Item seit Spielbeginn hergestellt (Gesamtproduktion). */
  | { kind: 'produced'; item: ItemKey; amount: number }
  /** Produktion dieses Items in der letzten Minute mindestens so hoch (pro Minute). */
  | { kind: 'rate'; item: ItemKey; perMinute: number }
  /** So viele Abschnitte des Uhrturms fertig. */
  | { kind: 'landmark'; stage: number }
  /** Mindestens ein Gebäude auf dieser Stufe (2 oder 3). */
  | { kind: 'level'; level: number };

export interface GoalDef {
  key: string;
  condition: GoalCondition;
}

/** Alle Aufgaben. Im Spielstand stehen die Schlüssel; neue hinten anhängen. */
export const GOALS: readonly GoalDef[] = [
  // Kapitel 1
  { key: 'harvestWood', condition: { kind: 'harvest', item: 'wood', amount: 10 } },
  { key: 'buildHq', condition: { kind: 'build', buildings: ['hq'] } },
  { key: 'lumberjackWorking', condition: { kind: 'working', building: 'lumberjack' } },
  { key: 'buildPower', condition: { kind: 'build', buildings: ['burner', 'pole'] } },
  { key: 'minerWorking', condition: { kind: 'working', building: 'miner' } },
  { key: 'beltToHq', condition: { kind: 'delivered', amount: 1 } },
  { key: 'firstResearch', condition: { kind: 'research', count: 1 } },
  // Kapitel 2: Schmelzen und Sägen
  { key: 'furnaceWorking', condition: { kind: 'working', building: 'furnace' } },
  { key: 'workshopWorking', condition: { kind: 'working', building: 'workshop' } },
  { key: 'produceIngots', condition: { kind: 'produced', item: 'copperIngot', amount: 100 } },
  { key: 'buildTower', condition: { kind: 'build', buildings: ['clockTower'] } },
  { key: 'researchLogistics', condition: { kind: 'researched', node: 'logistics1' } },
  // Kapitel 3: Zusammen geht's
  { key: 'buildMerger', condition: { kind: 'build', buildings: ['merger'] } },
  { key: 'ingotRate', condition: { kind: 'rate', item: 'copperIngot', perMinute: 80 } },
  { key: 'towerFoundation', condition: { kind: 'landmark', stage: 1 } },
  { key: 'researchAssembler', condition: { kind: 'researched', node: 'assembler' } },
  { key: 'produceFrames', condition: { kind: 'produced', item: 'frame', amount: 20 } },
  // Kapitel 4: Die Manufaktur
  { key: 'produceCoils', condition: { kind: 'produced', item: 'coil', amount: 30 } },
  { key: 'towerWalls', condition: { kind: 'landmark', stage: 2 } },
  { key: 'researchBelts2', condition: { kind: 'researched', node: 'logistics2' } },
  { key: 'researchIron', condition: { kind: 'researched', node: 'ironworking' } },
  { key: 'researchDrives', condition: { kind: 'researched', node: 'drives' } },
  // Kapitel 5: Eisen und Glas
  { key: 'produceIron', condition: { kind: 'produced', item: 'ironIngot', amount: 100 } },
  { key: 'produceGlass', condition: { kind: 'produced', item: 'glass', amount: 50 } },
  { key: 'towerChamber', condition: { kind: 'landmark', stage: 3 } },
  { key: 'firstLevel2', condition: { kind: 'level', level: 2 } },
  // Kapitel 6: Feinmechanik
  { key: 'researchPrecision', condition: { kind: 'researched', node: 'precision' } },
  { key: 'produceClockwork', condition: { kind: 'produced', item: 'clockwork', amount: 30 } },
  { key: 'towerClockwork', condition: { kind: 'landmark', stage: 4 } },
  { key: 'researchSteel', condition: { kind: 'researched', node: 'steelmaking' } },
  { key: 'produceSteelFrames', condition: { kind: 'produced', item: 'steelFrame', amount: 20 } },
  // Kapitel 7: Vollendung
  { key: 'researchOptics', condition: { kind: 'researched', node: 'optics' } },
  { key: 'towerBelfry', condition: { kind: 'landmark', stage: 5 } },
  { key: 'researchHighPerformance', condition: { kind: 'researched', node: 'highPerformance' } },
  { key: 'firstLevel3', condition: { kind: 'level', level: 3 } },
  { key: 'towerDone', condition: { kind: 'landmark', stage: 6 } },
];

export interface ChapterDef {
  key: string;
  /** Schlüssel der Aufgaben in diesem Kapitel (in Anzeigereihenfolge). */
  goals: readonly string[];
  /** Geschenk zum Abschluss (geht in den Vorrat). */
  reward: Partial<Record<ItemKey, number>>;
}

/** Kapitel in Spielreihenfolge. Im Spielstand als `chapter:<Schlüssel>` in der Liste der erledigten. */
export const CHAPTERS: readonly ChapterDef[] = [
  {
    key: 'start',
    goals: [
      'harvestWood',
      'buildHq',
      'lumberjackWorking',
      'buildPower',
      'minerWorking',
      'beltToHq',
      'firstResearch',
    ],
    reward: { wood: 50, stone: 50 },
  },
  {
    key: 'smelting',
    goals: [
      'furnaceWorking',
      'workshopWorking',
      'produceIngots',
      'buildTower',
      'researchLogistics',
    ],
    reward: { plank: 60, copperIngot: 40 },
  },
  {
    key: 'together',
    goals: ['buildMerger', 'ingotRate', 'towerFoundation', 'researchAssembler', 'produceFrames'],
    reward: { stoneBrick: 80, copperSheet: 30 },
  },
  {
    key: 'assembly',
    goals: ['produceCoils', 'towerWalls', 'researchBelts2', 'researchIron', 'researchDrives'],
    reward: { frame: 20, coil: 20 },
  },
  {
    key: 'ironGlass',
    goals: ['produceIron', 'produceGlass', 'towerChamber', 'firstLevel2'],
    reward: { motor: 10, ironIngot: 60 },
  },
  {
    key: 'precision',
    goals: [
      'researchPrecision',
      'produceClockwork',
      'towerClockwork',
      'researchSteel',
      'produceSteelFrames',
    ],
    reward: { clockwork: 10, steel: 30 },
  },
  {
    key: 'completion',
    goals: ['researchOptics', 'towerBelfry', 'researchHighPerformance', 'firstLevel3', 'towerDone'],
    reward: { instrument: 5, steelFrame: 10 },
  },
];

export const GOAL_ID = Object.fromEntries(GOALS.map((g, i) => [g.key, i])) as Record<
  string,
  number
>;

/** Aufgaben-IDs je Kapitel. */
export const CHAPTER_GOALS: readonly number[][] = CHAPTERS.map((c) =>
  c.goals.map((k) => GOAL_ID[k]),
);

/** Geschenke je Kapitel mit numerischen Item-IDs. */
export const CHAPTER_REWARDS: readonly ItemAmount[][] = CHAPTERS.map((c) => toAmounts(c.reward));

/** Bedingungen werden alle so viele Ticks geprüft. */
export const GOAL_CHECK_TICKS = 20;
