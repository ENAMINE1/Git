import Dexie, { type Table } from 'dexie';
import type {
  ArtDirection,
  Asset,
  Category,
  Collection,
  CollectionItem,
  Creator,
  Genre,
  GlossaryTerm,
  Meta,
  Moodboard,
  MoodboardItem,
  Niche,
  Software,
  StoredFile,
  Tag,
  Technique,
  TechniqueUsage,
  TechniqueVariation,
  Transcript,
  VideoBreakdown,
  VideoReference,
} from './types';

export const SCHEMA_VERSION = 1;

export class FrameworkDB extends Dexie {
  tags!: Table<Tag, string>;
  software!: Table<Software, string>;
  genres!: Table<Genre, string>;
  niches!: Table<Niche, string>;
  categories!: Table<Category, string>;
  creators!: Table<Creator, string>;
  videos!: Table<VideoReference, string>;
  breakdowns!: Table<VideoBreakdown, string>;
  transcripts!: Table<Transcript, string>;
  techniques!: Table<Technique, string>;
  variations!: Table<TechniqueVariation, string>;
  usages!: Table<TechniqueUsage, string>;
  artDirections!: Table<ArtDirection, string>;
  moodboards!: Table<Moodboard, string>;
  assets!: Table<Asset, string>;
  files!: Table<StoredFile, string>;
  moodboardItems!: Table<MoodboardItem, string>;
  collections!: Table<Collection, string>;
  collectionItems!: Table<CollectionItem, string>;
  glossary!: Table<GlossaryTerm, string>;
  meta!: Table<Meta, string>;

  constructor(name = 'framework') {
    super(name);
    this.version(SCHEMA_VERSION).stores({
      tags: 'id, &slug, name',
      software: 'id, name',
      genres: 'id, name',
      niches: 'id, name',
      categories: 'id, &slug, order',
      creators: 'id, name, status, role, *softwareIds, *categoryIds, *tagIds, updatedAt',
      videos: 'id, url, platform, creatorId, status, *genreIds, *nicheIds, *artDirectionIds, *softwareIds, *tagIds, createdAt, updatedAt',
      breakdowns: 'id, url, creatorId, referenceVideoId, status, *softwareIds, *tagIds, createdAt, updatedAt',
      transcripts: 'id, breakdownId',
      techniques: 'id, &slug, name, categoryId, *tagIds, *relatedIds, createdAt, updatedAt',
      variations: 'id, techniqueId',
      usages: 'id, techniqueId, variationId, targetId, [targetType+targetId], createdAt',
      artDirections: 'id, name, *tagIds, createdAt, updatedAt',
      moodboards: 'id, name, artDirectionId, createdAt, updatedAt',
      assets: 'id, type, kind, videoId, breakdownId, *tagIds, createdAt',
      files: 'id',
      moodboardItems: 'id, moodboardId, assetId, [moodboardId+order]',
      collections: 'id, name, createdAt, updatedAt',
      collectionItems: 'id, collectionId, entityId, [entityType+entityId]',
      glossary: 'id, term, techniqueId',
      meta: 'key',
    });
  }
}

export const db = new FrameworkDB();

/** Tables included in a backup (everything except the binary files table). */
export const DATA_TABLES = [
  'tags',
  'software',
  'genres',
  'niches',
  'categories',
  'creators',
  'videos',
  'breakdowns',
  'transcripts',
  'techniques',
  'variations',
  'usages',
  'artDirections',
  'moodboards',
  'assets',
  'moodboardItems',
  'collections',
  'collectionItems',
  'glossary',
  'meta',
] as const;
export type DataTable = (typeof DATA_TABLES)[number];
