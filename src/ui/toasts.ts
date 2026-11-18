import { BUILDING_COSTS } from '../data/buildings';
import { CHAPTERS, CHAPTER_REWARDS, GOALS } from '../data/goals';
import { ITEMS } from '../data/items';
import { LANDMARK_STAGES } from '../data/landmark';
import { RESEARCH, UPGRADES } from '../data/research';
import { PALETTE } from '../data/palette';
import { TEXTS } from '../data/texts';
import type { SimEvent } from '../sim/events';
import { PlaceResult } from '../sim/placement';
import type { Simulation } from '../sim/simulation';
import { amountsText, el, hex, itemName } from './dom';

const MESSAGE_MS = 2600;
const MAX_MESSAGES = 3;

/**
 * Kurze Meldungen (z. B. „Es fehlt noch: 5 Stein“) und kleine „+1 Holz“-Zahlen am Mauszeiger.
 */
export class Toasts {
  private readonly stack: HTMLElement;
  private pointerX = 0;
  private pointerY = 0;
  private lastMessage = '';
  private lastMessageAt = 0;

  constructor(private readonly parent: HTMLElement) {
    this.stack = el('div', 'toast-stack');
    parent.appendChild(this.stack);
    window.addEventListener('pointermove', (e) => {
      this.pointerX = e.clientX;
      this.pointerY = e.clientY;
    });
  }

  handleEvents(events: readonly SimEvent[], sim: Simulation): void {
    for (const e of events) {
      if (e.type === 'harvested' && e.amount > 0) {
        this.float(`+${e.amount} ${itemName(e.item)}`, PALETTE[ITEMS[e.item].color]);
      } else if (e.type === 'commandFailed') {
        this.message(this.failureText(e.reason, e.buildingType, sim));
      } else if (e.type === 'researched') {
        this.message(TEXTS.research.researched(TEXTS.research.nodes[RESEARCH[e.node].key]));
      } else if (e.type === 'upgraded') {
        const key = UPGRADES[e.upgrade].key;
        this.message(
          TEXTS.research.upgraded(
            TEXTS.research.upgrades[key].name,
            sim.research.levels[e.upgrade],
          ),
        );
      } else if (e.type === 'blueprintPlaced') {
        this.message(TEXTS.build.pasted(e.built, e.total));
      } else if (e.type === 'landmarkStage') {
        const done = LANDMARK_STAGES[e.stage - 1];
        this.message(
          e.stage >= LANDMARK_STAGES.length
            ? TEXTS.landmark.allDone
            : TEXTS.landmark.stageDone(TEXTS.landmark.stages[done.key]),
          true,
        );
      } else if (e.type === 'chapterCompleted') {
        this.message(
          TEXTS.goals.chapterDone(
            TEXTS.goals.chapters[CHAPTERS[e.chapter].key],
            amountsText(CHAPTER_REWARDS[e.chapter]),
          ),
          true,
        );
      } else if (e.type === 'goalCompleted') {
        this.message(TEXTS.goals.completed(TEXTS.goals.items[GOALS[e.goal].key]));
      }
    }
  }

  /** `big`: hervorgehobene, länger stehende Meldung (z. B. Uhrturm-Abschnitt fertig). */
  message(text: string, big = false): void {
    // Gleiche Meldung nicht im Sekundentakt wiederholen
    const now = performance.now();
    if (text === this.lastMessage && now - this.lastMessageAt < 1000) return;
    this.lastMessage = text;
    this.lastMessageAt = now;
    const t = el('div', big ? 'panel toast big' : 'panel toast', text);
    this.stack.appendChild(t);
    while (this.stack.children.length > MAX_MESSAGES) this.stack.firstElementChild?.remove();
    setTimeout(
      () => {
        t.classList.add('leaving');
        setTimeout(() => t.remove(), 400);
      },
      big ? MESSAGE_MS * 2.5 : MESSAGE_MS,
    );
  }

  private float(text: string, color: number): void {
    const f = el('div', 'float-text', text);
    f.style.left = `${this.pointerX + 12}px`;
    f.style.top = `${this.pointerY - 18}px`;
    f.style.color = hex(color);
    f.addEventListener('animationend', () => f.remove());
    this.parent.appendChild(f);
  }

  private failureText(reason: number, type: number, sim: Simulation): string {
    switch (reason) {
      case PlaceResult.OutOfBounds:
        return TEXTS.messages.outOfBounds;
      case PlaceResult.NeedsDeposit:
        return TEXTS.messages.needsDeposit;
      case PlaceResult.Unique:
        return TEXTS.messages.unique;
      case PlaceResult.Locked:
        return TEXTS.messages.locked;
      case PlaceResult.NeedsWater:
        return TEXTS.messages.needsWater;
      case PlaceResult.NeedsBelt:
        return TEXTS.messages.needsBelt;
      case PlaceResult.Cost: {
        const missing = BUILDING_COSTS[type]
          .map((c) => ({ item: c.item, amount: c.amount - sim.inventory.get(c.item) }))
          .filter((c) => c.amount > 0);
        return TEXTS.messages.missing(amountsText(missing));
      }
      default:
        return TEXTS.messages.blocked;
    }
  }
}
