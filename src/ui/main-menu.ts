import { QUALITIES, type Quality } from '../data/config';
import { MUSIC_TRACKS } from '../data/music';
import { WORLD_SIZES } from '../data/world';
import { TEXTS } from '../data/texts';
import type { Settings } from '../core/settings';
import type { SlotInfo } from '../core/storage';
import { el } from './dom';

export interface MenuActions {
  inGame(): boolean;
  canSave(): boolean;
  defaultName(): string;
  currentSeed(): number;
  rollSeed(): number;
  continueGame(): Promise<void>;
  newGame(seed: number, size: number): void;
  save(slot: string | null, name: string): Promise<void>;
  load(slot: string): Promise<void>;
  remove(slot: string): Promise<void>;
  list(): Promise<SlotInfo[]>;
  exportFile(): Promise<void>;
  importFile(file: File): Promise<void>;
  errorText(err: unknown): string;
  /** Menü geöffnet bzw. geschlossen (zum Pausieren). */
  visibilityChanged(open: boolean): void;
  /** Einstellungen lesen und ändern. */
  settings(): Settings;
  setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void;
}

type View = 'main' | 'new' | 'save' | 'load' | 'keys' | 'settings';

const dateFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' });

function playTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')} h`;
}

/**
 * Hauptmenü: Weiterspielen, neues Spiel mit Seed, Speichern, Laden, Export, Import, Tastenbelegung.
 */
export class MainMenu {
  private readonly overlay: HTMLElement;
  private readonly body: HTMLElement;
  private readonly message: HTMLElement;
  private readonly fileInput: HTMLInputElement;
  isOpen = false;

