import { useEffect, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { ImagePlus, Loader2 } from 'lucide-react';
import { ingestMany, type IngestOptions } from '@/db/images';
import type { ID } from '@/db/types';
import { toast } from './ui';

function imageFiles(list: FileList | DataTransferItemList | null | undefined): File[] {
  if (!list) return [];
  const out: File[] = [];
  for (const item of Array.from(list as ArrayLike<File | DataTransferItem>)) {
    const f = item instanceof File ? item : item.kind === 'file' ? item.getAsFile() : null;
    if (f && f.type.startsWith('image/')) out.push(f);
  }
  return out;
}

/**
 * Drop zone + file picker + clipboard paste for images.
 * Wrap content with it to make the whole area a drop target.
 */
export function Uploader({
  options,
  onDone,
  children,
  compact,
  pasteEnabled = true,
  label = 'Drop images, paste a screenshot, or browse',
}: {
  options: IngestOptions;
  onDone?: (ids: ID[]) => void;
  children?: ReactNode;
  compact?: boolean;
  pasteEnabled?: boolean;
  label?: string;
}) {
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const optsRef = useRef(options);
  optsRef.current = options;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const run = async (files: File[]) => {
    if (!files.length) return;
    setBusy(files.length);
    try {
      const ids = await ingestMany(files, optsRef.current);
      toast(`Saved ${ids.length} image${ids.length === 1 ? '' : 's'}`);
      doneRef.current?.(ids);
    } catch (e) {
      toast(`Upload failed: ${e instanceof Error ? e.message : e}`, 'error');
    } finally {
      setBusy(0);
    }
  };

  useEffect(() => {
    if (!pasteEnabled) return;
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && /^(INPUT|TEXTAREA)$/.test(t.tagName)) return;
      const files = imageFiles(e.clipboardData?.items);
      if (files.length) {
        e.preventDefault();
        void run(files);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [pasteEnabled]);

  const isFileDrag = (e: React.DragEvent) => e.dataTransfer.types.includes('Files');

  return (
    <div
      onDragOver={(e) => {
        if (!isFileDrag(e)) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setOver(false);
      }}
      onDrop={(e) => {
        if (!isFileDrag(e)) return;
        e.preventDefault();
        setOver(false);
        void run(imageFiles(e.dataTransfer.files));
      }}
      className="relative"
    >
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        data-testid="image-input"
        onChange={(e) => {
          void run(imageFiles(e.target.files));
          e.target.value = '';
        }}
      />
      {children ?? (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className={clsx(
            'flex w-full items-center justify-center gap-2 rounded-xl border border-dashed text-[13px] text-muted transition-colors hover:border-ink/40 hover:text-ink',
            compact ? 'px-3 py-3' : 'px-6 py-10',
            over ? 'border-ink bg-ink/[0.04] text-ink' : 'border-line',
          )}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
          {busy ? `Saving ${busy}…` : label}
        </button>
      )}
      {children && over && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-ink bg-paper/80 text-[15px] font-medium">
          Drop to add images
        </div>
      )}
      {children && busy > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[13px] text-paper">
          <Loader2 size={14} className="animate-spin" /> Saving {busy}…
        </div>
      )}
    </div>
  );
}

/** Opens the native file picker for an Uploader rendered elsewhere. */
export function BrowseButton({ options, onDone, children, className }: { options: IngestOptions; onDone?: (ids: ID[]) => void; children: ReactNode; className?: string }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={async (e) => {
          const files = imageFiles(e.target.files);
          e.target.value = '';
          if (!files.length) return;
          const ids = await ingestMany(files, options);
          toast(`Saved ${ids.length} image${ids.length === 1 ? '' : 's'}`);
          onDone?.(ids);
        }}
      />
      <button type="button" className={className ?? 'btn'} onClick={() => input.current?.click()}>
        {children}
      </button>
    </>
  );
}
