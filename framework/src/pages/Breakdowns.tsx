import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { db } from '@/db/db';
import { useLiveQuery, useLookups } from '@/lib/hooks';
import { normalizeName } from '@/lib/util';
import { BreakdownRow } from '@/components/cards';
import { useQuickAdd } from '@/components/quickadd';
import { EmptyState, PageHeader } from '@/components/ui';

export function Breakdowns() {
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
  const all = useLiveQuery(() => db.breakdowns.orderBy('createdAt').reverse().toArray(), []);
  const list = useMemo(() => {
    const q = normalizeName(get('q'));
    return (all ?? []).filter(
      (b) =>
        (!get('creator') || b.creatorId === get('creator')) &&
        (!get('software') || b.softwareIds.includes(get('software'))) &&
        (!get('status') || b.status === get('status')) &&
        (!get('format') || b.format === get('format')) &&
        (!q || normalizeName(`${b.title} ${b.summary} ${lk?.creators.get(b.creatorId ?? '')?.name ?? ''}`).includes(q)),
    );
  }, [all, params, lk]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <PageHeader
        eyebrow="Layer 4 · archive"
        title="Breakdowns"
        lede="Tutorials and analyses that show how things are made. Long-form first. Timestamps and transcripts are only ever added from the source — never estimated."
        actions={
          <button className="btn-solid" onClick={() => quick('breakdown')}>
            Save a breakdown
          </button>
        }
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input className="input py-1.5 pl-8" placeholder="Filter breakdowns…" value={get('q')} onChange={(e) => set('q', e.target.value)} />
        </div>
        <select className="input w-auto py-1.5 text-[12.5px]" value={get('status')} onChange={(e) => set('status', e.target.value)} aria-label="Status">
          <option value="">Any status</option>
          <option value="to-watch">To watch</option>
          <option value="watched">Watched</option>
          <option value="extracted">Extracted</option>
        </select>
        <select className="input w-auto py-1.5 text-[12.5px]" value={get('creator')} onChange={(e) => set('creator', e.target.value)} aria-label="Creator">
          <option value="">Any creator</option>
          {(lk?.lists.creators ?? []).filter((c) => c.role !== 'reference').map((c) => (
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
        <select className="input w-auto py-1.5 text-[12.5px]" value={get('format')} onChange={(e) => set('format', e.target.value)} aria-label="Format">
          <option value="">Any format</option>
          <option value="long-form">Long-form</option>
          <option value="short-form">Short-form</option>
          <option value="article">Article</option>
        </select>
      </div>
      {list.length ? (
        <div className="grid gap-1 lg:grid-cols-2">
          {list.map((b) => (
            <BreakdownRow key={b.id} b={b} />
          ))}
        </div>
      ) : (
        <EmptyState title="No breakdowns match" />
      )}
    </div>
  );
}
