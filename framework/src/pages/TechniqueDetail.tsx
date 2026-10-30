import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { ExternalLink, GitMerge, Pencil, Plus, Trash2, X } from 'lucide-react';
import { db } from '@/db/db';
import { addUsage, addVariation, deleteTechnique, deleteVariation, mergeTechniques, setRelated, toggleFavorite, updateTechnique } from '@/db/repo';
import type { Asset, Difficulty as Diff, Implementation, SourceRef, Technique } from '@/db/types';
import { useLiveQuery, useLookups } from '@/lib/hooks';
import { formatTime, present, urlAtTime } from '@/lib/util';
import { AddToCollection } from '@/components/collect';
import { Gallery } from '@/components/board';
import { ArtDirectionCard, BreakdownRow, VideoCover } from '@/components/cards';
import { StringList, TagInput, TagList } from '@/components/pickers';
import { Uploader } from '@/components/uploader';
import { TechniquePicker } from '@/components/usage';
import { ConfirmButton, Difficulty, FavoriteButton, Field, Modal, ProvenanceBadge, Section, Tabs, errorText, toast } from '@/components/ui';
import { NotFound } from './NotFound';

export function TechniqueDetail() {
  const { id = '' } = useParams();
  const t = useLiveQuery(() => db.techniques.get(id).then((r) => r ?? null), [id]);
  if (t === undefined) return null;
  return t ? <TechniqueView key={t.id} t={t} /> : <NotFound />;
}

