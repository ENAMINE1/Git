import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { ExternalLink, Plus, Trash2, X } from 'lucide-react';
import { db } from '@/db/db';
import { createBreakdown, deleteCreator, toggleFavorite, updateCreator } from '@/db/repo';
import type { Creator, CreatorRole, CreatorStatus, Handle, Platform } from '@/db/types';
import { useLiveQuery, useLookups } from '@/lib/hooks';
import { detectPlatform, platformLabel } from '@/lib/util';
import { AddToCollection } from '@/components/collect';
import { BreakdownRow, VideoCard } from '@/components/cards';
import { IdPicker, StringList, TagInput } from '@/components/pickers';
import { useQuickAdd } from '@/components/quickadd';
import { UsageEditor } from '@/components/usage';
import { ConfirmButton, FavoriteButton, Field, ProvenanceBadge, Section, toast } from '@/components/ui';
import { NotFound } from './NotFound';

export function CreatorDetail() {
  const { id = '' } = useParams();
  const c = useLiveQuery(() => db.creators.get(id).then((r) => r ?? null), [id]);
  if (c === undefined) return null;
  return c ? <CreatorView key={c.id} c={c} /> : <NotFound />;
}

function CreatorView({ c }: { c: Creator }) {
  const lk = useLookups();
  const nav = useNavigate();
  const quick = useQuickAdd();
  const breakdowns = useLiveQuery(() => db.breakdowns.where('creatorId').equals(c.id).toArray(), [c.id]);
  const videos = useLiveQuery(() => db.videos.where('creatorId').equals(c.id).toArray(), [c.id]);
  const techniques = useLiveQuery(async () => {
    const bds = await db.breakdowns.where('creatorId').equals(c.id).primaryKeys();
    const usages = bds.length ? await db.usages.where('targetId').anyOf(bds).toArray() : [];
    return [...new Set(usages.filter((u) => u.targetType === 'breakdown').map((u) => u.techniqueId))];
  }, [c.id]);
  const save = (patch: Partial<Creator>) => updateCreator(c.id, patch);
  const opts = <T extends { id: string; name: string }>(rows: T[] = []) => rows.map((r) => ({ id: r.id, label: r.name }));

  return (
    <div>
      <div className="label mb-3">
        <Link to="/creators" className="hover:text-ink">
          Creators
        </Link>
      </div>
      <header className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <Inline className="font-serif text-[46px] leading-[1] md:text-[64px]" value={c.name} onSave={(name) => name.trim() && save({ name: name.trim() })} label="Name" />
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
            {c.handles.map((h, i) => (
              <a key={i} href={h.url} target="_blank" rel="noreferrer" className={clsx(h.url && 'hover:text-ink')}>
                {h.handle} <span className="text-faint">· {platformLabel(h.platform)}</span>
              </a>
            ))}
            {c.channelUrl && (
              <a className="inline-flex items-center gap-1 hover:text-ink" href={c.channelUrl} target="_blank" rel="noreferrer">
                <ExternalLink size={12} /> Channel
              </a>
            )}
            {c.websiteUrl && (
              <a className="inline-flex items-center gap-1 hover:text-ink" href={c.websiteUrl} target="_blank" rel="noreferrer">
                <ExternalLink size={12} /> Website
              </a>
            )}
            <ProvenanceBadge value={c.provenance} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="input w-auto py-1.5 text-[13px]" value={c.status} onChange={(e) => save({ status: e.target.value as CreatorStatus })} aria-label="Evaluation status">
            <option value="candidate">Candidate</option>
            <option value="evaluating">Evaluating</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <FavoriteButton active={c.favorite} onClick={() => toggleFavorite('creators', c.id)} />
          <AddToCollection entityType="creator" entityId={c.id} />
          <ConfirmButton
            onConfirm={async () => {
              await deleteCreator(c.id);
              toast('Creator deleted');
              nav('/creators');
            }}
          >
            <Trash2 size={14} />
          </ConfirmButton>
        </div>
      </header>

      <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0">
          <Section title="Specialisation">
            <AreaInline value={c.specialization} onSave={(specialization) => save({ specialization })} placeholder="What do they teach or make?" big />
          </Section>

          <Section
            title="Breakdowns"
            count={breakdowns?.length}
            action={
              <button className="btn py-1" onClick={() => quick('breakdown', { creatorId: c.id })}>
                <Plus size={14} /> Add
              </button>
            }
          >
            {breakdowns?.length ? <div className="grid gap-1">{breakdowns.map((b) => <BreakdownRow key={b.id} b={b} />)}</div> : <p className="text-[13px] text-faint">No breakdowns saved yet.</p>}
          </Section>

          {c.watchlist.length > 0 && (
            <Section title="Noted during research" count={c.watchlist.length}>
              <p className="-mt-1 mb-3 text-[12.5px] text-faint">Titles found while researching this creator that are not yet saved as breakdowns.</p>
              <ul className="divide-y divide-line">
                {c.watchlist.map((w, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="text-[13.5px]">
                      {w.url ? (
                        <a href={w.url} target="_blank" rel="noreferrer" className="link">
                          {w.title}
                        </a>
                      ) : (
                        w.title
                      )}
                      {!w.url && <span className="ml-2 text-[11.5px] text-faint">URL not confirmed</span>}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      {w.url && (
                        <button
                          className="btn py-1 text-[12px]"
                          onClick={async () => {
                            const id = await createBreakdown({ url: w.url!, title: w.title, creatorId: c.id, provenance: 'inferred' });
                            await save({ watchlist: c.watchlist.filter((_, j) => j !== i) });
                            nav(`/breakdowns/${id}`);
                          }}
                        >
                          Save as breakdown
                        </button>
                      )}
                      <button className="icon-btn" aria-label="Remove" onClick={() => save({ watchlist: c.watchlist.filter((_, j) => j !== i) })}>
                        <X size={13} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {(videos?.length ?? 0) > 0 && (
            <Section title="Their work in your references" count={videos?.length}>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {videos!.map((v) => (
                  <VideoCard key={v.id} video={v} />
                ))}
              </div>
            </Section>
          )}

          {techniques && techniques.length > 0 && (
            <Section title="Techniques demonstrated in their breakdowns" count={techniques.length}>
              <div className="flex flex-wrap gap-1.5">
                {techniques.map((id) => (
                  <Link key={id} to={`/techniques/${id}`} className="chip hover:border-ink/40 hover:text-ink">
                    {lk?.techniques.get(id)?.name}
                  </Link>
                ))}
              </div>
            </Section>
          )}
        </div>

        <aside className="space-y-5">
          <h2 className="text-[24px]">Evaluation</h2>
          <Field label="Depth of technical explanation">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => save({ depth: c.depth === n ? 0 : n })} aria-label={`Depth ${n}`} className={clsx('h-6 flex-1 rounded', n <= c.depth ? 'bg-ink' : 'bg-line hover:bg-ink/30')} />
              ))}
            </div>
            <span className="mt-1 block text-[12px] text-faint">{c.depth ? `${c.depth}/5` : 'Not rated'} — rate after watching a full breakdown.</span>
          </Field>
          <Field label="Depth notes">
            <AreaInline value={c.depthNote} onSave={(depthNote) => save({ depthNote })} placeholder="Shows the timeline? Graph editor? Node trees?" />
          </Field>
          <Field label="Evaluation notes">
            <AreaInline value={c.evaluationNotes} onSave={(evaluationNotes) => save({ evaluationNotes })} />
          </Field>
          <Field label="Role">
            <select className="input" value={c.role} onChange={(e) => save({ role: e.target.value as CreatorRole })}>
              <option value="educator">Educator — explains how things are made</option>
              <option value="reference">Reference — makes work you study</option>
              <option value="both">Both</option>
            </select>
          </Field>
          <Field label="Primary software">
            <IdPicker options={opts(lk?.lists.software)} value={c.softwareIds} onChange={(softwareIds) => save({ softwareIds })} />
          </Field>
          <Field label="Specialises in">
            <IdPicker options={opts(lk?.lists.categories)} value={c.categoryIds} onChange={(categoryIds) => save({ categoryIds })} />
          </Field>
          <Field label="Types of breakdowns">
            <StringList value={c.breakdownTypes} onChange={(breakdownTypes) => save({ breakdownTypes })} placeholder="timeline walkthrough, effect recreation…" />
          </Field>
          <Handles c={c} onSave={(handles) => save({ handles })} />
          <Field label="Channel URL">
            <Inline className="input" value={c.channelUrl ?? ''} onSave={(channelUrl) => save({ channelUrl: channelUrl || undefined })} label="Channel URL" />
          </Field>
          <Field label="Website">
            <Inline className="input" value={c.websiteUrl ?? ''} onSave={(websiteUrl) => save({ websiteUrl: websiteUrl || undefined })} label="Website" />
          </Field>
          <Field label="Main platform">
            <select className="input" value={c.mainPlatform} onChange={(e) => save({ mainPlatform: e.target.value as Platform })}>
              {(['youtube', 'instagram', 'tiktok', 'vimeo', 'x', 'threads', 'web', 'other'] as Platform[]).map((p) => (
                <option key={p} value={p}>
                  {platformLabel(p)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tags">
            <TagInput value={c.tagIds} onChange={(tagIds) => save({ tagIds })} />
          </Field>
          <div>
            <div className="label mb-2">Techniques they explain well</div>
            <UsageEditor targetType="creator" targetId={c.id} compact defaultProvenance="verified" />
          </div>
          {c.sources.length > 0 && (
            <div className="rule pt-4 text-[12px] text-faint">
              <p className="label mb-1">Research sources</p>
              {c.sources.map((s, i) => (
                <a key={i} className="block truncate hover:text-ink" href={s.url} target="_blank" rel="noreferrer">
                  {s.label} {s.accessed && `· ${s.accessed}`}
                </a>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Handles({ c, onSave }: { c: Creator; onSave: (h: Handle[]) => void }) {
  const [h, setH] = useState('');
  const [url, setUrl] = useState('');
  return (
    <Field label="Handles">
      <ul className="mb-2 space-y-1">
        {c.handles.map((x, i) => (
          <li key={i} className="flex items-center justify-between text-[13px]">
            <span>
              {x.handle} <span className="text-faint">· {platformLabel(x.platform)}</span>
            </span>
            <button className="icon-btn h-6 w-6" aria-label="Remove handle" onClick={() => onSave(c.handles.filter((_, j) => j !== i))}>
              <X size={12} />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-1.5">
        <input className="input py-1.5" placeholder="@handle" value={h} onChange={(e) => setH(e.target.value)} />
        <input className="input py-1.5" placeholder="Profile URL" value={url} onChange={(e) => setUrl(e.target.value)} />
        <button
          className="icon-btn shrink-0"
          aria-label="Add handle"
          onClick={() => {
            if (!h.trim()) return;
            onSave([...c.handles, { handle: h.trim(), url: url.trim() || undefined, platform: url ? detectPlatform(url) : c.mainPlatform }]);
            setH('');
            setUrl('');
          }}
        >
          <Plus size={14} />
        </button>
      </div>
    </Field>
  );
}

function Inline({ value, onSave, className, label }: { value: string; onSave: (v: string) => void; className?: string; label: string }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return <input aria-label={label} className={clsx('w-full bg-transparent outline-none', !className?.includes('input') && 'border-0 p-0', className)} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onSave(v)} />;
}

function AreaInline({ value, onSave, placeholder, big }: { value: string; onSave: (v: string) => void; placeholder?: string; big?: boolean }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <textarea
      className={clsx(big ? 'min-h-[90px] w-full resize-y border-0 bg-transparent p-0 font-serif text-[22px] leading-snug outline-none placeholder:text-faint' : 'input min-h-[72px]')}
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== value && onSave(v)}
    />
  );
}
