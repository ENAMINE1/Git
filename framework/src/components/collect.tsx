import { useState } from 'react';
import { Check, FolderPlus, Plus } from 'lucide-react';
import { db } from '@/db/db';
import { createCollection, toggleInCollection } from '@/db/repo';
import type { EntityType, ID } from '@/db/types';
import { useLiveQuery } from '@/lib/hooks';
import { Popover, toast } from './ui';

/** "Add to collection" menu usable on any entity. */
export function AddToCollection({ entityType, entityId, iconOnly }: { entityType: EntityType; entityId: ID; iconOnly?: boolean }) {
  const collections = useLiveQuery(() => db.collections.orderBy('name').toArray(), []);
  const memberships = useLiveQuery(() => db.collectionItems.where('[entityType+entityId]').equals([entityType, entityId]).toArray(), [entityType, entityId]);
  const member = new Set((memberships ?? []).map((m) => m.collectionId));
  const [name, setName] = useState('');
  return (
    <Popover
      width={280}
      trigger={(p) =>
        iconOnly ? (
          <button className="icon-btn" title="Add to collection" aria-label="Add to collection" {...p}>
            <FolderPlus size={16} />
          </button>
        ) : (
          <button className="btn" {...p}>
            <FolderPlus size={14} /> Collect{member.size ? ` · ${member.size}` : ''}
          </button>
        )
      }
    >
      {() => (
        <div>
          <div className="label px-2.5 pb-1 pt-1.5">Collections</div>
          <div className="max-h-64 overflow-y-auto">
            {(collections ?? []).map((c) => {
              const on = member.has(c.id);
              return (
                <button
                  key={c.id}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] hover:bg-ink/[0.05]"
                  onClick={async () => {
                    const added = await toggleInCollection(c.id, entityType, entityId);
                    toast(added ? `Added to ${c.name}` : `Removed from ${c.name}`);
                  }}
                >
                  <span className="truncate">{c.name}</span>
                  {on && <Check size={14} className="shrink-0 text-accent" />}
                </button>
              );
            })}
          </div>
          <form
            className="mt-1 flex gap-1 border-t border-line p-1.5"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!name.trim()) return;
              const id = await createCollection(name);
              await toggleInCollection(id, entityType, entityId);
              toast(`Added to ${name.trim()}`);
              setName('');
            }}
          >
            <input className="input py-1 text-[12.5px]" placeholder="New collection…" value={name} onChange={(e) => setName(e.target.value)} />
            <button className="icon-btn" aria-label="Create collection" type="submit">
              <Plus size={15} />
            </button>
          </form>
        </div>
      )}
    </Popover>
  );
}
