import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, Download, ExternalLink, Info, Maximize2, Trash2, X } from 'lucide-react';
import { db } from '@/db/db';
import { addToMoodboard, deleteAsset, removeFromMoodboard, updateAsset } from '@/db/repo';
import { ASSET_KINDS, type Asset, type AssetKind, type ID } from '@/db/types';
import { useFileUrl, useLiveQuery } from '@/lib/hooks';
import { formatBytes, formatTime } from '@/lib/util';
import { FavoriteButton, Field, toast } from './ui';
import { TagInput } from './pickers';
import { Swatches } from './media';
import { UsageEditor } from './usage';
import { AddToCollection } from './collect';

export function Lightbox({ assetIds, index, onClose, onIndex }: { assetIds: ID[]; index: number; onClose: () => void; onIndex: (i: number) => void }) {
  const id = assetIds[index];
  const asset = useLiveQuery(() => (id ? db.assets.get(id) : undefined), [id]);
  const [info, setInfo] = useState(() => typeof window === 'undefined' || window.innerWidth >= 768);
  const stage = useRef<HTMLDivElement>(null);
  const prev = useCallback(() => onIndex((index - 1 + assetIds.length) % assetIds.length), [index, assetIds.length, onIndex]);
  const next = useCallback(() => onIndex((index + 1) % assetIds.length), [index, assetIds.length, onIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) {
        if (e.key === 'Escape') t.blur();
        return;
      }
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
      else if (e.key.toLowerCase() === 'i') setInfo((v) => !v);
      else if (e.key.toLowerCase() === 'f') void stage.current?.requestFullscreen?.();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, prev, next]);

  useEffect(() => {
    if (id === undefined) onClose();
  }, [id, onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex bg-[#0b0b0a] text-[#ece9e1]" role="dialog" aria-modal="true" aria-label="Image viewer">
      <div ref={stage} className="relative flex min-w-0 flex-1 items-center justify-center bg-[#0b0b0a]">
        {asset && <Stage asset={asset} />}
        <div className="absolute left-3 top-3 flex items-center gap-1">
          <button className="icon-btn text-white/70 hover:bg-white/10 hover:text-white" onClick={onClose} aria-label="Close viewer">
            <X size={18} />
          </button>
          <span className="ml-1 font-mono text-[11px] text-white/50">
            {index + 1} / {assetIds.length}
          </span>
        </div>
        <div className="absolute right-3 top-3 flex items-center gap-1">
          <button className="icon-btn text-white/70 hover:bg-white/10 hover:text-white" title="Full screen (F)" onClick={() => void stage.current?.requestFullscreen?.()} aria-label="Full screen">
            <Maximize2 size={16} />
          </button>
          <button className={clsx('icon-btn hover:bg-white/10 hover:text-white', info ? 'text-white' : 'text-white/70')} title="Details (I)" onClick={() => setInfo((v) => !v)} aria-label="Toggle details">
            <Info size={16} />
          </button>
        </div>
        {assetIds.length > 1 && (
          <>
            <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Previous">
              <ChevronLeft size={28} />
            </button>
            <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Next">
              <ChevronRight size={28} />
            </button>
          </>
        )}
      </div>
      {info && asset && (
        <aside className="absolute inset-x-0 bottom-0 z-10 max-h-[65vh] overflow-y-auto border-t border-line bg-panel text-ink md:static md:max-h-none md:w-[360px] md:shrink-0 md:border-l md:border-t-0">
          <AssetEditor asset={asset} onDeleted={onClose} />
        </aside>
      )}
    </div>,
    document.body,
  );
}

function Stage({ asset }: { asset: Asset }) {
  const url = useFileUrl(asset.fileId);
  if (asset.type === 'image') {
    return url ? <img src={url} alt={asset.title} className="h-full w-full object-contain p-4 md:p-10" /> : null;
  }
  if (asset.type === 'palette') {
    return (
      <div className="flex h-[60vh] w-[80%] overflow-hidden rounded-xl">
        {asset.colors.map((c, i) => (
          <div key={i} className="flex flex-1 items-end p-3" style={{ background: c }}>
            <span className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[12px]">{c}</span>
          </div>
        ))}
      </div>
    );
  }
  if (asset.type === 'note') {
    return <p className="max-w-2xl px-8 font-serif text-[34px] leading-snug">{asset.description}</p>;
  }
  return (
    <a href={asset.linkUrl} target="_blank" rel="noreferrer" className="max-w-xl px-8 text-center">
      <span className="label text-white/50">Motion reference</span>
      <p className="mt-2 font-serif text-[34px] leading-snug underline decoration-white/30 underline-offset-8">{asset.title}</p>
      <p className="mt-3 inline-flex items-center gap-1 text-[13px] text-white/60">
        <ExternalLink size={13} /> Open link
      </p>
    </a>
  );
}

export function AssetEditor({ asset, onDeleted }: { asset: Asset; onDeleted?: () => void }) {
  const [draft, setDraft] = useState(asset);
  useEffect(() => setDraft(asset), [asset.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = (patch: Partial<Asset>) => {
    setDraft((d) => ({ ...d, ...patch }));
    void updateAsset(asset.id, patch);
  };
  const originalUrl = useFileUrl(asset.fileId);

  const boards = useLiveQuery(() => db.moodboards.toArray(), []);
  const memberships = useLiveQuery(() => db.moodboardItems.where('assetId').equals(asset.id).toArray(), [asset.id]);
  const videos = useLiveQuery(() => db.videos.orderBy('updatedAt').reverse().toArray(), []);
  const memberIds = useMemo(() => new Set((memberships ?? []).map((m) => m.moodboardId)), [memberships]);
  const ads = (boards ?? []).filter((b) => b.artDirectionId);
  const personal = (boards ?? []).filter((b) => !b.artDirectionId);

  return (
    <div className="space-y-5 p-5">
      <div className="flex items-start justify-between gap-2">
        <input
          className="w-full border-0 bg-transparent p-0 font-serif text-[26px] leading-tight outline-none placeholder:text-faint"
          value={draft.title}
          placeholder="Untitled"
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          onBlur={() => save({ title: draft.title })}
          aria-label="Title"
        />
        <FavoriteButton active={draft.favorite} onClick={() => save({ favorite: !draft.favorite })} />
      </div>

      {draft.colors.length > 0 && <Swatches colors={draft.colors} />}

      <div className="flex flex-wrap gap-2">
        {asset.fileId && originalUrl && (
          <a className="btn" href={originalUrl} download={asset.fileName ?? `${asset.title || asset.id}`}>
            <Download size={14} /> Original
          </a>
        )}
        {asset.fileId && originalUrl && (
          <a className="btn" href={originalUrl} target="_blank" rel="noreferrer">
            <ExternalLink size={14} /> View
          </a>
        )}
        <AddToCollection entityType="asset" entityId={asset.id} />
      </div>

      <Field label="Type">
        <select className="input" value={draft.kind} onChange={(e) => save({ kind: e.target.value as AssetKind })}>
          {ASSET_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </Field>

      {asset.type === 'note' && (
        <Field label="Note">
          <textarea className="input min-h-[120px]" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} onBlur={() => save({ description: draft.description })} />
        </Field>
      )}

      <Field label="What I like about it">
        <textarea
          className="input min-h-[72px]"
          value={draft.notes}
          placeholder="The light falloff, the type scale, the way the cut lands…"
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          onBlur={() => save({ notes: draft.notes })}
        />
      </Field>

      {asset.type !== 'note' && (
        <Field label="Description">
          <textarea className="input min-h-[56px]" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} onBlur={() => save({ description: draft.description })} />
        </Field>
      )}

      <div className="grid grid-cols-1 gap-3">
        <Field label="Source URL">
          <input className="input" value={draft.sourceUrl} placeholder="https://…" onChange={(e) => setDraft({ ...draft, sourceUrl: e.target.value })} onBlur={() => save({ sourceUrl: draft.sourceUrl })} />
        </Field>
        <Field label="Attribution">
          <input className="input" value={draft.attribution} placeholder="Creator, film, studio…" onChange={(e) => setDraft({ ...draft, attribution: e.target.value })} onBlur={() => save({ attribution: draft.attribution })} />
        </Field>
      </div>

      <Field label="Tags">
        <TagInput value={draft.tagIds} onChange={(tagIds) => save({ tagIds })} />
      </Field>

      <Field label="From video reference">
        <select className="input" value={draft.videoId ?? ''} onChange={(e) => save({ videoId: e.target.value || undefined })}>
          <option value="">— none —</option>
          {(videos ?? []).map((v) => (
            <option key={v.id} value={v.id}>
              {v.title}
            </option>
          ))}
        </select>
        {draft.videoId && (
          <Link to={`/videos/${draft.videoId}`} className="link mt-1 inline-block text-[12px] text-muted">
            Open reference{draft.timestamp != null ? ` at ${formatTime(draft.timestamp)}` : ''}
          </Link>
        )}
      </Field>

      <div>
        <div className="label mb-2">Art directions</div>
        <BoardChecklist boards={ads} member={memberIds} assetId={asset.id} />
        <div className="label mb-2 mt-4">Personal moodboards</div>
        <BoardChecklist boards={personal} member={memberIds} assetId={asset.id} />
      </div>

      <div>
        <div className="label mb-2">Techniques visible here</div>
        <UsageEditor targetType="asset" targetId={asset.id} compact />
      </div>

      <div className="rule pt-4 text-[12px] text-faint">
        {asset.width && asset.height ? `${asset.width} × ${asset.height} · ` : ''}
        {asset.size ? `${formatBytes(asset.size)} · ` : ''}
        {asset.fileName ?? asset.type}
        <br />
        Added {new Date(asset.createdAt).toLocaleString()}
      </div>
      <button
        className="btn-danger w-full"
        onClick={async () => {
          if (!confirm('Delete this asset everywhere? This removes the stored file.')) return;
          await deleteAsset(asset.id);
          toast('Asset deleted');
          onDeleted?.();
        }}
      >
        <Trash2 size={14} /> Delete asset
      </button>
    </div>
  );
}

function BoardChecklist({ boards, member, assetId }: { boards: { id: ID; name: string }[]; member: Set<ID>; assetId: ID }) {
  if (!boards.length) return <p className="text-[12px] text-faint">None yet.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {boards
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((b) => {
          const on = member.has(b.id);
          return (
            <button
              key={b.id}
              type="button"
              className={on ? 'chip-active' : 'chip hover:border-ink/40 hover:text-ink'}
              onClick={() => (on ? removeFromMoodboard(b.id, assetId) : addToMoodboard(b.id, [assetId]))}
              aria-pressed={on}
            >
              {b.name}
            </button>
          );
        })}
    </div>
  );
}
