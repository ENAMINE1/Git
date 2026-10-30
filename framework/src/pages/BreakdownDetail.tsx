import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { ExternalLink, ListPlus, Play, Plus, Trash2, X } from 'lucide-react';
import { db } from '@/db/db';
import { deleteBreakdown, toggleFavorite, updateBreakdown } from '@/db/repo';
import type { BreakdownStep, Transcript, VideoBreakdown } from '@/db/types';
import { useLiveQuery, useLookups } from '@/lib/hooks';
import { parseChapters, parseTranscript } from '@/lib/transcript';
import { formatTime, parseTime, platformLabel, uid, urlAtTime, youtubeId } from '@/lib/util';
import { AddToCollection } from '@/components/collect';
import { IdPicker, TagInput } from '@/components/pickers';
import { TechniquePicker, UsageEditor } from '@/components/usage';
import { ConfirmButton, FavoriteButton, Field, Modal, ProvenanceBadge, Section, toast } from '@/components/ui';
import { NotFound } from './NotFound';

export function BreakdownDetail() {
  const { id = '' } = useParams();
  const b = useLiveQuery(() => db.breakdowns.get(id).then((r) => r ?? null), [id]);
  if (b === undefined) return null;
  return b ? <BreakdownView key={b.id} b={b} /> : <NotFound />;
}

