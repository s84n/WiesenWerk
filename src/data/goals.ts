import type { ItemKey } from './items';

/**
 * Aufgabenliste „Erste Schritte“. Die Bedingungen prüft `src/sim/goals.ts` regelmäßig.
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
  | { kind: 'research'; count: number };

export interface GoalDef {
  key: string;
  condition: GoalCondition;
}

export const GOALS: readonly GoalDef[] = [
  { key: 'harvestWood', condition: { kind: 'harvest', item: 'wood', amount: 10 } },
  { key: 'buildHq', condition: { kind: 'build', buildings: ['hq'] } },
  { key: 'lumberjackWorking', condition: { kind: 'working', building: 'lumberjack' } },
  { key: 'buildPower', condition: { kind: 'build', buildings: ['burner', 'pole'] } },
  { key: 'minerWorking', condition: { kind: 'working', building: 'miner' } },
  { key: 'beltToHq', condition: { kind: 'delivered', amount: 1 } },
  { key: 'firstResearch', condition: { kind: 'research', count: 1 } },
];

/** Bedingungen werden alle so viele Ticks geprüft. */
export const GOAL_CHECK_TICKS = 20;
