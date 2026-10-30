import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Download, HardDrive, Pencil, Plus, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { db } from '@/db/db';
import { backupFilename, createBackup, createJsonExport, downloadBlob, restoreBackup } from '@/db/backup';
import { ensureSeeded } from '@/db/seed';
import { addTaxonomy, deleteTag, deleteTaxonomy, renameTaxonomy, taxonomyUsage, type TaxonomyKind } from '@/db/repo';
import { useLiveQuery } from '@/lib/hooks';
import { formatBytes } from '@/lib/util';
import { useRemoteThumbs } from '@/components/cards';
import { Field, Modal, PageHeader, ProvenanceBadge, Section, Tabs, errorText, toast } from '@/components/ui';

export function LibraryPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Local-first"
        title="Library & backup"
        lede="Everything — records, images and attached videos — lives in this browser's IndexedDB on this device. Export a backup regularly; it is a plain ZIP you can restore on any machine."
      />
      <Backup />
      <Storage />
      <Taxonomy />
      <Preferences />
      <About />
      <Danger />
    </div>
  );
}

function Backup() {
  const last = useLiveQuery(() => db.meta.get('lastBackupAt'), []);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [mode, setMode] = useState<'replace' | 'merge'>('replace');
  const input = useRef<HTMLInputElement>(null);

  const exportZip = async () => {
    setBusy('zip');
    try {
      const blob = await createBackup(db);
      downloadBlob(blob, backupFilename());
      await db.meta.put({ key: 'lastBackupAt', value: new Date().toISOString() });
      toast(`Backup ready · ${formatBytes(blob.size)}`);
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(null);
    }
  };
  const exportJson = async () => {
    const blob = await createJsonExport(db);
    downloadBlob(blob, backupFilename().replace('.zip', '.json'));
  };
  const restore = async () => {
    if (!pending) return;
    setBusy('restore');
    try {
      const res = await restoreBackup(pending, mode, db);
      toast(`Restored ${res.records} records and ${res.files} files`);
      setPending(null);
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Section title="Backup & restore">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <p className="font-serif text-[22px]">Export</p>
          <p className="mt-1 text-[13px] text-muted">
            The full backup contains <code className="font-mono text-[12px]">library.json</code> plus every original image and attached video in <code className="font-mono text-[12px]">files/</code>.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn-solid" onClick={() => void exportZip()} disabled={!!busy} data-testid="export-zip">
              <Download size={14} /> {busy === 'zip' ? 'Packing…' : 'Full backup (.zip)'}
            </button>
            <button className="btn" onClick={() => void exportJson()}>
              Records only (.json)
            </button>
          </div>
          <p className="mt-3 text-[12px] text-faint">{last?.value ? `Last full backup: ${new Date(String(last.value)).toLocaleString()}` : 'No backup exported from this browser yet.'}</p>
        </div>
        <div className="card p-5">
          <p className="font-serif text-[22px]">Restore</p>
          <p className="mt-1 text-[13px] text-muted">Load a FRAMEWORK backup (.zip or .json) — for example on a new machine.</p>
          <input
            ref={input}
            type="file"
            accept=".zip,.json,application/zip,application/json"
            hidden
            data-testid="restore-input"
            onChange={(e) => {
              setPending(e.target.files?.[0] ?? null);
              e.target.value = '';
            }}
          />
          <button className="btn mt-4" onClick={() => input.current?.click()}>
            <Upload size={14} /> Choose backup file
          </button>
        </div>
      </div>
      <Modal
        open={!!pending}
        onClose={() => setPending(null)}
        title="Restore backup"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setPending(null)}>
              Cancel
            </button>
            <button className={mode === 'replace' ? 'btn-danger' : 'btn-solid'} onClick={() => void restore()} disabled={busy === 'restore'} data-testid="confirm-restore">
              {busy === 'restore' ? 'Restoring…' : mode === 'replace' ? 'Replace my library' : 'Merge into library'}
            </button>
          </>
        }
      >
        <p className="mb-4 text-[13px]">
          {pending?.name} · {formatBytes(pending?.size)}
        </p>
        <div className="space-y-2">
          {(
            [
              ['replace', 'Replace', 'Wipe this library and load the backup exactly. Use on a new machine.'],
              ['merge', 'Merge', 'Add records from the backup; entries with the same id are overwritten by the backup.'],
            ] as const
          ).map(([v, label, desc]) => (
            <label key={v} className={clsx('flex cursor-pointer gap-3 rounded-xl border p-3', mode === v ? 'border-ink' : 'border-line')}>
              <input type="radio" name="mode" checked={mode === v} onChange={() => setMode(v)} className="mt-1" />
              <span>
                <span className="block font-medium">{label}</span>
                <span className="text-[12.5px] text-muted">{desc}</span>
              </span>
            </label>
          ))}
        </div>
        {mode === 'replace' && <p className="mt-3 text-[12.5px] text-accent">Export a backup of the current library first if you might need it.</p>}
      </Modal>
    </Section>
  );
}

