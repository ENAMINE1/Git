import { useMemo, type ReactNode } from 'react';
import clsx from 'clsx';
import { Check, ExternalLink, Film, Heart, Link2, StickyNote } from 'lucide-react';
import type { Asset, ID } from '@/db/types';
import { useElementWidth, useFileUrl } from '@/lib/hooks';
import { formatTime, hostOf } from '@/lib/util';

// ───────────────────────────── Masonry

export interface MasonryItem {
  key: string;
  /** height / width */
  ratio: number;
}

/**
 * Shortest-column masonry that preserves each item's aspect ratio. Items are
 * placed left-to-right so the visual order follows the stored order (which
 * keeps drag-to-reorder intuitive, unlike CSS columns).
 */
export function Masonry<T extends MasonryItem>({
  items,
  render,
  minColumn = 240,
  gap = 14,
  maxColumns = 6,
}: {
  items: T[];
  render: (item: T, index: number) => ReactNode;
  minColumn?: number;
  gap?: number;
  maxColumns?: number;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const cols = Math.max(1, Math.min(maxColumns, Math.floor((width + gap) / (minColumn + gap)) || 1));
  const columns = useMemo(() => {
    const out: { item: T; index: number }[][] = Array.from({ length: cols }, () => []);
    const heights = new Array(cols).fill(0);
    items.forEach((item, index) => {
      let c = 0;
      for (let i = 1; i < cols; i++) if (heights[i] < heights[c] - 0.01) c = i;
      out[c].push({ item, index });
      heights[c] += item.ratio + gap / Math.max(1, minColumn);
    });
    return out;
  }, [items, cols, gap, minColumn]);
  return (
    <div ref={ref} className="flex w-full items-start" style={{ gap }}>
      {width > 0 &&
        columns.map((col, i) => (
          <div key={i} className="flex min-w-0 flex-1 flex-col" style={{ gap }}>
            {col.map(({ item, index }) => (
              <div key={item.key}>{render(item, index)}</div>
            ))}
          </div>
        ))}
    </div>
  );
}

export function assetRatio(a: Asset): number {
  if (a.type === 'image' && a.width && a.height) return Math.min(2.6, Math.max(0.3, a.height / a.width));
  if (a.type === 'palette') return 0.42;
  if (a.type === 'note') return 0.7;
  return 0.56;
}

// ───────────────────────────── Images

export function StoredImage({
  fileId,
  alt,
  className,
  ratio,
}: {
  fileId?: ID;
  alt: string;
  className?: string;
  /** width / height — reserves space before load */
  ratio?: number;
}) {
  const url = useFileUrl(fileId);
  return (
    <div className={clsx('relative overflow-hidden bg-line/40', className)} style={ratio ? { aspectRatio: String(ratio) } : undefined}>
      {url && <img src={url} alt={alt} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />}
    </div>
  );
}

export function Swatches({ colors, className, size = 'md' }: { colors: string[]; className?: string; size?: 'sm' | 'md' | 'lg' }) {
  if (!colors.length) return null;
  return (
    <div className={clsx('flex overflow-hidden rounded-md', size === 'sm' ? 'h-2' : size === 'md' ? 'h-4' : 'h-12', className)}>
      {colors.map((c, i) => (
        <span key={`${c}-${i}`} className="flex-1" style={{ background: c }} title={c} />
      ))}
    </div>
  );
}

// ───────────────────────────── Asset tile

export function AssetTile({
  asset,
  onOpen,
  selected,
  selectable,
  onToggleSelect,
  draggable,
  onDragStart,
  onDropOn,
  dropTarget,
  footer,
}: {
  asset: Asset;
  onOpen?: () => void;
  selected?: boolean;
  selectable?: boolean;
  onToggleSelect?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDropOn?: (e: React.DragEvent) => void;
  dropTarget?: boolean;
  footer?: ReactNode;
}) {
  const ratio = assetRatio(asset);
  const click = () => (selectable ? onToggleSelect?.() : onOpen?.());
  return (
    <figure
      className={clsx(
        'group relative cursor-pointer overflow-hidden rounded-lg border bg-panel transition-shadow',
        selected ? 'border-accent ring-2 ring-accent' : 'border-line hover:shadow-lg',
        dropTarget && 'ring-2 ring-ink',
      )}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={(e) => {
        if (onDropOn && e.dataTransfer.types.includes('application/x-framework-asset')) e.preventDefault();
      }}
      onDrop={onDropOn}
      onClick={click}
      data-asset-id={asset.id}
    >
      <AssetBody asset={asset} ratio={ratio} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-2.5 pt-8 opacity-0 transition-opacity group-hover:opacity-100">
        <figcaption className="truncate text-[12.5px] font-medium text-white">{asset.title || 'Untitled'}</figcaption>
        <div className="flex items-center gap-2 text-[11px] text-white/70">
          <span className="uppercase tracking-label">{asset.kind}</span>
          {asset.timestamp != null && <span>{formatTime(asset.timestamp)}</span>}
          {asset.sourceUrl && <span className="truncate">{hostOf(asset.sourceUrl)}</span>}
        </div>
      </div>
      {asset.favorite && (
        <Heart size={14} className="absolute right-2 top-2 text-white drop-shadow" fill="currentColor" aria-label="Favorite" />
      )}
      {selectable && (
        <span
          className={clsx(
            'absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full border-2',
            selected ? 'border-accent bg-accent text-white' : 'border-white/90 bg-black/20',
          )}
        >
          {selected && <Check size={12} strokeWidth={3} />}
        </span>
      )}
      {footer}
    </figure>
  );
}

function AssetBody({ asset, ratio }: { asset: Asset; ratio: number }) {
  if (asset.type === 'image') {
    return <StoredImage fileId={asset.thumbId ?? asset.fileId} alt={asset.title || 'Image'} ratio={1 / ratio} />;
  }
  if (asset.type === 'palette') {
    return (
      <div style={{ aspectRatio: String(1 / ratio) }} className="flex">
        {asset.colors.map((c, i) => (
          <div key={i} className="flex flex-1 items-end p-1.5" style={{ background: c }}>
            <span className="rounded bg-black/30 px-1 font-mono text-[9.5px] text-white">{c}</span>
          </div>
        ))}
      </div>
    );
  }
  if (asset.type === 'note') {
    return (
      <div style={{ aspectRatio: String(1 / ratio) }} className="flex flex-col overflow-hidden bg-[rgb(var(--ink)/0.03)] p-4">
        <StickyNote size={14} className="mb-2 text-faint" />
        <p className="line-clamp-[8] font-serif text-[18px] leading-snug">{asset.description || asset.title}</p>
      </div>
    );
  }
  return (
    <div style={{ aspectRatio: String(1 / ratio) }} className="flex flex-col justify-between bg-[rgb(var(--ink)/0.03)] p-4">
      <div className="flex items-center gap-2 text-faint">
        {asset.kind === 'motion' ? <Film size={14} /> : <Link2 size={14} />}
        <span className="label">Motion reference</span>
      </div>
      <div>
        <p className="line-clamp-3 font-serif text-[19px] leading-snug">{asset.title}</p>
        <p className="mt-1 flex items-center gap-1 truncate text-[12px] text-muted">
          <ExternalLink size={11} /> {hostOf(asset.linkUrl ?? asset.sourceUrl)}
        </p>
      </div>
    </div>
  );
}
