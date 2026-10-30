import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { db } from '@/db/db';
import { useLiveQuery, useLookups } from '@/lib/hooks';
import { normalizeName } from '@/lib/util';
import { TechniqueCard } from '@/components/cards';
import { useQuickAdd } from '@/components/quickadd';
import { EmptyState, PageHeader, Tabs } from '@/components/ui';

export function Techniques() {
  const lk = useLookups();
  const quick = useQuickAdd();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'all';
  const q = params.get('q') ?? '';
  const sort = params.get('sort') ?? 'name';
  const software = params.get('software') ?? '';
  const difficulty = params.get('difficulty') ?? '';
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v && v !== 'all') next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  const techniques = useLiveQuery(() => db.techniques.toArray(), []);
  const examples = useLiveQuery(async () => {
    const m = new Map<string, number>();
    for (const u of await db.usages.toArray()) if (u.targetType === 'video' || u.targetType === 'asset' || u.targetType === 'breakdown') m.set(u.techniqueId, (m.get(u.techniqueId) ?? 0) + 1);
    return m;
  }, []);
  const variations = useLiveQuery(async () => {
    const m = new Map<string, string[]>();
    for (const v of await db.variations.toArray()) m.set(v.techniqueId, [...(m.get(v.techniqueId) ?? []), v.name]);
    return m;
  }, []);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of techniques ?? []) m.set(t.categoryId, (m.get(t.categoryId) ?? 0) + 1);
    return m;
  }, [techniques]);

  const list = useMemo(() => {
    const n = normalizeName(q);
    return (techniques ?? [])
      .filter((t) => tab === 'all' || t.categoryId === tab)
      .filter((t) => !software || t.implementations.some((i) => i.softwareId === software))
      .filter((t) => !difficulty || String(t.difficulty) === difficulty)
      .filter((t) => !n || normalizeName([t.name, ...t.aliases, t.summary, ...(variations?.get(t.id) ?? [])].join(' ')).includes(n))
      .sort((a, b) =>
        sort === 'examples'
          ? (examples?.get(b.id) ?? 0) - (examples?.get(a.id) ?? 0) || a.name.localeCompare(b.name)
          : sort === 'recent'
            ? b.createdAt - a.createdAt
            : a.name.localeCompare(b.name),
      );
  }, [techniques, tab, q, sort, software, difficulty, examples, variations]);

  const cat = lk?.categories.get(tab);

  return (
    <div>
      <PageHeader
        eyebrow="Layer 2 · the reusable library"
        title="Effects & transitions"
        lede="Every technique lives here once. Videos, breakdowns and images link to it — so opening an effect shows every example of it and how to rebuild it."
        actions={
          <button className="btn-solid" onClick={() => quick('technique', tab !== 'all' ? { categoryId: tab } : undefined)}>
            New technique
          </button>
        }
      />
      <Tabs
        className="mb-4"
        value={tab}
        onChange={(v) => set('tab', v)}
        options={[{ value: 'all', label: 'All', count: techniques?.length }, ...(lk?.lists.categories ?? []).map((c) => ({ value: c.id, label: c.name, count: counts.get(c.id) ?? 0 }))]}
      />
      {cat && <p className="mb-5 max-w-2xl text-[13.5px] text-muted">{cat.description}</p>}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input className="input py-1.5 pl-8" placeholder="Name, alias or variation…" value={q} onChange={(e) => set('q', e.target.value)} />
        </div>
        <select className="input w-auto py-1.5 text-[12.5px]" value={software} onChange={(e) => set('software', e.target.value)} aria-label="Software">
          <option value="">Any software</option>
          {(lk?.lists.software ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select className="input w-auto py-1.5 text-[12.5px]" value={difficulty} onChange={(e) => set('difficulty', e.target.value)} aria-label="Difficulty">
          <option value="">Any difficulty</option>
          <option value="1">Beginner</option>
          <option value="2">Intermediate</option>
          <option value="3">Advanced</option>
        </select>
        <select className="input w-auto py-1.5 text-[12.5px]" value={sort} onChange={(e) => set('sort', e.target.value)} aria-label="Sort">
          <option value="name">A–Z</option>
          <option value="examples">Most examples</option>
          <option value="recent">Recently added</option>
        </select>
      </div>
      {list.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {list.map((t) => (
            <TechniqueCard key={t.id} technique={t} examples={examples?.get(t.id)} />
          ))}
        </div>
      ) : (
        <EmptyState title="No techniques match" action={q ? <button className="btn-solid" onClick={() => quick('technique', { name: q })}>Create “{q}”</button> : undefined}>
          Check the spelling or aliases first — the library tries to keep one entry per technique.
        </EmptyState>
      )}
    </div>
  );
}
