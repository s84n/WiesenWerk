/**
 * Zeigerwinkel für die Uhr am Uhrturm. Die Uhr zeigt die echte Uhrzeit des Computers
 * (Wunsch des Auftraggebers), nicht die Tageszeit im Spiel. Rein optisch: Die Simulation
 * kennt die Uhrzeit nicht, im Spielstand steht nichts davon.
 */

export interface ClockHands {
  /** Winkel des Stundenzeigers in Bogenmaß, im Uhrzeigersinn ab 12 Uhr. */
  hour: number;
  /** Winkel des Minutenzeigers in Bogenmaß, im Uhrzeigersinn ab 12 Uhr. */
  minute: number;
}

const TAU = Math.PI * 2;

/**
 * Berechnet die Zeigerwinkel für eine Uhrzeit. Die Zeiger laufen gleichmäßig (der Stundenzeiger
 * steht um 3:30 zwischen 3 und 4). Schreibt in `out`, damit in der Bildschleife kein Speicher
 * angelegt wird.
 */
export function clockHands(
  hours: number,
  minutes: number,
  seconds: number,
  out: ClockHands,
): ClockHands {
  const m = minutes + seconds / 60;
  out.minute = (m / 60) * TAU;
  out.hour = (((hours % 12) + m / 60) / 12) * TAU;
  return out;
}

/** Zeigerwinkel für die aktuelle Ortszeit des Computers. */
export function clockHandsNow(out: ClockHands, now: Date = new Date()): ClockHands {
  return clockHands(now.getHours(), now.getMinutes(), now.getSeconds(), out);
}

/** Stunde für den Glockenschlag (1–12) zur vollen Stunde, sonst 0. */
export function chimeCount(hours: number, minutes: number): number {
  if (minutes !== 0) return 0;
  return hours % 12 === 0 ? 12 : hours % 12;
}
