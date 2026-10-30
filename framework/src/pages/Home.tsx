import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CircleDashed } from 'lucide-react';
import { db } from '@/db/db';
import type { Asset } from '@/db/types';
import { useLiveQuery, useLookups } from '@/lib/hooks';
import { relativeDate } from '@/lib/util';
import { ArtDirectionCard, CollectionCard, CreatorCard, TechniqueCard, VideoCard } from '@/components/cards';
import { AssetTile, Masonry, assetRatio } from '@/components/media';
import { Lightbox } from '@/components/lightbox';
import { useQuickAdd } from '@/components/quickadd';
import { Uploader } from '@/components/uploader';
import { Section } from '@/components/ui';

const FEATURED_TRANSITIONS = ['tech_whip-pan', 'tech_speed-ramp', 'tech_match-cut', 'tech_mask-transition'];

export function Home() {
  const quick = useQuickAdd();
  const lk = useLookups();
  const [open, setOpen] = useState<number | null>(null);
  const data = useLiveQuery(async () => {
    const [videos, pending, techniques, recentAssets, ads, creators, collections, counts] = await Promise.all([
      db.videos.orderBy('createdAt').reverse().limit(8).toArray(),
      db.videos.where('status').equals('pending-inspection').toArray(),
      db.techniques.orderBy('createdAt').reverse().toArray(),
      db.assets.orderBy('createdAt').reverse().limit(18).toArray(),
      db.artDirections.toArray(),
      db.creators.orderBy('updatedAt').reverse().limit(6).toArray(),
      db.collections.orderBy('updatedAt').reverse().limit(6).toArray(),
      Promise.all([db.videos.count(), db.techniques.count(), db.artDirections.count(), db.assets.count(), db.creators.count(), db.breakdowns.count()]),
    ]);
    const usage = await db.usages.toArray();
    const examples = new Map<string, number>();
    for (const u of usage) if (u.targetType === 'video' || u.targetType === 'asset') examples.set(u.techniqueId, (examples.get(u.techniqueId) ?? 0) + 1);
    return { videos, pending, techniques, recentAssets, ads, creators, collections, counts, examples };
  }, []);
  if (!data) return null;

  const byExamples = [...data.techniques].sort((a, b) => (data.examples.get(b.id) ?? 0) - (data.examples.get(a.id) ?? 0));
  const featured = data.techniques.filter((t) => t.categoryId === 'cat_transition' && (t.favorite || data.examples.get(t.id)));
  const defaults = data.techniques.filter((t) => FEATURED_TRANSITIONS.includes(t.id) && !featured.includes(t));
  const featuredTransitions = [...featured, ...defaults].slice(0, 4);
  const userTechniques = data.techniques.filter((t) => t.provenance !== 'reference').slice(0, 4);
  const favAds = data.ads.filter((a) => a.favorite);
  const adsShown = (favAds.length ? favAds : data.ads.slice().sort((a, b) => b.updatedAt - a.updatedAt)).slice(0, 3);
  const [vCount, tCount, adCount, aCount, cCount, bCount] = data.counts;

  return (
    <div>
      <header className="mb-12 grid gap-8 border-b border-line pb-10 fade-in lg:grid-cols-[1.4fr_1fr] lg:items-end">
        <div>
          <div className="label mb-4">Personal visual research library</div>
          <h1 className="text-[56px] leading-[0.95] md:text-[84px]">
            Everything that makes
            <br />
            <em>a frame</em> worth keeping.
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted">
            Save the videos you love, pull them apart into reusable techniques, and collect the images that define each art direction.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <button className="btn-solid" onClick={() => quick('video')}>
              Save a video
            </button>
            <button className="btn" onClick={() => quick('technique')}>
              Add a technique
            </button>
            <Link className="btn" to="/moodboards">
              Open moodboards
            </Link>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-x-6 gap-y-5">
          {(
            [
              ['References', vCount, '/videos'],
              ['Techniques', tCount, '/techniques'],
              ['Art directions', adCount, '/art-directions'],
              ['Images', aCount, '/moodboards'],
              ['Creators', cCount, '/creators'],
              ['Breakdowns', bCount, '/breakdowns'],
            ] as const
          ).map(([label, n, to]) => (
            <Link key={label} to={to} className="group">
              <dt className="label">{label}</dt>
              <dd className="font-serif text-[40px] leading-none group-hover:text-accent">{n}</dd>
            </Link>
          ))}
        </dl>
      </header>

      {data.pending.length > 0 && (
        <Section
          title={
            <span className="inline-flex items-center gap-2">
              <CircleDashed size={18} className="text-inferred" /> Waiting for inspection
            </span>
          }
          count={data.pending.length}
          action={
            <Link to="/videos?status=pending-inspection" className="link text-[13px] text-muted">
              View all
            </Link>
          }
        >
          <p className="-mt-1 mb-4 max-w-2xl text-[13px] text-muted">
            These references are saved with their original links but have not been analysed. Open one, watch the original, upload frames or screenshots and record what you see.
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {data.pending.slice(0, 5).map((v) => (
              <VideoCard key={v.id} video={v} />
            ))}
          </div>
        </Section>
      )}

      <Section
        title="Recently added images"
        count={aCount}
        action={
          <Link to="/moodboards" className="link text-[13px] text-muted">
            Moodboards
          </Link>
        }
      >
        {data.recentAssets.length ? (
          <>
            <Masonry
              items={data.recentAssets.map((a: Asset) => ({ key: a.id, ratio: assetRatio(a), a }))}
              minColumn={200}
              maxColumns={6}
              render={({ a }, i) => <AssetTile asset={a} onOpen={() => setOpen(i)} />}
            />
            {open != null && <Lightbox assetIds={data.recentAssets.map((a) => a.id)} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
          </>
        ) : (
          <Uploader options={{ kind: 'screenshot' }} label="Drop your first frames or screenshots here — you can assign them to art directions later" />
        )}
      </Section>

      <Section
        title="Featured transitions"
        action={
          <Link to="/techniques?tab=cat_transition" className="link inline-flex items-center gap-1 text-[13px] text-muted">
            All transitions <ArrowRight size={13} />
          </Link>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featuredTransitions.map((t) => (
            <TechniqueCard key={t.id} technique={t} examples={data.examples.get(t.id)} />
          ))}
        </div>
      </Section>

      <Section
        title={favAds.length ? 'Favorite art directions' : 'Art directions'}
        action={
          <Link to="/art-directions" className="link text-[13px] text-muted">
            All directions
          </Link>
        }
      >
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {adsShown.map((a) => (
            <ArtDirectionCard key={a.id} ad={a} />
          ))}
        </div>
      </Section>

      {data.videos.length > 0 && (
        <Section
          title="Recently saved references"
          action={
            <Link to="/videos" className="link text-[13px] text-muted">
              All references
            </Link>
          }
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {data.videos.slice(0, 6).map((v) => (
              <VideoCard key={v.id} video={v} />
            ))}
          </div>
        </Section>
      )}

      <div className="grid gap-x-10 lg:grid-cols-2">
        <Section title={userTechniques.length ? 'Recently added techniques' : 'Most-referenced techniques'}>
          <ul className="divide-y divide-line">
            {(userTechniques.length ? userTechniques : byExamples.slice(0, 6)).map((t) => (
              <li key={t.id}>
                <Link to={`/techniques/${t.id}`} className="group flex items-baseline justify-between gap-4 py-2.5">
                  <span className="font-serif text-[20px] group-hover:underline">{t.name}</span>
                  <span className="text-[12px] text-faint">
                    {data.examples.get(t.id) ? `${data.examples.get(t.id)} example${data.examples.get(t.id) === 1 ? '' : 's'}` : userTechniques.length ? relativeDate(t.createdAt) : lk?.categories.get(t.categoryId)?.name}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
        <Section
          title="Collections"
          action={
            <Link to="/collections" className="link text-[13px] text-muted">
              All
            </Link>
          }
        >
          <div className="grid gap-2">
            {data.collections.map((c) => (
              <CollectionCard key={c.id} collection={c} />
            ))}
          </div>
        </Section>
      </div>

      <Section
        title="Recently researched creators"
        action={
          <Link to="/creators" className="link text-[13px] text-muted">
            Directory
          </Link>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.creators.map((c) => (
            <CreatorCard key={c.id} creator={c} />
          ))}
        </div>
      </Section>
    </div>
  );
}