function BreakdownView({ b }: { b: VideoBreakdown }) {
  const lk = useLookups();
  const nav = useNavigate();
  const creator = b.creatorId ? lk?.creators.get(b.creatorId) : undefined;
  const ref = useLiveQuery(() => (b.referenceVideoId ? db.videos.get(b.referenceVideoId) : undefined), [b.referenceVideoId]);
  const transcript = useLiveQuery(() => db.transcripts.where('breakdownId').equals(b.id).first(), [b.id]);
  const videos = useLiveQuery(() => db.videos.toArray(), []);
  const yt = youtubeId(b.url);
  const [player, setPlayer] = useState<{ start: number } | null>(null);
  const [chapters, setChapters] = useState(false);
  const [summary, setSummary] = useState(b.summary);
  useEffect(() => setSummary(b.summary), [b.summary]);

  const steps = useMemo(() => [...b.steps].sort((x, y) => (x.t ?? Infinity) - (y.t ?? Infinity)), [b.steps]);
  const saveSteps = (next: BreakdownStep[]) => updateBreakdown(b.id, { steps: next });
  const seek = (t: number | null) => {
    if (t == null) return;
    if (yt) setPlayer({ start: Math.floor(t) });
    else window.open(urlAtTime(b.url, t), '_blank', 'noreferrer');
  };

  return (
    <div>
      <div className="label mb-3">
        <Link to="/breakdowns" className="hover:text-ink">
          Breakdowns
        </Link>
      </div>
      <header className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-[38px] leading-[1.05] md:text-[50px]">{b.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
            {creator && (
              <Link to={`/creators/${creator.id}`} className="link text-ink">
                {creator.name}
              </Link>
            )}
            <span>{platformLabel(b.platform)}</span>
            <a className="inline-flex items-center gap-1 hover:text-ink" href={b.url} target="_blank" rel="noreferrer">
              <ExternalLink size={13} /> Open original
            </a>
            <ProvenanceBadge value={b.provenance} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="input w-auto py-1.5 text-[13px]" value={b.status} onChange={(e) => updateBreakdown(b.id, { status: e.target.value as VideoBreakdown['status'] })} aria-label="Status">
            <option value="to-watch">To watch</option>
            <option value="watched">Watched</option>
            <option value="extracted">Techniques extracted</option>
          </select>
          <FavoriteButton active={b.favorite} onClick={() => toggleFavorite('breakdowns', b.id)} />
          <AddToCollection entityType="breakdown" entityId={b.id} />
          <ConfirmButton
            onConfirm={async () => {
              await deleteBreakdown(b.id);
              toast('Breakdown deleted');
              nav('/breakdowns');
            }}
          >
            <Trash2 size={14} />
          </ConfirmButton>
        </div>
      </header>

      {b.sources.some((s) => s.note) && (
        <p className="mb-8 max-w-3xl rounded-xl border border-dashed border-inferred/60 bg-inferred/[0.05] p-3.5 text-[13px] text-muted">{b.sources.find((s) => s.note)?.note}</p>
      )}

      <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          {yt && (
            <div className="mb-10 overflow-hidden rounded-xl bg-black">
              {player ? (
                <iframe
                  key={player.start}
                  title={b.title}
                  className="aspect-video w-full"
                  src={`https://www.youtube-nocookie.com/embed/${yt}?start=${player.start}&autoplay=1&rel=0`}
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              ) : (
                <button className="group relative flex aspect-video w-full items-center justify-center" onClick={() => setPlayer({ start: 0 })}>
                  <img src={`https://i.ytimg.com/vi/${yt}/hqdefault.jpg`} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = 'none')} />
                  <span className="relative flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-[13px] font-medium text-black">
                    <Play size={14} fill="currentColor" /> Load player
                  </span>
                </button>
              )}
            </div>
          )}

          <Section
            title="Timeline"
            count={steps.length}
            action={
              <div className="flex gap-2">
                <button className="btn py-1" onClick={() => setChapters(true)}>
                  <ListPlus size={14} /> Paste chapters
                </button>
                <button className="btn py-1" onClick={() => saveSteps([...b.steps, { id: uid('step'), t: null, label: '', description: '', techniqueIds: [] }])}>
                  <Plus size={14} /> Step
                </button>
              </div>
            }
          >
            {steps.length === 0 ? (
              <p className="text-[13px] text-faint">
                No steps recorded. While watching, add each stage of the workflow with the timestamp shown in the player — or paste the chapter list from the video description.
              </p>
            ) : (
              <ol className="relative border-l border-line">
                {steps.map((s) => (
                  <StepRow key={s.id} step={s} onSeek={() => seek(s.t)} onChange={(patch) => saveSteps(b.steps.map((x) => (x.id === s.id ? { ...x, ...patch } : x)))} onDelete={() => saveSteps(b.steps.filter((x) => x.id !== s.id))} />
                ))}
              </ol>
            )}
          </Section>

          <TranscriptSection breakdown={b} transcript={transcript} onSeek={seek} />
        </div>

        <aside className="space-y-8">
          <Field label="Summary">
            <textarea className="input min-h-[90px]" value={summary} onChange={(e) => setSummary(e.target.value)} onBlur={() => summary !== b.summary && updateBreakdown(b.id, { summary })} />
          </Field>
          <div>
            <h2 className="mb-3 text-[24px]">Techniques demonstrated</h2>
            <UsageEditor targetType="breakdown" targetId={b.id} />
          </div>
          <Field label="Creator">
            <select className="input" value={b.creatorId ?? ''} onChange={(e) => updateBreakdown(b.id, { creatorId: e.target.value || undefined })}>
              <option value="">—</option>
              {(lk?.lists.creators ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Software & tools">
            <IdPicker options={(lk?.lists.software ?? []).map((s) => ({ id: s.id, label: s.name }))} value={b.softwareIds} onChange={(softwareIds) => updateBreakdown(b.id, { softwareIds })} />
          </Field>
          <Field label="Explains this saved reference">
            <select className="input" value={b.referenceVideoId ?? ''} onChange={(e) => updateBreakdown(b.id, { referenceVideoId: e.target.value || undefined })}>
              <option value="">—</option>
              {(videos ?? []).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.title}
                </option>
              ))}
            </select>
            {ref && (
              <Link className="link mt-1 inline-block text-[12px] text-muted" to={`/videos/${ref.id}`}>
                Open {ref.title}
              </Link>
            )}
          </Field>
          <Field label="Format">
            <select className="input" value={b.format} onChange={(e) => updateBreakdown(b.id, { format: e.target.value as VideoBreakdown['format'] })}>
              <option value="long-form">Long-form</option>
              <option value="short-form">Short-form</option>
              <option value="article">Article</option>
              <option value="unknown">Unknown</option>
            </select>
          </Field>
          <Field label="Tags">
            <TagInput value={b.tagIds} onChange={(tagIds) => updateBreakdown(b.id, { tagIds })} />
          </Field>
          <div className="rule pt-4 text-[12px] text-faint">
            <p className="label mb-1">Sources</p>
            {b.sources.map((s, i) => (
              <a key={i} className="block truncate hover:text-ink" href={s.url} target="_blank" rel="noreferrer">
                {s.label} {s.accessed && `· ${s.accessed}`}
              </a>
            ))}
          </div>
        </aside>
      </div>

      <ChapterImport
        open={chapters}
        onClose={() => setChapters(false)}
        onImport={(rows) => {
          const existing = new Set(b.steps.map((s) => s.t));
          const add = rows.filter((r) => !existing.has(r.t)).map((r) => ({ id: uid('step'), t: r.t, label: r.label, description: '', techniqueIds: [] }));
          void saveSteps([...b.steps, ...add]);
          toast(`Added ${add.length} step${add.length === 1 ? '' : 's'}`);
          setChapters(false);
        }}
      />
    </div>
  );
}

