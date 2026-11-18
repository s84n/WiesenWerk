import { SOLAR } from '../data/balance';
import { DAY_CONFIG, SEASON_CONFIG, SIM_CONFIG } from '../data/config';

/**
 * Tageszeit (0 = Mitternacht, 0,5 = Mittag) zum Tick. Dieselbe Rechnung nutzt die Darstellung
 * für Sonnenstand und Licht, damit Solarfelder genau dann Strom liefern, wenn die Sonne scheint.
 * `cycle = false` (Tag-Nacht-Wechsel in den Einstellungen aus): fester Nachmittag.
 */
export function dayTimeAt(tick: number, cycle: boolean): number {
  if (!cycle) return DAY_CONFIG.fixedTime;
  const seconds = tick / SIM_CONFIG.ticksPerSecond;
  return (DAY_CONFIG.startTime + seconds / DAY_CONFIG.daySeconds) % 1;
}

/**
 * Jahreszeit zum Tick als fortlaufende Zahl 0..4 (0 = Frühlingsbeginn, 1 = Sommer, 2 = Herbst,
 * 3 = Winter). Ganzzahliger Teil = Jahreszeit, Rest = wie weit sie fortgeschritten ist. Das Spiel
 * beginnt im Frühling. `enabled = false`: fester Sommer (Mitte).
 */
export function seasonAt(tick: number, enabled: boolean): number {
  if (!enabled) return SEASON_CONFIG.fixedSeason + 0.5;
  const days = tick / SIM_CONFIG.ticksPerSecond / DAY_CONFIG.daySeconds;
  return (days / SEASON_CONFIG.daysPerSeason) % 4;
}

/**
 * Anteile der vier Jahreszeiten (Summe 1) zu `seasonAt`: am Ende jeder Jahreszeit ein weicher
 * Übergang in die nächste (`SEASON_CONFIG.blend`). Schreibt in `out` (keine Speicherzuweisung).
 */
export function seasonWeights(season: number, out: number[]): number[] {
  out[0] = out[1] = out[2] = out[3] = 0;
  const i = Math.floor(season) % 4;
  const f = season - Math.floor(season);
  const start = 1 - SEASON_CONFIG.blend;
  const next = f <= start ? 0 : smooth(start, 1, f);
  out[i] = 1 - next;
  out[(i + 1) % 4] += next;
  return out;
}

/** Sonnenstärke in Tausendsteln (0 nachts, 1000 tagsüber, weiche Übergänge morgens und abends). */
export function sunlightAt(tick: number, cycle: boolean): number {
  const t = dayTimeAt(tick, cycle);
  const rise = smooth(SOLAR.riseStart, SOLAR.riseEnd, t);
  const set = 1 - smooth(SOLAR.setStart, SOLAR.setEnd, t);
  return Math.round(1000 * Math.min(rise, set));
}

function smooth(a: number, b: number, t: number): number {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
}