  constructor(
    parent: HTMLElement,
    private readonly actions: MenuActions,
    versionText: string,
  ) {
    this.overlay = el('div', 'menu-overlay');
    const card = el('div', 'panel menu-card');
    const head = el('div', 'menu-head');
    const title = el('h1', 'menu-title');
    const logo = el('img');
    logo.src = './logo.svg';
    logo.alt = TEXTS.gameTitle;
    logo.draggable = false;
    title.appendChild(logo);
    head.append(title, el('div', 'version', versionText));
    this.message = el('div', 'menu-message');
    this.body = el('div', 'menu-body');
    const foot = el('p', 'menu-foot', TEXTS.menu.storageHint);
    card.append(head, this.message, this.body, foot);
    this.overlay.appendChild(card);
    this.overlay.style.display = 'none';

    this.fileInput = el('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = '.fabrik,application/gzip,application/json';
    this.fileInput.style.display = 'none';
    this.fileInput.addEventListener('change', () => {
      const file = this.fileInput.files?.[0];
      this.fileInput.value = '';
      if (file) this.run(() => this.actions.importFile(file), true);
    });

    parent.append(this.overlay, this.fileInput);
  }

  open(view: View = 'main'): void {
    if (!this.isOpen) {
      this.isOpen = true;
      this.overlay.style.display = '';
      this.actions.visibilityChanged(true);
    }
    this.show(view);
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.overlay.style.display = 'none';
    this.actions.visibilityChanged(false);
  }

  /** Zeigt eine Meldung im Menü (z. B. einen Ladefehler) und öffnet es dafür. */
  showError(text: string): void {
    this.open(this.isOpen ? undefined : 'main');
    this.message.textContent = text;
    this.message.style.display = '';
  }

  /** Führt eine Aktion aus und zeigt Fehler verständlich an. `closeAfter`: Menü bei Erfolg schließen. */
  private run(action: () => Promise<void>, closeAfter: boolean): void {
    this.message.style.display = 'none';
    action()
      .then(() => {
        if (closeAfter) this.close();
      })
      .catch((err) => {
        console.error(err);
        this.showError(this.actions.errorText(err));
      });
  }

  private show(view: View): void {
    this.message.style.display = 'none';
    this.body.replaceChildren();
    switch (view) {
      case 'main':
        return this.showMain();
      case 'new':
        return this.showNew();
      case 'save':
        return void this.showSave();
      case 'load':
        return void this.showLoad();
      case 'keys':
        return this.showKeys();
      case 'settings':
        return this.showSettings();
    }
  }

  private button(text: string, onClick: () => void, cls = 'button'): HTMLButtonElement {
    const b = el('button', cls, text);
    b.addEventListener('click', () => {
      b.blur();
      onClick();
    });
    return b;
  }

  private back(): HTMLButtonElement {
    return this.button(TEXTS.menu.back, () => this.show('main'), 'button secondary');
  }

  private showMain(): void {
    const a = this.actions;
    const list = el('div', 'menu-buttons');
    list.append(
      this.button(TEXTS.menu.continue, () => this.run(() => a.continueGame(), true)),
      this.button(TEXTS.menu.newGame, () => this.show('new'), 'button secondary'),
    );
    if (a.inGame()) {
      const save = this.button(TEXTS.menu.save, () => this.show('save'), 'button secondary');
      const exp = this.button(
        TEXTS.menu.export,
        () => this.run(() => a.exportFile(), false),
        'button secondary',
      );
      if (!a.canSave()) {
        save.disabled = exp.disabled = true;
        save.title = exp.title = TEXTS.menu.notSaveable;
      }
      list.append(save);
      list.append(this.button(TEXTS.menu.load, () => this.show('load'), 'button secondary'));
      list.append(exp);
    } else {
      list.append(this.button(TEXTS.menu.load, () => this.show('load'), 'button secondary'));
    }
    list.append(
      this.button(TEXTS.menu.import, () => this.fileInput.click(), 'button secondary'),
      this.button(TEXTS.menu.settings, () => this.show('settings'), 'button secondary'),
      this.button(TEXTS.menu.keys, () => this.show('keys'), 'button secondary'),
    );
    this.body.append(list, el('p', 'menu-hint', TEXTS.menu.dropHint));
  }

  private showNew(): void {
    const row = el('div', 'menu-row');
    const label = el('label', 'menu-label', TEXTS.menu.seed);
    const input = el('input', 'menu-input');
    input.type = 'number';
    input.min = '1';
    input.value = String(this.actions.rollSeed());
    label.appendChild(input);
    row.append(
      label,
      this.button(
        TEXTS.menu.roll,
        () => (input.value = String(this.actions.rollSeed())),
        'button secondary',
      ),
    );
    // Kartengröße
    let size: number = WORLD_SIZES[0].size;
    const sizeSection = el('div', 'menu-section');
    sizeSection.append(el('div', 'menu-label', TEXTS.menu.mapSize));
    const sizeRow = el('div', 'quality-row');
    const sizeButtons: HTMLButtonElement[] = [];
    for (const s of WORLD_SIZES) {
      const b = this.button(
        TEXTS.menu.mapSizes[s.key],
        () => {
          size = s.size;
          for (const other of sizeButtons) other.classList.toggle('selected', other === b);
        },
        `quality-button${s.size === size ? ' selected' : ''}`,
      );
      b.title = TEXTS.menu.mapSizeTip(s.size);
      sizeButtons.push(b);
      sizeRow.append(b);
    }
    sizeSection.append(sizeRow, el('p', 'menu-hint left', TEXTS.menu.mapSizeHint));
    const start = (): void => {
      const seed = Math.max(1, Math.floor(Number(input.value) || this.actions.rollSeed()));
      this.actions.newGame(seed, size);
      this.close();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') start();
    });
    const actions = el('div', 'menu-row');
    actions.append(this.back(), this.button(TEXTS.menu.start, start));
    this.body.append(row, el('p', 'menu-hint', TEXTS.menu.seedHint), sizeSection, actions);
    input.focus();
    input.select();
  }

  private async showSave(): Promise<void> {
    const row = el('div', 'menu-row');
    const label = el('label', 'menu-label', TEXTS.menu.saveName);
    const input = el('input', 'menu-input wide');
    input.value = this.actions.defaultName();
    label.appendChild(input);
    row.append(label);
    const saveNew = (): void => {
      const name = input.value.trim() || this.actions.defaultName();
      this.run(() => this.actions.save(null, name), true);
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveNew();
    });
    const actions = el('div', 'menu-row');
    actions.append(this.back(), this.button(TEXTS.menu.saveAs, saveNew));
    this.body.append(row, actions);
    input.focus();
    input.select();