function Storage() {
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [estimate, setEstimate] = useState<{ usage?: number; quota?: number }>({});
  const counts = useLiveQuery(async () => {
    const tables = ['videos', 'techniques', 'variations', 'usages', 'artDirections', 'moodboards', 'assets', 'creators', 'breakdowns', 'transcripts', 'collections', 'glossary', 'tags'] as const;
    const entries = await Promise.all(tables.map(async (t) => [t, await db.table(t).count()] as const));
    let bytes = 0;
    await db.files.each((f) => {
      bytes += f.blob.size;
    });
    return { entries, bytes, files: await db.files.count() };
  }, []);
  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted);
    void navigator.storage?.estimate?.().then(setEstimate);
  }, [counts?.bytes]);
  return (
    <Section title="Storage">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card p-5">
          <div className="flex items-center gap-2">
            {persisted ? <ShieldCheck size={16} className="text-verified" /> : <HardDrive size={16} className="text-muted" />}
            <p className="font-medium">{persisted ? 'Persistent storage granted' : 'Best-effort storage'}</p>
          </div>
          <p className="mt-1 text-[12.5px] text-muted">
            {persisted ? 'The browser will not evict this library under storage pressure.' : 'The browser may clear data under pressure. Request persistence, and keep backups.'}
          </p>
          {!persisted && (
            <button className="btn mt-3" onClick={async () => setPersisted((await navigator.storage?.persist?.()) ?? false)}>
              Request persistence
            </button>
          )}
        </div>
        <div className="card p-5">
          <p className="label">Stored files</p>
          <p className="mt-1 font-serif text-[34px] leading-none">{formatBytes(counts?.bytes)}</p>
          <p className="mt-1 text-[12.5px] text-muted">
            {counts?.files ?? 0} files · origin usage {formatBytes(estimate.usage)} of {formatBytes(estimate.quota)}
          </p>
        </div>
        <div className="card p-5">
          <p className="label mb-2">Records</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[12.5px]">
            {counts?.entries.map(([t, n]) => (
              <div key={t} className="flex justify-between">
                <dt className="text-muted">{t}</dt>
                <dd className="font-mono">{n}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </Section>
  );
}

type TaxTab = TaxonomyKind | 'tags';

function Taxonomy() {
  const [tab, setTab] = useState<TaxTab>('tags');
  const rows = useLiveQuery(async () => {
    if (tab === 'tags') return (await db.tags.toArray()).map((t) => ({ id: t.id, name: t.name }));
    const list = (await db.table(tab).toArray()) as { id: string; name: string; order?: number }[];
    return tab === 'categories' ? list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : list.sort((a, b) => a.name.localeCompare(b.name));
  }, [tab]);
  const [name, setName] = useState('');
  return (
    <Section title="Taxonomy">
      <p className="-mt-1 mb-4 max-w-2xl text-[13px] text-muted">Genres (what a video is), technique categories, software, niches and tags. Rename freely; deleting removes the entry from every record.</p>
      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'tags', label: 'Tags' },
          { value: 'genres', label: 'Genres' },
          { value: 'niches', label: 'Niches' },
          { value: 'categories', label: 'Technique categories' },
          { value: 'software', label: 'Software' },
        ]}
      />
      <div className="card divide-y divide-line">
        {(rows ?? []).map((r) => (
          <TaxRow key={r.id} kind={tab} id={r.id} name={r.name} />
        ))}
        {tab !== 'tags' && (
          <form
            className="flex gap-2 p-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!name.trim()) return;
              await addTaxonomy(tab, name);
              setName('');
            }}
          >
            <input className="input" placeholder={`New ${tab === 'categories' ? 'category' : tab.replace(/s$/, '')}…`} value={name} onChange={(e) => setName(e.target.value)} />
            <button className="btn" type="submit">
              <Plus size={14} /> Add
            </button>
          </form>
        )}
        {tab === 'tags' && !rows?.length && <p className="p-4 text-[13px] text-faint">Tags appear here as you add them to items.</p>}
      </div>
    </Section>
  );
}

