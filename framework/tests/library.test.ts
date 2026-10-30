import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import { buildSeed, ensureSeeded } from '@/db/seed';
import {
  addToMoodboard,
  addUsage,
  createArtDirection,
  createTechnique,
  createVideo,
  deleteArtDirection,
  deleteTechnique,
  findSimilarTechniques,
  findVideoByUrl,
  mergeTechniques,
  promoteMoodboard,
  createMoodboard,
  reorderMoodboard,
  boardItems,
  toggleInCollection,
  createCollection,
} from '@/db/repo';
import { createBackup, restoreBackup } from '@/db/backup';
import { buildDocs, buildIndex, runSearch } from '@/db/search';
import { canonicalUrl, parseTime, formatTime, urlAtTime } from '@/lib/util';

async function reset() {
  await db.delete();
  await db.open();
  await ensureSeeded(db);
}

describe('seed', () => {
  beforeEach(reset);

  it('builds a consistent seed (all technique references resolve)', () => {
    const seed = buildSeed();
    expect(seed.techniques.length).toBeGreaterThan(60);
    const ids = new Set(seed.techniques.map((t) => t.id));
    for (const t of seed.techniques) for (const r of t.relatedIds) expect(ids.has(r)).toBe(true);
    for (const u of seed.usages) expect(ids.has(u.techniqueId)).toBe(true);
    const slugs = seed.techniques.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('stores the five Instagram references as pending inspection with no analysis', async () => {
    const vids = await db.videos.where('platform').equals('instagram').toArray();
    expect(vids).toHaveLength(5);
    for (const v of vids) {
      expect(v.status).toBe('pending-inspection');
      expect(Object.keys(v.analysis)).toHaveLength(0);
    }
  });

  it('never invents breakdown timestamps or transcripts', async () => {
    const bds = await db.breakdowns.toArray();
    expect(bds.length).toBeGreaterThanOrEqual(10);
    for (const b of bds) expect(b.steps).toHaveLength(0);
    expect(await db.transcripts.count()).toBe(0);
    const usages = await db.usages.where('targetType').equals('breakdown').toArray().catch(async () =>
      (await db.usages.toArray()).filter((u) => u.targetType === 'breakdown'),
    );
    for (const u of usages) {
      expect(u.provenance).toBe('inferred');
      expect(u.timestamp).toBeNull();
    }
  });

  it('is idempotent and does not re-seed deleted data', async () => {
    await deleteTechnique('tech_whip-pan');
    expect(await ensureSeeded(db)).toBe(false);
    expect(await db.techniques.get('tech_whip-pan')).toBeUndefined();
  });

  it('gives every art direction its own moodboard', async () => {
    const ads = await db.artDirections.toArray();
    for (const a of ads) expect(await db.moodboards.where('artDirectionId').equals(a.id).count()).toBe(1);
  });
});

describe('duplicate prevention', () => {
  beforeEach(reset);

  it('finds an existing technique by alias', async () => {
    const hits = await findSimilarTechniques('swish pan');
    expect(hits[0].technique.slug).toBe('whip-pan');
  });

  it('refuses an exact duplicate name', async () => {
    await expect(createTechnique({ name: 'Whip Pan Transition', categoryId: 'cat_transition' })).rejects.toThrow(/already exists/);
  });

  it('detects the same video URL with different tracking params', async () => {
    const found = await findVideoByUrl('https://www.instagram.com/reel/DeP2abcBrB1/?igsh=xyz');
    expect(found?.id).toBe('vid_ig_DeP2abcBrB1');
    expect(canonicalUrl('https://youtu.be/abc123XYZ')).toBe(canonicalUrl('https://www.youtube.com/watch?v=abc123XYZ&t=4s'));
  });

  it('merges a duplicate technique into the original, keeping its usages', async () => {
    const dup = await createTechnique({ name: 'Swoosh Pan', categoryId: 'cat_transition' });
    const vid = await createVideo({ url: 'https://example.com/v1', title: 'V1' });
    await addUsage({ techniqueId: dup, targetType: 'video', targetId: vid, timestamp: 12, note: '', provenance: 'verified' });
    await mergeTechniques(dup, 'tech_whip-pan');
    expect(await db.techniques.get(dup)).toBeUndefined();
    const usages = await db.usages.where('techniqueId').equals('tech_whip-pan').toArray();
    expect(usages.some((u) => u.targetId === vid && u.timestamp === 12)).toBe(true);
    expect((await db.techniques.get('tech_whip-pan'))!.aliases).toContain('Swoosh Pan');
  });
});

describe('relationships', () => {
  beforeEach(reset);

  it('keeps images when an art direction is deleted', async () => {
    const ad = await createArtDirection({ name: 'Test direction' });
    const board = (await db.moodboards.where('artDirectionId').equals(ad).first())!;
    await db.assets.add({ id: 'a1', type: 'note', kind: 'annotation', title: 'n', description: 'x', notes: '', sourceUrl: '', attribution: '', tagIds: [], colors: [], favorite: false, createdAt: 1, updatedAt: 1 });
    await addToMoodboard(board.id, ['a1']);
    await deleteArtDirection(ad);
    expect((await db.moodboards.get(board.id))!.artDirectionId).toBeNull();
    expect(await db.moodboardItems.where('moodboardId').equals(board.id).count()).toBe(1);
  });

  it('reorders and promotes a personal moodboard', async () => {
    const mb = await createMoodboard('Neon nights');
    for (const id of ['x1', 'x2', 'x3']) {
      await db.assets.add({ id, type: 'note', kind: 'annotation', title: id, description: id, notes: '', sourceUrl: '', attribution: '', tagIds: [], colors: [], favorite: false, createdAt: 1, updatedAt: 1 });
    }
    await addToMoodboard(mb, ['x1', 'x2', 'x3']);
    await reorderMoodboard(mb, ['x2', 'x3', 'x1']);
    expect((await boardItems(mb)).map((i) => i.assetId)).toEqual(['x2', 'x3', 'x1']);
    const ad = await promoteMoodboard(mb);
    expect((await db.artDirections.get(ad))!.name).toBe('Neon nights');
  });

  it('toggles collection membership', async () => {
    const c = await createCollection('Test');
    expect(await toggleInCollection(c, 'technique', 'tech_whip-pan')).toBe(true);
    expect(await toggleInCollection(c, 'technique', 'tech_whip-pan')).toBe(false);
  });
});

describe('search', () => {
  beforeEach(reset);

  it('finds techniques, creators and breakdowns across the library', async () => {
    const index = buildIndex(await buildDocs());
    expect(runSearch(index, 'whip pan')[0].id).toBe('tech_whip-pan');
    const resolve = runSearch(index, 'DaVinci Resolve');
    expect(resolve.some((h) => h.kind === 'creator' && h.id === 'cr_ryan_herrick')).toBe(true);
    expect(resolve.some((h) => h.kind === 'technique')).toBe(true);
    const glitch = runSearch(index, 'glitch transition');
    expect(glitch.some((h) => h.kind === 'breakdown' && h.id === 'bd_odisho_glitch')).toBe(true);
    expect(runSearch(index, 'film grain')[0].id).toBe('tech_film-grain');
  });
});

describe('backup', () => {
  beforeEach(reset);

  it('round-trips records and files through a ZIP', async () => {
    await db.files.add({ id: 'file_t', blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' }), mime: 'image/png', name: 't.png' });
    await createVideo({ url: 'https://example.com/roundtrip', title: 'Round trip' });
    const blob = await createBackup(db);
    const counts = { videos: await db.videos.count(), techniques: await db.techniques.count() };

    await db.delete();
    await db.open();
    expect(await db.videos.count()).toBe(0);

    const res = await restoreBackup(blob, 'replace', db);
    expect(res.files).toBe(1);
    expect(await db.videos.count()).toBe(counts.videos);
    expect(await db.techniques.count()).toBe(counts.techniques);
    const f = await db.files.get('file_t');
    expect(new Uint8Array(await f!.blob.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4]));
    expect(await ensureSeeded(db)).toBe(false);
  });

  it('rejects files that are not FRAMEWORK backups', async () => {
    await expect(restoreBackup(new Blob(['{"hello":1}']), 'merge', db)).rejects.toThrow();
  });
});

describe('time helpers', () => {
  it('parses and formats timestamps', () => {
    expect(parseTime('02:40')).toBe(160);
    expect(parseTime('1:02:03')).toBe(3723);
    expect(parseTime('1m30s')).toBe(90);
    expect(parseTime('')).toBeNull();
    expect(parseTime('abc')).toBeNull();
    expect(formatTime(160)).toBe('02:40');
    expect(urlAtTime('https://www.youtube.com/watch?v=abc123XYZ', 75)).toBe('https://www.youtube.com/watch?v=abc123XYZ&t=75s');
  });
});

describe('json export', () => {
  beforeEach(reset);
  it('round-trips a records-only JSON export', async () => {
    const { createJsonExport } = await import('@/db/backup');
    const blob = await createJsonExport(db);
    const n = await db.techniques.count();
    await db.delete();
    await db.open();
    await restoreBackup(blob, 'replace', db);
    expect(await db.techniques.count()).toBe(n);
  });
});