    const slots = (await this.safeList()).filter((s) => !s.auto);
    if (slots.length === 0) return;
    const list = el('div', 'slot-list');
    for (const s of slots) {
      list.append(
        this.slotRow(s, [
          this.button(
            TEXTS.menu.overwrite,
            () => this.run(() => this.actions.save(s.slot, input.value.trim() || s.name), true),
            'button small',
          ),
        ]),
      );
    }
    this.body.append(list);
  }

  private async showLoad(): Promise<void> {
    const actions = el('div', 'menu-row');
    actions.append(
      this.back(),
      this.button(TEXTS.menu.import, () => this.fileInput.click(), 'button secondary'),
    );
    this.body.append(actions);
    const slots = await this.safeList();
    const list = el('div', 'slot-list');
    if (slots.length === 0) list.append(el('p', 'menu-hint', TEXTS.menu.noSaves));
    for (const s of slots) {
      list.append(
        this.slotRow(s, [
          this.button(
            TEXTS.menu.load,
            () => this.run(() => this.actions.load(s.slot), true),
            'button small',
          ),
          this.button(
            TEXTS.menu.delete,
            () => {
              if (window.confirm(TEXTS.menu.confirmDelete(s.name)))
                this.run(() => this.actions.remove(s.slot).then(() => this.show('load')), false);
            },
            'button small secondary',
          ),
        ]),
      );
    }
    this.body.append(list);
  }

  private showKeys(): void {
    const table = el('table', 'keys-table');
    for (const [k, v] of TEXTS.keys) {
      const tr = el('tr');
      tr.append(el('td', 'key', k), el('td', '', v));
      table.append(tr);
    }
    const actions = el('div', 'menu-row');
    actions.append(this.back());
    this.body.append(table, actions);
  }

  private showSettings(): void {
    const a = this.actions;
    const s = a.settings();

    // Grafik
    const quality = el('div', 'menu-section');
    quality.append(el('div', 'menu-label', TEXTS.settings.quality));
    const row = el('div', 'quality-row');
    const hint = el('p', 'menu-hint left', TEXTS.settings.qualityHints[s.quality]);
    const buttons = new Map<Quality, HTMLButtonElement>();
    for (const q of QUALITIES) {
      const b = this.button(
        TEXTS.settings.qualities[q],
        () => {
          a.setSetting('quality', q);
          a.setSetting('qualityChosen', true);
          for (const [k, btn] of buttons) btn.classList.toggle('selected', k === q);
          hint.textContent = TEXTS.settings.qualityHints[q];
        },
        `quality-button${q === s.quality ? ' selected' : ''}`,
      );
      buttons.set(q, b);
      row.append(b);
    }
    quality.append(row, hint);
    if (!s.qualityChosen) quality.append(el('p', 'menu-hint left', TEXTS.settings.autoChosen));

    // Schalter
    const toggles = el('div', 'menu-section');
    toggles.append(
      this.checkbox(TEXTS.settings.dayNight, s.dayNight, (v) => a.setSetting('dayNight', v)),
      this.checkbox(TEXTS.settings.seasons, s.seasons, (v) => a.setSetting('seasons', v)),
      this.checkbox(TEXTS.settings.muted, s.muted, (v) => a.setSetting('muted', v)),
    );

    // Lautstärken
    const volumes = el('div', 'menu-section');
    volumes.append(
      this.slider(TEXTS.settings.soundVolume, s.soundVolume, (v) => a.setSetting('soundVolume', v)),
      this.slider(TEXTS.settings.musicVolume, s.musicVolume, (v) => a.setSetting('musicVolume', v)),
    );
    if (MUSIC_TRACKS.length === 0)
      volumes.append(el('p', 'menu-hint left', TEXTS.settings.noMusic));

    const actions = el('div', 'menu-row');
    actions.append(this.back());
    this.body.append(quality, toggles, volumes, actions);
  }

  private checkbox(label: string, value: boolean, onChange: (v: boolean) => void): HTMLElement {
    const wrap = el('label', 'menu-check');
    const box = el('input');
    box.type = 'checkbox';
    box.checked = value;
    box.addEventListener('change', () => onChange(box.checked));
    wrap.append(box, el('span', '', label));
    return wrap;
  }

  private slider(label: string, value: number, onChange: (v: number) => void): HTMLElement {
    const wrap = el('label', 'menu-slider');
    const input = el('input');
    input.type = 'range';
    input.min = '0';
    input.max = '100';
    input.value = String(Math.round(value * 100));
    const out = el('span', 'slider-value', `${input.value} %`);
    input.addEventListener('input', () => {
      out.textContent = `${input.value} %`;
      onChange(Number(input.value) / 100);
    });
    wrap.append(el('span', '', label), input, out);
    return wrap;
  }

  private slotRow(s: SlotInfo, buttons: HTMLElement[]): HTMLElement {
    const row = el('div', 'slot-row');
    const text = el('div', 'slot-text');
    text.append(
      el('div', 'slot-name', s.auto ? `${s.name} · ${TEXTS.menu.autosave}` : s.name),
      el(
        'div',
        'slot-line',
        TEXTS.menu.slotLine(dateFormat.format(s.savedAt), playTime(s.playSeconds), s.seed),
      ),
    );
    row.append(text, ...buttons);
    return row;
  }

  private async safeList(): Promise<SlotInfo[]> {
    try {
      return await this.actions.list();
    } catch (err) {
      this.showError(this.actions.errorText(err));
      return [];
    }
  }
}
