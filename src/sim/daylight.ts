import { SOLAR } from '../data/balance';
import { DAY_CONFIG, SIM_CONFIG } from '../data/config';

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
