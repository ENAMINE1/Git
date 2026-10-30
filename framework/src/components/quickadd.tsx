import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import {
  createArtDirection,
  createBreakdown,
  createCreator,
  createMoodboard,
  createTechnique,
  createVideo,
  findCreatorByHandle,
  findSimilarTechniques,
  findVideoByUrl,
  type SimilarTechnique,
} from '@/db/repo';
import { db } from '@/db/db';
import type { Platform, VideoBreakdown, VideoReference } from '@/db/types';
import { useLookups } from '@/lib/hooks';
import { canonicalUrl, detectPlatform, instagramShortcode, platformLabel, youtubeId } from '@/lib/util';
import { Field, Modal, errorText, toast } from './ui';

export type QuickKind = 'video' | 'technique' | 'breakdown' | 'creator' | 'artDirection' | 'moodboard';
const Ctx = createContext<(k: QuickKind, preset?: Record<string, string>) => void>(() => {});
export const useQuickAdd = () => useContext(Ctx);

export function QuickAddProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ kind: QuickKind; preset?: Record<string, string> } | null>(null);
  const close = () => setState(null);
  return (
    <Ctx.Provider value={(kind, preset) => setState({ kind, preset })}>
      {children}
      {state?.kind === 'video' && <SaveVideo onClose={close} />}
      {state?.kind === 'technique' && <NewTechnique onClose={close} preset={state.preset} />}
      {state?.kind === 'breakdown' && <NewBreakdown onClose={close} preset={state.preset} />}
      {state?.kind === 'creator' && <NewCreator onClose={close} />}
      {state?.kind === 'artDirection' && <NewNamed kind="artDirection" onClose={close} />}
      {state?.kind === 'moodboard' && <NewNamed kind="moodboard" onClose={close} />}
    </Ctx.Provider>
  );
}

function suggestTitle(url: string, handle: string) {
  const ig = instagramShortcode(url);
  if (ig) return `${handle ? `${handle} — ` : ''}reel ${ig}`;
  const yt = youtubeId(url);
  if (yt) return `${handle ? `${handle} — ` : ''}YouTube ${yt}`;
  return '';
}

