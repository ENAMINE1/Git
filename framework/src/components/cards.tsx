import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowUpRight, CircleDashed, Clock, Film, Layers } from 'lucide-react';
import { db } from '@/db/db';
import type { ArtDirection, Asset, Collection, Creator, ID, Moodboard, Technique, VideoBreakdown, VideoReference } from '@/db/types';
import { useLiveQuery, useLookups, usePref } from '@/lib/hooks';
import { hostOf, instagramShortcode, platformLabel, relativeDate, youtubeId } from '@/lib/util';
import { StoredImage, Swatches } from './media';
import { Difficulty, ProvenanceBadge } from './ui';

// ───────────────────────────── Shared preview hooks

export function useBoardPreview(moodboardId: ID | undefined, n = 4): Asset[] | undefined {
  return useLiveQuery(async () => {
    if (!moodboardId) return [];
    const items = await db.moodboardItems.where('moodboardId').equals(moodboardId).sortBy('order');
    const assets = await db.assets.bulkGet(items.map((i) => i.assetId));
    return assets.filter((a): a is Asset => !!a && a.type === 'image').slice(0, n);
  }, [moodboardId, n]);
}

function useVideoCover(v: VideoReference) {
  return useLiveQuery(async () => {
    if (v.coverAssetId) return db.assets.get(v.coverAssetId);
    const first = await db.assets.where('videoId').equals(v.id).filter((a) => a.type === 'image').first();
    return first;
  }, [v.id, v.coverAssetId]);
}

export function useRemoteThumbs() {
  return usePref('remoteThumbs', true);
}

// ───────────────────────────── Video references

export function VideoCover({ video, className }: { video: VideoReference; className?: string }) {
  const cover = useVideoCover(video);
  const [remote] = useRemoteThumbs();
  const yt = youtubeId(video.url);
  if (cover) return <StoredImage fileId={cover.thumbId ?? cover.fileId} alt={video.title} className={className} ratio={cover.width && cover.height ? cover.width / cover.height : 16 / 9} />;
  if (yt && remote) {
    return (
      <div className={clsx('relative overflow-hidden bg-line/40', className)} style={{ aspectRatio: '16 / 9' }}>
        <img src={`https://i.ytimg.com/vi/${yt}/hqdefault.jpg`} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = 'none')} />
      </div>
    );
  }
  const pending = video.status === 'pending-inspection';
  return (
    <div
      className={clsx('relative flex flex-col justify-between overflow-hidden p-4', pending ? 'border-b border-dashed border-inferred/50 bg-inferred/[0.06]' : 'bg-ink/[0.04]', className)}
      style={{ aspectRatio: video.platform === 'instagram' || video.platform === 'tiktok' ? '4 / 5' : '16 / 9' }}
    >
      {pending ? (
        <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-inferred">
          <CircleDashed size={12} /> Pending inspection
        </span>
      ) : (
        <span className="label">No frames yet</span>
      )}
      <div>
        <p className="font-serif text-[30px] italic leading-none text-ink/40">{platformLabel(video.platform)}</p>
        <p className="mt-1.5 truncate font-mono text-[11px] text-faint">{instagramShortcode(video.url) ?? youtubeId(video.url) ?? hostOf(video.url)}</p>
      </div>
    </div>
  );
}

