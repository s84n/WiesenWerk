import { TEXTS } from '../data/texts';

let shown = false;
let exporter: (() => Promise<void>) | null = null;

/** Legt fest, wie der Fehlerbildschirm den aktuellen Spielstand exportiert. */
export function setErrorExport(fn: (() => Promise<void>) | null): void {
  exporter = fn;
}

/**
 * Zeigt bei einem Fehler eine verständliche Meldung statt eines eingefrorenen Bildes.
 * Ein Knopf erlaubt, den Spielstand vorher zu exportieren.
 */
export function showErrorScreen(error: unknown): void {
  console.error(error);
  if (shown) return;
  shown = true;

  const box = document.createElement('div');
  box.className = 'error-screen';
  const card = document.createElement('div');
  card.className = 'panel error-card';

  const h = document.createElement('h2');
  h.textContent = TEXTS.error.title;
  const p = document.createElement('p');
  p.textContent = TEXTS.error.body;

  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = TEXTS.error.details;
  const pre = document.createElement('pre');
  pre.textContent =
    error instanceof Error ? `${error.message}\n\n${error.stack ?? ''}` : String(error);
  details.append(summary, pre);

  const button = document.createElement('button');
  button.className = 'button';
  button.textContent = TEXTS.error.reload;
  button.addEventListener('click', () => location.reload());

  const buttons = document.createElement('div');
  buttons.className = 'menu-row';
  if (exporter) {
    const exp = document.createElement('button');
    exp.className = 'button secondary';
    exp.textContent = TEXTS.error.export;
    const fn = exporter;
    exp.addEventListener('click', () => {
      fn().catch((e) => {
        exp.textContent = TEXTS.error.exportFailed;
        console.error(e);
      });
    });
    buttons.appendChild(exp);
  }
  buttons.appendChild(button);
  card.append(h, p, details, buttons);
  box.appendChild(card);
  document.body.appendChild(box);
}
