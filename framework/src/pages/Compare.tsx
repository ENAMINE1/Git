import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { db } from '@/db/db';
import type { ArtDirection, Asset } from '@/db/types';
import { useLiveQuery, useLookups } from '@/lib/hooks';
import { present } from '@/lib/util';
import { CompareStrip, useBoardAssets } from '@/components/board';
import { AssetTile, Masonry, Swatches, assetRatio } from '@/components/media';
import { PageHeader, Tabs } from '@/components/ui';
import { derivePalette } from './ArtDirectionDetail';

export function Compare() {
  const [params, setParams] = useSearchParams();
  const assetIds = (params.get('assets') ?? '').split(',').filter(Boolean);
  const directionIds = (params.get('directions') ?? '').split(',').filter(Boolean);
  const mode = assetIds.length && !directionIds.length ? 'images' : 'directions';
  const lk = useLookups();
  const assets = useLiveQuery(async () => present(await db.assets.bulkGet(assetIds)), [assetIds.join(',')]);

  const setDirections = (ids: string[]) => setParams(ids.length ? { directions: ids.join(',') } : {}, { replace: true });
  const available = (lk?.lists.artDirections ?? []).filter((a) => !directionIds.includes(a.id));

  return (
    <div>
      <PageHeader eyebrow="Side by side" title="Compare" lede="Put art directions next to each other — palette, imagery, mood and techniques — to see what actually separates them." />
      <Tabs
        className="mb-6"
        value={mode}
        onChange={(v) => (v === 'directions' ? setParams({}, { replace: true }) : undefined)}
        options={[
          { value: 'directions', label: 'Art directions' },
          ...(assetIds.length ? [{ value: 'images' as const, label: `Images (${assetIds.length})` }] : []),
        ]}
      />
      {mode === 'images' ? (
        <div className="flex h-[75vh] flex-col">
          <CompareStrip assets={assets ?? []} />
        </div>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-2">
            {directionIds.map((id) => (
              <span key={id} className="chip-active py-1">
                {lk?.artDirections.get(id)?.name}
                <button aria-label="Remove" onClick={() => setDirections(directionIds.filter((x) => x !== id))}>
                  <X size={12} />
                </button>
              </span>
            ))}
            {directionIds.length < 4 && (
              <select className="input w-auto py-1.5 text-[12.5px]" value="" onChange={(e) => e.target.value && setDirections([...directionIds, e.target.value])} aria-label="Add art direction">
                <option value="">+ Add art direction</option>
                {available.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          {directionIds.length === 0 ? (
            <p className="text-[13.5px] text-muted">Choose two to four art directions to compare.</p>
          ) : (
            <div
              className="grid grid-cols-1 gap-10 md:gap-6 md:[grid-template-columns:var(--cols)]"
              style={{ '--cols': `repeat(${directionIds.length}, minmax(0, 1fr))` } as React.CSSProperties}
            >
              {directionIds.map((id) => {
                const ad = lk?.artDirections.get(id);
                return ad ? <DirectionColumn key={id} ad={ad} /> : null;
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DirectionColumn({ ad }: { ad: ArtDirection }) {
  const lk = useLookups();
  const board = useLiveQuery(() => db.moodboards.where('artDirectionId').equals(ad.id).first(), [ad.id]);
  const assets = useBoardAssets(board?.id);
  const techniques = useLiveQuery(async () => (await db.usages.where('[targetType+targetId]').equals(['artDirection', ad.id]).toArray()).map((u) => u.techniqueId), [ad.id]);
  const palette = useMemo(() => (ad.palette.length ? ad.palette.map((s) => s.hex) : derivePalette((assets ?? []).map((a) => a.colors), 6)), [ad.palette, assets]);
  const images = (assets ?? []).filter((a: Asset) => a.type !== 'note');
  return (
    <div className="min-w-0">
      <Link to={`/art-directions/${ad.id}`} className="font-serif text-[30px] leading-tight hover:underline">
        {ad.name}
      </Link>
      <p className="font-serif text-[16px] italic text-muted">{ad.mood || '—'}</p>
      <Swatches colors={palette} size="lg" className="my-4" />
      {images.length ? (
        <Masonry items={images.slice(0, 12).map((a) => ({ key: a.id, ratio: assetRatio(a), a }))} minColumn={140} maxColumns={2} gap={8} render={({ a }) => <AssetTile asset={a} />} />
      ) : (
        <div className="rounded-lg border border-dashed border-line p-6 text-center text-[12.5px] text-faint">No images yet</div>
      )}
      <div className="mt-5">
        <div className="label mb-1.5">Characteristics</div>
        <ul className="space-y-0.5 text-[13px]">
          {ad.characteristics.map((c) => (
            <li key={c}>— {c}</li>
          ))}
        </ul>
      </div>
      {ad.typography && (
        <div className="mt-4">
          <div className="label mb-1.5">Typography</div>
          <p className="text-[13px]">{ad.typography}</p>
        </div>
      )}
      <div className="mt-4">
        <div className="label mb-1.5">Techniques</div>
        <div className="flex flex-wrap gap-1">
          {(techniques ?? []).map((id) => (
            <Link key={id} to={`/techniques/${id}`} className="chip py-0 text-[11.5px] hover:text-ink">
              {lk?.techniques.get(id)?.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
