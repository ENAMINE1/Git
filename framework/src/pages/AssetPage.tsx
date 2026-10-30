import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { db } from '@/db/db';
import { useLiveQuery } from '@/lib/hooks';
import { AssetEditor, Lightbox } from '@/components/lightbox';
import { AssetTile } from '@/components/media';
import { NotFound } from './NotFound';

/** Standalone page for one asset (search results link here). */
export function AssetPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const asset = useLiveQuery(() => db.assets.get(id).then((r) => r ?? null), [id]);
  const [open, setOpen] = useState(false);
  if (asset === undefined) return null;
  if (!asset) return <NotFound />;
  return (
    <div>
      <div className="label mb-4">
        <Link to="/moodboards?tab=all" className="hover:text-ink">
          Images
        </Link>
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="mx-auto w-full max-w-4xl">
          <AssetTile asset={asset} onOpen={() => setOpen(true)} />
          <p className="mt-2 text-[12px] text-faint">Click to view full screen.</p>
        </div>
        <div className="card">
          <AssetEditor asset={asset} onDeleted={() => nav('/moodboards?tab=all')} />
        </div>
      </div>
      {open && <Lightbox assetIds={[asset.id]} index={0} onIndex={() => {}} onClose={() => setOpen(false)} />}
    </div>
  );
}
