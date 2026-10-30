import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '@/db/db';
import { useLiveQuery } from '@/lib/hooks';
import { ArtDirectionCard } from '@/components/cards';
import { useQuickAdd } from '@/components/quickadd';
import { PageHeader } from '@/components/ui';

export function ArtDirections() {
  const quick = useQuickAdd();
  const [sort, setSort] = useState<'name' | 'recent' | 'images'>('images');
  const ads = useLiveQuery(() => db.artDirections.toArray(), []);
  const sizes = useLiveQuery(async () => {
    const boards = await db.moodboards.filter((b) => !!b.artDirectionId).toArray();
    const items = await db.moodboardItems.toArray();
    const byBoard = new Map<string, number>();
    for (const i of items) byBoard.set(i.moodboardId, (byBoard.get(i.moodboardId) ?? 0) + 1);
    return new Map(boards.map((b) => [b.artDirectionId!, byBoard.get(b.id) ?? 0]));
  }, []);
  const list = useMemo(
    () =>
      [...(ads ?? [])].sort((a, b) =>
        sort === 'name'
          ? a.name.localeCompare(b.name)
          : sort === 'recent'
            ? b.updatedAt - a.updatedAt
            : (sizes?.get(b.id) ?? 0) - (sizes?.get(a.id) ?? 0) || a.name.localeCompare(b.name),
      ),
    [ads, sort, sizes],
  );
  return (
    <div>
      <PageHeader
        eyebrow="Layer 3"
        title="Art directions"
        lede="Recurring visual identities — how a video looks and feels, kept separate from its genre and the techniques that build it. Each direction has its own moodboard."
        actions={
          <>
            <Link className="btn" to="/compare">
              Compare directions
            </Link>
            <button className="btn-solid" onClick={() => quick('artDirection')}>
              New art direction
            </button>
          </>
        }
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <select className="input w-auto py-1.5 text-[12.5px]" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort">
          <option value="images">Most images</option>
          <option value="recent">Recently updated</option>
          <option value="name">A–Z</option>
        </select>
        <span className="text-[12.5px] text-faint">The starting directions come from your brief. Rename, merge or delete them as your taxonomy settles.</span>
      </div>
      <div className="grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((a) => (
          <ArtDirectionCard key={a.id} ad={a} large />
        ))}
      </div>
    </div>
  );
}
