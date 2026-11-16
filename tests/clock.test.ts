import { describe, expect, it } from 'vitest';
import { chimeCount, clockHands, clockHandsNow, type ClockHands } from '../src/render/clock';

const TAU = Math.PI * 2;
const hands = (): ClockHands => ({ hour: 0, minute: 0 });

describe('Uhr am Uhrturm', () => {
  it('zeigt 12 Uhr mit beiden Zeigern oben', () => {
    const h = clockHands(0, 0, 0, hands());
    expect(h.hour).toBe(0);
    expect(h.minute).toBe(0);
  });

  it('3:00 → Stundenzeiger auf Viertel, Minutenzeiger oben', () => {
    const h = clockHands(15, 0, 0, hands());
    expect(h.hour).toBeCloseTo(TAU / 4);
    expect(h.minute).toBe(0);
  });

  it('Zeiger laufen gleichmäßig (3:30 → Stundenzeiger zwischen 3 und 4)', () => {
    const h = clockHands(3, 30, 0, hands());
    expect(h.minute).toBeCloseTo(TAU / 2);
    expect(h.hour).toBeCloseTo((3.5 / 12) * TAU);
  });

  it('liest die echte Uhrzeit aus einem Datum', () => {
    const h = clockHandsNow(hands(), new Date(2026, 10, 16, 9, 45, 0));
    expect(h.minute).toBeCloseTo((45 / 60) * TAU);
    expect(h.hour).toBeCloseTo((9.75 / 12) * TAU);
  });

  it('Glockenschlag nur zur vollen Stunde, 1–12 Schläge', () => {
    expect(chimeCount(0, 0)).toBe(12);
    expect(chimeCount(13, 0)).toBe(1);
    expect(chimeCount(12, 0)).toBe(12);
    expect(chimeCount(13, 1)).toBe(0);
  });
});
