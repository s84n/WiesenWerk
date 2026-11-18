/**
 * Musikstücke. Die Dateien (MP3 oder OGG) gehören nach `public/audio/musik/`, hier steht nur der
 * Dateiname, z. B. 'morgenwiese.mp3'. Ist die Liste leer oder fehlt eine Datei, läuft das Spiel
 * einfach ohne Musik weiter.
 */
export const MUSIC_TRACKS: readonly string[] = [
  'wiesenwerk-1.mp3',
  'wiesenwerk-2.mp3',
  'wiesenwerk-3.mp3',
  'wiesenwerk-4.mp3',
  'wiesenwerk-5.mp3',
];

export const MUSIC_CONFIG = {
  /** Ordner relativ zur Seite. */
  folder: 'audio/musik/',
  /** Überblenden in Sekunden. */
  crossfadeSeconds: 3,
  /** Pause zwischen zwei Stücken in Sekunden. */
  gapSeconds: 1.5,
} as const;
