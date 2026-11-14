/**
 * Ereignisse, die die Simulation an Darstellung und Oberfläche meldet.
 * Sie werden einmal pro Bild abgeholt und danach verworfen.
 */
export type SimEvent =
  | { type: 'buildingAdded'; id: number }
  | {
      type: 'buildingRemoved';
      id: number;
      buildingType: number;
      x: number;
      y: number;
      rot: number;
      /** Rezept vor dem Abriss (−1 = keins), für „Rückgängig“. */
      recipe: number;
    }
  /** Bandfeld gedreht; `oldRot` = Richtung vorher (für „Rückgängig“). */
  | { type: 'buildingRotated'; id: number; oldRot: number }
  | { type: 'treeChanged'; tile: number }
  | { type: 'harvested'; item: number; amount: number }
  | { type: 'commandFailed'; reason: number; buildingType: number }
  /** Bandfeld durch eine andere Bandstufe ersetzt. */
  | { type: 'buildingReplaced'; id: number; oldType: number }
  /** Bergwerk oder Holzfäller auf Stufe 2 aufgewertet. */
  | { type: 'buildingUpgraded'; id: number }
  | { type: 'researched'; node: number }
  | { type: 'upgraded'; upgrade: number }
  | { type: 'goalCompleted'; goal: number }
  /** Blaupause eingefügt: so viele von allen Gebäuden wurden gebaut. */
  | { type: 'blueprintPlaced'; built: number; total: number };
