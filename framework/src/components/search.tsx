import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { CornerDownLeft, Search } from 'lucide-react';
import { buildDocs, buildIndex, KIND_LABEL, runSearch, type SearchHit, type SearchKind } from '@/db/search';
import { useHotkey, useLiveQuery } from '@/lib/hooks';

type Index = ReturnType<typeof buildIndex>;
const Ctx = createContext<{ index?: Index; openPalette: () => void }>({ openPalette: () => {} });

export function hitPath(h: { kind: SearchKind; id: string }): string {
  switch (h.kind) {
    case 'video':
      return `/videos/${h.id}`;
    case 'breakdown':
      return `/breakdowns/${h.id}`;
    case 'technique':
      return `/techniques/${h.id}`;
    case 'creator':
      return `/creators/${h.id}`;
    case 'artDirection':
      return `/art-directions/${h.id}`;
    case 'moodboard':
      return `/moodboards/${h.id}`;
    case 'asset':
      return `/assets/${h.id}`;
    case 'glossary':
      return `/glossary#${h.id}`;
    case 'collection':
      return `/collections/${h.id}`;
  }
}

export function SearchProvider({ children }: { children: ReactNode }) {
  const docs = useLiveQuery(buildDocs, []);
  const index = useMemo(() => (docs ? buildIndex(docs) : undefined), [docs]);
  const [open, setOpen] = useState(false);
  useHotkey('mod+k', (e) => {
    e.preventDefault();
    setOpen((o) => !o);
  });
  useHotkey('/', (e) => {
    e.preventDefault();
    setOpen(true);
  });
  return (
    <Ctx.Provider value={{ index, openPalette: () => setOpen(true) }}>
      {children}
      {open && <Palette onClose={() => setOpen(false)} />}
    </Ctx.Provider>
  );
}

export function useSearch() {
  return useContext(Ctx);
}

export function groupHits(hits: SearchHit[]) {
  const order: SearchKind[] = ['technique', 'video', 'artDirection', 'breakdown', 'creator', 'asset', 'moodboard', 'collection', 'glossary'];
  const groups = new Map<SearchKind, SearchHit[]>();
  for (const h of hits) groups.set(h.kind, [...(groups.get(h.kind) ?? []), h]);
  return order.filter((k) => groups.has(k)).map((k) => ({ kind: k, hits: groups.get(k)! }));
}

function Palette({ onClose }: { onClose: () => void }) {
  const { index } = useSearch();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const hits = useMemo(() => (index ? runSearch(index, q, 40) : []), [index, q]);
  const groups = useMemo(() => groupHits(hits), [hits]);
  const flat = groups.flatMap((g) => g.hits);
  useEffect(() => input.current?.focus(), []);
  useEffect(() => setHi(0), [q]);

  const go = (h: SearchHit) => {
    nav(hitPath(h));
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 p-4 pt-[12vh] backdrop-blur-[2px]" onMouseDown={onClose}>
      <div className="fade-in w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Search">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={16} className="text-faint" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search techniques, videos, art directions, creators…"
            className="h-14 flex-1 border-0 bg-transparent text-[15px] outline-none placeholder:text-faint"
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHi((h) => Math.min(h + 1, flat.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHi((h) => Math.max(h - 1, 0));
              } else if (e.key === 'Enter') {
                if (flat[hi]) go(flat[hi]);
                else if (q.trim()) {
                  nav(`/search?q=${encodeURIComponent(q.trim())}`);
                  onClose();
                }
              }
            }}
          />
          <kbd className="rounded border border-line px-1.5 font-mono text-[10px] text-faint">esc</kbd>
        </div>
        <div className="max-h-[56vh] overflow-y-auto p-1.5">
          {!q.trim() && <p className="px-3 py-6 text-center text-[13px] text-faint">Try “whip pan”, “DaVinci Resolve”, “film grain” or “dark”.</p>}
          {q.trim() && !flat.length && <p className="px-3 py-6 text-center text-[13px] text-faint">Nothing matches “{q}”.</p>}
          {groups.map((g) => (
            <div key={g.kind} className="mb-1">
              <div className="label px-3 pb-1 pt-2">{KIND_LABEL[g.kind]}</div>
              {g.hits.map((h) => {
                const i = flat.indexOf(h);
                return (
                  <button
                    key={h.key}
                    onMouseEnter={() => setHi(i)}
                    onClick={() => go(h)}
                    className={clsx('flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left', i === hi && 'bg-ink/[0.06]')}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px]">{h.title}</span>
                      {h.subtitle && <span className="block truncate text-[11.5px] text-faint">{h.subtitle}</span>}
                    </span>
                    {i === hi && <CornerDownLeft size={13} className="shrink-0 text-faint" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        {q.trim() && (
          <button
            className="w-full border-t border-line px-4 py-2.5 text-left text-[12.5px] text-muted hover:bg-ink/[0.04]"
            onClick={() => {
              nav(`/search?q=${encodeURIComponent(q.trim())}`);
              onClose();
            }}
          >
            See all results for “{q.trim()}”
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
