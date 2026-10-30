// Library-wide search. Builds an in-memory MiniSearch index from the whole
// library; names of related things (software, tags, categories, creators,
// art directions, techniques) are folded into each document so a query like
// "DaVinci Resolve" or "dark cinematic" reaches everything connected to it.

import MiniSearch from 'minisearch';
import { db } from './db';

export type SearchKind =
  | 'video'
  | 'breakdown'
  | 'technique'
  | 'creator'
  | 'artDirection'
  | 'moodboard'
  | 'asset'
  | 'glossary'
  | 'collection';

export interface SearchDoc {
  key: string;
  id: string;
  kind: SearchKind;
  title: string;
  subtitle: string;
  text: string;
  related: string;
  tags: string;
}

export interface SearchHit {
  key: string;
  id: string;
  kind: SearchKind;
  title: string;
  subtitle: string;
  score: number;
}

export const KIND_LABEL: Record<SearchKind, string> = {
  video: 'Video references',
  breakdown: 'Breakdowns',
  technique: 'Techniques',
  creator: 'Creators',
  artDirection: 'Art directions',
  moodboard: 'Moodboards',
  asset: 'Images & assets',
  glossary: 'Glossary',
  collection: 'Collections',
};

export async function buildDocs(): Promise<SearchDoc[]> {
  const [tags, software, categories, genres, niches, creators, videos, breakdowns, techniques, variations, usages, ads, boards, assets, glossary, collections] =
    await Promise.all([
      db.tags.toArray(),
      db.software.toArray(),
      db.categories.toArray(),
      db.genres.toArray(),
      db.niches.toArray(),
      db.creators.toArray(),
      db.videos.toArray(),
      db.breakdowns.toArray(),
      db.techniques.toArray(),
      db.variations.toArray(),
      db.usages.toArray(),
      db.artDirections.toArray(),
      db.moodboards.toArray(),
      db.assets.toArray(),
      db.glossary.toArray(),
      db.collections.toArray(),
    ]);
  const name = <T extends { id: string }>(rows: T[], label: (r: T) => string) => {
    const m = new Map(rows.map((r) => [r.id, label(r)]));
    return (ids: (string | undefined)[] = []) => ids.map((i) => (i ? m.get(i) : undefined)).filter(Boolean).join(' ');
  };
  const tagN = name(tags, (t) => t.name);
  const swN = name(software, (s) => s.name);
  const catN = name(categories, (c) => c.name);
  const genN = name(genres, (g) => g.name);
  const nicN = name(niches, (n) => n.name);
  const crN = name(creators, (c) => `${c.name} ${c.handles.map((h) => h.handle).join(' ')}`);
  const adN = name(ads, (a) => a.name);
  const techN = name(techniques, (t) => t.name);

  const usageBy = new Map<string, string[]>();
  const usageOfTech = new Map<string, string[]>();
  for (const u of usages) {
    const k = `${u.targetType}:${u.targetId}`;
    usageBy.set(k, [...(usageBy.get(k) ?? []), u.techniqueId]);
    usageOfTech.set(u.techniqueId, [...(usageOfTech.get(u.techniqueId) ?? []), `${u.targetType}:${u.targetId}`]);
  }
  const varsBy = new Map<string, string[]>();
  for (const v of variations) varsBy.set(v.techniqueId, [...(varsBy.get(v.techniqueId) ?? []), v.name]);

  const docs: SearchDoc[] = [];
  for (const v of videos) {
    docs.push({
      key: `video:${v.id}`,
      id: v.id,
      kind: 'video',
      title: v.title,
      subtitle: [crN([v.creatorId]), v.platform, v.status.replace('-', ' ')].filter(Boolean).join(' · '),
      text: [v.url, v.inspectionNotes, ...Object.values(v.analysis).map((a) => a?.text ?? '')].join(' '),
      related: [crN([v.creatorId]), genN(v.genreIds), nicN(v.nicheIds), adN(v.artDirectionIds), swN(v.softwareIds), techN(usageBy.get(`video:${v.id}`))].join(' '),
      tags: tagN(v.tagIds),
    });
  }
  for (const b of breakdowns) {
    docs.push({
      key: `breakdown:${b.id}`,
      id: b.id,
      kind: 'breakdown',
      title: b.title,
      subtitle: [crN([b.creatorId]), swN(b.softwareIds)].filter(Boolean).join(' · '),
      text: [b.summary, ...b.steps.map((s) => `${s.label} ${s.description}`)].join(' '),
      related: [crN([b.creatorId]), swN(b.softwareIds), techN(usageBy.get(`breakdown:${b.id}`)), techN(b.steps.flatMap((s) => s.techniqueIds))].join(' '),
      tags: tagN(b.tagIds),
    });
  }
  for (const t of techniques) {
    docs.push({
      key: `technique:${t.id}`,
      id: t.id,
      kind: 'technique',
      title: t.name,
      subtitle: catN([t.categoryId]),
      text: [t.aliases.join(' '), t.summary, t.description, t.keyframeNotes, t.requiredFootage, t.plugins.join(' '), (varsBy.get(t.id) ?? []).join(' ')].join(' '),
      related: [catN([t.categoryId]), swN(t.implementations.map((i) => i.softwareId)), techN(t.relatedIds)].join(' '),
      tags: tagN(t.tagIds),
    });
  }
  for (const c of creators) {
    docs.push({
      key: `creator:${c.id}`,
      id: c.id,
      kind: 'creator',
      title: c.name,
      subtitle: [c.handles[0]?.handle, c.status].filter(Boolean).join(' · '),
      text: [c.handles.map((h) => h.handle).join(' '), c.specialization, c.evaluationNotes, c.breakdownTypes.join(' '), c.watchlist.map((w) => w.title).join(' ')].join(' '),
      related: [swN(c.softwareIds), catN(c.categoryIds), techN(usageBy.get(`creator:${c.id}`))].join(' '),
      tags: tagN(c.tagIds),
    });
  }
  for (const a of ads) {
    docs.push({
      key: `artDirection:${a.id}`,
      id: a.id,
      kind: 'artDirection',
      title: a.name,
      subtitle: a.mood,
      text: [a.description, a.characteristics.join(' '), a.typography, a.notes].join(' '),
      related: techN(usageBy.get(`artDirection:${a.id}`)),
      tags: tagN(a.tagIds),
    });
  }
  for (const m of boards) {
    if (m.artDirectionId) continue; // represented by its art direction
    docs.push({ key: `moodboard:${m.id}`, id: m.id, kind: 'moodboard', title: m.name, subtitle: 'Moodboard', text: m.description, related: '', tags: tagN(m.tagIds) });
  }
  for (const a of assets) {
    docs.push({
      key: `asset:${a.id}`,
      id: a.id,
      kind: 'asset',
      title: a.title || a.fileName || (a.type === 'note' ? a.description.slice(0, 60) : 'Untitled image'),
      subtitle: [a.kind, a.attribution].filter(Boolean).join(' · '),
      text: [a.description, a.notes, a.sourceUrl, a.fileName ?? ''].join(' '),
      related: techN(usageBy.get(`asset:${a.id}`)),
      tags: tagN(a.tagIds),
    });
  }
  for (const g of glossary) {
    docs.push({ key: `glossary:${g.id}`, id: g.id, kind: 'glossary', title: g.term, subtitle: 'Glossary', text: [g.definition, g.aliases.join(' ')].join(' '), related: techN([g.techniqueId]), tags: '' });
  }
  for (const c of collections) {
    docs.push({ key: `collection:${c.id}`, id: c.id, kind: 'collection', title: c.name, subtitle: 'Collection', text: c.description, related: '', tags: '' });
  }
  return docs;
}

export function buildIndex(docs: SearchDoc[]) {
  const index = new MiniSearch<SearchDoc>({
    idField: 'key',
    fields: ['title', 'tags', 'subtitle', 'related', 'text'],
    storeFields: ['kind', 'title', 'subtitle'],
    searchOptions: {
      boost: { title: 4, tags: 2.5, subtitle: 1.5, related: 1.2, text: 1 },
      prefix: true,
      fuzzy: (term) => (term.length > 4 ? 0.2 : false),
      combineWith: 'AND',
    },
  });
  index.addAll(docs);
  return index;
}

export function runSearch(index: MiniSearch<SearchDoc>, query: string, limit = 60): SearchHit[] {
  const q = query.trim();
  if (!q) return [];
  let results = index.search(q);
  if (!results.length) results = index.search(q, { combineWith: 'OR' });
  return results.slice(0, limit).map((r) => ({
    key: r.id as string,
    id: (r.id as string).slice((r.kind as string).length + 1),
    kind: r.kind as SearchKind,
    title: r.title as string,
    subtitle: r.subtitle as string,
    score: r.score,
  }));
}
