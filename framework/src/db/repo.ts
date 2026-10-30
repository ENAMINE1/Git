// CRUD and relationship helpers. Every write goes through here so that
// timestamps, cascades and cross-references stay consistent.

import { db } from './db';
import type {
  ArtDirection,
  Asset,
  Collection,
  Creator,
  EntityType,
  GlossaryTerm,
  ID,
  Moodboard,
  Tag,
  Technique,
  TechniqueUsage,
  TechniqueVariation,
  UsageTarget,
  VideoBreakdown,
  VideoReference,
} from './types';
import { canonicalUrl, detectPlatform, normalizeName, similarity, slugify, uid } from '@/lib/util';

const now = () => Date.now();

// ───────────────────────────── Tags

export async function ensureTag(name: string): Promise<ID> {
  const clean = name.trim().replace(/^#/, '');
  const slug = slugify(clean);
  if (!slug) throw new Error('Empty tag');
  const existing = await db.tags.where('slug').equals(slug).first();
  if (existing) return existing.id;
  const tag: Tag = { id: uid('tag'), name: clean.toLowerCase(), slug };
  await db.tags.add(tag);
  return tag.id;
}

export async function deleteTag(id: ID) {
  await db.transaction('rw', [db.tags, db.videos, db.breakdowns, db.techniques, db.creators, db.artDirections, db.assets, db.moodboards], async () => {
    for (const t of [db.videos, db.breakdowns, db.techniques, db.creators, db.artDirections, db.assets, db.moodboards] as const) {
      await (t as typeof db.videos).where('tagIds').equals(id).modify((row: { tagIds: ID[] }) => {
        row.tagIds = row.tagIds.filter((x) => x !== id);
      });
    }
    await db.tags.delete(id);
  });
}

// ───────────────────────────── Video references

export async function findVideoByUrl(url: string): Promise<VideoReference | undefined> {
  const key = canonicalUrl(url);
  const all = await db.videos.toArray();
  return all.find((v) => canonicalUrl(v.url) === key);
}

export async function createVideo(input: Partial<VideoReference> & { url: string; title?: string }): Promise<ID> {
  const id = uid('vid');
  const video: VideoReference = {
    id,
    title: input.title?.trim() || input.url,
    url: input.url.trim(),
    platform: input.platform ?? detectPlatform(input.url),
    creatorId: input.creatorId,
    status: input.status ?? 'pending-inspection',
    genreIds: input.genreIds ?? [],
    nicheIds: input.nicheIds ?? [],
    artDirectionIds: input.artDirectionIds ?? [],
    softwareIds: input.softwareIds ?? [],
    tagIds: input.tagIds ?? [],
    analysis: input.analysis ?? {},
    checklist: input.checklist ?? { record: true },
    inspectionNotes: input.inspectionNotes ?? '',
    priority: input.priority,
    favorite: false,
    provenance: 'user',
    sources: input.sources ?? [{ url: input.url.trim(), label: 'Original', accessed: new Date().toISOString().slice(0, 10) }],
    createdAt: now(),
    updatedAt: now(),
  };
  await db.videos.add(video);
  return id;
}

export async function updateVideo(id: ID, patch: Partial<VideoReference>) {
  await db.videos.update(id, { ...patch, updatedAt: now() });
}

export async function deleteVideo(id: ID) {
  await db.transaction('rw', [db.videos, db.usages, db.assets, db.breakdowns, db.collectionItems, db.files], async () => {
    const v = await db.videos.get(id);
    if (v?.videoFileId) await db.files.delete(v.videoFileId);
    await db.usages.where('[targetType+targetId]').equals(['video', id]).delete();
    await db.assets.where('videoId').equals(id).modify((a: Asset) => {
      delete a.videoId;
    });
    await db.breakdowns.where('referenceVideoId').equals(id).modify((b: VideoBreakdown) => {
      delete b.referenceVideoId;
    });
    await db.collectionItems.where('[entityType+entityId]').equals(['video', id]).delete();
    await db.videos.delete(id);
  });
}

// ───────────────────────────── Creators

export async function findCreatorByHandle(handle: string): Promise<Creator | undefined> {
  const h = handle.trim().replace(/^@/, '').toLowerCase();
  if (!h) return undefined;
  const all = await db.creators.toArray();
  return all.find(
    (c) =>
      c.handles.some((x) => x.handle.replace(/^@/, '').toLowerCase() === h) || normalizeName(c.name) === normalizeName(handle),
  );
}

export async function createCreator(input: Partial<Creator> & { name: string }): Promise<ID> {
  const id = uid('cr');
  const c: Creator = {
    id,
    name: input.name.trim(),
    role: input.role ?? 'educator',
    handles: input.handles ?? [],
    mainPlatform: input.mainPlatform ?? 'youtube',
    channelUrl: input.channelUrl,
    websiteUrl: input.websiteUrl,
    softwareIds: input.softwareIds ?? [],
    categoryIds: input.categoryIds ?? [],
    specialization: input.specialization ?? '',
    breakdownTypes: input.breakdownTypes ?? [],
    depth: input.depth ?? 0,
    depthNote: input.depthNote ?? '',
    status: input.status ?? 'candidate',
    evaluationNotes: input.evaluationNotes ?? '',
    watchlist: input.watchlist ?? [],
    tagIds: input.tagIds ?? [],
    favorite: false,
    provenance: 'user',
    sources: input.sources ?? [],
    createdAt: now(),
    updatedAt: now(),
  };
  await db.creators.add(c);
  return id;
}

export async function updateCreator(id: ID, patch: Partial<Creator>) {
  await db.creators.update(id, { ...patch, updatedAt: now() });
}

export async function deleteCreator(id: ID) {
  await db.transaction('rw', [db.creators, db.videos, db.breakdowns, db.usages, db.collectionItems], async () => {
    await db.videos.where('creatorId').equals(id).modify((v: VideoReference) => {
      delete v.creatorId;
    });
    await db.breakdowns.where('creatorId').equals(id).modify((b: VideoBreakdown) => {
      delete b.creatorId;
    });
    await db.usages.where('[targetType+targetId]').equals(['creator', id]).delete();
    await db.collectionItems.where('[entityType+entityId]').equals(['creator', id]).delete();
    await db.creators.delete(id);
  });
}

// ───────────────────────────── Breakdowns

export async function createBreakdown(input: Partial<VideoBreakdown> & { url: string; title: string }): Promise<ID> {
  const id = uid('bd');
  const b: VideoBreakdown = {
    id,
    title: input.title.trim(),
    url: input.url.trim(),
    platform: input.platform ?? detectPlatform(input.url),
    creatorId: input.creatorId,
    referenceVideoId: input.referenceVideoId,
    softwareIds: input.softwareIds ?? [],
    status: input.status ?? 'to-watch',
    format: input.format ?? 'unknown',
    summary: input.summary ?? '',
    steps: input.steps ?? [],
    tagIds: input.tagIds ?? [],
    favorite: false,
    provenance: input.provenance ?? 'user',
    sources: input.sources ?? [{ url: input.url.trim(), label: 'Original', accessed: new Date().toISOString().slice(0, 10) }],
    createdAt: now(),
    updatedAt: now(),
  };
  await db.breakdowns.add(b);
  return id;
}

export async function updateBreakdown(id: ID, patch: Partial<VideoBreakdown>) {
  await db.breakdowns.update(id, { ...patch, updatedAt: now() });
}

export async function deleteBreakdown(id: ID) {
  await db.transaction('rw', [db.breakdowns, db.usages, db.transcripts, db.assets, db.collectionItems], async () => {
    await db.usages.where('[targetType+targetId]').equals(['breakdown', id]).delete();
    await db.transcripts.where('breakdownId').equals(id).delete();
    await db.assets.where('breakdownId').equals(id).modify((a: Asset) => {
      delete a.breakdownId;
    });
    await db.collectionItems.where('[entityType+entityId]').equals(['breakdown', id]).delete();
    await db.breakdowns.delete(id);
  });
}

// ───────────────────────────── Techniques

export interface SimilarTechnique {
  technique: Technique;
  score: number;
  matched: string;
}

/**
 * Finds existing techniques that look like `name` — by name or alias —
 * so the UI can steer you to the existing entry instead of a duplicate.
 */
export async function findSimilarTechniques(name: string, limit = 5): Promise<SimilarTechnique[]> {
  const q = normalizeName(name);
  if (q.length < 2) return [];
  const all = await db.techniques.toArray();
  const scored: SimilarTechnique[] = [];
  for (const t of all) {
    let best = { score: 0, matched: t.name };
    for (const label of [t.name, ...t.aliases]) {
      const n = normalizeName(label);
      let s = similarity(q, n);
      if (n === q) s = 1;
      else if (n.includes(q) || q.includes(n)) s = Math.max(s, 0.75);
      if (s > best.score) best = { score: s, matched: label };
    }
    if (best.score >= 0.45) scored.push({ technique: t, ...best });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

export async function createTechnique(input: Partial<Technique> & { name: string; categoryId: ID }): Promise<ID> {
  let slug = slugify(input.name);
  const key = normalizeName(input.name);
  const taken =
    (await db.techniques.where('slug').equals(slug).first()) ??
    (await db.techniques.filter((t) => [t.name, ...t.aliases].some((n) => normalizeName(n) === key)).first());
  if (taken) throw new Error(`"${taken.name}" already exists — open it instead of creating a duplicate.`);
  if (!slug) slug = uid('t');
  const id = uid('tech');
  const t: Technique = {
    id,
    name: input.name.trim(),
    slug,
    aliases: input.aliases ?? [],
    categoryId: input.categoryId,
    summary: input.summary ?? '',
    description: input.description ?? '',
    implementations: input.implementations ?? [],
    difficulty: input.difficulty ?? 2,
    requiredFootage: input.requiredFootage ?? '',
    requiredAssets: input.requiredAssets ?? '',
    plugins: input.plugins ?? [],
    keyframeNotes: input.keyframeNotes ?? '',
    relatedIds: input.relatedIds ?? [],
    tagIds: input.tagIds ?? [],
    favorite: false,
    provenance: 'user',
    sources: input.sources ?? [],
    createdAt: now(),
    updatedAt: now(),
  };
  await db.techniques.add(t);
  return id;
}

export async function updateTechnique(id: ID, patch: Partial<Technique>) {
  if (patch.name) {
    const slug = slugify(patch.name);
    const clash = await db.techniques.where('slug').equals(slug).first();
    if (clash && clash.id !== id) throw new Error(`"${clash.name}" already uses that name.`);
    patch.slug = slug;
  }
  await db.techniques.update(id, { ...patch, updatedAt: now() });
}

/** Links two techniques both ways. */
export async function setRelated(a: ID, b: ID, related: boolean) {
  await db.transaction('rw', db.techniques, async () => {
    for (const [x, y] of [
      [a, b],
      [b, a],
    ]) {
      const t = await db.techniques.get(x);
      if (!t) continue;
      const set = new Set(t.relatedIds);
      if (related) set.add(y);
      else set.delete(y);
      await db.techniques.update(x, { relatedIds: [...set], updatedAt: now() });
    }
  });
}

export async function deleteTechnique(id: ID) {
  await db.transaction('rw', [db.techniques, db.variations, db.usages, db.glossary, db.breakdowns, db.collectionItems], async () => {
    await db.variations.where('techniqueId').equals(id).delete();
    await db.usages.where('techniqueId').equals(id).delete();
    await db.techniques.where('relatedIds').equals(id).modify((t: Technique) => {
      t.relatedIds = t.relatedIds.filter((x) => x !== id);
    });
    await db.glossary.where('techniqueId').equals(id).modify((g: GlossaryTerm) => {
      delete g.techniqueId;
    });
    await db.breakdowns.toCollection().modify((b: VideoBreakdown) => {
      b.steps = b.steps.map((s) => ({ ...s, techniqueIds: s.techniqueIds.filter((x) => x !== id) }));
    });
    await db.collectionItems.where('[entityType+entityId]').equals(['technique', id]).delete();
    await db.techniques.delete(id);
  });
}

/**
 * Merges `fromId` into `intoId`: usages, variations, relations, glossary and
 * collection items move over, aliases are combined, then `fromId` is deleted.
 */
export async function mergeTechniques(fromId: ID, intoId: ID) {
  if (fromId === intoId) return;
  await db.transaction('rw', [db.techniques, db.variations, db.usages, db.glossary, db.breakdowns, db.collectionItems], async () => {
    const from = await db.techniques.get(fromId);
    const into = await db.techniques.get(intoId);
    if (!from || !into) throw new Error('Technique not found');
    await db.usages.where('techniqueId').equals(fromId).modify({ techniqueId: intoId });
    await db.variations.where('techniqueId').equals(fromId).modify({ techniqueId: intoId });
    await db.glossary.where('techniqueId').equals(fromId).modify({ techniqueId: intoId });
    await db.collectionItems.where('[entityType+entityId]').equals(['technique', fromId]).modify({ entityId: intoId });
    await db.techniques.where('relatedIds').equals(fromId).modify((t: Technique) => {
      t.relatedIds = [...new Set(t.relatedIds.map((x) => (x === fromId ? intoId : x)))].filter((x) => x !== t.id);
    });
    await db.breakdowns.toCollection().modify((b: VideoBreakdown) => {
      b.steps = b.steps.map((s) => ({ ...s, techniqueIds: [...new Set(s.techniqueIds.map((x) => (x === fromId ? intoId : x)))] }));
    });
    const aliases = [...new Set([...into.aliases, from.name, ...from.aliases])].filter(
      (a) => normalizeName(a) !== normalizeName(into.name),
    );
    const implementations = [...into.implementations];
    for (const imp of from.implementations) {
      if (!implementations.some((i) => i.softwareId === imp.softwareId)) implementations.push(imp);
    }
    await db.techniques.update(intoId, {
      aliases,
      implementations,
      relatedIds: [...new Set([...into.relatedIds, ...from.relatedIds])].filter((x) => x !== intoId && x !== fromId),
      tagIds: [...new Set([...into.tagIds, ...from.tagIds])],
      updatedAt: now(),
    });
    await db.techniques.delete(fromId);
  });
}

export async function addVariation(techniqueId: ID, name: string, description = ''): Promise<ID> {
  const v: TechniqueVariation = { id: uid('var'), techniqueId, name: name.trim(), description, createdAt: now(), updatedAt: now() };
  await db.variations.add(v);
  return v.id;
}

export async function deleteVariation(id: ID) {
  await db.transaction('rw', [db.variations, db.usages], async () => {
    await db.usages.where('variationId').equals(id).modify((u: TechniqueUsage) => {
      delete u.variationId;
    });
    await db.variations.delete(id);
  });
}

// ───────────────────────────── Technique usages

export async function addUsage(input: Omit<TechniqueUsage, 'id' | 'createdAt' | 'updatedAt'>): Promise<ID> {
  const u: TechniqueUsage = { ...input, id: uid('use'), createdAt: now(), updatedAt: now() };
  await db.usages.add(u);
  return u.id;
}

export async function updateUsage(id: ID, patch: Partial<TechniqueUsage>) {
  await db.usages.update(id, { ...patch, updatedAt: now() });
}

export async function deleteUsage(id: ID) {
  await db.usages.delete(id);
}

export async function usagesFor(targetType: UsageTarget, targetId: ID) {
  return db.usages.where('[targetType+targetId]').equals([targetType, targetId]).toArray();
}

// ───────────────────────────── Art directions & moodboards

export async function createArtDirection(input: Partial<ArtDirection> & { name: string }): Promise<ID> {
  const id = uid('ad');
  const a: ArtDirection = {
    id,
    name: input.name.trim(),
    mood: input.mood ?? '',
    description: input.description ?? '',
    characteristics: input.characteristics ?? [],
    palette: input.palette ?? [],
    typography: input.typography ?? '',
    notes: input.notes ?? '',
    tagIds: input.tagIds ?? [],
    favorite: false,
    provenance: 'user',
    createdAt: now(),
    updatedAt: now(),
  };
  await db.transaction('rw', [db.artDirections, db.moodboards], async () => {
    await db.artDirections.add(a);
    await db.moodboards.add({ id: uid('mb'), name: a.name, description: '', artDirectionId: id, tagIds: [], createdAt: now(), updatedAt: now() });
  });
  return id;
}

export async function updateArtDirection(id: ID, patch: Partial<ArtDirection>) {
  await db.transaction('rw', [db.artDirections, db.moodboards], async () => {
    await db.artDirections.update(id, { ...patch, updatedAt: now() });
    if (patch.name) await db.moodboards.where('artDirectionId').equals(id).modify({ name: patch.name, updatedAt: now() });
  });
}

/** Deleting a direction keeps its images: its moodboard becomes a personal board. */
export async function deleteArtDirection(id: ID) {
  await db.transaction('rw', [db.artDirections, db.moodboards, db.videos, db.usages, db.collectionItems], async () => {
    await db.moodboards.where('artDirectionId').equals(id).modify((m: Moodboard) => {
      m.artDirectionId = null;
    });
    await db.videos.where('artDirectionIds').equals(id).modify((v: VideoReference) => {
      v.artDirectionIds = v.artDirectionIds.filter((x) => x !== id);
    });
    await db.usages.where('[targetType+targetId]').equals(['artDirection', id]).delete();
    await db.collectionItems.where('[entityType+entityId]').equals(['artDirection', id]).delete();
    await db.artDirections.delete(id);
  });
}

export async function boardForArtDirection(artDirectionId: ID): Promise<Moodboard> {
  const mb = await db.moodboards.where('artDirectionId').equals(artDirectionId).first();
  if (mb) return mb;
  const ad = await db.artDirections.get(artDirectionId);
  const created: Moodboard = {
    id: uid('mb'),
    name: ad?.name ?? 'Moodboard',
    description: '',
    artDirectionId,
    tagIds: [],
    createdAt: now(),
    updatedAt: now(),
  };
  await db.moodboards.add(created);
  return created;
}

export async function createMoodboard(name: string, description = ''): Promise<ID> {
  const id = uid('mb');
  await db.moodboards.add({ id, name: name.trim(), description, artDirectionId: null, tagIds: [], createdAt: now(), updatedAt: now() });
  return id;
}

export async function updateMoodboard(id: ID, patch: Partial<Moodboard>) {
  await db.moodboards.update(id, { ...patch, updatedAt: now() });
}

/** Turns a personal moodboard into a formal art direction. */
export async function promoteMoodboard(id: ID): Promise<ID> {
  const mb = await db.moodboards.get(id);
  if (!mb) throw new Error('Moodboard not found');
  if (mb.artDirectionId) return mb.artDirectionId;
  const adId = uid('ad');
  await db.transaction('rw', [db.artDirections, db.moodboards], async () => {
    await db.artDirections.add({
      id: adId,
      name: mb.name,
      mood: '',
      description: mb.description,
      characteristics: [],
      palette: [],
      typography: '',
      notes: '',
      tagIds: mb.tagIds,
      favorite: false,
      coverAssetId: mb.coverAssetId,
      provenance: 'user',
      createdAt: now(),
      updatedAt: now(),
    });
    await db.moodboards.update(id, { artDirectionId: adId, updatedAt: now() });
  });
  return adId;
}

export async function deleteMoodboard(id: ID) {
  await db.transaction('rw', [db.moodboards, db.moodboardItems, db.collectionItems], async () => {
    const mb = await db.moodboards.get(id);
    if (mb?.artDirectionId) throw new Error('This board belongs to an art direction — delete the art direction instead.');
    await db.moodboardItems.where('moodboardId').equals(id).delete();
    await db.collectionItems.where('[entityType+entityId]').equals(['moodboard', id]).delete();
    await db.moodboards.delete(id);
  });
}

export async function boardItems(moodboardId: ID) {
  return db.moodboardItems.where('moodboardId').equals(moodboardId).sortBy('order');
}

export async function addToMoodboard(moodboardId: ID, assetIds: ID[]) {
  await db.transaction('rw', [db.moodboardItems, db.moodboards], async () => {
    const items = await db.moodboardItems.where('moodboardId').equals(moodboardId).toArray();
    const present = new Set(items.map((i) => i.assetId));
    // New items go to the front (most recent first).
    let top = items.reduce((m, i) => Math.min(m, i.order), 0);
    for (const assetId of assetIds) {
      if (present.has(assetId)) continue;
      top -= 1;
      await db.moodboardItems.add({ id: uid('mbi'), moodboardId, assetId, order: top, addedAt: now() });
    }
    await db.moodboards.update(moodboardId, { updatedAt: now() });
  });
}

export async function removeFromMoodboard(moodboardId: ID, assetId: ID) {
  await db.moodboardItems.where('moodboardId').equals(moodboardId).and((i) => i.assetId === assetId).delete();
}

export async function moveToMoodboard(fromId: ID, toId: ID, assetId: ID) {
  await addToMoodboard(toId, [assetId]);
  if (fromId !== toId) await removeFromMoodboard(fromId, assetId);
}

/** Persists a new order for a board, given asset ids in display order. */
export async function reorderMoodboard(moodboardId: ID, orderedAssetIds: ID[]) {
  await db.transaction('rw', db.moodboardItems, async () => {
    const items = await db.moodboardItems.where('moodboardId').equals(moodboardId).toArray();
    const byAsset = new Map(items.map((i) => [i.assetId, i]));
    let order = 0;
    for (const assetId of orderedAssetIds) {
      const item = byAsset.get(assetId);
      if (item) await db.moodboardItems.update(item.id, { order: order++ });
    }
  });
}

// ───────────────────────────── Assets

export async function updateAsset(id: ID, patch: Partial<Asset>) {
  await db.assets.update(id, { ...patch, updatedAt: now() });
}

export async function deleteAsset(id: ID) {
  await db.transaction(
    'rw',
    [db.assets, db.files, db.moodboardItems, db.usages, db.collectionItems, db.videos, db.techniques, db.artDirections, db.moodboards],
    async () => {
      const a = await db.assets.get(id);
      if (!a) return;
      if (a.fileId) await db.files.delete(a.fileId);
      if (a.thumbId) await db.files.delete(a.thumbId);
      await db.moodboardItems.where('assetId').equals(id).delete();
      await db.usages.where('[targetType+targetId]').equals(['asset', id]).delete();
      await db.collectionItems.where('[entityType+entityId]').equals(['asset', id]).delete();
      for (const table of [db.videos, db.techniques, db.artDirections, db.moodboards] as const) {
        await (table as typeof db.videos).toCollection().modify((row: { coverAssetId?: ID }) => {
          if (row.coverAssetId === id) delete row.coverAssetId;
        });
      }
      await db.assets.delete(id);
    },
  );
}

/** Moodboards (and through them, art directions) an asset belongs to. */
export async function boardsForAsset(assetId: ID): Promise<Moodboard[]> {
  const items = await db.moodboardItems.where('assetId').equals(assetId).toArray();
  const boards = await db.moodboards.bulkGet(items.map((i) => i.moodboardId));
  return boards.filter((b): b is Moodboard => !!b);
}

// ───────────────────────────── Collections

export async function createCollection(name: string, description = ''): Promise<ID> {
  const c: Collection = { id: uid('col'), name: name.trim(), description, createdAt: now(), updatedAt: now() };
  await db.collections.add(c);
  return c.id;
}

export async function updateCollection(id: ID, patch: Partial<Collection>) {
  await db.collections.update(id, { ...patch, updatedAt: now() });
}

export async function deleteCollection(id: ID) {
  await db.transaction('rw', [db.collections, db.collectionItems], async () => {
    await db.collectionItems.where('collectionId').equals(id).delete();
    await db.collections.delete(id);
  });
}

export async function toggleInCollection(collectionId: ID, entityType: EntityType, entityId: ID): Promise<boolean> {
  return db.transaction('rw', [db.collectionItems, db.collections], async () => {
    const existing = await db.collectionItems
      .where('[entityType+entityId]')
      .equals([entityType, entityId])
      .and((i) => i.collectionId === collectionId)
      .first();
    if (existing) {
      await db.collectionItems.delete(existing.id);
      return false;
    }
    const count = await db.collectionItems.where('collectionId').equals(collectionId).count();
    await db.collectionItems.add({ id: uid('ci'), collectionId, entityType, entityId, order: count, note: '', addedAt: now() });
    await db.collections.update(collectionId, { updatedAt: now() });
    return true;
  });
}

// ───────────────────────────── Glossary

export async function saveGlossaryTerm(input: Partial<GlossaryTerm> & { term: string; definition: string }): Promise<ID> {
  if (input.id) {
    await db.glossary.update(input.id, { ...input, updatedAt: now() });
    return input.id;
  }
  const g: GlossaryTerm = {
    id: uid('term'),
    term: input.term.trim(),
    definition: input.definition,
    aliases: input.aliases ?? [],
    techniqueId: input.techniqueId,
    provenance: 'user',
    createdAt: now(),
    updatedAt: now(),
  };
  await db.glossary.add(g);
  return g.id;
}

export async function deleteGlossaryTerm(id: ID) {
  await db.glossary.delete(id);
}

// ───────────────────────────── Favorites

type FavTable = 'videos' | 'techniques' | 'artDirections' | 'creators' | 'assets' | 'breakdowns';

export async function toggleFavorite(table: FavTable, id: ID) {
  const t = db.table(table);
  const row = (await t.get(id)) as { favorite?: boolean } | undefined;
  if (row) await t.update(id, { favorite: !row.favorite, updatedAt: now() });
}

// ───────────────────────────── Taxonomy (software, genres, niches, categories)

export type TaxonomyKind = 'software' | 'genres' | 'niches' | 'categories';

/** Number of records referencing a taxonomy entry. */
export async function taxonomyUsage(kind: TaxonomyKind, id: ID): Promise<number> {
  switch (kind) {
    case 'software':
      return (
        (await db.videos.where('softwareIds').equals(id).count()) +
        (await db.breakdowns.where('softwareIds').equals(id).count()) +
        (await db.creators.where('softwareIds').equals(id).count()) +
        (await db.techniques.filter((t) => t.implementations.some((i) => i.softwareId === id)).count())
      );
    case 'genres':
      return db.videos.where('genreIds').equals(id).count();
    case 'niches':
      return db.videos.where('nicheIds').equals(id).count();
    case 'categories':
      return (await db.techniques.where('categoryId').equals(id).count()) + (await db.creators.where('categoryIds').equals(id).count());
  }
}

export async function renameTaxonomy(kind: TaxonomyKind, id: ID, name: string) {
  await db.table(kind).update(id, { name: name.trim() });
}

export async function addTaxonomy(kind: TaxonomyKind, name: string): Promise<ID> {
  const id = uid({ software: 'sw', genres: 'gen', niches: 'nic', categories: 'cat' }[kind]);
  if (kind === 'categories') {
    const order = (await db.categories.count()) + 1;
    await db.categories.add({ id, name: name.trim(), slug: slugify(name), description: '', order });
  } else {
    await db.table(kind).add({ id, name: name.trim() });
  }
  return id;
}

/** Deletes a taxonomy entry and strips it from every record. Categories must be unused. */
export async function deleteTaxonomy(kind: TaxonomyKind, id: ID) {
  if (kind === 'categories' && (await db.techniques.where('categoryId').equals(id).count())) {
    throw new Error('Move its techniques to another category first.');
  }
  await db.transaction('rw', [db.table(kind), db.videos, db.breakdowns, db.creators, db.techniques], async () => {
    const strip = (field: string) => (row: object) => {
      const r = row as Record<string, ID[]>;
      r[field] = r[field].filter((x) => x !== id);
    };
    if (kind === 'software') {
      await db.videos.where('softwareIds').equals(id).modify(strip('softwareIds'));
      await db.breakdowns.where('softwareIds').equals(id).modify(strip('softwareIds'));
      await db.creators.where('softwareIds').equals(id).modify(strip('softwareIds'));
      await db.techniques.toCollection().modify((t: Technique) => {
        t.implementations = t.implementations.filter((i) => i.softwareId !== id);
      });
    }
    if (kind === 'genres') await db.videos.where('genreIds').equals(id).modify(strip('genreIds'));
    if (kind === 'niches') await db.videos.where('nicheIds').equals(id).modify(strip('nicheIds'));
    if (kind === 'categories') await db.creators.where('categoryIds').equals(id).modify(strip('categoryIds'));
    await db.table(kind).delete(id);
  });
}
