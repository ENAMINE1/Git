// FRAMEWORK data model.
//
// Three dimensions are kept deliberately separate:
//   Genre         — what kind of video it is            (VideoReference.genreIds)
//   Art direction — how it looks and feels               (VideoReference.artDirectionIds)
//   Technique     — how it is constructed                (TechniqueUsage rows)
//
// Techniques are independent entities. A video never owns a technique; it
// *uses* one through a TechniqueUsage row, so five videos with the same whip
// pan point at one Technique entry.

export type ID = string;

/**
 * Where a piece of information came from.
 * - verified:  confirmed against the original source (watched, read, measured)
 * - inferred:  an observation or interpretation that has not been confirmed
 * - reference: general domain knowledge (technique definitions, glossary)
 * - user:      entered by you; no claim either way
 */
export type Provenance = 'verified' | 'inferred' | 'reference' | 'user';

export type Platform =
  | 'instagram'
  | 'youtube'
  | 'tiktok'
  | 'vimeo'
  | 'x'
  | 'threads'
  | 'web'
  | 'local'
  | 'other';

export interface SourceRef {
  url: string;
  label: string;
  /** ISO date the source was consulted. */
  accessed?: string;
  note?: string;
}

interface Timestamps {
  createdAt: number;
  updatedAt: number;
}

export interface Tag {
  id: ID;
  name: string;
  slug: string;
}

export type SoftwareKind = 'editor' | 'compositor' | '3d' | 'grading' | 'audio' | 'mobile' | 'design' | 'plugin';

export interface Software {
  id: ID;
  name: string;
  vendor?: string;
  kind?: SoftwareKind;
}

export interface Genre {
  id: ID;
  name: string;
  description?: string;
}

export interface Niche {
  id: ID;
  name: string;
}

/** Technique category (Effects, Transitions, …). Extensible. */
export interface Category {
  id: ID;
  slug: string;
  name: string;
  description: string;
  order: number;
}

export type CreatorRole = 'educator' | 'reference' | 'both';
export type CreatorStatus = 'candidate' | 'evaluating' | 'approved' | 'rejected';

export interface Handle {
  platform: Platform;
  handle: string;
  url?: string;
}

export interface Creator extends Timestamps {
  id: ID;
  name: string;
  /** educator = explains how things are made; reference = makes work you study. */
  role: CreatorRole;
  handles: Handle[];
  mainPlatform: Platform;
  channelUrl?: string;
  websiteUrl?: string;
  softwareIds: ID[];
  /** Technique categories the creator specialises in. */
  categoryIds: ID[];
  specialization: string;
  /** e.g. "timeline walkthrough", "effect recreation", "editor reaction" */
  breakdownTypes: string[];
  /** 0 = not yet rated, 1–5 depth of technical explanation. */
  depth: number;
  depthNote: string;
  status: CreatorStatus;
  evaluationNotes: string;
  /** Titles noted during research that are not yet saved as breakdowns. */
  watchlist: { title: string; url?: string }[];
  tagIds: ID[];
  favorite: boolean;
  provenance: Provenance;
  sources: SourceRef[];
}

export type ReferenceStatus = 'pending-inspection' | 'in-progress' | 'inspected';

export const ANALYSIS_KEYS = [
  'visualStyle',
  'genreNiche',
  'transitions',
  'effects',
  'motionGraphics',
  'cinematography',
  'typography',
  'sound',
  'pacing',
] as const;
export type AnalysisKey = (typeof ANALYSIS_KEYS)[number];

export interface AnalysisNote {
  text: string;
  provenance: Provenance;
}

export interface VideoReference extends Timestamps {
  id: ID;
  title: string;
  url: string;
  platform: Platform;
  creatorId?: ID;
  status: ReferenceStatus;
  genreIds: ID[];
  nicheIds: ID[];
  artDirectionIds: ID[];
  softwareIds: ID[];
  tagIds: ID[];
  analysis: Partial<Record<AnalysisKey, AnalysisNote>>;
  /** Inspection checklist step id → done. */
  checklist: Record<string, boolean>;
  inspectionNotes: string;
  /** What to prioritise when inspecting (e.g. capture the timeline). */
  priority?: string;
  coverAssetId?: ID;
  /** A local copy of the video you uploaded (files table). */
  videoFileId?: ID;
  videoFileName?: string;
  favorite: boolean;
  provenance: Provenance;
  sources: SourceRef[];
}

export type BreakdownStatus = 'to-watch' | 'watched' | 'extracted';

export interface BreakdownStep {
  id: ID;
  /** Seconds from the start. null = no timestamp known (never invent one). */
  t: number | null;
  label: string;
  description: string;
  techniqueIds: ID[];
}