function TaxRow({ kind, id, name }: { kind: TaxTab; id: string; name: string }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(name);
  const usage = useLiveQuery(() => (kind === 'tags' ? Promise.resolve(-1) : taxonomyUsage(kind, id)), [kind, id]);
  return (
    <div className="group flex items-center gap-3 px-4 py-2">
      {editing ? (
        <input
          className="input py-1"
          autoFocus
          value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={async () => {
            setEditing(false);
            if (v.trim() && v !== name) {
              if (kind === 'tags') await db.tags.update(id, { name: v.trim() });
              else await renameTaxonomy(kind, id, v);
            }
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      ) : (
        <span className="flex-1 text-[13.5px]">{kind === 'tags' ? `#${name}` : name}</span>
      )}
      {usage != null && usage >= 0 && <span className="text-[11.5px] text-faint">{usage} uses</span>}
      <button className="icon-btn h-7 w-7 opacity-0 group-hover:opacity-100" aria-label={`Rename ${name}`} onClick={() => setEditing(true)}>
        <Pencil size={13} />
      </button>
      <button
        className="icon-btn h-7 w-7 opacity-0 group-hover:opacity-100"
        aria-label={`Delete ${name}`}
        onClick={async () => {
          if (!confirm(`Delete “${name}”${usage ? ` (used ${usage} times)` : ''}?`)) return;
          try {
            if (kind === 'tags') await deleteTag(id);
            else await deleteTaxonomy(kind, id);
          } catch (e) {
            toast(errorText(e), 'error');
          }
        }}
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

function Preferences() {
  const [remote, setRemote] = useRemoteThumbs();
  return (
    <Section title="Preferences">
      <label className="flex max-w-2xl items-start gap-3 text-[13.5px]">
        <input type="checkbox" checked={remote} onChange={(e) => setRemote(e.target.checked)} className="mt-1" />
        <span>
          Show YouTube thumbnails
          <span className="block text-[12.5px] text-muted">Loads preview images from i.ytimg.com when online. Turn off to keep the app fully offline — your own captured frames are always used first.</span>
        </span>
      </label>
    </Section>
  );
}

function About() {
  const seededAt = useLiveQuery(() => db.meta.get('seededAt'), []);
  return (
    <Section title="Provenance & research log">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2 text-[13.5px]">
          <p className="flex items-center gap-2">
            <ProvenanceBadge value="verified" /> confirmed against the original source.
          </p>
          <p className="flex items-center gap-2">
            <ProvenanceBadge value="inferred" /> an observation or interpretation, not confirmed.
          </p>
          <p className="flex items-center gap-2">
            <ProvenanceBadge value="reference" /> general production knowledge.
          </p>
          <p className="flex items-center gap-2">
            <ProvenanceBadge value="user" /> entered by you.
          </p>
        </div>
        <div className="text-[13px] text-muted">
          <p>
            Seed data was prepared on 2026-10-30{seededAt?.value ? ` and loaded into this browser on ${new Date(String(seededAt.value)).toLocaleDateString()}` : ''}. The research environment blocked instagram.com and youtube.com, so:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>the five Instagram reels are pending inspection, with no analysis;</li>
            <li>creators are candidates described from web-search sources (listed on each creator);</li>
            <li>breakdown URLs and titles come from search results and have not been watched — no timestamps or transcripts are recorded;</li>
            <li>technique entries are reference definitions; examples are only linked when verified.</li>
          </ul>
        </div>
      </div>
    </Section>
  );
}

function Danger() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  return (
    <Section title="Reset">
      <button className="btn-danger" onClick={() => setOpen(true)}>
        <Trash2 size={14} /> Erase library and reload the starter data
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Erase everything?"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              className="btn-danger"
              disabled={typed !== 'ERASE'}
              onClick={async () => {
                await db.transaction('rw', db.tables, async () => {
                  for (const t of db.tables) await t.clear();
                });
                await ensureSeeded(db);
                setOpen(false);
                setTyped('');
                toast('Library reset');
              }}
            >
              Erase library
            </button>
          </>
        }
      >
        <p className="mb-3 text-[13.5px]">This deletes every record, image and video in this browser. It cannot be undone. Export a backup first.</p>
        <Field label='Type "ERASE" to confirm'>
          <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} />
        </Field>
      </Modal>
    </Section>
  );
}
