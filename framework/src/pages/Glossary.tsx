import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { db } from '@/db/db';
import { deleteGlossaryTerm, saveGlossaryTerm } from '@/db/repo';
import type { GlossaryTerm } from '@/db/types';
import { useLiveQuery, useLookups } from '@/lib/hooks';
import { normalizeName } from '@/lib/util';
import { StringList } from '@/components/pickers';
import { Field, Modal, PageHeader, ProvenanceBadge, toast } from '@/components/ui';

interface Entry {
  key: string;
  term: string;
  definition: string;
  aliases: string[];
  techniqueId?: string;
  category?: string;
  glossary?: GlossaryTerm;
}

export function Glossary() {
  const lk = useLookups();
  const loc = useLocation();
  const terms = useLiveQuery(() => db.glossary.toArray(), []);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Partial<GlossaryTerm> | null>(null);
  const [showTechniques, setShowTechniques] = useState(true);

  const entries = useMemo(() => {
    const out: Entry[] = (terms ?? []).map((g) => ({ key: g.id, term: g.term, definition: g.definition, aliases: g.aliases, techniqueId: g.techniqueId, glossary: g }));
    if (showTechniques) {
      for (const t of lk?.lists.techniques ?? []) {
        out.push({ key: t.id, term: t.name, definition: t.summary, aliases: t.aliases, techniqueId: t.id, category: lk?.categories.get(t.categoryId)?.name });
      }
    }
    const n = normalizeName(q);
    return out
      .filter((e) => !n || normalizeName(`${e.term} ${e.aliases.join(' ')} ${e.definition}`).includes(n))
      .sort((a, b) => a.term.localeCompare(b.term, undefined, { sensitivity: 'base' }));
  }, [terms, lk, q, showTechniques]);

  const letters = useMemo(() => {
    const m = new Map<string, Entry[]>();
    for (const e of entries) {
      const l = /[a-z]/i.test(e.term[0]) ? e.term[0].toUpperCase() : '#';
      m.set(l, [...(m.get(l) ?? []), e]);
    }
    return [...m.entries()];
  }, [entries]);

  useEffect(() => {
    if (!loc.hash) return;
    const el = document.getElementById(loc.hash.slice(1));
    if (el) {
      el.scrollIntoView({ block: 'center' });
      el.classList.add('bg-accent/10');
      setTimeout(() => el.classList.remove('bg-accent/10'), 1800);
    }
  }, [loc.hash, entries.length]);

  return (
    <div>
      <PageHeader
        eyebrow="Reference"
        title="Glossary"
        lede="Technical vocabulary, linked to the technique library. Every technique appears here too, so the glossary doubles as an A–Z index."
        actions={
          <button className="btn-solid" onClick={() => setEditing({ term: '', definition: '', aliases: [] })}>
            <Plus size={14} /> New term
          </button>
        }
      />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input className="input py-1.5 pl-8" placeholder="Search terms…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-[13px] text-muted">
          <input type="checkbox" checked={showTechniques} onChange={(e) => setShowTechniques(e.target.checked)} /> Include techniques
        </label>
        <nav className="flex flex-wrap gap-1 text-[12px]" aria-label="Letters">
          {letters.map(([l]) => (
            <a key={l} href={`#letter-${l}`} onClick={(e) => (e.preventDefault(), document.getElementById(`letter-${l}`)?.scrollIntoView())} className="rounded px-1.5 py-0.5 font-mono text-muted hover:bg-ink/[0.06] hover:text-ink">
              {l}
            </a>
          ))}
        </nav>
      </div>
      <div className="space-y-10">
        {letters.map(([l, list]) => (
          <section key={l} id={`letter-${l}`}>
            <h2 className="mb-3 border-b border-line pb-1 font-serif text-[40px] leading-none text-ink/30">{l}</h2>
            <dl className="grid gap-x-12 md:grid-cols-2">
              {list.map((e) => (
                <div key={e.key} id={e.key} className="group rounded-lg py-3 transition-colors">
                  <dt className="flex items-baseline justify-between gap-3">
                    <span className="font-serif text-[22px] leading-tight">
                      {e.glossary ? e.term : <Link to={`/techniques/${e.techniqueId}`} className="hover:underline">{e.term}</Link>}
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      {e.category && <span className="label">{e.category}</span>}
                      {e.glossary && (
                        <>
                          <button className="icon-btn h-7 w-7 opacity-0 group-hover:opacity-100" aria-label={`Edit ${e.term}`} onClick={() => setEditing(e.glossary!)}>
                            <Pencil size={13} />
                          </button>
                          <button
                            className="icon-btn h-7 w-7 opacity-0 group-hover:opacity-100"
                            aria-label={`Delete ${e.term}`}
                            onClick={async () => {
                              if (!confirm(`Delete “${e.term}”?`)) return;
                              await deleteGlossaryTerm(e.glossary!.id);
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </span>
                  </dt>
                  {e.aliases.length > 0 && <p className="text-[12px] text-faint">also {e.aliases.join(', ')}</p>}
                  <dd className={clsx('mt-1 text-[13.5px] text-ink/80')}>{e.definition || <span className="text-faint">—</span>}</dd>
                  {e.glossary?.techniqueId && (
                    <Link to={`/techniques/${e.glossary.techniqueId}`} className="link mt-1 inline-block text-[12px] text-muted">
                      → {lk?.techniques.get(e.glossary.techniqueId)?.name}
                    </Link>
                  )}
                  {e.glossary && e.glossary.provenance !== 'reference' && <ProvenanceBadge value={e.glossary.provenance} className="ml-2" />}
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      {editing && <TermEditor term={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function TermEditor({ term, onClose }: { term: Partial<GlossaryTerm>; onClose: () => void }) {
  const lk = useLookups();
  const [d, setD] = useState(term);
  return (
    <Modal
      open
      onClose={onClose}
      title={term.id ? `Edit ${term.term}` : 'New glossary term'}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-solid"
            disabled={!d.term?.trim() || !d.definition?.trim()}
            onClick={async () => {
              await saveGlossaryTerm({ ...d, term: d.term!.trim(), definition: d.definition!.trim() });
              toast('Saved');
              onClose();
            }}
          >
            Save
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Term">
          <input className="input" autoFocus value={d.term ?? ''} onChange={(e) => setD({ ...d, term: e.target.value })} />
        </Field>
        <Field label="Definition">
          <textarea className="input min-h-[100px]" value={d.definition ?? ''} onChange={(e) => setD({ ...d, definition: e.target.value })} />
        </Field>
        <Field label="Aliases">
          <StringList value={d.aliases ?? []} onChange={(aliases) => setD({ ...d, aliases })} />
        </Field>
        <Field label="Linked technique">
          <select className="input" value={d.techniqueId ?? ''} onChange={(e) => setD({ ...d, techniqueId: e.target.value || undefined })}>
            <option value="">—</option>
            {(lk?.lists.techniques ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </Modal>
  );
}
