import { describe, expect, it } from 'vitest';
import { DAY_CONFIG, SEASON_CONFIG, SIM_CONFIG } from '../src/data/config';
import { seasonAt, seasonWeights } from '../src/sim/daylight';

const SEASON_TICKS =
  SEASON_CONFIG.daysPerSeason * DAY_CONFIG.daySeconds * SIM_CONFIG.ticksPerSecond;

describe('Jahreszeiten', () => {
  it('beginnen im Frühling und folgen aufeinander, nach dem Winter wieder Frühling', () => {
    expect(Math.floor(seasonAt(0, true))).toBe(0);
    expect(Math.floor(seasonAt(SEASON_TICKS * 1.5, true))).toBe(1);
    expect(Math.floor(seasonAt(SEASON_TICKS * 2.5, true))).toBe(2);
    expect(Math.floor(seasonAt(SEASON_TICKS * 3.5, true))).toBe(3);
    expect(Math.floor(seasonAt(SEASON_TICKS * 4.5, true))).toBe(0);
  });

  it('abgeschaltet: immer Sommer', () => {
    for (const t of [0, SEASON_TICKS * 2.7, SEASON_TICKS * 3.2])
      expect(Math.floor(seasonAt(t, false))).toBe(SEASON_CONFIG.fixedSeason);
  });

  it('Anteile ergeben immer 1, mit weichem Übergang am Ende einer Jahreszeit', () => {
    const w = [0, 0, 0, 0];
    for (let s = 0; s < 4; s += 0.01) {
      seasonWeights(s, w);
      expect(w[0] + w[1] + w[2] + w[3]).toBeCloseTo(1, 6);
    }
    // Mitte des Herbstes: nur Herbst
    expect(seasonWeights(2.5, w)).toEqual([0, 0, 1, 0]);
    // kurz vor Ende des Winters: schon etwas Frühling
    seasonWeights(3.97, w);
    expect(w[3]).toBeGreaterThan(0);
    expect(w[0]).toBeGreaterThan(0);
  });
});
