/**
 * Musikstücke. Die Dateien (MP3 oder OGG) gehören nach `public/audio/musik/`, hier steht nur der
 * Dateiname, z. B. 'morgenwiese.mp3'. Ist die Liste leer oder fehlt eine Datei, läuft das Spiel
 * einfach ohne Musik weiter.
 */
export const MUSIC_TRACKS: readonly string[] = [];

export const MUSIC_CONFIG = {
  /** Ordner relativ zur Seite. */
  folder: 'audio/musik/',
  /** Überblenden in Sekunden. */
  crossfadeSeconds: 4,
  /** Pause zwischen zwei Stücken in Sekunden. */
  gapSeconds: 6,
} as const;
