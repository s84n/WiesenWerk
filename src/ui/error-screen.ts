import { TEXTS } from '../data/texts';

let shown = false;

/**
 * Zeigt bei einem Fehler eine verständliche Meldung statt eines eingefrorenen Bildes.
 * Ab Phase 4 kommt hier zusätzlich ein Knopf zum Exportieren des Spielstands hinzu.
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

  card.append(h, p, details, button);
  box.appendChild(card);
  document.body.appendChild(box);
}