export interface VideoBreakdown extends Timestamps {
  id: ID;
  title: string;
  url: string;
  platform: Platform;
  creatorId?: ID;
  /** The finished video this breakdown explains, if saved. */
  referenceVideoId?: ID;
  softwareIds: ID[];
  status: BreakdownStatus;
  format: 'long-form' | 'short-form' | 'article' | 'unknown';
  summary: string;
  steps: BreakdownStep[];
  tagIds: ID[];
  favorite: boolean;
  provenance: Provenance;
  sources: SourceRef[];
}

export interface TranscriptSegment {
  t: number | null;
  text: string;
}

export interface Transcript extends Timestamps {
  id: ID;
  breakdownId: ID;
  origin: 'manual-paste' | 'caption-file';
  language: string;
  raw: string;
  segments: TranscriptSegment[];
}

export type Difficulty = 1 | 2 | 3;

export interface Implementation {
  softwareId: ID;
  steps: string;
}

export interface Technique extends Timestamps {
  id: ID;
  name: string;
  slug: string;
  aliases: string[];
  categoryId: ID;
  /** One-line visual description. */
  summary: string;
  /** How it works — the principle. */
  description: string;
  implementations: Implementation[];
  difficulty: Difficulty;
  requiredFootage: string;
  requiredAssets: string;
  plugins: string[];
  keyframeNotes: string;
  relatedIds: ID[];
  tagIds: ID[];
  favorite: boolean;
  coverAssetId?: ID;
  provenance: Provenance;
  sources: SourceRef[];
}

export interface TechniqueVariation extends Timestamps {
  id: ID;
  techniqueId: ID;
  name: string;
  description: string;
}

export type UsageTarget = 'video' | 'breakdown' | 'asset' | 'creator' | 'artDirection';

/** A technique appearing in (or explained by / typical of) something. */
export interface TechniqueUsage extends Timestamps {
  id: ID;
  techniqueId: ID;
  variationId?: ID;
  targetType: UsageTarget;
  targetId: ID;
  /** Seconds. null when unknown. */
  timestamp: number | null;
  note: string;
  provenance: Provenance;
}

export interface Swatch {
  hex: string;
  name?: string;
}

export interface ArtDirection extends Timestamps {
  id: ID;
  name: string;
  mood: string;
  description: string;
  characteristics: string[];
  palette: Swatch[];
  typography: string;
  notes: string;
  tagIds: ID[];
  coverAssetId?: ID;
  favorite: boolean;
  provenance: Provenance;
}

/** Every art direction owns exactly one moodboard (artDirectionId set). */
export interface Moodboard extends Timestamps {
  id: ID;
  name: string;
  description: string;
  artDirectionId: ID | null;
  coverAssetId?: ID;
  tagIds: ID[];
}

export type AssetType = 'image' | 'link' | 'note' | 'palette';

export const ASSET_KINDS = [
  'frame',
  'screenshot',
  'interface',
  'palette',
  'typography',
  'composition',
  'lighting',
  'texture',
  'motion',
  'annotation',
  'other',
] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export interface Asset extends Timestamps {
  id: ID;
  type: AssetType;
  kind: AssetKind;
  title: string;
  description: string;
  /** What you like about it. */
  notes: string;
  sourceUrl: string;
  attribution: string;
  tagIds: ID[];
  videoId?: ID;
  breakdownId?: ID;
  /** Seconds into the source video, for captured frames. */
  timestamp?: number | null;
  fileId?: ID;
  thumbId?: ID;
  mime?: string;
  width?: number;
  height?: number;
  size?: number;
  fileName?: string;
  /** Dominant colours extracted on upload, or a hand-made palette. */
  colors: string[];
  /** Motion reference link (type 'link'). */
  linkUrl?: string;
  favorite: boolean;
}

export interface StoredFile {
  id: ID;
  blob: Blob;
  mime: string;
  name?: string;
}

export interface MoodboardItem {
  id: ID;
  moodboardId: ID;
  assetId: ID;
  order: number;
  addedAt: number;
}

export type EntityType =
  | 'video'
  | 'technique'
  | 'asset'
  | 'artDirection'
  | 'creator'
  | 'breakdown'
  | 'moodboard';

export interface Collection extends Timestamps {
  id: ID;
  name: string;
  description: string;
}

export interface CollectionItem {
  id: ID;
  collectionId: ID;
  entityType: EntityType;
  entityId: ID;
  order: number;
  note: string;
  addedAt: number;
}

export interface GlossaryTerm extends Timestamps {
  id: ID;
  term: string;
  definition: string;
  aliases: string[];
  techniqueId?: ID;
  provenance: Provenance;
}

export interface Meta {
  key: string;
  value: unknown;
}
