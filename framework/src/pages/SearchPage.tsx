import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { KIND_LABEL, runSearch } from '@/db/search';
import { groupHits, hitPath, useSearch } from '@/components/search';
import { EmptyState, PageHeader } from '@/components/ui';

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const { index } = useSearch();
  const groups = useMemo(() => (index ? groupHits(runSearch(index, q, 200)) : []), [index, q]);
  const total = groups.reduce((n, g) => n + g.hits.length, 0);
  return (
    <div>
      <PageHeader eyebrow="Search" title={q ? `“${q}”` : 'Search the library'} lede={q ? `${total} result${total === 1 ? '' : 's'} across videos, techniques, art directions, creators, moodboards and more.` : undefined} />
      <div className="relative mb-10 max-w-xl">
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
        <input autoFocus className="input py-3 pl-10 text-[15px]" value={q} onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })} placeholder="whip pan, DaVinci Resolve, dark cinematic…" />
      </div>
      {q && !total && <EmptyState title="Nothing found">Try a broader word, an alias, or a software name.</EmptyState>}
      <div className="grid gap-x-12 gap-y-10 lg:grid-cols-2">
        {groups.map((g) => (
          <section key={g.kind}>
            <h2 className="mb-2 border-b border-line pb-1.5 text-[24px]">
              {KIND_LABEL[g.kind]} <span className="font-sans text-[12px] text-faint">{g.hits.length}</span>
            </h2>
            <ul className="divide-y divide-line">
              {g.hits.map((h) => (
                <li key={h.key}>
                  <Link to={hitPath(h)} className="group block py-2.5">
                    <span className="block font-medium group-hover:underline">{h.title}</span>
                    {h.subtitle && <span className="block text-[12px] text-muted">{h.subtitle}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
