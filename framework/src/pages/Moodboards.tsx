import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ImagePlus } from 'lucide-react';
import { db } from '@/db/db';
import { useLiveQuery } from '@/lib/hooks';
import { Gallery } from '@/components/board';
import { MoodboardCard } from '@/components/cards';
import { useQuickAdd } from '@/components/quickadd';
import { BrowseButton, Uploader } from '@/components/uploader';
import { EmptyState, PageHeader, Tabs } from '@/components/ui';

type Tab = 'personal' | 'directions' | 'all' | 'unsorted';

export function Moodboards() {
  const quick = useQuickAdd();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) ?? 'personal';
  const boards = useLiveQuery(() => db.moodboards.orderBy('updatedAt').reverse().toArray(), []);
  const assets = useLiveQuery(() => db.assets.toArray(), []);
  const placed = useLiveQuery(async () => new Set((await db.moodboardItems.toArray()).map((i) => i.assetId)), []);
  const personal = (boards ?? []).filter((b) => !b.artDirectionId);
  const directions = (boards ?? []).filter((b) => b.artDirectionId);
  const unsorted = useMemo(() => (assets ?? []).filter((a) => !placed?.has(a.id)), [assets, placed]);

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Moodboards"
        lede="Collect first, classify later. Personal boards hold images before they belong to a formal art direction — promote a board when its look becomes clear."
        actions={
          <>
            <BrowseButton options={{}}>
              <ImagePlus size={14} /> Upload images
            </BrowseButton>
            <button className="btn-solid" onClick={() => quick('moodboard')}>
              New moodboard
            </button>
          </>
        }
      />
      <Tabs
        className="mb-8"
        value={tab}
        onChange={(v) => setParams(v === 'personal' ? {} : { tab: v }, { replace: true })}
        options={[
          { value: 'personal', label: 'Personal boards', count: personal.length },
          { value: 'directions', label: 'Art direction boards', count: directions.length },
          { value: 'all', label: 'All images', count: assets?.length },
          { value: 'unsorted', label: 'Unsorted', count: unsorted.length },
        ]}
      />
      {tab === 'personal' &&
        (personal.length ? (
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3 xl:grid-cols-4">
            {personal.map((b) => (
              <MoodboardCard key={b.id} board={b} />
            ))}
          </div>
        ) : (
          <EmptyState title="No personal moodboards" action={<button className="btn-solid" onClick={() => quick('moodboard')}>New moodboard</button>} />
        ))}
      {tab === 'directions' && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3 xl:grid-cols-4">
          {directions.map((b) => (
            <MoodboardCard key={b.id} board={b} />
          ))}
        </div>
      )}
      {tab === 'all' && <Gallery assets={assets ?? []} uploadOptions={{}} emptyText="Every image in the library appears here." />}
      {tab === 'unsorted' && (
        <>
          <p className="mb-4 text-[13px] text-muted">Images that are not on any board yet. Select a few and use “Add to board…”.</p>
          {unsorted.length ? <Gallery assets={unsorted} /> : <Uploader options={{}} label="Nothing unsorted. Drop images here to start an inbox." />}
        </>
      )}
    </div>
  );
}
