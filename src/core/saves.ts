import { SIM_CONFIG } from '../data/config';
import { TEXTS } from '../data/texts';
import { SaveError, deserialize, migrate, serialize, type SaveData } from '../sim/serialize';
import type { Simulation } from '../sim/simulation';
import { downloadSave, readSaveFile } from './save-files';
import {
  AUTOSAVE_SLOT,
  deleteSlot,
  listSlots,
  readSlot,
  writeSlot,
  type SlotInfo,
} from './storage';

/** Zwischenablage für den Notfall-Spielstand beim Schließen des Tabs. */
const EMERGENCY_KEY = 'wiesenwerk-notfall';

export interface SaveHost {
  getSim(): Simulation;
  /** Kamerazustand für den Spielstand. */
  camera(): number[];
  /** Übernimmt eine geladene Simulation samt Kamera. */
  apply(sim: Simulation, camera: number[]): void;
  toast(message: string): void;
}

/**
 * Speichern, Laden, automatisches Speichern, Export und Import.
 * Merkt sich den aktuellen Speicherplatz, damit Strg + S dorthin speichert.
 */
export class SaveManager {
  currentSlot: string | null = null;
  currentName = '';

  constructor(private readonly host: SaveHost) {}

  canSave(): boolean {
    return this.host.getSim().world.generated;
  }

  defaultName(): string {
    return this.currentName || TEXTS.menu.defaultName(this.host.getSim().world.seed);
  }

  /** Neues Spiel begonnen: kein Speicherplatz zugeordnet. */
  reset(): void {
    this.currentSlot = null;
    this.currentName = '';
  }

  list(): Promise<SlotInfo[]> {
    return listSlots();
  }

  async save(slot: string | null, name: string): Promise<void> {
    const id = slot ?? `s${Date.now().toString(36)}`;
    await this.write(id, name, false);
    this.currentSlot = id;
    this.currentName = name;
    this.host.toast(TEXTS.save.saved(name));
  }

  /** Strg + S: in den aktuellen Speicherplatz, sonst in einen neuen. */
  quickSave(): Promise<void> {
    return this.save(this.currentSlot, this.defaultName());
  }

  async autosave(): Promise<void> {
    if (!this.canSave()) return;
    await this.write(AUTOSAVE_SLOT, this.defaultName(), true);
  }

  /**
   * Beim Schließen des Tabs: IndexedDB schafft das Schreiben dann oft nicht mehr.
   * Deshalb wird der Spielstand sofort (synchron) in den localStorage gelegt und beim
   * nächsten Start mit `recoverEmergency` in den Autosave-Platz übernommen.
   */
  emergencySave(): void {
    if (!this.canSave()) return;
    try {
      const data = this.data(this.defaultName());
      localStorage.setItem(
        EMERGENCY_KEY,
        JSON.stringify({ info: this.info(AUTOSAVE_SLOT, data, true), data }),
      );
    } catch (err) {
      console.warn('Notfall-Spielstand konnte nicht abgelegt werden', err);
    }
  }

  /** Übernimmt einen Notfall-Spielstand vom letzten Schließen in den Autosave-Platz. */
  async recoverEmergency(): Promise<void> {
    let raw: string | null;
    try {
      raw = localStorage.getItem(EMERGENCY_KEY);
    } catch {
      return;
    }
    if (!raw) return;
    try {
      const { info, data } = JSON.parse(raw) as { info: SlotInfo; data: SaveData };
      const existing = (await listSlots()).find((s) => s.slot === AUTOSAVE_SLOT);
      if (!existing || existing.savedAt < info.savedAt) await writeSlot(info, data);
      localStorage.removeItem(EMERGENCY_KEY);
    } catch (err) {
      console.warn('Notfall-Spielstand konnte nicht übernommen werden', err);
    }
  }

  async load(slot: string): Promise<void> {
    const raw = await readSlot(slot);
    const name = this.loadRaw(raw);
    this.currentSlot = slot === AUTOSAVE_SLOT ? null : slot;
    this.currentName = name;
  }

  remove(slot: string): Promise<void> {
    if (slot === this.currentSlot) this.currentSlot = null;
    return deleteSlot(slot);
  }

  async exportFile(): Promise<void> {
    await downloadSave(this.data(this.defaultName()));
    this.host.toast(TEXTS.save.exported);
  }

  async importFile(file: Blob): Promise<void> {
    const raw = await readSaveFile(file);
    this.currentName = this.loadRaw(raw);
    this.currentSlot = null;
  }

  /** Verständlicher Text zu einem Fehler beim Speichern oder Laden. */
  errorText(err: unknown): string {
    if (err instanceof SaveError) return TEXTS.save.errors[err.code];
    if (err instanceof DOMException || (err instanceof Error && /IndexedDB/.test(err.message))) {
      return TEXTS.save.errors.storage;
    }
    return TEXTS.save.errors.damaged;
  }

  private loadRaw(raw: unknown): string {
    const data = migrate(raw);
    const sim = deserialize(data);
    this.host.apply(sim, data.camera);
    this.host.toast(TEXTS.save.loaded(data.meta.name));
    return data.meta.name;
  }

  private data(name: string): SaveData {
    return serialize(this.host.getSim(), { name, savedAt: Date.now() }, this.host.camera());
  }

  private info(slot: string, data: SaveData, auto: boolean): SlotInfo {
    return {
      slot,
      name: data.meta.name,
      savedAt: data.meta.savedAt,
      seed: data.seed,
      playSeconds: Math.floor(data.tick / SIM_CONFIG.ticksPerSecond),
      auto,
    };
  }

  private async write(slot: string, name: string, auto: boolean): Promise<void> {
    const data = this.data(name);
    await writeSlot(this.info(slot, data, auto), data);
  }
}
