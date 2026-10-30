import { useState } from 'react';
import { db } from '@/db/db';
import { createCollection } from '@/db/repo';
import { useLiveQuery } from '@/lib/hooks';
import { CollectionCard } from '@/components/cards';
import { EmptyState, PageHeader, toast } from '@/components/ui';

export function Collections() {
  const collections = useLiveQuery(() => db.collections.orderBy('updatedAt').reverse().toArray(), []);
  const [name, setName] = useState('');
  return (
    <div>
      <PageHeader
        eyebrow="Your sets"
        title="Collections"
        lede="Hand-picked sets that mix anything — videos, techniques, images, art directions, creators, breakdowns. Use the Collect button on any item to add it."
      />
      <form
        className="mb-8 flex max-w-md gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          await createCollection(name);
          toast(`Created ${name.trim()}`);
          setName('');
        }}
      >
        <input className="input" placeholder="New collection — e.g. Trailer pitch, March" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-solid" type="submit" disabled={!name.trim()}>
          Create
        </button>
      </form>
      {collections?.length ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {collections.map((c) => (
            <CollectionCard key={c.id} collection={c} />
          ))}
        </div>
      ) : (
        <EmptyState title="No collections yet" />
      )}
    </div>
  );
}
