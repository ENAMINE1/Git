import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ImagePlus, Pin, Plus, Trash2, X } from 'lucide-react';
import { db } from '@/db/db';
import { boardForArtDirection, deleteArtDirection, toggleFavorite, updateArtDirection } from '@/db/repo';
import type { ArtDirection, Swatch } from '@/db/types';
import { useLiveQuery } from '@/lib/hooks';
import { present } from '@/lib/util';
import { AddToCollection } from '@/components/collect';
import { BoardExtras, Gallery, useBoardAssets } from '@/components/board';
import { TechniqueCard, VideoCard } from '@/components/cards';
import { StringList, TagInput } from '@/components/pickers';
import { BrowseButton } from '@/components/uploader';
import { UsageEditor } from '@/components/usage';
import { ConfirmButton, FavoriteButton, Field, ProvenanceBadge, Section, toast } from '@/components/ui';
import { NotFound } from './NotFound';

export function ArtDirectionDetail() {
  const { id = '' } = useParams();
  const ad = useLiveQuery(() => db.artDirections.get(id).then((r) => r ?? null), [id]);
  if (ad === undefined) return null;
  return ad ? <ADView key={ad.id} ad={ad} /> : <NotFound />;
}

/** Ranks colours extracted from a board's images into a suggested palette. */
export function derivePalette(colorLists: string[][], n = 8): string[] {
  const count = new Map<string, number>();
  for (const list of colorLists) list.forEach((c, i) => count.set(c, (count.get(c) ?? 0) + (list.length - i)));
  const ranked = [...count.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const out: string[] = [];
  for (const c of ranked) {
    const [r, g, b] = rgb(c);
    const distinct = out.every((o) => {
      const [r2, g2, b2] = rgb(o);
      return Math.hypot(r - r2, g - g2, b - b2) > 38;
    });
    if (distinct) out.push(c);
    if (out.length >= n) break;
  }
  return out;
}

function ADView({ ad }: { ad: ArtDirection }) {
  const nav = useNavigate();
  const board = useLiveQuery(() => boardForArtDirection(ad.id), [ad.id]);
  const assets = useBoardAssets(board?.id);
  const videos = useLiveQuery(() => db.videos.where('artDirectionIds').equals(ad.id).toArray(), [ad.id]);
  const videoTechniques = useLiveQuery(async () => {
    const vids = await db.videos.where('artDirectionIds').equals(ad.id).primaryKeys();
    if (!vids.length) return [];
    const usages = await db.usages.where('targetId').anyOf(vids).toArray();
    const counts = new Map<string, number>();
    for (const u of usages) if (u.targetType === 'video') counts.set(u.techniqueId, (counts.get(u.techniqueId) ?? 0) + 1);
    const ts = present(await db.techniques.bulkGet([...counts.keys()]));
    return ts.map((t) => ({ t, n: counts.get(t.id)! })).sort((a, b) => b.n - a.n);
  }, [ad.id]);
  const suggested = useMemo(() => derivePalette((assets ?? []).map((a) => a.colors)), [assets]);
  const pinned = ad.palette.map((s) => s.hex);

  const [name, setName] = useState(ad.name);
  const [mood, setMood] = useState(ad.mood);
  useEffect(() => {
    setName(ad.name);
    setMood(ad.mood);
  }, [ad.name, ad.mood]);
  const save = (patch: Partial<ArtDirection>) => updateArtDirection(ad.id, patch);
  const setPalette = (palette: Swatch[]) => save({ palette });

  return (
    <div>
      <div className="label mb-3">
        <Link to="/art-directions" className="hover:text-ink">
          Art directions
        </Link>
      </div>
      <header className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1">
          <input
            className="w-full border-0 bg-transparent p-0 font-serif text-[48px] leading-[1] outline-none md:text-[72px]"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && name !== ad.name && save({ name: name.trim() })}
            aria-label="Name"
          />
          <input
            className="mt-2 w-full border-0 bg-transparent p-0 font-serif text-[22px] italic text-muted outline-none placeholder:text-faint"
            value={mood}
            placeholder="Mood — three words"
            onChange={(e) => setMood(e.target.value)}
            onBlur={() => mood !== ad.mood && save({ mood })}
            aria-label="Mood"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FavoriteButton active={ad.favorite} onClick={() => toggleFavorite('artDirections', ad.id)} />
          <AddToCollection entityType="artDirection" entityId={ad.id} />
          <Link className="btn" to={`/compare?directions=${ad.id}`}>
            Compare
          </Link>
          <ConfirmButton
            label="Delete? Images stay"
            onConfirm={async () => {
              await deleteArtDirection(ad.id);
              toast('Art direction deleted — its images remain in a personal moodboard');
              nav('/art-directions');
            }}
          >
            <Trash2 size={14} />
          </ConfirmButton>
        </div>
      </header>

      <div className="mb-10">
        <div className="mb-2 flex items-center justify-between">
          <span className="label">Palette</span>
          {pinned.length > 0 && (
            <button className="text-[12px] text-faint hover:text-ink" onClick={() => setPalette([])}>
              Clear
            </button>
          )}
        </div>
        {pinned.length ? (
          <div className="flex h-16 overflow-hidden rounded-xl">
            {ad.palette.map((s, i) => (
              <button
                key={`${s.hex}-${i}`}
                className="group relative flex flex-1 items-end p-2"
                style={{ background: s.hex }}
                title="Remove from palette"
                onClick={() => setPalette(ad.palette.filter((_, j) => j !== i))}
              >
                <span className="rounded bg-black/35 px-1 font-mono text-[10px] text-white">{s.hex}</span>
                <X size={12} className="absolute right-1.5 top-1.5 text-white opacity-0 group-hover:opacity-100" />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-faint">
            {suggested.length ? 'Pin colours from the images below to define this direction’s palette.' : 'Add images and a palette will be suggested from their colours.'}
          </p>
        )}
        {suggested.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[12px] text-muted">From the moodboard:</span>
            {suggested.map((c) => (
              <button
                key={c}
                disabled={pinned.includes(c)}
                onClick={() => setPalette([...ad.palette, { hex: c }])}
                className="group flex items-center gap-1 rounded-full border border-line py-0.5 pl-0.5 pr-2 text-[11px] text-muted hover:border-ink/40 disabled:opacity-40"
                title="Pin to palette"
              >
                <span className="h-4 w-4 rounded-full" style={{ background: c }} />
                <span className="font-mono">{c}</span>
                <Pin size={10} className="opacity-0 group-hover:opacity-100" />
              </button>
            ))}
          </div>
        )}
      </div>

      <Section
        title="Moodboard"
        count={assets?.length}
        action={
          board && (
            <div className="flex flex-wrap gap-2">
              <BrowseButton options={{ moodboardId: board.id }}>
                <ImagePlus size={14} /> Add images
              </BrowseButton>
              <BoardExtras moodboardId={board.id} />
            </div>
          )
        }
      >
        {board && <Gallery assets={assets ?? []} moodboardId={board.id} emptyText="Drag stills, screenshots, typography or lighting references here — or paste with ⌘V." />}
      </Section>

      <div className="grid gap-x-12 lg:grid-cols-2">
        <Section title="Definition">
          <div className="space-y-4">
            <Field label="Description">
              <Area value={ad.description} onSave={(description) => save({ description })} placeholder="What defines this look?" />
            </Field>
            <Field label="Visual characteristics">
              <StringList value={ad.characteristics} onChange={(characteristics) => save({ characteristics })} placeholder="Add a recurring characteristic…" />
            </Field>
            <Field label="Typography">
              <Area value={ad.typography} onSave={(typography) => save({ typography })} placeholder="Typefaces, weights, layout habits…" />
            </Field>
            <Field label="Notes">
              <Area value={ad.notes} onSave={(notes) => save({ notes })} />
            </Field>
            <Field label="Tags">
              <TagInput value={ad.tagIds} onChange={(tagIds) => save({ tagIds })} />
            </Field>
            <div className="text-[12px] text-faint">
              Definition provenance: <ProvenanceBadge value={ad.provenance} />
            </div>
          </div>
        </Section>
        <Section title="Techniques">
          <p className="-mt-1 mb-3 text-[12.5px] text-faint">Techniques typical of this direction.</p>
          <UsageEditor targetType="artDirection" targetId={ad.id} compact defaultProvenance="inferred" />
          {videoTechniques && videoTechniques.length > 0 && (
            <div className="mt-6">
              <div className="label mb-2">Seen in its videos</div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {videoTechniques.slice(0, 6).map(({ t, n }) => (
                  <TechniqueCard key={t.id} technique={t} examples={n} />
                ))}
              </div>
            </div>
          )}
        </Section>
      </div>

      <Section title="Videos in this direction" count={videos?.length}>
        {videos?.length ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {videos.map((v) => (
              <VideoCard key={v.id} video={v} />
            ))}
          </div>
        ) : (
          <p className="flex items-center gap-2 text-[13px] text-faint">
            <Plus size={13} /> Assign videos to this direction from their Classification panel.
          </p>
        )}
      </Section>
    </div>
  );
}

function Area({ value, onSave, placeholder }: { value: string; onSave: (v: string) => void; placeholder?: string }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return <textarea className="input min-h-[84px]" value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onSave(v)} />;
}
