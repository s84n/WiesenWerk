/**
 * Strich-Symbole der Oberfläche (Stil „Papier und Tinte“). Sie zeichnen mit `currentColor`,
 * nehmen also die Textfarbe des Knopfs an, und sehen anders als Emojis auf jedem System gleich aus.
 */
const PATHS = {
  pause:
    '<rect x="5" y="4" width="5" height="16" rx="1.5" fill="currentColor" stroke="none"/><rect x="14" y="4" width="5" height="16" rx="1.5" fill="currentColor" stroke="none"/>',
  bolt: '<path class="fill" d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z M3 7l9 4 9-4 M12 11v10"/>',
  flask: '<path d="M9 3h6 M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/>',
  chart: '<path d="M5 20V11 M12 20V5 M19 20v-6"/>',
  map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z M9 4v14 M15 6v14"/>',
  soundOn: '<path d="M4 9h4l5-4v14l-5-4H4z M17 9a4 4 0 0 1 0 6"/>',
  soundOff: '<path d="M4 9h4l5-4v14l-5-4H4z M17 9l5 6 M22 9l-5 6"/>',
  menu: '<path d="M5 7h14 M5 12h14 M5 17h14"/>',
  close: '<path d="M6 6l12 12 M18 6L6 18"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  gauge: '<path d="M4 17a8 8 0 1 1 16 0 M12 17l4-5 M4 17h16"/>',
  // Jahreszeiten
  blossom:
    '<circle cx="12" cy="12" r="2.2"/><path d="M12 9.8a3 3 0 1 1 2.6-4.5 3 3 0 1 1 1.4 5.1 3 3 0 1 1-2.2 4.8 3 3 0 1 1-3.6 0 3 3 0 1 1-2.2-4.8 3 3 0 1 1 1.4-5.1A3 3 0 0 1 12 9.8z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5 M12 19.5V22 M2 12h2.5 M19.5 12H22 M4.9 4.9l1.8 1.8 M17.3 17.3l1.8 1.8 M4.9 19.1l1.8-1.8 M17.3 6.7l1.8-1.8"/>',
  leaf: '<path d="M5 19C5 10 11 5 20 4c-1 9-6 15-15 15z M5 19l8-8"/>',
  snowflake:
    '<path d="M12 2v20 M3.3 7l17.4 10 M3.3 17L20.7 7 M9.5 3.5L12 6l2.5-2.5 M9.5 20.5L12 18l2.5 2.5"/>',
} as const;

export type IconName = keyof typeof PATHS;

/** Erzeugt ein SVG-Symbol (feste, eigene Zeichenketten, keine Eingaben von außen). */
export function icon(name: IconName, size = 18): SVGSVGElement {
  const tpl = document.createElement('template');
  tpl.innerHTML =
    `<svg class="ui-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" ` +
    `stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" ` +
    `aria-hidden="true">${PATHS[name]}</svg>`;
  return tpl.content.firstChild as SVGSVGElement;
}

/** Runder Schließen-Knopf mit Kreuz (Fenster, Infofenster, Aufgaben). */
export function closeButton(title: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'info-close';
  b.title = title;
  b.setAttribute('aria-label', title);
  b.append(icon('close', 14));
  b.addEventListener('click', () => {
    b.blur();
    onClick();
  });
  return b;
}
