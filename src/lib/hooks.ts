import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import type { ArtDirection, Category, Creator, Genre, ID, Niche, Software, Tag, Technique } from '@/db/types';

export { useLiveQuery };

// ───────────────────────────── Blob URLs for stored files

const urlCache = new Map<string, { url: string; refs: number }>();

/** Object URL for a stored file; shared and released when no longer used. */
export function useFileUrl(fileId?: ID): string | undefined {
  const [url, setUrl] = useState<string | undefined>(() => (fileId ? urlCache.get(fileId)?.url : undefined));
  useEffect(() => {
    if (!fileId) {
      setUrl(undefined);
      return;
    }
    let cancelled = false;
    const cached = urlCache.get(fileId);
    if (cached) {
      cached.refs++;
      setUrl(cached.url);
    } else {
      db.files.get(fileId).then((f) => {
        if (cancelled || !f) return;
        const existing = urlCache.get(fileId);
        if (existing) {
          existing.refs++;
          setUrl(existing.url);
          return;
        }
        const u = URL.createObjectURL(f.blob);
        urlCache.set(fileId, { url: u, refs: 1 });
        setUrl(u);
      });
    }
    return () => {
      cancelled = true;
      const entry = urlCache.get(fileId);
      if (!entry) return;
      entry.refs--;
      if (entry.refs <= 0) {
        // Delay so quick remounts (route changes, re-sorts) reuse the URL.
        setTimeout(() => {
          const e = urlCache.get(fileId);
          if (e && e.refs <= 0) {
            URL.revokeObjectURL(e.url);
            urlCache.delete(fileId);
          }
        }, 30_000);
      }
    };
  }, [fileId]);
  return url;
}

// ───────────────────────────── Lookups for small tables

export interface Lookups {
  tags: Map<ID, Tag>;
  software: Map<ID, Software>;
  categories: Map<ID, Category>;
  genres: Map<ID, Genre>;
  niches: Map<ID, Niche>;
  creators: Map<ID, Creator>;
  artDirections: Map<ID, ArtDirection>;
  techniques: Map<ID, Technique>;
  lists: {
    tags: Tag[];
    software: Software[];
    categories: Category[];
    genres: Genre[];
    niches: Niche[];
    creators: Creator[];
    artDirections: ArtDirection[];
    techniques: Technique[];
  };
}

const sortName = <T extends { name: string }>(a: T[]) => [...a].sort((x, y) => x.name.localeCompare(y.name));

export function useLookups(): Lookups | undefined {
  const data = useLiveQuery(async () => {
    const [tags, software, categories, genres, niches, creators, artDirections, techniques] = await Promise.all([
      db.tags.toArray(),
      db.software.toArray(),
      db.categories.orderBy('order').toArray(),
      db.genres.toArray(),
      db.niches.toArray(),
      db.creators.toArray(),
      db.artDirections.toArray(),
      db.techniques.toArray(),
    ]);
    return { tags, software, categories, genres, niches, creators, artDirections, techniques };
  }, []);
  return useMemo(() => {
    if (!data) return undefined;
    const m = <T extends { id: ID }>(rows: T[]) => new Map(rows.map((r) => [r.id, r]));
    return {
      tags: m(data.tags),
      software: m(data.software),
      categories: m(data.categories),
      genres: m(data.genres),
      niches: m(data.niches),
      creators: m(data.creators),
      artDirections: m(data.artDirections),
      techniques: m(data.techniques),
      lists: {
        tags: sortName(data.tags),
        software: sortName(data.software),
        categories: data.categories,
        genres: sortName(data.genres),
        niches: sortName(data.niches),
        creators: sortName(data.creators),
        artDirections: sortName(data.artDirections),
        techniques: sortName(data.techniques),
      },
    };
  }, [data]);
}

// ───────────────────────────── Misc

export function useHotkey(combo: string, handler: (e: KeyboardEvent) => void, enabled = true) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!enabled) return;
    const parts = combo.toLowerCase().split('+');
    const key = parts.pop();
    const needMeta = parts.includes('mod');
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== key) return;
      if (needMeta && !(e.metaKey || e.ctrlKey)) return;
      if (!needMeta) {
        const t = e.target as HTMLElement;
        if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
        if (e.metaKey || e.ctrlKey || e.altKey) return;
      }
      ref.current(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [combo, enabled]);
}

export function useElementWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** Per-viewer UI preference, kept in localStorage when available. */
export function usePref<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(`framework:${key}`);
      return raw == null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });
  const set = (v: T) => {
    setValue(v);
    try {
      localStorage.setItem(`framework:${key}`, JSON.stringify(v));
    } catch {
      /* storage unavailable */
    }
  };
  return [value, set];
}
