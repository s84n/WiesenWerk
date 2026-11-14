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
  /** Gelände wird in Blöcken dieser Kantenlänge (Felder) gezeichnet – ein Zeichenaufruf je Block. */
  terrainBlockSize: 32,
  /** Unterhalb dieser Zoomstufe (sichtbare Höhe in Feldern) werden Blumen und Kleinkram gezeichnet. */
  detailMaxViewHeight: 45,
  /** Ab dieser Zoomstufe werden Bäume vereinfacht gezeichnet und Schatten abgeschaltet. */
  lodViewHeight: 55,
  /** Anteil der Wiesenfelder mit Blumen bzw. Grasbüscheln. */
  flowerDensity: 0.1,
  tuftDensity: 0.18,
  /** Höhe der Wasseroberfläche. */
  waterLevel: -0.22,
  /** Größte Kantenlänge des Schattenbereichs in Feldern. */
  shadowMaxExtent: 70,
  shadowMapSize: 2048,
} as const;

export const CAMERA_CONFIG = {
  /** Sichtbare Höhe in Feldern: Start, kleinster und größter Wert. */
  viewHeightStart: 30,
  viewHeightMin: 8,
  viewHeightMax: 110,
  /** Neigung der Kamera (klassischer Iso-Winkel ≈ 35,26°). */
  elevationDeg: 35.264,
  /** Abstand der Kamera zum Blickpunkt (nur für Tiefe und Nebel relevant). */
  distance: 200,
  /** Verschiebetempo mit der Tastatur: sichtbare Höhen pro Sekunde. */
  keyPanSpeed: 1.1,
  /** Zoomempfindlichkeit des Mausrads. */
  wheelZoomSpeed: 0.0015,
  /** Glättung: höher = schneller am Ziel. */
  smoothing: 12,
} as const;
