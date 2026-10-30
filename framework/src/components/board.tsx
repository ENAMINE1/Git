import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowRightLeft, Columns2, FolderInput, Heart, Link2, Palette, StickyNote, X } from 'lucide-react';
import { db } from '@/db/db';
import { createLinkAsset, createNoteAsset, createPaletteAsset, type IngestOptions } from '@/db/images';
import { addToMoodboard, moveToMoodboard, removeFromMoodboard, reorderMoodboard } from '@/db/repo';
import { ASSET_KINDS, type Asset, type ID } from '@/db/types';
import { useFileUrl, useLiveQuery, useLookups, usePref } from '@/lib/hooks';
import { hostOf } from '@/lib/util';
import { AssetTile, Masonry, assetRatio } from './media';
import { Lightbox } from './lightbox';
import { Uploader } from './uploader';
import { MenuItem, Modal, Popover, toast } from './ui';

type Sort = 'manual' | 'recent' | 'oldest';

export interface GalleryProps {
  assets: Asset[];
  /** Present when the gallery is a moodboard (enables reorder/move/remove). */
  moodboardId?: ID;
  emptyText?: string;
  uploadOptions?: IngestOptions;
}

/** Filterable, sortable masonry of assets with lightbox, selection and compare. */
export function Gallery({ assets, moodboardId, emptyText, uploadOptions }: GalleryProps) {
  const lk = useLookups();
  const nav = useNavigate();
  const [sort, setSort] = useState<Sort>(moodboardId ? 'manual' : 'recent');
  const [tag, setTag] = useState<ID | ''>('');
  const [kind, setKind] = useState('');
  const [source, setSource] = useState('');
  const [favOnly, setFavOnly] = useState(false);
  const [density, setDensity] = usePref<'s' | 'm' | 'l'>('density', 'm');
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ID[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [dragId, setDragId] = useState<ID | null>(null);
  const [overId, setOverId] = useState<ID | null>(null);
  const [comparing, setComparing] = useState(false);

  const tagsPresent = useMemo(() => [...new Set(assets.flatMap((a) => a.tagIds))], [assets]);
  const kindsPresent = useMemo(() => [...new Set(assets.map((a) => a.kind))], [assets]);
  const sourcesPresent = useMemo(() => [...new Set(assets.map((a) => hostOf(a.sourceUrl || a.linkUrl || '')).filter(Boolean))], [assets]);

  const shown = useMemo(() => {
    let list = assets.filter(
      (a) =>
        (!tag || a.tagIds.includes(tag)) &&
        (!kind || a.kind === kind) &&
        (!source || hostOf(a.sourceUrl || a.linkUrl || '') === source) &&
        (!favOnly || a.favorite),
    );
    if (sort === 'recent') list = [...list].sort((a, b) => b.createdAt - a.createdAt);
    if (sort === 'oldest') list = [...list].sort((a, b) => a.createdAt - b.createdAt);
    return list;
  }, [assets, tag, kind, source, favOnly, sort]);

  const canReorder = !!moodboardId && sort === 'manual' && !tag && !kind && !source && !favOnly;
  const minColumn = { s: 170, m: 240, l: 340 }[density];

  const drop = async (targetId: ID) => {
    if (!moodboardId || !dragId || dragId === targetId) return;
    const ids = shown.map((a) => a.id).filter((i) => i !== dragId);
    const idx = ids.indexOf(targetId);
    ids.splice(idx, 0, dragId);
    await reorderMoodboard(moodboardId, ids);
  };

  const toggle = (id: ID) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select className="input w-auto py-1.5 text-[12.5px]" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
          {moodboardId && <option value="manual">Arranged</option>}
          <option value="recent">Recently added</option>
          <option value="oldest">Oldest first</option>
        </select>
        {kindsPresent.length > 1 && (
          <select className="input w-auto py-1.5 text-[12.5px]" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Filter by type">
            <option value="">All types</option>
            {ASSET_KINDS.filter((k) => kindsPresent.includes(k)).map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        )}
        {tagsPresent.length > 0 && (
          <select className="input w-auto py-1.5 text-[12.5px]" value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Filter by tag">
            <option value="">All tags</option>
            {tagsPresent.map((t) => (
              <option key={t} value={t}>
                #{lk?.tags.get(t)?.name}
              </option>
            ))}
          </select>
        )}
        {sourcesPresent.length > 0 && (
          <select className="input w-auto py-1.5 text-[12.5px]" value={source} onChange={(e) => setSource(e.target.value)} aria-label="Filter by source">
            <option value="">All sources</option>
            {sourcesPresent.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
        <button className={favOnly ? 'chip-active py-1' : 'chip py-1'} onClick={() => setFavOnly(!favOnly)} aria-pressed={favOnly}>
          <Heart size={12} /> Favorites
        </button>
        <div className="ml-auto flex items-center gap-1">
          <div className="hidden rounded-full border border-line p-0.5 sm:flex" role="group" aria-label="Grid density">
            {(['s', 'm', 'l'] as const).map((d) => (
              <button key={d} onClick={() => setDensity(d)} className={clsx('rounded-full px-2 py-0.5 text-[11px] uppercase', density === d ? 'bg-ink text-paper' : 'text-muted')}>
                {d}
              </button>
            ))}
          </div>
          <button
            className={selecting ? 'btn-solid py-1' : 'btn py-1'}
            onClick={() => {
              setSelecting(!selecting);
              setSelected([]);
            }}
          >
            {selecting ? 'Done' : 'Select'}
          </button>
        </div>
      </div>

      {selecting && (
        <div className="sticky top-14 z-20 mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-panel/95 px-3 py-2 backdrop-blur lg:top-2">
          <span className="text-[13px] text-muted">{selected.length} selected</span>
          <button className="btn py-1" disabled={selected.length < 2 || selected.length > 4} onClick={() => setComparing(true)} title="Compare 2–4 images side by side">
            <Columns2 size={14} /> Compare
          </button>
          <MoveMenu assetIds={selected} fromId={moodboardId} onDone={() => setSelected([])} />
          {moodboardId && (
            <button
              className="btn py-1"
              disabled={!selected.length}
              onClick={async () => {
                for (const id of selected) await removeFromMoodboard(moodboardId, id);
                toast(`Removed ${selected.length} from board`);
                setSelected([]);
              }}
            >
              <X size={14} /> Remove from board
            </button>
          )}
          <button className="btn-ghost ml-auto py-1" onClick={() => setSelected(shown.map((a) => a.id))}>
            Select all
          </button>
        </div>
      )}

      <Uploader options={{ ...uploadOptions, moodboardId }} pasteEnabled={!!uploadOptions || !!moodboardId}>
        {shown.length ? (
          <Masonry
            items={shown.map((a) => ({ key: a.id, ratio: assetRatio(a), a }))}
            minColumn={minColumn}
            render={({ a }, i) => (
              <AssetTile
                asset={a}
                onOpen={() => setOpen(i)}
                selectable={selecting}
                selected={selected.includes(a.id)}
                onToggleSelect={() => toggle(a.id)}
                draggable={canReorder && !selecting}
                dropTarget={overId === a.id && dragId !== a.id}
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/x-framework-asset', a.id);
                  e.dataTransfer.effectAllowed = 'move';
                  setDragId(a.id);
                }}
                onDropOn={
                  canReorder
                    ? (e) => {
                        e.preventDefault();
                        void drop(a.id);
                        setDragId(null);
                        setOverId(null);
                      }
                    : undefined
                }
              />
            )}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-line px-6 py-14 text-center">
            <p className="font-serif text-[24px]">{assets.length ? 'Nothing matches these filters.' : 'Empty board'}</p>
            <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted">{emptyText ?? 'Drag images here, paste a screenshot (⌘V), or use Add images.'}</p>
          </div>
        )}
      </Uploader>
      {canReorder && shown.length > 1 && <p className="mt-3 text-[12px] text-faint">Drag an image onto another to place it before it.</p>}

      {open != null && shown[open] && <Lightbox assetIds={shown.map((a) => a.id)} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
      {comparing && (
        <CompareAssets
          ids={selected}
          onClose={() => setComparing(false)}
          onOpenPage={() => {
            nav(`/compare?assets=${selected.join(',')}`);
          }}
        />
      )}
    </div>
  );
}

function MoveMenu({ assetIds, fromId, onDone }: { assetIds: ID[]; fromId?: ID; onDone: () => void }) {
  const boards = useLiveQuery(() => db.moodboards.orderBy('name').toArray(), []);
  return (
    <Popover
      align="left"
      width={260}
      trigger={(p) => (
        <button className="btn py-1" disabled={!assetIds.length} {...p}>
          {fromId ? <ArrowRightLeft size={14} /> : <FolderInput size={14} />} {fromId ? 'Move / copy to…' : 'Add to board…'}
        </button>
      )}
    >
      {(close) => (
        <div className="max-h-72 overflow-y-auto">
          {(boards ?? [])
            .filter((b) => b.id !== fromId)
            .map((b) => (
              <div key={b.id} className="flex items-center gap-1">
                <MenuItem
                  onClick={async () => {
                    await addToMoodboard(b.id, assetIds);
                    toast(`Added to ${b.name}`);
                    close();
                    onDone();
                  }}
                >
                  <span className="flex-1 truncate">{b.name}</span>
                  <span className="text-[11px] text-faint">{b.artDirectionId ? 'direction' : 'board'}</span>
                </MenuItem>
                {fromId && (
                  <button
                    className="shrink-0 rounded-md px-2 py-1 text-[11.5px] text-muted hover:bg-ink/[0.06] hover:text-ink"
                    title="Move (remove from this board)"
                    onClick={async () => {
                      for (const id of assetIds) await moveToMoodboard(fromId, b.id, id);
                      toast(`Moved to ${b.name}`);
                      close();
                      onDone();
                    }}
                  >
                    Move
                  </button>
                )}
              </div>
            ))}
        </div>
      )}
    </Popover>
  );
}

export function CompareAssets({ ids, onClose, onOpenPage }: { ids: ID[]; onClose: () => void; onOpenPage?: () => void }) {
  const assets = useLiveQuery(() => db.assets.bulkGet(ids), [ids.join(',')]);
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0b0b0a] text-[#ece9e1]" role="dialog" aria-label="Compare images">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="label text-white/60">Side by side · {ids.length}</span>
        <div className="flex items-center gap-2">
          {onOpenPage && (
            <button className="rounded-full border border-white/20 px-3 py-1 text-[12.5px] hover:bg-white/10" onClick={onOpenPage}>
              Open as page
            </button>
          )}
          <button className="icon-btn text-white/70 hover:bg-white/10 hover:text-white" onClick={onClose} aria-label="Close compare">
            <X size={18} />
          </button>
        </div>
      </div>
      <CompareStrip assets={(assets ?? []).filter((a): a is Asset => !!a)} dark />
    </div>
  );
}

export function CompareStrip({ assets, dark }: { assets: Asset[]; dark?: boolean }) {
  return (
    <div className={clsx('grid min-h-0 flex-1 gap-3 px-4 pb-4', dark ? '' : 'min-h-[60vh]')} style={{ gridTemplateColumns: `repeat(${Math.max(1, assets.length)}, minmax(0, 1fr))` }}>
      {assets.map((a) => (
        <CompareCell key={a.id} asset={a} dark={dark} />
      ))}
    </div>
  );
}

function CompareCell({ asset, dark }: { asset: Asset; dark?: boolean }) {
  const url = useFileUrl(asset.fileId);
  return (
    <figure className="flex min-h-0 flex-col">
      <div className={clsx('flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg', dark ? 'bg-black' : 'bg-ink/[0.04]')}>
        {url && <img src={url} alt={asset.title} className="max-h-full max-w-full object-contain" />}
        {asset.type === 'palette' && (
          <div className="flex h-full w-full">
            {asset.colors.map((c, i) => (
              <div key={i} className="flex-1" style={{ background: c }} />
            ))}
          </div>
        )}
      </div>
      <figcaption className={clsx('mt-2 truncate text-[12.5px]', dark ? 'text-white/70' : 'text-muted')}>{asset.title || 'Untitled'}</figcaption>
      {asset.colors.length > 0 && (
        <div className="mt-1 flex h-2 overflow-hidden rounded">
          {asset.colors.map((c, i) => (
            <span key={i} className="flex-1" style={{ background: c }} />
          ))}
        </div>
      )}
    </figure>
  );
}

/** Small toolbar: add link, note or palette cards to a board. */
export function BoardExtras({ moodboardId, videoId }: { moodboardId?: ID; videoId?: ID }) {
  const [mode, setMode] = useState<'link' | 'note' | 'palette' | null>(null);
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const close = () => {
    setMode(null);
    setA('');
    setB('');
  };
  const save = async () => {
    if (mode === 'link') await createLinkAsset(a.trim(), { title: b.trim() || a.trim(), moodboardId, videoId });
    if (mode === 'note') await createNoteAsset(a.trim(), { moodboardId, title: b.trim() });
    if (mode === 'palette') {
      const colors = a.match(/#?[0-9a-f]{6}\b/gi)?.map((c) => (c.startsWith('#') ? c : `#${c}`).toLowerCase()) ?? [];
      if (!colors.length) return toast('Enter hex colours like #1a1a1a #e8dcc8', 'error');
      await createPaletteAsset(colors, { moodboardId, title: b.trim() || 'Palette' });
    }
    toast('Added');
    close();
  };
  return (
    <>
      <button className="btn" onClick={() => setMode('link')}>
        <Link2 size={14} /> Motion link
      </button>
      <button className="btn" onClick={() => setMode('note')}>
        <StickyNote size={14} /> Note
      </button>
      <button className="btn" onClick={() => setMode('palette')}>
        <Palette size={14} /> Palette
      </button>
      <Modal
        open={!!mode}
        onClose={close}
        title={mode === 'link' ? 'Add a motion reference link' : mode === 'note' ? 'Add an annotation' : 'Add a colour palette'}
        footer={
          <>
            <button className="btn-ghost" onClick={close}>
              Cancel
            </button>
            <button className="btn-solid" disabled={!a.trim()} onClick={() => void save()}>
              Add
            </button>
          </>
        }
      >
        <div className="space-y-3">
          {mode === 'note' ? (
            <textarea className="input min-h-[120px]" autoFocus placeholder="What should future-you notice here?" value={a} onChange={(e) => setA(e.target.value)} />
          ) : (
            <input
              className="input"
              autoFocus
              placeholder={mode === 'link' ? 'https://vimeo.com/…' : '#0e0e0e #2b2f33 #c9b79c #e8e1d3'}
              value={a}
              onChange={(e) => setA(e.target.value)}
            />
          )}
          <input className="input" placeholder={mode === 'note' ? 'Title (optional)' : 'Label (optional)'} value={b} onChange={(e) => setB(e.target.value)} />
        </div>
      </Modal>
    </>
  );
}

/** Live list of a moodboard's assets in arranged order. */
export function useBoardAssets(moodboardId?: ID) {
  return useLiveQuery(async () => {
    if (!moodboardId) return [] as Asset[];
    const items = await db.moodboardItems.where('moodboardId').equals(moodboardId).sortBy('order');
    const assets = await db.assets.bulkGet(items.map((i) => i.assetId));
    return assets.filter((a): a is Asset => !!a);
  }, [moodboardId]);
}

