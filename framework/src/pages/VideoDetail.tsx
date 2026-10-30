import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { AlertCircle, Camera, Check, CircleDashed, ExternalLink, FileVideo, Plus, Trash2, Upload } from 'lucide-react';
import { db } from '@/db/db';
import { attachVideoFile, captureFrame, detachVideoFile } from '@/db/images';
import { createArtDirection, deleteVideo, toggleFavorite, updateVideo } from '@/db/repo';
import { ANALYSIS_KEYS, type AnalysisKey, type Provenance, type ReferenceStatus, type VideoReference } from '@/db/types';
import { useFileUrl, useLiveQuery, useLookups } from '@/lib/hooks';
import { formatTime, platformLabel, relativeDate } from '@/lib/util';
import { AddToCollection } from '@/components/collect';
import { BoardExtras, Gallery } from '@/components/board';
import { BreakdownRow } from '@/components/cards';
import { IdPicker, TagInput } from '@/components/pickers';
import { useQuickAdd } from '@/components/quickadd';
import { Uploader } from '@/components/uploader';
import { UsageEditor } from '@/components/usage';
import { ConfirmButton, FavoriteButton, Field, ProvenanceBadge, ProvenanceSelect, Section, toast } from '@/components/ui';
import { NotFound } from './NotFound';

export const CHECKLIST: { id: string; label: string }[] = [
  { id: 'access', label: 'Access the original video' },
  { id: 'record', label: 'Record the creator and original URL' },
  { id: 'style', label: 'Examine the visual style' },
  { id: 'genre', label: 'Identify the genre and niche' },
  { id: 'transitions', label: 'Identify editing effects and transitions' },
  { id: 'motion', label: 'Identify motion graphics and animation' },
  { id: 'camera', label: 'Identify cinematography and camera movement' },
  { id: 'type', label: 'Identify typography and graphic composition' },
  { id: 'sound', label: 'Identify sound design (where accessible)' },
  { id: 'frames', label: 'Extract representative frames or screenshots' },
  { id: 'direction', label: 'Assign one or more art directions' },
  { id: 'techniques', label: 'Link the identifiable techniques' },
];

const ANALYSIS_LABEL: Record<AnalysisKey, string> = {
  visualStyle: 'Visual style',
  genreNiche: 'Genre & niche',
  transitions: 'Transitions & editing effects',
  effects: 'Visual effects',
  motionGraphics: 'Motion graphics & animation',
  cinematography: 'Cinematography & camera',
  typography: 'Typography & composition',
  sound: 'Sound design',
  pacing: 'Editing grammar & pacing',
};

export function VideoDetail() {
  const { id = '' } = useParams();
  const video = useLiveQuery(() => db.videos.get(id).then((r) => r ?? null), [id]);
  if (video === undefined) return null;
  return video ? <VideoView video={video} /> : <NotFound />;
}