function SaveVideo({ onClose }: { onClose: () => void }) {
  const nav = useNavigate();
  const lk = useLookups();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [handle, setHandle] = useState('');
  const [creatorId, setCreatorId] = useState('');
  const [dupe, setDupe] = useState<VideoReference | undefined>();
  const platform: Platform = url ? detectPlatform(url) : 'other';

  useEffect(() => {
    if (!url.trim()) return setDupe(undefined);
    void findVideoByUrl(url).then(setDupe);
    const m = url.match(/instagram\.com\/([\w.]+)\/(?:reel|p)\//) ?? url.match(/tiktok\.com\/@([\w.]+)/);
    if (m && !handle) setHandle(`@${m[1]}`);
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!handle.trim()) return;
    void findCreatorByHandle(handle).then((c) => c && setCreatorId(c.id));
  }, [handle]);

  const save = async () => {
    try {
      let cId = creatorId || undefined;
      if (!cId && handle.trim()) {
        cId = await createCreator({
          name: handle.trim(),
          role: 'reference',
          handles: [{ platform, handle: handle.trim().startsWith('@') ? handle.trim() : `@${handle.trim()}` }],
          mainPlatform: platform,
        });
      }
      const id = await createVideo({ url, title: title || suggestTitle(url, handle) || url, creatorId: cId });
      toast('Saved — pending inspection');
      onClose();
      nav(`/videos/${id}`);
    } catch (e) {
      toast(errorText(e), 'error');
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Save a video reference"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-solid" disabled={!url.trim() || !!dupe} onClick={() => void save()}>
            Save reference
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="URL" hint={url ? `${platformLabel(platform)} · ${canonicalUrl(url)}` : 'Instagram, YouTube, TikTok, Vimeo or any page'}>
          <input className="input" autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.instagram.com/reel/…" />
        </Field>
        {dupe && (
          <div className="flex items-start gap-2 rounded-lg bg-inferred/10 p-3 text-[13px]">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-inferred" />
            <span>
              Already saved as{' '}
              <Link className="link font-medium" to={`/videos/${dupe.id}`} onClick={onClose}>
                {dupe.title}
              </Link>
              .
            </span>
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Creator handle" hint={creatorId ? `Linked to ${lk?.creators.get(creatorId)?.name}` : handle ? 'A new creator will be added' : undefined}>
            <input
              className="input"
              value={handle}
              onChange={(e) => {
                setHandle(e.target.value);
                setCreatorId('');
              }}
              placeholder="@handle"
            />
          </Field>
          <Field label="…or existing creator">
            <select className="input" value={creatorId} onChange={(e) => setCreatorId(e.target.value)}>
              <option value="">—</option>
              {(lk?.lists.creators ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Title" hint="Optional — describe it once you've watched it">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={suggestTitle(url, handle) || 'What is it?'} />
        </Field>
        <p className="text-[12px] text-faint">
          New references start as <em>pending inspection</em>. Nothing about the video is assumed until you inspect it and record what you see.
        </p>
      </div>
    </Modal>
  );
}

function NewTechnique({ onClose, preset }: { onClose: () => void; preset?: Record<string, string> }) {
  const nav = useNavigate();
  const lk = useLookups();
  const [name, setName] = useState(preset?.name ?? '');
  const [categoryId, setCategoryId] = useState(preset?.categoryId ?? 'cat_transition');
  const [summary, setSummary] = useState('');
  const [similar, setSimilar] = useState<SimilarTechnique[]>([]);
  useEffect(() => {
    void findSimilarTechniques(name).then(setSimilar);
  }, [name]);
  const exact = similar.find((s) => s.score >= 0.999);
  const save = async () => {
    try {
      const id = await createTechnique({ name, categoryId, summary });
      toast(`Created ${name}`);
      onClose();
      nav(`/techniques/${id}`);
    } catch (e) {
      toast(errorText(e), 'error');
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="New technique"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-solid" disabled={!name.trim() || !!exact} onClick={() => void save()}>
            Create technique
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Seamless object wipe" />
        </Field>
        {similar.length > 0 && (
          <div className="rounded-lg bg-inferred/10 p-3 text-[13px]">
            <p className="mb-2 font-medium">{exact ? 'This technique already exists:' : 'Similar techniques already in your library:'}</p>
            <ul className="space-y-1">
              {similar.map((s) => (
                <li key={s.technique.id}>
                  <Link className="link" to={`/techniques/${s.technique.id}`} onClick={onClose}>
                    {s.technique.name}
                  </Link>
                  {s.matched !== s.technique.name && <span className="text-faint"> — matches “{s.matched}”</span>}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[12px] text-muted">Prefer adding a variation or alias to an existing entry over creating a near-duplicate.</p>
          </div>
        )}
        <Field label="Category">
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {(lk?.lists.categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Visual description">
          <textarea className="input min-h-[72px]" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="What does it look like on screen?" />
        </Field>
      </div>
    </Modal>
  );
}

function NewBreakdown({ onClose, preset }: { onClose: () => void; preset?: Record<string, string> }) {
  const nav = useNavigate();
  const lk = useLookups();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [creatorId, setCreatorId] = useState(preset?.creatorId ?? '');
  const [format, setFormat] = useState<VideoBreakdown['format']>('long-form');
  const [dupe, setDupe] = useState<VideoBreakdown | undefined>();
  useEffect(() => {
    if (!url.trim()) return setDupe(undefined);
    const key = canonicalUrl(url);
    void db.breakdowns.toArray().then((all) => setDupe(all.find((b) => canonicalUrl(b.url) === key)));
  }, [url]);
  const save = async () => {
    const id = await createBreakdown({ url, title, creatorId: creatorId || undefined, format, referenceVideoId: preset?.referenceVideoId });
    toast('Breakdown saved');
    onClose();
    nav(`/breakdowns/${id}`);
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Save a breakdown"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-solid" disabled={!url.trim() || !title.trim() || !!dupe} onClick={() => void save()}>
            Save breakdown
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="URL">
          <input className="input" autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
        </Field>
        {dupe && (
          <p className="rounded-lg bg-inferred/10 p-3 text-[13px]">
            Already saved:{' '}
            <Link className="link" to={`/breakdowns/${dupe.id}`} onClick={onClose}>
              {dupe.title}
            </Link>
          </p>
        )}
        <Field label="Title" hint="Use the video's actual title">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Creator">
            <select className="input" value={creatorId} onChange={(e) => setCreatorId(e.target.value)}>
              <option value="">—</option>
              {(lk?.lists.creators ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Format">
            <select className="input" value={format} onChange={(e) => setFormat(e.target.value as VideoBreakdown['format'])}>
              <option value="long-form">Long-form</option>
              <option value="short-form">Short-form</option>
              <option value="article">Article</option>
              <option value="unknown">Unknown</option>
            </select>
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function NewCreator({ onClose }: { onClose: () => void }) {
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [url, setUrl] = useState('');
  const [existing, setExisting] = useState<string | undefined>();
  useEffect(() => {
    void findCreatorByHandle(handle || name).then((c) => setExisting(c?.id));
  }, [handle, name]);
  const save = async () => {
    const platform = url ? detectPlatform(url) : 'youtube';
    const id = await createCreator({
      name,
      handles: handle ? [{ platform, handle, url: url || undefined }] : [],
      channelUrl: url || undefined,
      mainPlatform: platform,
    });
    toast('Creator added as a candidate');
    onClose();
    nav(`/creators/${id}`);
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Add a creator"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-solid" disabled={!name.trim() || !!existing} onClick={() => void save()}>
            Add creator
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Handle">
          <input className="input" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@handle" />
        </Field>
        <Field label="Channel or profile URL">
          <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} />
        </Field>
        {existing && (
          <p className="rounded-lg bg-inferred/10 p-3 text-[13px]">
            This creator seems to exist already —{' '}
            <Link className="link" to={`/creators/${existing}`} onClick={onClose}>
              open it
            </Link>
            .
          </p>
        )}
      </div>
    </Modal>
  );
}

function NewNamed({ kind, onClose }: { kind: 'artDirection' | 'moodboard'; onClose: () => void }) {
  const nav = useNavigate();
  const [name, setName] = useState('');
  const save = async () => {
    if (kind === 'artDirection') {
      const id = await createArtDirection({ name });
      nav(`/art-directions/${id}`);
    } else {
      const id = await createMoodboard(name);
      nav(`/moodboards/${id}`);
    }
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={kind === 'artDirection' ? 'New art direction' : 'New moodboard'}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-solid" disabled={!name.trim()} onClick={() => void save()}>
            Create
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) void save();
        }}
      >
        <Field label="Name" hint={kind === 'artDirection' ? 'Name a recurring visual identity, not a single video.' : 'A personal board — promote it to an art direction later.'}>
          <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}
