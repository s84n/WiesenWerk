/**
 * Technische Grundwerte des Spiels. Balancing-Zahlen (Rezepte, Kosten, ...) kommen
 * in eigene Datendateien, sobald die jeweilige Phase sie braucht.
 */
export const SIM_CONFIG = {
  /** Feste Simulationsrate: 20 Ticks pro Sekunde, ein Tick = 50 ms. */
  ticksPerSecond: 20,
  /** Höchstens so viele Ticks werden pro Bild nachgeholt, danach läuft das Spiel langsamer. */
  maxTicksPerFrame: 5,
  /** Wählbare Spielgeschwindigkeiten (Faktor auf die Tickrate). */
  speeds: [1, 2, 3] as const,
} as const;

export const RENDER_CONFIG = {
  /** Obergrenze für das Pixelverhältnis (hochauflösende Displays). */
  maxPixelRatio: 2,
  /** Wie oft pro Sekunde Debug-Anzeige und Oberfläche höchstens aktualisiert werden. */
  uiUpdatesPerSecond: 4,
} as const;