function VideoView({ video }: { video: VideoReference }) {
  const lk = useLookups();
  const nav = useNavigate();
  const quick = useQuickAdd();
  const creator = video.creatorId ? lk?.creators.get(video.creatorId) : undefined;
  const assets = useLiveQuery(() => db.assets.where('videoId').equals(video.id).reverse().sortBy('createdAt'), [video.id]);
  const usageCount = useLiveQuery(() => db.usages.where('[targetType+targetId]').equals(['video', video.id]).count(), [video.id]);
  const breakdowns = useLiveQuery(() => db.breakdowns.where('referenceVideoId').equals(video.id).toArray(), [video.id]);
  const [currentTime, setCurrentTime] = useState<number | undefined>();
  const [title, setTitle] = useState(video.title);
  useEffect(() => setTitle(video.title), [video.title]);

  const auto: Record<string, boolean> = {
    record: !!video.url,
    genre: video.genreIds.length > 0,
    frames: (assets?.length ?? 0) > 0,
    direction: video.artDirectionIds.length > 0,
    techniques: (usageCount ?? 0) > 0,
  };
  const done = (k: string) => !!video.checklist[k] || !!auto[k];
  const progress = CHECKLIST.filter((c) => done(c.id)).length;

  const setStatus = (status: ReferenceStatus) => updateVideo(video.id, { status });
  const toggleStep = (k: string) => {
    const checklist = { ...video.checklist, [k]: !video.checklist[k] };
    void updateVideo(video.id, { checklist, status: video.status === 'pending-inspection' ? 'in-progress' : video.status });
  };

  const isPending = video.status === 'pending-inspection';
  const attribution = creator?.handles[0]?.handle ?? creator?.name ?? '';

  return (
    <div>
      <div className="label mb-3 flex flex-wrap items-center gap-2">
        <Link to="/videos" className="hover:text-ink">
          Video references
        </Link>
        <span>/</span>
        <span>{platformLabel(video.platform)}</span>
      </div>
      <header className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1">
          <textarea
            value={title}
            rows={1}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title !== video.title && updateVideo(video.id, { title: title.trim() })}
            className="w-full resize-none overflow-hidden border-0 bg-transparent p-0 font-serif text-[40px] leading-[1.05] outline-none md:text-[52px]"
            aria-label="Title"
            ref={(el) => {
              if (el) {
                el.style.height = 'auto';
                el.style.height = `${el.scrollHeight}px`;
              }
            }}
          />
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
            {creator && (
              <Link to={`/creators/${creator.id}`} className="link text-ink">
                {creator.handles[0]?.handle ?? creator.name}
              </Link>
            )}
            <a href={video.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-ink">
              <ExternalLink size={13} /> Open original
            </a>
            <span>Saved {relativeDate(video.createdAt)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="input w-auto py-1.5 text-[13px]" value={video.status} onChange={(e) => void setStatus(e.target.value as ReferenceStatus)} aria-label="Status">
            <option value="pending-inspection">Pending inspection</option>
            <option value="in-progress">Inspection in progress</option>
            <option value="inspected">Inspected</option>
          </select>
          <FavoriteButton active={video.favorite} onClick={() => toggleFavorite('videos', video.id)} />
          <AddToCollection entityType="video" entityId={video.id} />
          <ConfirmButton
            onConfirm={async () => {
              await deleteVideo(video.id);
              toast('Reference deleted');
              nav('/videos');
            }}
          >
            <Trash2 size={14} />
          </ConfirmButton>
        </div>
      </header>

      {isPending && (
        <div className="mb-8 flex gap-3 rounded-xl border border-dashed border-inferred/60 bg-inferred/[0.06] p-4">
          <CircleDashed size={18} className="mt-0.5 shrink-0 text-inferred" />
          <div className="text-[13.5px]">
            <p className="font-medium">Pending inspection — nothing about this video has been observed yet.</p>
            <p className="mt-1 text-muted">{video.inspectionNotes || 'Watch the original, attach the video file or screenshots, then work through the checklist.'}</p>
          </div>
        </div>
      )}
      {video.priority && (
        <div className="mb-8 flex gap-3 rounded-xl border border-accent/40 bg-accent/[0.05] p-4 text-[13.5px]">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-accent" />
          <p>
            <span className="font-medium">Priority: </span>
            {video.priority}
          </p>
        </div>
      )}

      <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0">
          <LocalVideo video={video} attribution={attribution} onTime={setCurrentTime} />

          <Section
            title="Frames & screenshots"
            count={assets?.length}
            action={
              <div className="flex flex-wrap gap-2">
                <BoardExtras videoId={video.id} />
              </div>
            }
          >
            <Uploader
              compact
              options={{ videoId: video.id, kind: video.priority ? 'interface' : 'screenshot', sourceUrl: video.url, attribution }}
              label={video.priority ? 'Drop interface screenshots — timeline, effects panel, layers' : 'Drop frames or screenshots from this video'}
            />
            <div className="mt-4">
              <Gallery assets={assets ?? []} emptyText="Frames you capture or upload for this reference appear here." />
            </div>
          </Section>

          <Section title="Analysis">
            <p className="-mt-1 mb-4 text-[12.5px] text-faint">Mark each note as verified (seen in the source) or inferred (your interpretation).</p>
            <div className="grid gap-5 md:grid-cols-2">
              {ANALYSIS_KEYS.map((k) => (
                <AnalysisField key={k} video={video} k={k} />
              ))}
            </div>
          </Section>

          <Section
            title="Breakdowns of this video"
            action={
              <button className="btn py-1" onClick={() => quick('breakdown', { referenceVideoId: video.id })}>
                <Plus size={14} /> Add breakdown
              </button>
            }
          >
            {breakdowns?.length ? breakdowns.map((b) => <BreakdownRow key={b.id} b={b} />) : <p className="text-[13px] text-faint">No breakdown linked. If a creator explains how this was made, save it here.</p>}
          </Section>
        </div>

        <aside className="space-y-8">
          <div>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-[24px]">Inspection</h2>
              <span className="font-mono text-[12px] text-muted">
                {progress}/{CHECKLIST.length}
              </span>
            </div>
            <div className="mb-3 h-1 overflow-hidden rounded-full bg-line">
              <div className="h-full bg-ink transition-all" style={{ width: `${(progress / CHECKLIST.length) * 100}%` }} />
            </div>
            <ul className="space-y-0.5">
              {CHECKLIST.map((c) => {
                const on = done(c.id);
                return (
                  <li key={c.id}>
                    <button onClick={() => !auto[c.id] && toggleStep(c.id)} className={clsx('flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px]', !auto[c.id] && 'hover:bg-ink/[0.04]')} aria-pressed={on}>
                      <span className={clsx('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border', on ? 'border-ink bg-ink text-paper' : 'border-line')}>{on && <Check size={11} strokeWidth={3} />}</span>
                      <span className={clsx(on && 'text-muted line-through decoration-line')}>{c.label}</span>
                      {auto[c.id] && <span className="ml-auto text-[10.5px] text-faint">auto</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
            {video.status !== 'inspected' && progress >= 8 && (
              <button className="btn-solid mt-3 w-full" onClick={() => void setStatus('inspected')}>
                Mark as inspected
              </button>
            )}
          </div>

          <div>
            <h2 className="mb-3 text-[24px]">Techniques</h2>
            {currentTime != null && <p className="mb-2 text-[12px] text-muted">New links are stamped at the player position ({formatTime(currentTime)}).</p>}
            <UsageEditor targetType="video" targetId={video.id} currentTime={currentTime} defaultProvenance="verified" />
          </div>

          <Classification video={video} />

          <Field label="Inspection notes">
            <NotesArea value={video.inspectionNotes} onSave={(inspectionNotes) => updateVideo(video.id, { inspectionNotes })} />
          </Field>

          <div className="rule pt-4 text-[12px] text-faint">
            <p className="label mb-1">Sources</p>
            {video.sources.map((s, i) => (
              <a key={i} href={s.url} target="_blank" rel="noreferrer" className="block truncate hover:text-ink">
                {s.label} {s.accessed ? `· ${s.accessed}` : ''}
              </a>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

function NotesArea({ value, onSave, placeholder }: { value: string; onSave: (v: string) => void; placeholder?: string }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return <textarea className="input min-h-[90px]" value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onSave(v)} />;
}

function AnalysisField({ video, k }: { video: VideoReference; k: AnalysisKey }) {
  const note = video.analysis[k];
  const [text, setText] = useState(note?.text ?? '');
  const [prov, setProv] = useState<Provenance>(note?.provenance ?? 'verified');
  useEffect(() => {
    setText(note?.text ?? '');
    setProv(note?.provenance ?? 'verified');
  }, [note?.text, note?.provenance]);
  const save = (t: string, p: Provenance) => {
    const analysis = { ...video.analysis };
    if (t.trim()) analysis[k] = { text: t, provenance: p };
    else delete analysis[k];
    void updateVideo(video.id, { analysis });
  };
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="label">{ANALYSIS_LABEL[k]}</span>
        {text.trim() ? (
          <ProvenanceSelect
            value={prov}
            onChange={(p) => {
              setProv(p);
              save(text, p);
            }}
          />
        ) : null}
      </div>
      <textarea
        className={clsx('input min-h-[84px]', prov === 'inferred' && text.trim() && 'border-dashed border-inferred/60')}
        value={text}
        placeholder="Not yet observed."
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text !== (note?.text ?? '') && save(text, prov)}
      />
    </div>
  );
}

function Classification({ video }: { video: VideoReference }) {
  const lk = useLookups();
  const opts = <T extends { id: string; name: string }>(rows: T[] = []) => rows.map((r) => ({ id: r.id, label: r.name }));
  return (
    <div className="space-y-4">
      <h2 className="text-[24px]">Classification</h2>
      <p className="-mt-2 text-[12px] text-faint">Genre is what it is · art direction is how it looks · techniques are how it's built.</p>
      <Field label="Genre">
        <IdPicker
          options={opts(lk?.lists.genres)}
          value={video.genreIds}
          onChange={(genreIds) => updateVideo(video.id, { genreIds })}
          onCreate={async (name) => {
            const id = `gen_${crypto.randomUUID().slice(0, 8)}`;
            await db.genres.add({ id, name });
            return id;
          }}
        />
      </Field>
      <Field label="Niche">
        <IdPicker
          options={opts(lk?.lists.niches)}
          value={video.nicheIds}
          onChange={(nicheIds) => updateVideo(video.id, { nicheIds })}
          onCreate={async (name) => {
            const id = `nic_${crypto.randomUUID().slice(0, 8)}`;
            await db.niches.add({ id, name });
            return id;
          }}
        />
      </Field>
      <Field label="Art directions" hint="Group into an existing direction where it fits; create a new one only for a genuinely distinct look.">
        <IdPicker options={opts(lk?.lists.artDirections)} value={video.artDirectionIds} onChange={(artDirectionIds) => updateVideo(video.id, { artDirectionIds })} onCreate={(name) => createArtDirection({ name })} />
      </Field>
      <Field label="Editing software">
        <IdPicker
          options={opts(lk?.lists.software)}
          value={video.softwareIds}
          onChange={(softwareIds) => updateVideo(video.id, { softwareIds })}
          onCreate={async (name) => {
            const id = `sw_${crypto.randomUUID().slice(0, 8)}`;
            await db.software.add({ id, name });
            return id;
          }}
        />
      </Field>
      <Field label="Tags">
        <TagInput value={video.tagIds} onChange={(tagIds) => updateVideo(video.id, { tagIds })} />
      </Field>
      <div className="flex items-center gap-2 text-[12px] text-faint">
        Record provenance: <ProvenanceBadge value={video.provenance} />
      </div>
    </div>
  );
}

/** Attach a local copy of the video, scrub it, and capture frames. */
function LocalVideo({ video, attribution, onTime }: { video: VideoReference; attribution: string; onTime: (t: number | undefined) => void }) {
  const url = useFileUrl(video.videoFileId);
  const el = useRef<HTMLVideoElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => () => onTime(undefined), [onTime]);
  const usage = useMemo(() => ({ videoId: video.id, sourceUrl: video.url, attribution }), [video.id, video.url, attribution]);

  const attach = async (f?: File | null) => {
    if (!f) return;
    if (!f.type.startsWith('video/')) return toast('Choose a video file', 'error');
    setBusy(true);
    await attachVideoFile(video.id, f);
    setBusy(false);
    toast('Video attached — scrub and capture frames');
  };

  if (!video.videoFileId) {
    return (
      <div
        className="mb-10 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line px-6 py-10 text-center"
        onDragOver={(e) => e.dataTransfer.types.includes('Files') && e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void attach(e.dataTransfer.files[0]);
        }}
      >
        <FileVideo size={22} className="text-faint" />
        <div>
          <p className="font-serif text-[22px]">Attach the video to study it frame by frame</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-muted">If you have a local copy (your own download or export), drop it here. It stays on this device, inside the library, and lets you capture stills at exact timestamps.</p>
        </div>
        <input ref={input} type="file" accept="video/*" hidden onChange={(e) => void attach(e.target.files?.[0])} />
        <button className="btn" onClick={() => input.current?.click()} disabled={busy}>
          <Upload size={14} /> {busy ? 'Attaching…' : 'Choose video file'}
        </button>
      </div>
    );
  }

  return (
    <div className="mb-10">
      <div className="overflow-hidden rounded-xl bg-black">
        {url && <video ref={el} src={url} controls className="mx-auto max-h-[70vh] w-full" onTimeUpdate={(e) => onTime(e.currentTarget.currentTime)} onSeeked={(e) => onTime(e.currentTarget.currentTime)} />}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          className="btn-solid"
          onClick={async () => {
            if (!el.current) return;
            try {
              await captureFrame(el.current, { ...usage, title: `Frame at ${formatTime(el.current.currentTime)}` });
              toast(`Captured ${formatTime(el.current.currentTime)}`);
            } catch (e) {
              toast(e instanceof Error ? e.message : 'Capture failed', 'error');
            }
          }}
        >
          <Camera size={14} /> Capture frame
        </button>
        <span className="text-[12px] text-muted">{video.videoFileName}</span>
        <button
          className="btn-ghost ml-auto text-[12.5px]"
          onClick={async () => {
            if (!confirm('Remove the attached video file? Captured frames are kept.')) return;
            await detachVideoFile(video.id);
          }}
        >
          Remove file
        </button>
      </div>
    </div>
  );
}