function TechniqueView({ t }: { t: Technique }) {
  const lk = useLookups();
  const nav = useNavigate();
  const [editing, setEditing] = useState(false);
  const [merging, setMerging] = useState(false);

  const rel = useLiveQuery(async () => {
    const usages = await db.usages.where('techniqueId').equals(t.id).toArray();
    const of = (type: string) => usages.filter((u) => u.targetType === type);
    const videos = present(await db.videos.bulkGet(of('video').map((u) => u.targetId)));
    const stepBds = await db.breakdowns.filter((b) => b.steps.some((s) => s.techniqueIds.includes(t.id))).toArray();
    const usageBds = present(await db.breakdowns.bulkGet(of('breakdown').map((u) => u.targetId)));
    const breakdowns = [...new Map([...usageBds, ...stepBds].map((b) => [b.id, b])).values()];
    const directAssets = present(await db.assets.bulkGet(of('asset').map((u) => u.targetId)));
    const videoFrames = videos.length ? await db.assets.where('videoId').anyOf(videos.map((v) => v.id)).toArray() : [];
    const assets: Asset[] = [...new Map([...directAssets, ...videoFrames].map((a) => [a.id, a])).values()];
    const adIds = new Set([...of('artDirection').map((u) => u.targetId), ...videos.flatMap((v) => v.artDirectionIds)]);
    const ads = present(await db.artDirections.bulkGet([...adIds]));
    const creatorIds = new Set(present([...breakdowns.map((b) => b.creatorId), ...of('creator').map((u) => u.targetId)]));
    const creators = present(await db.creators.bulkGet([...creatorIds]));
    const variations = await db.variations.where('techniqueId').equals(t.id).toArray();
    const glossary = await db.glossary.where('techniqueId').equals(t.id).toArray();
    return { usages, videoUsages: of('video'), videos, breakdowns, assets, ads, creators, variations, glossary };
  }, [t.id]);

  const related = t.relatedIds.map((id) => lk?.techniques.get(id)).filter(Boolean) as Technique[];
  const cat = lk?.categories.get(t.categoryId);
  const [implTab, setImplTab] = useState(t.implementations[0]?.softwareId ?? '');
  useEffect(() => {
    if (!t.implementations.some((i) => i.softwareId === implTab)) setImplTab(t.implementations[0]?.softwareId ?? '');
  }, [t.implementations, implTab]);
  const impl = t.implementations.find((i) => i.softwareId === implTab);

  return (
    <div>
      <div className="label mb-3 flex flex-wrap items-center gap-2">
        <Link to="/techniques" className="hover:text-ink">
          Techniques
        </Link>
        <span>/</span>
        <Link to={`/techniques?tab=${t.categoryId}`} className="hover:text-ink">
          {cat?.name}
        </Link>
      </div>
      <header className="mb-10 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="min-w-0">
          <h1 className="text-[48px] leading-[1] md:text-[68px]">{t.name}</h1>
          {t.aliases.length > 0 && <p className="mt-2 text-[13.5px] text-muted">Also called {t.aliases.join(', ')}</p>}
          <p className="mt-4 max-w-3xl font-serif text-[23px] leading-snug text-ink/85">{t.summary || <span className="text-faint">No visual description yet.</span>}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Difficulty value={t.difficulty} />
            <ProvenanceBadge value={t.provenance} />
            <TagList ids={t.tagIds} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FavoriteButton active={t.favorite} onClick={() => toggleFavorite('techniques', t.id)} />
          <AddToCollection entityType="technique" entityId={t.id} />
          <button className="btn" onClick={() => setEditing(true)}>
            <Pencil size={14} /> Edit
          </button>
          <button className="btn" onClick={() => setMerging(true)} title="Merge a duplicate into another entry">
            <GitMerge size={14} /> Merge
          </button>
          <ConfirmButton
            onConfirm={async () => {
              await deleteTechnique(t.id);
              toast('Technique deleted');
              nav('/techniques');
            }}
          >
            <Trash2 size={14} />
          </ConfirmButton>
        </div>
      </header>
      {t.provenance === 'reference' && (
        <p className="-mt-6 mb-10 max-w-3xl text-[12.5px] text-faint">
          Reference entry: general production knowledge, not taken from a specific video. Menu names vary between versions — confirm against a breakdown, then attach real examples below.
        </p>
      )}

      <Section title="Visual examples" count={rel?.assets.length}>
        <Uploader
          compact
          options={{ kind: 'frame' }}
          label={`Drop frames that show ${t.name.toLowerCase()}`}
          onDone={async (ids) => {
            for (const id of ids) await addUsage({ techniqueId: t.id, targetType: 'asset', targetId: id, timestamp: null, note: '', provenance: 'verified' });
          }}
        />
        <div className="mt-4">
          <Gallery assets={rel?.assets ?? []} emptyText="Frames linked to this technique — directly, or through a video that uses it — collect here." />
        </div>
      </Section>

      <div className="grid gap-x-12 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <Section title="How it works">
            <p className="prose-notes max-w-2xl">{t.description || <span className="text-faint">Not described yet.</span>}</p>
          </Section>

          <Section title="How to recreate it">
            {t.implementations.length ? (
              <>
                <Tabs value={implTab} onChange={setImplTab} options={t.implementations.map((i) => ({ value: i.softwareId, label: lk?.software.get(i.softwareId)?.name ?? i.softwareId }))} className="mb-4" />
                {impl && <Steps text={impl.steps} />}
              </>
            ) : (
              <p className="text-[13px] text-faint">No software workflow yet — add one from Edit.</p>
            )}
            <dl className="mt-8 grid gap-5 sm:grid-cols-2">
              {[
                ['Required footage', t.requiredFootage],
                ['Required assets', t.requiredAssets],
                ['Keyframe principles', t.keyframeNotes],
                ['Plugins', t.plugins.join(', ')],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="label mb-1">{label}</dt>
                  <dd className="text-[13.5px] text-ink/85">{value || <span className="text-faint">—</span>}</dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section title="Variations" count={rel?.variations.length}>
            <Variations techniqueId={t.id} variations={rel?.variations ?? []} />
          </Section>

          <Section title="Videos using it" count={rel?.videos.length}>
            {rel?.videos.length ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {rel.videoUsages.map((u) => {
                  const v = rel.videos.find((x) => x.id === u.targetId);
                  if (!v) return null;
                  return (
                    <div key={u.id}>
                      <Link to={`/videos/${v.id}`} className="block overflow-hidden rounded-xl border border-line">
                        <VideoCover video={v} />
                      </Link>
                      <p className="mt-1.5 line-clamp-1 text-[13px] font-medium">{v.title}</p>
                      <div className="flex items-center gap-2 text-[12px] text-muted">
                        {u.timestamp != null && (
                          <a href={urlAtTime(v.url, u.timestamp)} target="_blank" rel="noreferrer" className="font-mono hover:text-ink">
                            {formatTime(u.timestamp)}
                          </a>
                        )}
                        <ProvenanceBadge value={u.provenance} />
                      </div>
                      {u.note && <p className="mt-1 text-[12px] text-muted">{u.note}</p>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[13px] text-faint">No saved reference uses this yet. Link it from a video's Techniques panel.</p>
            )}
          </Section>
        </div>

        <aside className="min-w-0">
          <Section title="Explained in" count={rel?.breakdowns.length}>
            {rel?.breakdowns.length ? rel.breakdowns.map((b) => <BreakdownRow key={b.id} b={b} />) : <p className="text-[13px] text-faint">No breakdown linked yet.</p>}
            {rel && rel.creators.length > 0 && (
              <div className="mt-4">
                <div className="label mb-2">Creators explaining it</div>
                <div className="flex flex-wrap gap-1.5">
                  {rel.creators.map((c) => (
                    <Link key={c.id} to={`/creators/${c.id}`} className="chip hover:border-ink/40 hover:text-ink">
                      {c.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </Section>

          <Section title="Related techniques" count={related.length}>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {related.map((r) => (
                <span key={r.id} className="chip py-1 text-ink">
                  <Link to={`/techniques/${r.id}`} className="hover:underline">
                    {r.name}
                  </Link>
                  <button className="text-faint hover:text-ink" aria-label={`Unlink ${r.name}`} onClick={() => setRelated(t.id, r.id, false)}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <TechniquePicker placeholder="Relate another technique…" exclude={[t.id, ...t.relatedIds]} onPick={(r) => setRelated(t.id, r.id, true)} />
          </Section>

          <Section title="Common in art directions" count={rel?.ads.length}>
            {rel?.ads.length ? (
              <div className="grid grid-cols-2 gap-4">
                {rel.ads.map((a) => (
                  <ArtDirectionCard key={a.id} ad={a} />
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-faint">Not associated with an art direction yet.</p>
            )}
          </Section>

          {rel && rel.glossary.length > 0 && (
            <Section title="Glossary">
              <dl className="space-y-3">
                {rel.glossary.map((g) => (
                  <div key={g.id}>
                    <dt className="font-medium">{g.term}</dt>
                    <dd className="text-[13px] text-muted">{g.definition}</dd>
                  </div>
                ))}
              </dl>
            </Section>
          )}

          {t.sources.length > 0 && (
            <Section title="Sources">
              <ul className="space-y-1.5 text-[13px]">
                {t.sources.map((s, i) => (
                  <li key={i}>
                    <a className="link inline-flex items-center gap-1" href={s.url} target="_blank" rel="noreferrer">
                      <ExternalLink size={12} /> {s.label || s.url}
                    </a>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </aside>
      </div>

      {editing && <TechniqueEditor t={t} onClose={() => setEditing(false)} />}
      <Modal open={merging} onClose={() => setMerging(false)} title={`Merge “${t.name}” into…`}>
        <p className="mb-3 text-[13px] text-muted">
          Use this when two entries describe the same technique. Every example, variation, relation and collection link moves to the target; “{t.name}” becomes an alias of it.
        </p>
        <TechniquePicker
          autoFocus
          exclude={[t.id]}
          onPick={async (target) => {
            try {
              await mergeTechniques(t.id, target.id);
              toast(`Merged into ${target.name}`);
              setMerging(false);
              nav(`/techniques/${target.id}`);
            } catch (e) {
              toast(errorText(e), 'error');
            }
          }}
        />
      </Modal>
    </div>
  );
}

function Steps({ text }: { text: string }) {
  const lines = text.split('\n').filter((l) => l.trim());
  const numbered = lines.every((l) => /^\d+[.)]\s/.test(l.trim()));
  if (numbered && lines.length > 1) {
    return (
      <ol className="space-y-2.5">
        {lines.map((l, i) => (
          <li key={i} className="grid grid-cols-[28px_1fr] gap-2 text-[14px] leading-relaxed">
            <span className="font-mono text-[12px] leading-[1.9] text-faint">{String(i + 1).padStart(2, '0')}</span>
            <span>{l.replace(/^\d+[.)]\s*/, '')}</span>
          </li>
        ))}
      </ol>
    );
  }
  return <p className="prose-notes">{text}</p>;
}

function Variations({ techniqueId, variations }: { techniqueId: string; variations: { id: string; name: string; description: string }[] }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  return (
    <div>
      {variations.length > 0 && (
        <ul className="mb-4 divide-y divide-line">
          {variations.map((v) => (
            <li key={v.id} className="group flex items-start justify-between gap-3 py-2.5">
              <div>
                <p className="font-medium">{v.name}</p>
                {v.description && <p className="text-[13px] text-muted">{v.description}</p>}
              </div>
              <button className="icon-btn opacity-0 group-hover:opacity-100" aria-label={`Delete ${v.name}`} onClick={() => deleteVariation(v.id)}>
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          await addVariation(techniqueId, name, desc);
          setName('');
          setDesc('');
        }}
      >
        <input className="input sm:w-56" placeholder="New variation" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input flex-1" placeholder="What's different about it?" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <button className="btn" type="submit">
          <Plus size={14} /> Add
        </button>
      </form>
    </div>
  );
}

function TechniqueEditor({ t, onClose }: { t: Technique; onClose: () => void }) {
  const lk = useLookups();
  const [d, setD] = useState<Technique>(t);
  const set = <K extends keyof Technique>(k: K, v: Technique[K]) => setD((x) => ({ ...x, [k]: v }));
  const usedSw = useMemo(() => new Set(d.implementations.map((i) => i.softwareId)), [d.implementations]);
  const save = async () => {
    try {
      await updateTechnique(t.id, {
        name: d.name.trim(),
        aliases: d.aliases,
        categoryId: d.categoryId,
        summary: d.summary,
        description: d.description,
        difficulty: d.difficulty,
        requiredFootage: d.requiredFootage,
        requiredAssets: d.requiredAssets,
        plugins: d.plugins,
        keyframeNotes: d.keyframeNotes,
        implementations: d.implementations.filter((i) => i.steps.trim()),
        tagIds: d.tagIds,
        sources: d.sources.filter((s) => s.url.trim()),
      });
      toast('Saved');
      onClose();
    } catch (e) {
      toast(errorText(e), 'error');
    }
  };
  const setImpl = (i: number, patch: Partial<Implementation>) => set('implementations', d.implementations.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const setSource = (i: number, patch: Partial<SourceRef>) => set('sources', d.sources.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={`Edit ${t.name}`}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-solid" onClick={() => void save()}>
            Save changes
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input className="input" value={d.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Category">
          <select className="input" value={d.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
            {(lk?.lists.categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Aliases" className="sm:col-span-2" hint="Other names — they make search and duplicate detection work.">
          <StringList value={d.aliases} onChange={(v) => set('aliases', v)} placeholder="swish pan, whip transition…" />
        </Field>
        <Field label="Visual description" className="sm:col-span-2">
          <textarea className="input min-h-[64px]" value={d.summary} onChange={(e) => set('summary', e.target.value)} />
        </Field>
        <Field label="How it works" className="sm:col-span-2">
          <textarea className="input min-h-[110px]" value={d.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <Field label="Difficulty">
          <select className="input" value={d.difficulty} onChange={(e) => set('difficulty', Number(e.target.value) as Diff)}>
            <option value={1}>Beginner</option>
            <option value={2}>Intermediate</option>
            <option value={3}>Advanced</option>
          </select>
        </Field>
        <Field label="Plugins">
          <StringList value={d.plugins} onChange={(v) => set('plugins', v)} placeholder="Optional plugins" />
        </Field>
        <Field label="Required footage">
          <textarea className="input min-h-[64px]" value={d.requiredFootage} onChange={(e) => set('requiredFootage', e.target.value)} />
        </Field>
        <Field label="Required assets">
          <textarea className="input min-h-[64px]" value={d.requiredAssets} onChange={(e) => set('requiredAssets', e.target.value)} />
        </Field>
        <Field label="Keyframe principles" className="sm:col-span-2">
          <textarea className="input min-h-[64px]" value={d.keyframeNotes} onChange={(e) => set('keyframeNotes', e.target.value)} />
        </Field>
        <Field label="Tags" className="sm:col-span-2">
          <TagInput value={d.tagIds} onChange={(v) => set('tagIds', v)} />
        </Field>
      </div>

      <div className="mt-6">
        <div className="label mb-2">Software workflows</div>
        <div className="space-y-3">
          {d.implementations.map((imp, i) => (
            <div key={i} className="rounded-xl border border-line p-3">
              <div className="mb-2 flex items-center gap-2">
                <select className="input w-auto py-1.5" value={imp.softwareId} onChange={(e) => setImpl(i, { softwareId: e.target.value })}>
                  {(lk?.lists.software ?? []).map((s) => (
                    <option key={s.id} value={s.id} disabled={s.id !== imp.softwareId && usedSw.has(s.id)}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <button className="icon-btn ml-auto" aria-label="Remove workflow" onClick={() => set('implementations', d.implementations.filter((_, j) => j !== i))}>
                  <Trash2 size={14} />
                </button>
              </div>
              <textarea className="input min-h-[110px] font-mono text-[12.5px]" value={imp.steps} placeholder={'1. First step\n2. Second step'} onChange={(e) => setImpl(i, { steps: e.target.value })} />
            </div>
          ))}
        </div>
        <button
          className="btn mt-2"
          onClick={() => {
            const free = (lk?.lists.software ?? []).find((s) => !usedSw.has(s.id));
            if (free) set('implementations', [...d.implementations, { softwareId: free.id, steps: '' }]);
          }}
        >
          <Plus size={14} /> Add workflow
        </button>
      </div>

      <div className="mt-6">
        <div className="label mb-2">Original source links</div>
        <div className="space-y-2">
          {d.sources.map((s, i) => (
            <div key={i} className="flex gap-2">
              <input className="input" placeholder="https://…" value={s.url} onChange={(e) => setSource(i, { url: e.target.value })} />
              <input className="input" placeholder="Label" value={s.label} onChange={(e) => setSource(i, { label: e.target.value })} />
              <button className="icon-btn shrink-0" aria-label="Remove source" onClick={() => set('sources', d.sources.filter((_, j) => j !== i))}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
        <button className={clsx('btn mt-2')} onClick={() => set('sources', [...d.sources, { url: '', label: '' }])}>
          <Plus size={14} /> Add source
        </button>
      </div>
    </Modal>
  );
}
