import { TEXTS } from '../data/texts';
import { el } from './dom';
import { closeButton } from './icons';

/**
 * Ein Fenster in der Bildmitte mit Titel und Schließen-Knopf (Forschung, Statistik).
 * Es pausiert das Spiel nicht; Esc oder der Knopf schließen es.
 */
export class GameWindow {
  readonly root: HTMLElement;
  readonly body: HTMLElement;
  private shown = false;
  onToggle: (open: boolean) => void = () => {};

  constructor(parent: HTMLElement, title: string, className: string) {
    this.root = el('div', `panel game-window ${className}`);
    const head = el('div', 'window-head');
    const close = closeButton(TEXTS.info.close, () => this.close());
    head.append(el('h2', 'window-title', title), close);
    this.body = el('div', 'window-body');
    this.root.append(head, this.body);
    this.root.style.display = 'none';
    parent.appendChild(this.root);
  }

  get isOpen(): boolean {
    return this.shown;
  }

  open(): void {
    if (this.shown) return;
    this.shown = true;
    this.root.style.display = '';
    this.onToggle(true);
  }

  close(): void {
    if (!this.shown) return;
    this.shown = false;
    this.root.style.display = 'none';
    this.onToggle(false);
  }

  toggle(): void {
    if (this.shown) this.close();
    else this.open();
  }
}
