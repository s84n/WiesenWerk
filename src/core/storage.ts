import type { SaveData } from '../sim/serialize';

/**
 * Speicherplätze im Browser (IndexedDB). Zwei Tabellen: `meta` für die Liste (klein),
 * `data` für die eigentlichen Spielstände (groß), damit die Übersicht schnell lädt.
 */
export interface SlotInfo {
  slot: string;
  name: string;
  savedAt: number;
  seed: number;
  /** Spielzeit in Sekunden. */
  playSeconds: number;
  auto: boolean;
}

export const AUTOSAVE_SLOT = 'autosave';
const DB_NAME = 'wiesenwerk';
const DB_VERSION = 1;

/** Nach so vielen Millisekunden gilt das Öffnen als gescheitert (statt ewig zu warten). */
const OPEN_TIMEOUT_MS = 4000;

let dbPromise: Promise<IDBDatabase> | null = null;
let openDbHandle: IDBDatabase | null = null;

/**
 * Schließt die Verbindung, z. B. beim Verlassen der Seite. Sonst kann eine im Browser-Zwischenspeicher
 * („Zurück“-Cache) geparkte alte Seite die Datenbank für die neue Seite blockieren.
 */
export function closeDb(): void {
  openDbHandle?.close();
  openDbHandle = null;
  dbPromise = null;
}

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('IndexedDB antwortet nicht.')),
      OPEN_TIMEOUT_MS,
    );
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB ist in diesem Browser nicht verfügbar.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'slot' });
      if (!db.objectStoreNames.contains('data')) db.createObjectStore('data', { keyPath: 'slot' });
    };
    req.onsuccess = () => {
      clearTimeout(timer);
      const db = req.result;
      openDbHandle = db;
      // Eine neuere Seite will die Datenbank aktualisieren: Platz machen
      db.onversionchange = () => closeDb();
      resolve(db);
    };
    req.onerror = () => {
      clearTimeout(timer);
      reject(req.error ?? new Error('IndexedDB konnte nicht geöffnet werden.'));
    };
  });
  dbPromise.catch(() => (dbPromise = null));
  return dbPromise;
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Speichern fehlgeschlagen.'));
    tx.onabort = () => reject(tx.error ?? new Error('Speichern abgebrochen.'));
  });
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Lesen fehlgeschlagen.'));
  });
}

export async function listSlots(): Promise<SlotInfo[]> {
  const db = await openDb();
  const all = await request(
    db.transaction('meta').objectStore('meta').getAll() as IDBRequest<SlotInfo[]>,
  );
  return all.sort((a, b) => b.savedAt - a.savedAt);
}

export async function writeSlot(info: SlotInfo, data: SaveData): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(['meta', 'data'], 'readwrite');
  tx.objectStore('meta').put(info);
  tx.objectStore('data').put({ slot: info.slot, data });
  await done(tx);
}

export async function readSlot(slot: string): Promise<unknown> {
  const db = await openDb();
  const entry = await request(
    db.transaction('data').objectStore('data').get(slot) as IDBRequest<
      { data: unknown } | undefined
    >,
  );
  if (!entry) throw new Error('Spielstand nicht gefunden.');
  return entry.data;
}

export async function deleteSlot(slot: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(['meta', 'data'], 'readwrite');
  tx.objectStore('meta').delete(slot);
  tx.objectStore('data').delete(slot);
  await done(tx);
}
