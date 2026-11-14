import { SAVE_CONFIG } from '../data/config';
import { SaveError, type SaveData } from '../sim/serialize';

/**
 * Export und Import von Spielständen als Datei. Exporte sind gepacktes JSON (gzip über den
 * im Browser eingebauten `CompressionStream`), Endung `.fabrik`.
 */
export async function downloadSave(data: SaveData): Promise<void> {
  const json = JSON.stringify(data);
  const packed = await new Response(
    new Blob([json]).stream().pipeThrough(new CompressionStream('gzip')),
  ).blob();
  const date = new Date(data.meta.savedAt).toISOString().slice(0, 10);
  const name = data.meta.name
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' })[c] ?? c)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(packed);
  a.download = `wiesenwerk-${name || 'fabrik'}-${date}${SAVE_CONFIG.fileExtension}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

/** Liest eine Datei (gepackt oder unverpackt) und gibt die rohen Daten zurück. */
export async function readSaveFile(file: Blob): Promise<unknown> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let text: string;
  try {
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
      text = await new Response(
        new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')),
      ).text();
    } else {
      text = new TextDecoder().decode(bytes);
    }
    return JSON.parse(text);
  } catch {
    throw new SaveError('notJson');
  }
}
