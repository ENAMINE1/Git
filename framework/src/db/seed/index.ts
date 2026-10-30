import type { FrameworkDB } from '../db';
import type {
  ArtDirection,
  Collection,
  Creator,
  GlossaryTerm,
  Moodboard,
  Tag,
  Technique,
  TechniqueUsage,
  TechniqueVariation,
  VideoBreakdown,
  VideoReference,
} from '../types';
import { slugify } from '@/lib/util';
import { CATEGORIES, GENRES, NICHES, SOFTWARE } from './taxonomy';
import { SW_KEY_TO_ID, TECHNIQUES } from './techniques';
import { BREAKDOWNS, CREATORS, REFERENCES } from './research';
import { ART_DIRECTIONS, GLOSSARY, STARTER_COLLECTIONS, STARTER_MOODBOARDS } from './library';

export const SEED_VERSION = 1;

const techId = (slug: string) => `tech_${slug}`;

export function buildSeed(now = Date.now()) {
  const stamp = { createdAt: now, updatedAt: now };
  const slugs = new Set(TECHNIQUES.map((t) => t.slug));
  const assertSlug = (s: string, where: string) => {
    if (!slugs.has(s)) throw new Error(`Seed references unknown technique "${s}" in ${where}`);
    return techId(s);
  };

  const tags: Tag[] = [{ id: 'tag_seed_reference', name: 'seed reference', slug: 'seed-reference' }];

  const techniques: Technique[] = [];
  const variations: TechniqueVariation[] = [];
  for (const t of TECHNIQUES) {
    const id = techId(t.slug);
    techniques.push({
      id,
      name: t.name,
      slug: t.slug,
      aliases: t.aliases ?? [],
      categoryId: `cat_${t.cat}`,
      summary: t.summary,
      description: t.description,
      implementations: Object.entries(t.impl ?? {}).map(([k, steps]) => ({
        softwareId: SW_KEY_TO_ID[k as keyof typeof SW_KEY_TO_ID],
        steps: steps as string,
      })),
      difficulty: t.difficulty,
      requiredFootage: t.footage ?? '',
      requiredAssets: t.assets ?? '',
      plugins: t.plugins ?? [],
      keyframeNotes: t.keyframes ?? '',
      relatedIds: (t.related ?? []).map((r) => assertSlug(r, t.slug)),
      tagIds: [],
      favorite: false,
      provenance: 'reference',
      sources: [],
      ...stamp,
    });
    (t.variations ?? []).forEach(([name, description], i) =>
      variations.push({ id: `var_${t.slug}_${i}`, techniqueId: id, name, description, ...stamp }),
    );
  }

  const creators: Creator[] = CREATORS.map((c) => ({ ...c, tagIds: [], favorite: false, ...stamp }));
  const videos: VideoReference[] = REFERENCES.map((r) => ({ ...r, ...stamp }));

  const usages: TechniqueUsage[] = [];
  const breakdowns: VideoBreakdown[] = BREAKDOWNS.map(({ inferred, ...b }) => {
    inferred.forEach((slug, i) =>
      usages.push({
        id: `use_${b.id}_${i}`,
        techniqueId: assertSlug(slug, b.id),
        targetType: 'breakdown',
        targetId: b.id,
        timestamp: null,
        note: 'Suggested from the video title only — confirm after watching.',
        provenance: 'inferred',
        ...stamp,
      }),
    );
    return { ...b, status: 'to-watch', steps: [], tagIds: [], favorite: false, ...stamp };
  });

  const artDirections: ArtDirection[] = [];
  const moodboards: Moodboard[] = [];
  for (const a of ART_DIRECTIONS) {
    artDirections.push({
      id: a.id,
      name: a.name,
      mood: a.mood,
      description: a.description,
      characteristics: a.characteristics,
      typography: a.typography,
      palette: [],
      notes: '',
      tagIds: [],
      favorite: false,
      provenance: 'reference',
      ...stamp,
    });
    moodboards.push({ id: `mb_${a.id}`, name: a.name, description: '', artDirectionId: a.id, tagIds: [], ...stamp });
    a.techniques.forEach((slug, i) =>
      usages.push({
        id: `use_${a.id}_${i}`,
        techniqueId: assertSlug(slug, a.id),
        targetType: 'artDirection',
        targetId: a.id,
        timestamp: null,
        note: 'Typical of this direction (starter definition).',
        provenance: 'reference',
        ...stamp,
      }),
    );
  }
  for (const m of STARTER_MOODBOARDS) {
    moodboards.push({ id: m.id, name: m.name, description: '', artDirectionId: null, tagIds: [], ...stamp });
  }

  const collections: Collection[] = STARTER_COLLECTIONS.map((c) => ({ id: c.id, name: c.name, description: '', ...stamp }));

  const glossary: GlossaryTerm[] = GLOSSARY.map((g) => ({
    id: `term_${slugify(g.term)}`,
    term: g.term,
    definition: g.definition,
    aliases: g.aliases ?? [],
    techniqueId: g.technique ? assertSlug(g.technique, g.term) : undefined,
    provenance: 'reference',
    ...stamp,
  }));

  return {
    tags,
    software: SOFTWARE,
    genres: GENRES,
    niches: NICHES,
    categories: CATEGORIES,
    techniques,
    variations,
    creators,
    videos,
    breakdowns,
    usages,
    artDirections,
    moodboards,
    collections,
    glossary,
  };
}

/** Seeds an empty library once. Never re-seeds over your edits or deletions. */
export async function ensureSeeded(db: FrameworkDB): Promise<boolean> {
  const done = await db.meta.get('seedVersion');
  if (done) return false;
  const seed = buildSeed();
  await db.transaction('rw', db.tables, async () => {
    // Re-check inside the transaction so two tabs can't seed twice.
    if (await db.meta.get('seedVersion')) return;
    for (const [table, rows] of Object.entries(seed)) {
      await db.table(table).bulkPut(rows as unknown[]);
    }
    await db.meta.put({ key: 'seedVersion', value: SEED_VERSION });
    await db.meta.put({ key: 'seededAt', value: new Date().toISOString() });
  });
  return true;
}
