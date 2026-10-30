// Backup & restore. A backup is a plain ZIP you can open anywhere:
//
//   framework-backup-YYYY-MM-DD.zip
//   ├── manifest.json     app id, schema version, counts, file index
//   ├── library.json      every table except binary files
//   └── files/<id>.<ext>  original images, thumbnails and attached videos
//
// Restoring onto another machine reproduces the library exactly.

import { strFromU8, strToU8, unzip, zip, type Zippable } from 'fflate';
import { DATA_TABLES, SCHEMA_VERSION, db, type FrameworkDB } from './db';
import type { StoredFile } from './types';

export const BACKUP_APP_ID = 'framework-library';

export interface BackupManifest {
  app: typeof BACKUP_APP_ID;
  schemaVersion: number;
  exportedAt: string;
  counts: Record<string, number>;
  files: { id: string; path: string; mime: string; name?: string }[];
}

export type LibraryJson = Record<string, unknown[]>;

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};

export async function exportLibraryJson(database: FrameworkDB = db): Promise<LibraryJson> {
  const out: LibraryJson = {};
  for (const name of DATA_TABLES) out[name] = await database.table(name).toArray();
  return out;
}

function zipAsync(data: Zippable): Promise<Uint8Array> {
  return new Promise((resolve, reject) => zip(data, (err, res) => (err ? reject(err) : resolve(res))));
}

function unzipAsync(data: Uint8Array): Promise<Record<string, Uint8Array>> {
  return new Promise((resolve, reject) => unzip(data, (err, res) => (err ? reject(err) : resolve(res))));
}

async function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

export async function createBackup(database: FrameworkDB = db, opts: { includeFiles?: boolean } = {}): Promise<Blob> {
  const includeFiles = opts.includeFiles ?? true;
  const library = await exportLibraryJson(database);
  const files: StoredFile[] = includeFiles ? await database.files.toArray() : [];
  const manifest: BackupManifest = {
    app: BACKUP_APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    counts: Object.fromEntries(Object.entries(library).map(([k, v]) => [k, v.length])),
    files: files.map((f) => ({
      id: f.id,
      path: `files/${f.id}.${EXT[f.mime] ?? 'bin'}`,
      mime: f.mime,
      name: f.name,
    })),
  };
  const entries: Zippable = {
    'manifest.json': [strToU8(JSON.stringify(manifest, null, 2)), { level: 6 }],
    'library.json': [strToU8(JSON.stringify(library, null, 2)), { level: 6 }],
    'README.txt': [
      strToU8(
        'FRAMEWORK library backup.\n\nlibrary.json holds every record (videos, techniques, art directions, moodboards, creators, ...).\nfiles/ holds the original images and videos, named by their file id (see manifest.json).\nRestore it from Library > Backup & restore in the app.\n',
      ),
      { level: 6 },
    ],
  };
  for (const f of files) {
    const path = manifest.files.find((m) => m.id === f.id)!.path;
    entries[path] = [await blobBytes(f.blob), { level: 0 }];
  }
  const bytes = await zipAsync(entries);
  return new Blob([bytes as unknown as BlobPart], { type: 'application/zip' });
}

export interface RestoreResult {
  records: number;
  files: number;
}

function validate(manifest: unknown, library: unknown): asserts library is LibraryJson {
  if (!manifest || (manifest as BackupManifest).app !== BACKUP_APP_ID) {
    throw new Error('This file is not a FRAMEWORK backup.');
  }
  const v = (manifest as BackupManifest).schemaVersion;
  if (v > SCHEMA_VERSION) throw new Error(`Backup was made by a newer version (schema ${v}).`);
  if (!library || typeof library !== 'object') throw new Error('Backup is missing library.json.');
}

/**
 * Restores a backup ZIP (or a bare library.json).
 * mode "replace" wipes the library first; "merge" upserts by id.
 */
export async function restoreBackup(
  input: Blob,
  mode: 'replace' | 'merge' = 'replace',
  database: FrameworkDB = db,
): Promise<RestoreResult> {
  const bytes = await blobBytes(input);
  let manifest: BackupManifest;
  let library: LibraryJson;
  let fileEntries: { meta: BackupManifest['files'][number]; data: Uint8Array }[] = [];

  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (isZip) {
    const entries = await unzipAsync(bytes);
    if (!entries['manifest.json'] || !entries['library.json']) throw new Error('Backup is missing manifest.json or library.json.');
    manifest = JSON.parse(strFromU8(entries['manifest.json']));
    library = JSON.parse(strFromU8(entries['library.json']));
    validate(manifest, library);
    fileEntries = manifest.files.filter((m) => entries[m.path]).map((meta) => ({ meta, data: entries[meta.path] }));
  } else {
    let parsed: { app?: string; schemaVersion?: number; library?: LibraryJson };
    try {
      parsed = JSON.parse(strFromU8(bytes));
    } catch {
      throw new Error('This file is not a FRAMEWORK backup.');
    }
    manifest = { app: parsed.app as typeof BACKUP_APP_ID, schemaVersion: parsed.schemaVersion ?? 0, exportedAt: '', counts: {}, files: [] };
    library = parsed.library as LibraryJson;
    validate(manifest, library);
  }

  let records = 0;
  await database.transaction('rw', database.tables, async () => {
    if (mode === 'replace') {
      for (const t of database.tables) await t.clear();
    }
    for (const name of DATA_TABLES) {
      const rows = library[name];
      if (!Array.isArray(rows)) continue;
      await database.table(name).bulkPut(rows);
      records += rows.length;
    }
    for (const { meta, data } of fileEntries) {
      await database.files.put({ id: meta.id, mime: meta.mime, name: meta.name, blob: new Blob([data as unknown as BlobPart], { type: meta.mime }) });
    }
    // A restored library must never be re-seeded on top.
    if (!(await database.meta.get('seedVersion'))) await database.meta.put({ key: 'seedVersion', value: 1 });
  });
  return { records, files: fileEntries.length };
}

/** Records only (no binary files) as a single JSON document. */
export async function createJsonExport(database: FrameworkDB = db): Promise<Blob> {
  const doc = { app: BACKUP_APP_ID, schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), library: await exportLibraryJson(database) };
  return new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function backupFilename(date = new Date()) {
  return `framework-backup-${date.toISOString().slice(0, 10)}.zip`;
}