export function VideoCard({ video }: { video: VideoReference }) {
  const lk = useLookups();
  const creator = video.creatorId ? lk?.creators.get(video.creatorId) : undefined;
  const count = useLiveQuery(() => db.usages.where('[targetType+targetId]').equals(['video', video.id]).count(), [video.id]);
  return (
    <Link to={`/videos/${video.id}`} className="group block overflow-hidden rounded-xl border border-line bg-panel transition-shadow hover:shadow-lg">
      <VideoCover video={video} />
      <div className="p-3.5">
        <p className="line-clamp-2 text-[14px] font-medium leading-snug group-hover:underline">{video.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[12px] text-muted">
          {creator && <span>{creator.handles[0]?.handle ?? creator.name}</span>}
          <span>{platformLabel(video.platform)}</span>
          {count ? <span>{count} technique{count === 1 ? '' : 's'}</span> : null}
        </div>
        {video.artDirectionIds.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {video.artDirectionIds.map((id) => (
              <span key={id} className="chip py-0 text-[11px]">
                {lk?.artDirections.get(id)?.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

// ───────────────────────────── Techniques

export function TechniqueCard({ technique, examples }: { technique: Technique; examples?: number }) {
  const lk = useLookups();
  const preview = useLiveQuery(async () => {
    if (technique.coverAssetId) return db.assets.get(technique.coverAssetId);
    const usages = await db.usages.where('techniqueId').equals(technique.id).toArray();
    const assetUse = usages.find((u) => u.targetType === 'asset');
    if (assetUse) return db.assets.get(assetUse.targetId);
    for (const u of usages.filter((x) => x.targetType === 'video')) {
      const img = await db.assets.where('videoId').equals(u.targetId).filter((a) => a.type === 'image').first();
      if (img) return img;
    }
    return undefined;
  }, [technique.id, technique.coverAssetId]);
  const cat = lk?.categories.get(technique.categoryId);
  return (
    <Link to={`/techniques/${technique.id}`} className="group flex flex-col overflow-hidden rounded-xl border border-line bg-panel transition-shadow hover:shadow-lg">
      {preview?.type === 'image' ? (
        <StoredImage fileId={preview.thumbId ?? preview.fileId} alt={technique.name} ratio={16 / 10} />
      ) : (
        <div className="relative flex aspect-[16/10] items-end overflow-hidden bg-ink/[0.035] p-4">
          <span className="absolute right-3 top-3 font-mono text-[10px] uppercase tracking-label text-faint">{cat?.name}</span>
          <p className="font-serif text-[30px] leading-[0.98] text-ink/85">{technique.name}</p>
        </div>
      )}
      <div className="flex flex-1 flex-col p-3.5">
        {preview?.type === 'image' && <p className="text-[14px] font-medium">{technique.name}</p>}
        <p className="line-clamp-2 text-[12.5px] text-muted">{technique.summary}</p>
        <div className="mt-auto flex items-center justify-between pt-3">
          <Difficulty value={technique.difficulty} />
          <span className="text-[11.5px] text-faint">{examples ? `${examples} example${examples === 1 ? '' : 's'}` : technique.provenance === 'reference' ? 'reference entry' : ''}</span>
        </div>
      </div>
    </Link>
  );
}

// ───────────────────────────── Art directions

export function ArtDirectionCard({ ad, large }: { ad: ArtDirection; large?: boolean }) {
  const board = useLiveQuery(() => db.moodboards.where('artDirectionId').equals(ad.id).first(), [ad.id]);
  const preview = useBoardPreview(board?.id, 3);
  const cover = useLiveQuery(() => (ad.coverAssetId ? db.assets.get(ad.coverAssetId) : undefined), [ad.coverAssetId]);
  const count = useLiveQuery(() => (board ? db.moodboardItems.where('moodboardId').equals(board.id).count() : 0), [board?.id]);
  const lead = cover ?? preview?.[0];
  const rest = (preview ?? []).filter((a) => a.id !== lead?.id).slice(0, 2);
  const palette = ad.palette.length ? ad.palette.map((s) => s.hex) : [...new Set((preview ?? []).flatMap((a) => a.colors.slice(0, 2)))].slice(0, 6);
  return (
    <Link to={`/art-directions/${ad.id}`} className="group block">
      <div className={clsx('grid gap-1 overflow-hidden rounded-xl', rest.length ? 'grid-cols-[2fr_1fr]' : 'grid-cols-1', large ? 'aspect-[4/3]' : 'aspect-[5/4]')}>
        {lead ? (
          <StoredImage fileId={lead.thumbId ?? lead.fileId} alt={ad.name} className="h-full" />
        ) : (
          <div className="flex h-full items-center justify-center bg-ink/[0.04] p-6 text-center">
            <p className="font-serif text-[34px] italic leading-none text-ink/30">{ad.name}</p>
          </div>
        )}
        {rest.length > 0 && (
          <div className="grid gap-1" style={{ gridTemplateRows: `repeat(${rest.length}, 1fr)` }}>
            {rest.map((a) => (
              <StoredImage key={a.id} fileId={a.thumbId ?? a.fileId} alt="" className="h-full" />
            ))}
          </div>
        )}
      </div>
      {palette.length > 0 && <Swatches colors={palette} size="sm" className="mt-1" />}
      <div className="mt-2.5 flex items-baseline justify-between gap-3">
        <h3 className="text-[24px] leading-tight group-hover:underline">{ad.name}</h3>
        <span className="shrink-0 text-[11.5px] text-faint">{count ?? 0} images</span>
      </div>
      {ad.mood && <p className="text-[13px] text-muted">{ad.mood}</p>}
    </Link>
  );
}

// ───────────────────────────── Moodboards & collections

export function MoodboardCard({ board }: { board: Moodboard }) {
  const preview = useBoardPreview(board.id, 4);
  const count = useLiveQuery(() => db.moodboardItems.where('moodboardId').equals(board.id).count(), [board.id]);
  return (
    <Link to={board.artDirectionId ? `/art-directions/${board.artDirectionId}` : `/moodboards/${board.id}`} className="group block">
      <div className="grid aspect-[4/3] grid-cols-2 grid-rows-2 gap-1 overflow-hidden rounded-xl bg-ink/[0.04]">
        {[0, 1, 2, 3].map((i) =>
          preview?.[i] ? (
            <StoredImage key={i} fileId={preview[i].thumbId ?? preview[i].fileId} alt="" className="h-full" />
          ) : (
            <div key={i} className="bg-ink/[0.03]" />
          ),
        )}
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <h3 className="text-[21px] leading-tight group-hover:underline">{board.name}</h3>
        <span className="text-[11.5px] text-faint">{count ?? 0}</span>
      </div>
      <p className="text-[12px] text-muted">{board.artDirectionId ? 'Art direction' : 'Personal moodboard'}</p>
    </Link>
  );
}

export function CollectionCard({ collection }: { collection: Collection }) {
  const count = useLiveQuery(() => db.collectionItems.where('collectionId').equals(collection.id).count(), [collection.id]);
  return (
    <Link to={`/collections/${collection.id}`} className="group flex items-center justify-between rounded-xl border border-line bg-panel px-4 py-3.5 hover:border-ink/40">
      <div className="min-w-0">
        <p className="truncate font-serif text-[20px] leading-tight">{collection.name}</p>
        <p className="text-[12px] text-muted">
          {count ?? 0} item{count === 1 ? '' : 's'} · {relativeDate(collection.updatedAt)}
        </p>
      </div>
      <Layers size={16} className="shrink-0 text-faint group-hover:text-ink" />
    </Link>
  );
}

// ───────────────────────────── Creators & breakdowns

export function CreatorCard({ creator }: { creator: Creator }) {
  const lk = useLookups();
  const n = useLiveQuery(() => db.breakdowns.where('creatorId').equals(creator.id).count(), [creator.id]);
  return (
    <Link to={`/creators/${creator.id}`} className="group flex h-full flex-col rounded-xl border border-line bg-panel p-4 hover:border-ink/40">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-serif text-[23px] leading-tight group-hover:underline">{creator.name}</p>
          <p className="truncate text-[12px] text-muted">
            {creator.handles[0]?.handle} · {platformLabel(creator.mainPlatform)}
          </p>
        </div>
        <StatusPill status={creator.status} />
      </div>
      <p className="mt-2 line-clamp-3 text-[13px] text-ink/80">{creator.specialization}</p>
      <div className="mt-auto flex flex-wrap gap-1 pt-3">
        {creator.softwareIds.map((id) => (
          <span key={id} className="chip py-0 text-[11px]">
            {lk?.software.get(id)?.name}
          </span>
        ))}
        {n ? <span className="chip py-0 text-[11px]">{n} breakdown{n === 1 ? '' : 's'}</span> : null}
      </div>
    </Link>
  );
}

export function StatusPill({ status }: { status: Creator['status'] }) {
  const cls = {
    candidate: 'border-dashed border-line text-muted',
    evaluating: 'border-inferred/50 text-inferred',
    approved: 'border-verified/50 text-verified',
    rejected: 'border-line text-faint line-through',
  }[status];
  return <span className={clsx('shrink-0 rounded-full border px-2 py-[1px] text-[11px] capitalize', cls)}>{status}</span>;
}

export function BreakdownRow({ b }: { b: VideoBreakdown }) {
  const lk = useLookups();
  const creator = b.creatorId ? lk?.creators.get(b.creatorId) : undefined;
  const [remote] = useRemoteThumbs();
  const yt = youtubeId(b.url);
  return (
    <Link to={`/breakdowns/${b.id}`} className="group flex gap-4 rounded-xl border border-transparent p-2 hover:border-line hover:bg-panel">
      <div className="relative aspect-video w-36 shrink-0 overflow-hidden rounded-lg bg-ink/[0.05] sm:w-44">
        {yt && remote ? (
          <img src={`https://i.ytimg.com/vi/${yt}/mqdefault.jpg`} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
        ) : (
          <Film size={18} className="absolute inset-0 m-auto text-faint" />
        )}
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <p className="line-clamp-2 font-medium leading-snug group-hover:underline">{b.title}</p>
        <p className="mt-0.5 text-[12px] text-muted">
          {creator?.name ?? 'Unknown creator'} · {b.softwareIds.map((s) => lk?.software.get(s)?.name).filter(Boolean).join(', ') || 'software unknown'}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11.5px] text-faint">
          <span className="inline-flex items-center gap-1 capitalize">
            <Clock size={11} /> {b.status.replace('-', ' ')}
          </span>
          {b.steps.length > 0 && <span>{b.steps.length} steps</span>}
          <ProvenanceBadge value={b.provenance} />
        </div>
      </div>
      <ArrowUpRight size={16} className="mt-1 shrink-0 text-faint opacity-0 group-hover:opacity-100" />
    </Link>
  );
}
