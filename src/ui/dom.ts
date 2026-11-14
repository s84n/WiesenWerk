import { ITEMS, type ItemAmount } from '../data/items';
import { PALETTE } from '../data/palette';
import { TEXTS } from '../data/texts';

/** Kleines Hilfsmittel zum Erzeugen von HTML-Elementen. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

export function itemName(item: number): string {
  return TEXTS.items[ITEMS[item].key];
}

let itemIconUrls: readonly string[] = [];
/** Bilder der Items (von der Darstellung einmalig erzeugt). */
export function setItemIcons(urls: readonly string[]): void {
  itemIconUrls = urls;
}

/** Symbol eines Items: Bild, falls vorhanden, sonst ein farbiges Quadrat. */
export function itemIcon(item: number): HTMLElement {
  const url = itemIconUrls[item];
  if (url) {
    const img = el('img', 'item-icon image');
    img.src = url;
    img.alt = itemName(item);
    img.title = itemName(item);
    return img;
  }
  const icon = el('span', 'item-icon');
  icon.style.background = hex(PALETTE[ITEMS[item].color]);
  icon.title = itemName(item);
  return icon;
}

const numberFormat = new Intl.NumberFormat('de-DE');
export function formatNumber(n: number): string {
  return numberFormat.format(n);
}

/** „10 Holz, 5 Stein“ */
export function amountsText(list: readonly ItemAmount[]): string {
  return list.map((a) => `${formatNumber(a.amount)} ${itemName(a.item)}`).join(', ');
}
