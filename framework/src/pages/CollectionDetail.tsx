import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Trash2, X } from 'lucide-react';
import { db } from '@/db/db';
import { deleteCollection, toggleInCollection, updateCollection } from '@/db/repo';
import type { Asset, Collection, EntityType } from '@/db/types';
import { useLiveQuery } from '@/lib/hooks';
import { present } from '@/lib/util';
import { ArtDirectionCard, BreakdownRow, CreatorCard, MoodboardCard, TechniqueCard, VideoCard } from '@/components/cards';
import { AssetTile, Masonry, assetRatio } from '@/components/media';
import { Lightbox } from '@/components/lightbox';
import { ConfirmButton, EmptyState, Section, toast } from '@/components/ui';
import { NotFound } from './NotFound';

const GROUPS: { type: EntityType; title: string }[] = [
  { type: 'asset', title: 'Images' },
  { type: 'video', title: 'Video references' },
  { type: 'technique', title: 'Techniques' },
  { type: 'artDirection', title: 'Art directions' },
  { type: 'moodboard', title: 'Moodboards' },
  { type: 'breakdown', title: 'Breakdowns' },
  { type: 'creator', title: 'Creators' },
];

export function CollectionDetail() {
  const { id = '' } = useParams();
  const c = useLiveQuery(() => db.collections.get(id).then((r) => r ?? null), [id]);
  if (c === undefined) return null;
  return c ? <CollectionView key={c.id} c={c} /> : <NotFound />;
}

function CollectionView({ c }: { c: Collection }) {
  const nav = useNavigate();
  const [open, setOpen] = useState<number | null>(null);
  const [name, setName] = useState(c.name);
  const [desc, setDesc] = useState(c.description);
  useEffect(() => {
    setName(c.name);
    setDesc(c.description);
  }, [c.name, c.description]);

  const data = useLiveQuery(async () => {
    const items = await db.collectionItems.where('collectionId').equals(c.id).sortBy('order');
    const ids = (t: EntityType) => items.filter((i) => i.entityType === t).map((i) => i.entityId);
    const [assets, videos, techniques, ads, boards, breakdowns, creators] = await Promise.all([
      db.assets.bulkGet(ids('asset')),
      db.videos.bulkGet(ids('video')),
      db.techniques.bulkGet(ids('technique')),
      db.artDirections.bulkGet(ids('artDirection')),
      db.moodboards.bulkGet(ids('moodboard')),
      db.breakdowns.bulkGet(ids('breakdown')),
      db.creators.bulkGet(ids('creator')),
    ]);
    return {
      items,
      asset: present(assets),
      video: present(videos),
      technique: present(techniques),
      artDirection: present(ads),
      moodboard: present(boards),
      breakdown: present(breakdowns),
      creator: present(creators),
    };
  }, [c.id]);
  const assets = useMemo(() => (data?.asset ?? []) as Asset[], [data]);

  return (
    <div>
      <div className="label mb-3">
        <Link to="/collections" className="hover:text-ink">
          Collections
        </Link>
      </div>
      <header className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1">
          <input className="w-full border-0 bg-transparent p-0 font-serif text-[48px] leading-[1] outline-none md:text-[64px]" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== c.name && updateCollection(c.id, { name: name.trim() })} aria-label="Collection name" />
          <input className="mt-2 w-full max-w-2xl border-0 bg-transparent p-0 text-[15px] text-muted outline-none placeholder:text-faint" value={desc} placeholder="What is this collection for?" onChange={(e) => setDesc(e.target.value)} onBlur={() => desc !== c.description && updateCollection(c.id, { description: desc })} aria-label="Description" />
        </div>
        <ConfirmButton
          label="Delete collection? Items stay"
          onConfirm={async () => {
            await deleteCollection(c.id);
            toast('Collection deleted');
            nav('/collections');
          }}
        >
          <Trash2 size={14} /> Delete
        </ConfirmButton>
      </header>

      {data && data.items.length === 0 && <EmptyState title="Empty collection">Use the Collect button on any video, technique, image, art direction, creator or breakdown.</EmptyState>}

      {data &&
        GROUPS.map(({ type, title }) => {
          const rows = data[type as keyof typeof data] as unknown[];
          if (!rows.length) return null;
          return (
            <Section key={type} title={title} count={rows.length}>
              {type === 'asset' && (
                <>
                  <Masonry items={assets.map((a) => ({ key: a.id, ratio: assetRatio(a), a }))} minColumn={220} render={({ a }, i) => <Removable onRemove={() => void toggleInCollection(c.id, 'asset', a.id)}><AssetTile asset={a} onOpen={() => setOpen(i)} /></Removable>} />
                  {open != null && <Lightbox assetIds={assets.map((a) => a.id)} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
                </>
              )}
              {type === 'video' && (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                  {data.video.map((v) => (
                    <Removable key={v.id} onRemove={() => void toggleInCollection(c.id, 'video', v.id)}>
                      <VideoCard video={v} />
                    </Removable>
                  ))}
                </div>
              )}
              {type === 'technique' && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {data.technique.map((t) => (
                    <Removable key={t.id} onRemove={() => void toggleInCollection(c.id, 'technique', t.id)}>
                      <TechniqueCard technique={t} />
                    </Removable>
                  ))}
                </div>
              )}
              {type === 'artDirection' && (
                <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                  {data.artDirection.map((a) => (
                    <Removable key={a.id} onRemove={() => void toggleInCollection(c.id, 'artDirection', a.id)}>
                      <ArtDirectionCard ad={a} />
                    </Removable>
                  ))}
                </div>
              )}
              {type === 'moodboard' && (
                <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
                  {data.moodboard.map((m) => (
                    <Removable key={m.id} onRemove={() => void toggleInCollection(c.id, 'moodboard', m.id)}>
                      <MoodboardCard board={m} />
                    </Removable>
                  ))}
                </div>
              )}
              {type === 'breakdown' &&
                data.breakdown.map((b) => (
                  <Removable key={b.id} onRemove={() => void toggleInCollection(c.id, 'breakdown', b.id)}>
                    <BreakdownRow b={b} />
                  </Removable>
                ))}
              {type === 'creator' && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {data.creator.map((cr) => (
                    <Removable key={cr.id} onRemove={() => void toggleInCollection(c.id, 'creator', cr.id)}>
                      <CreatorCard creator={cr} />
                    </Removable>
                  ))}
                </div>
              )}
            </Section>
          );
        })}
    </div>
  );
}


function Removable({ onRemove, children }: { onRemove: () => void; children: ReactNode }) {
  return (
    <div className="group relative">
      {children}
      <button
        className="absolute right-2 top-2 z-10 rounded-full bg-paper/90 p-1 text-muted opacity-0 shadow hover:text-ink group-hover:opacity-100"
        aria-label="Remove from collection"
        onClick={onRemove}
      >
        <X size={13} />
      </button>
    </div>
  );
}
