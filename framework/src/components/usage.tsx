import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Plus, Search, Trash2 } from 'lucide-react';
import { db } from '@/db/db';
import { addUsage, createTechnique, deleteUsage, findSimilarTechniques, updateUsage, type SimilarTechnique } from '@/db/repo';
import type { ID, Provenance, Technique, UsageTarget } from '@/db/types';
import { useLiveQuery, useLookups } from '@/lib/hooks';
import { formatTime, normalizeName, parseTime, similarity } from '@/lib/util';
import { ProvenanceBadge, ProvenanceSelect, toast, errorText } from './ui';

/**
 * Search-first technique picker. Typing always shows existing techniques
 * (by name and alias) before offering to create a new one, so the library
 * grows without duplicates.
 */
export function TechniquePicker({
  onPick,
  exclude = [],
  placeholder = 'Find a technique — e.g. whip pan, film grain…',
  autoFocus,
}: {
  onPick: (t: Technique) => void;
  exclude?: ID[];
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const lk = useLookups();
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [categoryId, setCategoryId] = useState('cat_transition');
  const [similar, setSimilar] = useState<SimilarTechnique[]>([]);

  const matches = useMemo(() => {
    const list = lk?.lists.techniques ?? [];
    const n = normalizeName(q);
    if (!n) return [];
    return list
      .filter((t) => !exclude.includes(t.id))
      .map((t) => {
        const labels = [t.name, ...t.aliases];
        let score = 0;
        let via = '';
        for (const l of labels) {
          const ln = normalizeName(l);
          const s = ln.includes(n) ? 1 + (ln.startsWith(n) ? 0.5 : 0) : similarity(n, ln);
          if (s > score) {
            score = s;
            via = l === t.name ? '' : l;
          }
        }
        return { t, score, via };
      })
      .filter((m) => m.score >= 0.4)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }, [q, lk, exclude]);

  useEffect(() => {
    if (!creating) return;
    void findSimilarTechniques(q).then(setSimilar);
  }, [creating, q]);

  const create = async () => {
    try {
      const id = await createTechnique({ name: q.trim(), categoryId, provenance: 'user' });
      const t = await db.techniques.get(id);
      if (t) onPick(t);
      toast(`Created “${q.trim()}”`);
      setQ('');
      setCreating(false);
    } catch (e) {
      toast(errorText(e), 'error');
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
        <input
          className="input pl-8"
          value={q}
          autoFocus={autoFocus}
          placeholder={placeholder}
          onChange={(e) => {
            setQ(e.target.value);
            setCreating(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && matches[0]) {
              e.preventDefault();
              onPick(matches[0].t);
              setQ('');
            }
          }}
          aria-label="Search techniques"
        />
      </div>
      {q.trim() && !creating && (
        <div className="absolute left-0 right-0 z-30 mt-1 rounded-xl border border-line bg-panel p-1 shadow-xl">
          {matches.map(({ t, via }) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                onPick(t);
                setQ('');
              }}
              className="flex w-full items-baseline justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-[13px] hover:bg-ink/[0.05]"
            >
              <span>
                {t.name}
                {via && <span className="ml-1.5 text-[11.5px] text-faint">aka {via}</span>}
              </span>
              <span className="shrink-0 text-[11.5px] text-faint">{lk?.categories.get(t.categoryId)?.name}</span>
            </button>
          ))}
          {!matches.length && <p className="px-2.5 py-1.5 text-[12.5px] text-faint">No existing technique matches “{q.trim()}”.</p>}
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mt-0.5 flex w-full items-center gap-2 rounded-lg border-t border-line px-2.5 py-2 text-left text-[13px] text-muted hover:bg-ink/[0.05]"
          >
            <Plus size={13} /> New technique “{q.trim()}”…
          </button>
        </div>
      )}
      {creating && (
        <div className="mt-2 rounded-xl border border-line bg-panel p-3">
          {similar.length > 0 && (
            <div className="mb-3 rounded-lg bg-inferred/10 p-2.5 text-[12.5px]">
              <p className="mb-1.5 font-medium">Already in your library — use one of these instead?</p>
              <div className="flex flex-wrap gap-1.5">
                {similar.map((s) => (
                  <button
                    key={s.technique.id}
                    className="chip border-ink/30 text-ink hover:bg-ink hover:text-paper"
                    onClick={() => {
                      onPick(s.technique);
                      setQ('');
                      setCreating(false);
                    }}
                  >
                    {s.technique.name}
                    {s.matched !== s.technique.name && <span className="opacity-60">({s.matched})</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <select className="input w-auto" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Category">
              {(lk?.lists.categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button className="btn-solid" onClick={() => void create()}>
              Create “{q.trim()}”
            </button>
            <button className="btn-ghost" onClick={() => setCreating(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Techniques linked to a video / breakdown / asset / creator / art direction. */
export function UsageEditor({
  targetType,
  targetId,
  compact,
  currentTime,
  defaultProvenance = 'verified',
}: {
  targetType: UsageTarget;
  targetId: ID;
  compact?: boolean;
  /** When set (e.g. a playing local video), new usages get this timestamp. */
  currentTime?: number;
  defaultProvenance?: Provenance;
}) {
  const lk = useLookups();
  const usages = useLiveQuery(() => db.usages.where('[targetType+targetId]').equals([targetType, targetId]).toArray(), [targetType, targetId]);
  const variations = useLiveQuery(async () => {
    const ids = [...new Set((usages ?? []).map((u) => u.techniqueId))];
    return ids.length ? db.variations.where('techniqueId').anyOf(ids).toArray() : [];
  }, [usages]);
  const sorted = useMemo(() => [...(usages ?? [])].sort((a, b) => (a.timestamp ?? 1e9) - (b.timestamp ?? 1e9) || a.createdAt - b.createdAt), [usages]);

  const add = async (t: Technique) => {
    await addUsage({
      techniqueId: t.id,
      targetType,
      targetId,
      timestamp: currentTime != null ? Math.floor(currentTime * 10) / 10 : null,
      note: '',
      provenance: defaultProvenance,
    });
  };

  return (
    <div className="space-y-3">
      <TechniquePicker onPick={add} placeholder={compact ? 'Link a technique…' : undefined} />
      {sorted.length === 0 && <p className="text-[12.5px] text-faint">No techniques linked yet.</p>}
      <ul className="divide-y divide-line">
        {sorted.map((u) => {
          const t = lk?.techniques.get(u.techniqueId);
          const vars = (variations ?? []).filter((v) => v.techniqueId === u.techniqueId);
          return (
            <li key={u.id} className={clsx('py-2.5', compact && 'py-2')}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link to={`/techniques/${u.techniqueId}`} className="font-medium hover:underline">
                    {t?.name ?? 'Missing technique'}
                  </Link>
                  <div className="text-[11.5px] text-faint">{t && lk?.categories.get(t.categoryId)?.name}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <ProvenanceBadge value={u.provenance} />
                  <button className="icon-btn h-7 w-7" aria-label="Remove technique" onClick={() => deleteUsage(u.id)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <UsageFields
                usageId={u.id}
                timestamp={u.timestamp}
                note={u.note}
                provenance={u.provenance}
                variationId={u.variationId}
                variations={vars}
                collapsed={compact && u.timestamp == null && !u.note}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function UsageFields({
  usageId,
  timestamp,
  note,
  provenance,
  variationId,
  variations,
  collapsed,
}: {
  usageId: ID;
  timestamp: number | null;
  note: string;
  provenance: Provenance;
  variationId?: ID;
  variations: { id: ID; name: string }[];
  collapsed?: boolean;
}) {
  const [open, setOpen] = useState(!collapsed);
  const [t, setT] = useState(timestamp == null ? '' : formatTime(timestamp));
  const [n, setN] = useState(note);
  useEffect(() => setT(timestamp == null ? '' : formatTime(timestamp)), [timestamp]);
  useEffect(() => setN(note), [note]);
  if (!open) {
    return (
      <button className="mt-1 text-[12px] text-faint hover:text-ink" onClick={() => setOpen(true)}>
        + timestamp, variation or note
      </button>
    );
  }
  return (
    <div className="mt-2 grid grid-cols-[88px_1fr] gap-2">
      <input
        className="input py-1.5 font-mono text-[12px]"
        placeholder="mm:ss"
        value={t}
        aria-label="Timestamp"
        title="Only add a timestamp you have checked in the source"
        onChange={(e) => setT(e.target.value)}
        onBlur={() => {
          const v = parseTime(t);
          if (t.trim() && v == null) {
            toast('Use mm:ss, h:mm:ss or seconds', 'error');
            return;
          }
          void updateUsage(usageId, { timestamp: v });
        }}
      />
      <input
        className="input py-1.5 text-[12.5px]"
        placeholder="How it is used here…"
        value={n}
        aria-label="Note"
        onChange={(e) => setN(e.target.value)}
        onBlur={() => n !== note && void updateUsage(usageId, { note: n })}
      />
      <div className="col-span-2 flex flex-wrap items-center gap-2">
        <ProvenanceSelect value={provenance === 'verified' ? 'verified' : 'inferred'} onChange={(p) => void updateUsage(usageId, { provenance: p })} />
        {variations.length > 0 && (
          <select
            className="input w-auto py-1 text-[12px]"
            value={variationId ?? ''}
            onChange={(e) => void updateUsage(usageId, { variationId: e.target.value || undefined })}
            aria-label="Variation"
          >
            <option value="">Any variation</option>
            {variations.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
