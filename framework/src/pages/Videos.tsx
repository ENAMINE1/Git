import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { db } from '@/db/db';
import { useLiveQuery, useLookups } from '@/lib/hooks';
import { normalizeName, platformLabel } from '@/lib/util';
import { VideoCard } from '@/components/cards';
import { useQuickAdd } from '@/components/quickadd';
import { EmptyState, PageHeader } from '@/components/ui';

const FILTERS = ['platform', 'creator', 'genre', 'niche', 'direction', 'software', 'technique', 'status'] as const;

export function Videos() {
  const lk = useLookups();
  const quick = useQuickAdd();
  const [params, setParams] = useSearchParams();
  const videos = useLiveQuery(() => db.videos.toArray(), []);
  const usages = useLiveQuery(() => db.usages.filter((u) => u.targetType === 'video').toArray(), []);
  const get = (k: string) => params.get(k) ?? '';
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  const techByVideo = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const u of usages ?? []) m.set(u.targetId, (m.get(u.targetId) ?? new Set()).add(u.techniqueId));
    return m;
  }, [usages]);

  const list = useMemo(() => {
    const q = normalizeName(get('q'));
    let out = (videos ?? []).filter((v) => {
      if (get('platform') && v.platform !== get('platform')) return false;
      if (get('creator') && v.creatorId !== get('creator')) return false;
      if (get('genre') && !v.genreIds.includes(get('genre'))) return false;
      if (get('niche') && !v.nicheIds.includes(get('niche'))) return false;
      if (get('direction') && !v.artDirectionIds.includes(get('direction'))) return false;
      if (get('software') && !v.softwareIds.includes(get('software'))) return false;
      if (get('technique') && !techByVideo.get(v.id)?.has(get('technique'))) return false;
      if (get('status') && v.status !== get('status')) return false;
      if (q) {
        const creator = v.creatorId ? lk?.creators.get(v.creatorId) : undefined;
        const hay = normalizeName(`${v.title} ${v.url} ${creator?.name ?? ''} ${creator?.handles.map((h) => h.handle).join(' ') ?? ''} ${v.inspectionNotes}`);
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const sort = get('sort') || 'recent';
    out = out.sort((a, b) => (sort === 'oldest' ? a.createdAt - b.createdAt : sort === 'title' ? a.title.localeCompare(b.title) : b.createdAt - a.createdAt));
    return out;
  }, [videos, params, techByVideo, lk]); // eslint-disable-line react-hooks/exhaustive-deps

  const platforms = [...new Set((videos ?? []).map((v) => v.platform))];
  const active = FILTERS.filter((f) => get(f)).length;

  const sel = (key: string, label: string, options: { id: string; name: string }[]) => (
    <select className="input w-auto py-1.5 text-[12.5px]" value={get(key)} onChange={(e) => set(key, e.target.value)} aria-label={label}>
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  );

  return (
    <div>
      <PageHeader
        eyebrow="Layer 1"
        title="Video references"
        lede="Reels, ads, films and sequences you found visually interesting. Open one to see — or record — everything extracted from it."
        actions={
          <button className="btn-solid" onClick={() => quick('video')}>
            Save a video
          </button>
        }
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input className="input py-1.5 pl-8" placeholder="Filter references…" value={get('q')} onChange={(e) => set('q', e.target.value)} />
        </div>
        {sel('status', 'Any status', [
          { id: 'pending-inspection', name: 'Pending inspection' },
          { id: 'in-progress', name: 'In progress' },
          { id: 'inspected', name: 'Inspected' },
        ])}
        {sel('platform', 'Platform', platforms.map((p) => ({ id: p, name: platformLabel(p) })))}
        {sel('creator', 'Creator', lk?.lists.creators ?? [])}
        {sel('genre', 'Genre', lk?.lists.genres ?? [])}
        {sel('niche', 'Niche', lk?.lists.niches ?? [])}
        {sel('direction', 'Art direction', lk?.lists.artDirections ?? [])}
        {sel('software', 'Software', lk?.lists.software ?? [])}
        {sel('technique', 'Technique', lk?.lists.techniques ?? [])}
        <select className="input w-auto py-1.5 text-[12.5px]" value={get('sort') || 'recent'} onChange={(e) => set('sort', e.target.value)} aria-label="Sort">
          <option value="recent">Date added — newest</option>
          <option value="oldest">Date added — oldest</option>
          <option value="title">Title A–Z</option>
        </select>
        {active > 0 && (
          <button className="btn-ghost py-1 text-[12.5px]" onClick={() => setParams({}, { replace: true })}>
            Clear filters
          </button>
        )}
      </div>
      {list.length ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {list.map((v) => (
            <VideoCard key={v.id} video={v} />
          ))}
        </div>
      ) : (
        <EmptyState title={videos?.length ? 'No references match' : 'No references yet'} action={<button className="btn-solid" onClick={() => quick('video')}>Save a video</button>}>
          {videos?.length ? 'Try removing a filter.' : 'Paste the URL of a video you like to start.'}
        </EmptyState>
      )}
    </div>
  );
}
