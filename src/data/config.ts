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

export const SAVE_CONFIG = {
  /** Automatisch speichern alle … Sekunden (Echtzeit, nur im laufenden Spiel). */
  autosaveSeconds: 120,
  /** Dateiendung für Exporte. */
  fileExtension: '.fabrik',
} as const;

export const SOUND_CONFIG = {
  /** Gesamtlautstärke (0..1). */
  volume: 0.5,
  /** Lautstärke von Wind und Vögeln. */
  ambience: 0.05,
  /** Lautstärke der Arbeitsgeräusche, wenn viele Maschinen im Bild arbeiten. */
  machines: 0.07,
} as const;

/** Grafikstufen. „Ultra“ wählt das Spiel nie selbst, nur der Spieler. */
export type Quality = 'low' | 'medium' | 'high' | 'ultra';
export const QUALITIES: readonly Quality[] = ['low', 'medium', 'high', 'ultra'];

export interface QualityPreset {
  /** Echte Schatten (sonst dunkle Flecken unter den Gebäuden). */
  shadows: boolean;
  shadowMapSize: number;
  /** Weichere Schattenkanten. */
  softShadows: boolean;
  /** Höchstes Pixelverhältnis. */
  pixelRatio: number;
  /** Kantenglättung (wirkt nach Neuladen der Seite). */
  antialias: boolean;
  /** Blumen und Grasbüschel. */
  details: boolean;
  /** Bäume und Gras wiegen sich im Wind. */
  sway: boolean;
  /** Anteil der Partikel (Rauch, Funken, Staub). */
  particles: number;
  /** Wolkenschatten, Leuchten (Bloom), Regen, Glühwürmchen. */
  clouds: boolean;
  bloom: boolean;
  weather: boolean;
  fireflies: boolean;
}

export const QUALITY_PRESETS: Record<Quality, QualityPreset> = {
  low: {
    shadows: false,
    shadowMapSize: 512,
    softShadows: false,
    pixelRatio: 1,
    antialias: false,
    details: false,
    sway: false,
    particles: 0.4,
    clouds: false,
    bloom: false,
    weather: false,
    fireflies: false,
  },
  medium: {
    shadows: true,
    shadowMapSize: 1024,
    softShadows: false,
    pixelRatio: 1.25,
    antialias: true,
    details: true,
    sway: true,
    particles: 0.7,
    clouds: false,
    bloom: false,
    weather: false,
    fireflies: false,
  },
  high: {
    shadows: true,
    shadowMapSize: 2048,
    softShadows: false,
    pixelRatio: 2,
    antialias: true,
    details: true,
    sway: true,
    particles: 1,
    clouds: true,
    bloom: false,
    weather: false,
    fireflies: true,
  },
  ultra: {
    shadows: true,
    shadowMapSize: 4096,
    softShadows: true,
    pixelRatio: 2,
    antialias: true,
    details: true,
    sway: true,
    particles: 1,
    clouds: true,
    bloom: true,
    weather: true,
    fireflies: true,
  },
};

/** Automatische Wahl beim ersten Start: Messdauer und Grenzen der Bildrate. */
export const QUALITY_PROBE = {
  seconds: 4,
  /** Ab dieser Bildrate „Hoch“, ab der zweiten „Mittel“, sonst „Niedrig“. */
  highFps: 55,
  mediumFps: 38,
} as const;

/** Tag und Nacht (rein optisch). */
export const DAY_CONFIG = {
  /** Ein ganzer Tag in Sekunden Spielzeit (Auftraggeber: 20 Minuten). */
  daySeconds: 20 * 60,
  /** Tageszeit zu Spielbeginn (0 = Mitternacht, 0,5 = Mittag): früher Vormittag. */
  startTime: 0.3,
  /** Tageszeit, wenn der Wechsel abgeschaltet ist: goldener Nachmittag. */
  fixedTime: 0.55,
} as const;

/** Wetter (nur Ultra): leichte Regenschauer, gleich für jeden Spielstand mit gleicher Spielzeit. */
export const WEATHER_CONFIG = {
  /** Länge eines Wetterabschnitts in Sekunden Spielzeit. */
  slotSeconds: 150,
  /** Anteil der Abschnitte mit Regen. */
  rainChance: 0.22,
  /** Regentropfen im Bild. */
  drops: 1400,
} as const;
