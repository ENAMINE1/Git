// Image ingestion: stores the original untouched, plus a thumbnail for fast
// grids, and extracts a small dominant-colour palette.

import { db } from './db';
import type { Asset, AssetKind, ID } from './types';
import { addToMoodboard, boardForArtDirection } from './repo';
import { uid } from '@/lib/util';

const THUMB_MAX = 900;

export interface IngestOptions {
  kind?: AssetKind;
  title?: string;
  sourceUrl?: string;
  attribution?: string;
  videoId?: ID;
  breakdownId?: ID;
  timestamp?: number | null;
  tagIds?: ID[];
  moodboardId?: ID;
  artDirectionId?: ID;
  notes?: string;
}

async function decode(blob: Blob): Promise<ImageBitmap | HTMLImageElement | null> {
  try {
    if (typeof createImageBitmap === 'function') return await createImageBitmap(blob);
  } catch {
    /* fall through — e.g. SVG */
  }
  if (typeof Image === 'undefined') return null;
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function dims(src: ImageBitmap | HTMLImageElement) {
  return 'naturalWidth' in src ? { w: src.naturalWidth, h: src.naturalHeight } : { w: src.width, h: src.height };
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

async function makeThumb(src: ImageBitmap | HTMLImageElement, w: number, h: number, mime: string): Promise<Blob | null> {
  if (w <= THUMB_MAX && h <= THUMB_MAX * 2 && mime !== 'image/gif') return null; // original is small enough
  const scale = Math.min(1, THUMB_MAX / w);
  const c = canvas(Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale)));
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return new Promise((resolve) => c.toBlob((b) => resolve(b), 'image/webp', 0.86));
}

/** Median-cut-ish palette: bucket colours on a 4-bit grid, then pick distinct heavy buckets. */
export function extractPalette(data: Uint8ClampedArray, count = 6): string[] {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.n++;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
    } else buckets.set(key, { n: 1, r, g, b });
  }
  const sorted = [...buckets.values()]
    .map((b) => ({ n: b.n, r: b.r / b.n, g: b.g / b.n, b: b.b / b.n }))
    .sort((a, b) => b.n - a.n);
  const picked: typeof sorted = [];
  for (const c of sorted) {
    if (picked.every((p) => Math.hypot(p.r - c.r, p.g - c.g, p.b - c.b) > 42)) picked.push(c);
    if (picked.length >= count) break;
  }
  const hex = (v: number) => Math.round(v).toString(16).padStart(2, '0');
  return picked.map((c) => `#${hex(c.r)}${hex(c.g)}${hex(c.b)}`);
}

function paletteOf(src: ImageBitmap | HTMLImageElement): string[] {
  const c = canvas(64, 64);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(src, 0, 0, 64, 64);
  try {
    return extractPalette(ctx.getImageData(0, 0, 64, 64).data);
  } catch {
    return [];
  }
}