function StepRow({ step, onChange, onDelete, onSeek }: { step: BreakdownStep; onChange: (p: Partial<BreakdownStep>) => void; onDelete: () => void; onSeek: () => void }) {
  const lk = useLookups();
  const [t, setT] = useState(step.t == null ? '' : formatTime(step.t));
  const [label, setLabel] = useState(step.label);
  const [desc, setDesc] = useState(step.description);
  const [adding, setAdding] = useState(false);
  useEffect(() => setT(step.t == null ? '' : formatTime(step.t)), [step.t]);
  return (
    <li className="group relative mb-5 ml-5">
      <span className={clsx('absolute -left-[25px] top-2.5 h-2 w-2 rounded-full', step.t == null ? 'border border-faint bg-paper' : 'bg-ink')} />
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex items-center">
          <input
            className="input w-[78px] py-1 font-mono text-[12.5px]"
            value={t}
            placeholder="mm:ss"
            aria-label="Timestamp"
            title="Copy the time from the player — don't estimate"
            onChange={(e) => setT(e.target.value)}
            onBlur={() => {
              const v = parseTime(t);
              if (t.trim() && v == null) return toast('Use mm:ss or h:mm:ss', 'error');
              if (v !== step.t) onChange({ t: v });
            }}
          />
          {step.t != null && (
            <button className="icon-btn ml-1 h-7 w-7" onClick={onSeek} aria-label={`Play from ${formatTime(step.t)}`} title="Play from here">
              <Play size={12} />
            </button>
          )}
        </div>
        <input
          className="min-w-[160px] flex-1 border-0 bg-transparent py-1 font-serif text-[20px] leading-tight outline-none placeholder:text-faint"
          value={label}
          placeholder="What happens in this step"
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => label !== step.label && onChange({ label })}
          aria-label="Step label"
        />
        <button className="icon-btn opacity-0 group-hover:opacity-100" onClick={onDelete} aria-label="Delete step">
          <Trash2 size={13} />
        </button>
      </div>
      <textarea
        className="mt-1.5 w-full resize-y border-0 bg-transparent p-0 text-[13.5px] text-ink/80 outline-none placeholder:text-faint"
        rows={desc ? 2 : 1}
        value={desc}
        placeholder="Settings, keyframes, layer order…"
        onChange={(e) => setDesc(e.target.value)}
        onBlur={() => desc !== step.description && onChange({ description: desc })}
      />
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        {step.techniqueIds.map((id) => (
          <span key={id} className="chip py-0 text-[11.5px] text-ink">
            <Link to={`/techniques/${id}`} className="hover:underline">
              {lk?.techniques.get(id)?.name ?? 'Missing'}
            </Link>
            <button aria-label="Unlink" className="text-faint hover:text-ink" onClick={() => onChange({ techniqueIds: step.techniqueIds.filter((x) => x !== id) })}>
              <X size={11} />
            </button>
          </span>
        ))}
        {adding ? (
          <div className="w-full max-w-sm">
            <TechniquePicker
              autoFocus
              exclude={step.techniqueIds}
              onPick={(tech) => {
                onChange({ techniqueIds: [...step.techniqueIds, tech.id] });
                setAdding(false);
              }}
            />
          </div>
        ) : (
          <button className="text-[11.5px] text-faint hover:text-ink" onClick={() => setAdding(true)}>
            + technique
          </button>
        )}
      </div>
    </li>
  );
}

