/**
 * Ereignisse, die die Simulation an Darstellung und Oberfläche meldet.
 * Sie werden einmal pro Bild abgeholt und danach verworfen.
 */
export type SimEvent =
  | { type: 'buildingAdded'; id: number }
  | { type: 'buildingRemoved'; id: number; buildingType: number; x: number; y: number; rot: number }
  | { type: 'treeChanged'; tile: number }
  | { type: 'harvested'; item: number; amount: number }
  | { type: 'commandFailed'; reason: number; buildingType: number };