export async function ingestImage(file: Blob & { name?: string }, opts: IngestOptions = {}): Promise<ID> {
  const mime = file.type || 'image/png';
  const decoded = await decode(file);
  let width: number | undefined;
  let height: number | undefined;
  let thumb: Blob | null = null;
  let colors: string[] = [];
  if (decoded) {
    const d = dims(decoded);
    width = d.w;
    height = d.h;
    thumb = await makeThumb(decoded, d.w, d.h, mime);
    colors = paletteOf(decoded);
    if ('close' in decoded) decoded.close();
  }

  const fileId = uid('file');
  const thumbId = thumb ? uid('file') : undefined;
  const id = uid('asset');
  const name = file.name ?? '';
  const asset: Asset = {
    id,
    type: 'image',
    kind: opts.kind ?? 'screenshot',
    title: opts.title ?? name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim(),
    description: '',
    notes: opts.notes ?? '',
    sourceUrl: opts.sourceUrl ?? '',
    attribution: opts.attribution ?? '',
    tagIds: opts.tagIds ?? [],
    videoId: opts.videoId,
    breakdownId: opts.breakdownId,
    timestamp: opts.timestamp ?? null,
    fileId,
    thumbId,
    mime,
    width,
    height,
    size: file.size,
    fileName: name || undefined,
    colors,
    favorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await db.transaction('rw', [db.files, db.assets], async () => {
    await db.files.add({ id: fileId, blob: file, mime, name: name || undefined });
    if (thumb && thumbId) await db.files.add({ id: thumbId, blob: thumb, mime: 'image/webp' });
    await db.assets.add(asset);
  });

  if (opts.moodboardId) await addToMoodboard(opts.moodboardId, [id]);
  if (opts.artDirectionId) {
    const board = await boardForArtDirection(opts.artDirectionId);
    await addToMoodboard(board.id, [id]);
  }
  return id;
}

export async function ingestMany(files: Iterable<File>, opts: IngestOptions = {}): Promise<ID[]> {
  const ids: ID[] = [];
  for (const f of files) {
    if (!f.type.startsWith('image/')) continue;
    ids.push(await ingestImage(f, opts));
  }
  return ids;
}

/** Saves the current frame of a <video> element as an image asset. */
export async function captureFrame(video: HTMLVideoElement, opts: IngestOptions): Promise<ID> {
  const c = canvas(video.videoWidth, video.videoHeight);
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(video, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => c.toBlob((b) => resolve(b), 'image/png'));
  if (!blob) throw new Error('Could not capture frame');
  return ingestImage(Object.assign(blob, { name: `frame-${Math.round(video.currentTime * 1000)}ms.png` }), {
    kind: 'frame',
    timestamp: video.currentTime,
    ...opts,
  });
}

export async function createLinkAsset(url: string, opts: IngestOptions & { title?: string } = {}): Promise<ID> {
  const id = uid('asset');
  await db.assets.add({
    id,
    type: 'link',
    kind: 'motion',
    title: opts.title ?? url,
    description: '',
    notes: opts.notes ?? '',
    sourceUrl: url,
    linkUrl: url,
    attribution: opts.attribution ?? '',
    tagIds: opts.tagIds ?? [],
    videoId: opts.videoId,
    colors: [],
    favorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  if (opts.moodboardId) await addToMoodboard(opts.moodboardId, [id]);
  return id;
}

export async function createNoteAsset(text: string, opts: IngestOptions = {}): Promise<ID> {
  const id = uid('asset');
  await db.assets.add({
    id,
    type: 'note',
    kind: 'annotation',
    title: opts.title ?? '',
    description: text,
    notes: '',
    sourceUrl: '',
    attribution: '',
    tagIds: opts.tagIds ?? [],
    colors: [],
    favorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  if (opts.moodboardId) await addToMoodboard(opts.moodboardId, [id]);
  return id;
}

export async function createPaletteAsset(colors: string[], opts: IngestOptions = {}): Promise<ID> {
  const id = uid('asset');
  await db.assets.add({
    id,
    type: 'palette',
    kind: 'palette',
    title: opts.title ?? 'Palette',
    description: '',
    notes: opts.notes ?? '',
    sourceUrl: opts.sourceUrl ?? '',
    attribution: '',
    tagIds: opts.tagIds ?? [],
    colors,
    favorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  if (opts.moodboardId) await addToMoodboard(opts.moodboardId, [id]);
  return id;
}

/** Attaches a local copy of a video to a reference so frames can be captured from it. */
export async function attachVideoFile(videoId: ID, file: File) {
  const fileId = uid('file');
  await db.transaction('rw', [db.files, db.videos], async () => {
    const v = await db.videos.get(videoId);
    if (v?.videoFileId) await db.files.delete(v.videoFileId);
    await db.files.add({ id: fileId, blob: file, mime: file.type || 'video/mp4', name: file.name });
    await db.videos.update(videoId, { videoFileId: fileId, videoFileName: file.name, updatedAt: Date.now() });
  });
}

export async function detachVideoFile(videoId: ID) {
  await db.transaction('rw', [db.files, db.videos], async () => {
    const v = await db.videos.get(videoId);
    if (v?.videoFileId) await db.files.delete(v.videoFileId);
    await db.videos.where('id').equals(videoId).modify((row) => {
      delete row.videoFileId;
      delete row.videoFileName;
      row.updatedAt = Date.now();
    });
  });
}
