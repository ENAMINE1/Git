import { useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { Plus, X } from 'lucide-react';
import { ensureTag } from '@/db/repo';
import type { ID } from '@/db/types';
import { useLookups } from '@/lib/hooks';
import { normalizeName } from '@/lib/util';

interface Option {
  id: ID;
  label: string;
  hint?: string;
}

/**
 * Multi-select of ids with type-ahead. When `onCreate` is given, unmatched
 * input can create a new option (e.g. a tag, genre or software).
 */
export function IdPicker({
  options,
  value,
  onChange,
  placeholder = 'Add…',
  onCreate,
  className,
  single,
}: {
  options: Option[];
  value: ID[];
  onChange: (ids: ID[]) => void;
  placeholder?: string;
  onCreate?: (label: string) => Promise<ID>;
  className?: string;
  single?: boolean;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const matches = useMemo(() => {
    const n = normalizeName(q);
    return options
      .filter((o) => !value.includes(o.id))
      .filter((o) => !n || normalizeName(`${o.label} ${o.hint ?? ''}`).includes(n))
      .slice(0, 8);
  }, [q, options, value]);
  const exact = options.some((o) => normalizeName(o.label) === normalizeName(q));
  const canCreate = !!onCreate && q.trim().length > 0 && !exact;

  const pick = (id: ID) => {
    onChange(single ? [id] : [...value, id]);
    setQ('');
    setHi(0);
    if (single) setOpen(false);
  };
  const create = async () => {
    if (!onCreate) return;
    const id = await onCreate(q.trim());
    pick(id);
  };

  return (
    <div className={clsx('relative', className)}>
      <div
        className="input flex min-h-[38px] flex-wrap items-center gap-1.5 py-1.5"
        onClick={() => {
          inputRef.current?.focus();
          setOpen(true);
        }}
      >
        {value.map((id) => (
          <span key={id} className="chip border-ink/20 py-0 text-ink">
            {byId.get(id)?.label ?? 'Unknown'}
            <button
              type="button"
              aria-label="Remove"
              className="text-faint hover:text-ink"
              onClick={(e) => {
                e.stopPropagation();
                onChange(value.filter((v) => v !== id));
              }}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        {(!single || value.length === 0) && (
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
              setHi(0);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') setHi((h) => Math.min(h + 1, matches.length - (canCreate ? 0 : 1)));
              else if (e.key === 'ArrowUp') setHi((h) => Math.max(0, h - 1));
              else if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                if (matches[hi]) pick(matches[hi].id);
                else if (canCreate) void create();
              } else if (e.key === 'Backspace' && !q && value.length) onChange(value.slice(0, -1));
            }}
            placeholder={value.length ? '' : placeholder}
            className="min-w-[80px] flex-1 border-0 bg-transparent p-0 text-[13.5px] outline-none placeholder:text-faint"
          />
        )}
      </div>
      {open && (matches.length > 0 || canCreate) && (
        <div className="absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-line bg-panel p-1 shadow-xl">
          {matches.map((o, i) => (
            <button
              type="button"
              key={o.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(o.id)}
              className={clsx('flex w-full items-baseline justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-[13px]', i === hi && 'bg-ink/[0.06]')}
            >
              <span>{o.label}</span>
              {o.hint && <span className="truncate text-[11.5px] text-faint">{o.hint}</span>}
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void create()}
              className={clsx('flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-muted', hi === matches.length && 'bg-ink/[0.06]')}
            >
              <Plus size={13} /> Create “{q.trim()}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function TagInput({ value, onChange, placeholder = 'Add tags…' }: { value: ID[]; onChange: (ids: ID[]) => void; placeholder?: string }) {
  const lk = useLookups();
  const options = useMemo(() => (lk?.lists.tags ?? []).map((t) => ({ id: t.id, label: t.name })), [lk]);
  return <IdPicker options={options} value={value} onChange={onChange} onCreate={ensureTag} placeholder={placeholder} />;
}

export function TagList({ ids, className }: { ids: ID[]; className?: string }) {
  const lk = useLookups();
  if (!ids.length || !lk) return null;
  return (
    <div className={clsx('flex flex-wrap gap-1', className)}>
      {ids.map((id) => {
        const t = lk.tags.get(id);
        return t ? (
          <span key={id} className="text-[12px] text-muted">
            #{t.name}
          </span>
        ) : null;
      })}
    </div>
  );
}

/** Editable list of short strings (characteristics, aliases, plugins…). */
export function StringList({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [q, setQ] = useState('');
  const add = () => {
    const v = q.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setQ('');
  };
  return (
    <div className="input flex min-h-[38px] flex-wrap items-center gap-1.5 py-1.5">
      {value.map((s) => (
        <span key={s} className="chip border-ink/20 py-0 text-ink">
          {s}
          <button type="button" aria-label={`Remove ${s}`} className="text-faint hover:text-ink" onClick={() => onChange(value.filter((x) => x !== s))}>
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add();
          } else if (e.key === 'Backspace' && !q && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={add}
        placeholder={value.length ? '' : placeholder}
        className="min-w-[80px] flex-1 border-0 bg-transparent p-0 text-[13.5px] outline-none placeholder:text-faint"
      />
    </div>
  );
}
