import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { db } from '@/db/db';
import { useLiveQuery, useLookups } from '@/lib/hooks';
import { normalizeName, platformLabel } from '@/lib/util';
import { CreatorCard } from '@/components/cards';
import { useQuickAdd } from '@/components/quickadd';
import { EmptyState, PageHeader, Tabs } from '@/components/ui';

export function Creators() {
  const lk = useLookups();
  const quick = useQuickAdd();
  const [params, setParams] = useSearchParams();
  const get = (k: string) => params.get(k) ?? '';
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };
  const role = get('role') || 'educator';
  const creators = useLiveQuery(() => db.creators.toArray(), []);
  const list = useMemo(() => {
    const q = normalizeName(get('q'));
    return (creators ?? [])
      .filter((c) => (role === 'educator' ? c.role !== 'reference' : role === 'reference' ? c.role !== 'educator' : true))
      .filter((c) => !get('status') || c.status === get('status'))
      .filter((c) => !get('software') || c.softwareIds.includes(get('software')))
      .filter((c) => !get('category') || c.categoryIds.includes(get('category')))
      .filter((c) => !get('platform') || c.mainPlatform === get('platform'))
      .filter((c) => !q || normalizeName(`${c.name} ${c.handles.map((h) => h.handle).join(' ')} ${c.specialization} ${c.breakdownTypes.join(' ')}`).includes(q))
      .sort((a, b) => b.depth - a.depth || a.name.localeCompare(b.name));
  }, [creators, params, role]); // eslint-disable-line react-hooks/exhaustive-deps
  const platforms = [...new Set((creators ?? []).map((c) => c.mainPlatform))];

  return (
    <div>
      <PageHeader
        eyebrow="Layer 4"
        title="Creators"
        lede="People who expose timelines, effect panels, node graphs and curves — prioritised for teaching how to recreate an effect, not just showing the result. Everyone starts as a candidate until you've evaluated their work."
        actions={
          <button className="btn-solid" onClick={() => quick('creator')}>
            Add creator
          </button>
        }
      />
      <Tabs
        className="mb-4"
        value={role}
        onChange={(v) => set('role', v === 'educator' ? '' : v)}
        options={[
          { value: 'educator', label: 'Educators & breakdowns' },
          { value: 'reference', label: 'Reference creators' },
          { value: 'all', label: 'All', count: creators?.length },
        ]}
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input className="input py-1.5 pl-8" placeholder="Name, handle, specialisation…" value={get('q')} onChange={(e) => set('q', e.target.value)} />
        </div>
        <select className="input w-auto py-1.5 text-[12.5px]" value={get('status')} onChange={(e) => set('status', e.target.value)} aria-label="Status">
          <option value="">Any status</option>
          <option value="candidate">Candidate</option>
          <option value="evaluating">Evaluating</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <select className="input w-auto py-1.5 text-[12.5px]" value={get('category')} onChange={(e) => set('category', e.target.value)} aria-label="Specialisation">
          <option value="">Any specialisation</option>
          {(lk?.lists.categories ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select className="input w-auto py-1.5 text-[12.5px]" value={get('software')} onChange={(e) => set('software', e.target.value)} aria-label="Software">
          <option value="">Any software</option>
          {(lk?.lists.software ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select className="input w-auto py-1.5 text-[12.5px]" value={get('platform')} onChange={(e) => set('platform', e.target.value)} aria-label="Platform">
          <option value="">Any platform</option>
          {platforms.map((p) => (
            <option key={p} value={p}>
              {platformLabel(p)}
            </option>
          ))}
        </select>
      </div>
      {list.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => (
            <CreatorCard key={c.id} creator={c} />
          ))}
        </div>
      ) : (
        <EmptyState title="No creators match" />
      )}
    </div>
  );
}