function ChapterImport({ open, onClose, onImport }: { open: boolean; onClose: () => void; onImport: (rows: { t: number; label: string }[]) => void }) {
  const [raw, setRaw] = useState('');
  const rows = useMemo(() => parseChapters(raw), [raw]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Paste chapters"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-solid" disabled={!rows.length} onClick={() => onImport(rows)}>
            Add {rows.length || ''} steps
          </button>
        </>
      }
    >
      <p className="mb-3 text-[13px] text-muted">Copy the chapter list from the video's own description (lines like “02:40 Masking”). Only lines with a timestamp become steps.</p>
      <textarea className="input min-h-[180px] font-mono text-[12.5px]" value={raw} onChange={(e) => setRaw(e.target.value)} placeholder={'00:00 Intro\n01:15 Footage prep\n…'} />
      {rows.length > 0 && (
        <ul className="mt-3 max-h-40 overflow-y-auto text-[12.5px]">
          {rows.map((r, i) => (
            <li key={i}>
              <span className="font-mono text-faint">{formatTime(r.t)}</span> {r.label}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function TranscriptSection({ breakdown, transcript, onSeek }: { breakdown: VideoBreakdown; transcript?: Transcript; onSeek: (t: number | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');
  const [q, setQ] = useState('');
  const segs = useMemo(() => {
    const all = transcript?.segments ?? [];
    const n = q.trim().toLowerCase();
    return n ? all.filter((s) => s.text.toLowerCase().includes(n)) : all;
  }, [transcript, q]);
  const save = async () => {
    const segments = parseTranscript(raw);
    const now = Date.now();
    if (transcript) await db.transcripts.update(transcript.id, { raw, segments, updatedAt: now });
    else await db.transcripts.add({ id: uid('tr'), breakdownId: breakdown.id, origin: 'manual-paste', language: 'en', raw, segments, createdAt: now, updatedAt: now });
    toast(`Saved transcript · ${segments.length} segments`);
    setEditing(false);
  };
  return (
    <Section
      title="Transcript"
      count={transcript?.segments.length}
      action={
        <button
          className="btn py-1"
          onClick={() => {
            setRaw(transcript?.raw ?? '');
            setEditing(true);
          }}
        >
          {transcript ? 'Replace' : 'Paste transcript'}
        </button>
      }
    >
      {!transcript && <p className="text-[13px] text-faint">No transcript stored. Paste captions you exported or copied from the platform (WebVTT, SRT, or timestamped lines). Nothing is fetched or generated automatically.</p>}
      {transcript && (
        <>
          <input className="input mb-3 py-1.5" placeholder="Search the transcript…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="max-h-[480px] space-y-1 overflow-y-auto pr-2">
            {segs.map((s, i) => (
              <p key={i} className="grid grid-cols-[56px_1fr] gap-2 text-[13.5px] leading-relaxed">
                {s.t != null ? (
                  <button className="text-left font-mono text-[11.5px] leading-[1.9] text-faint hover:text-accent" onClick={() => onSeek(s.t)}>
                    {formatTime(s.t)}
                  </button>
                ) : (
                  <span />
                )}
                <span>{s.text}</span>
              </p>
            ))}
          </div>
          <p className="mt-2 text-[11.5px] text-faint">Pasted {new Date(transcript.createdAt).toLocaleDateString()} · {transcript.origin}</p>
        </>
      )}
      <Modal
        open={editing}
        wide
        onClose={() => setEditing(false)}
        title="Paste transcript"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button className="btn-solid" disabled={!raw.trim()} onClick={() => void save()}>
              Save transcript
            </button>
          </>
        }
      >
        <textarea className="input min-h-[300px] font-mono text-[12px]" value={raw} onChange={(e) => setRaw(e.target.value)} placeholder={'WEBVTT\n\n00:00:01.000 --> 00:00:04.000\n…'} />
      </Modal>
    </Section>
  );
}
