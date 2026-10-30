import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { BookOpen, CheckCircle2, CircleDashed, Heart, User, X } from 'lucide-react';
import type { Provenance } from '@/db/types';

// ───────────────────────────── Layout

export function PageHeader({
  eyebrow,
  title,
  lede,
  actions,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="mb-8 fade-in">
      {eyebrow && <div className="label mb-3">{eyebrow}</div>}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-[44px] leading-[1.02] md:text-[56px] break-words">{title}</h1>
          {lede && <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">{lede}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

export function Section({
  title,
  action,
  children,
  className,
  count,
}: {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  count?: number;
}) {
  return (
    <section className={clsx('mb-12', className)}>
      <div className="mb-4 flex items-baseline justify-between gap-4 border-b border-line pb-2">
        <h2 className="text-[26px] leading-tight">
          {title}
          {count != null && <span className="ml-2 align-top font-sans text-[12px] text-faint">{count}</span>}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-6 py-10 text-center">
      <p className="font-serif text-[22px]">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-[13.5px] text-muted">{children}</div>}
      {action && <div className="mt-4 flex justify-center gap-2">{action}</div>}
    </div>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={clsx('block', className)}>
      <span className="label mb-1.5 block">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-faint">{hint}</span>}
    </label>
  );
}

export function Tabs<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; count?: number }[];
  className?: string;
}) {
  return (
    <div className={clsx('-mx-1 flex gap-1 overflow-x-auto pb-1', className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx(value === o.value ? 'chip-active' : 'chip hover:border-ink/40 hover:text-ink', 'shrink-0 px-3 py-1')}
        >
          {o.label}
          {o.count != null && <span className={clsx('text-[11px]', value === o.value ? 'text-paper/70' : 'text-faint')}>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ───────────────────────────── Badges

const PROV: Record<Provenance, { label: string; title: string; cls: string; Icon: typeof CheckCircle2 }> = {
  verified: { label: 'Verified', title: 'Confirmed against the original source', cls: 'text-verified border-verified/40', Icon: CheckCircle2 },
  inferred: { label: 'Inferred', title: 'Observation or interpretation — not confirmed', cls: 'text-inferred border-inferred/50 border-dashed', Icon: CircleDashed },
  reference: { label: 'Reference', title: 'General domain knowledge', cls: 'text-muted border-line', Icon: BookOpen },
  user: { label: 'Yours', title: 'Entered by you', cls: 'text-muted border-line', Icon: User },
};

export function ProvenanceBadge({ value, className }: { value: Provenance; className?: string }) {
  const p = PROV[value];
  return (
    <span title={p.title} className={clsx('inline-flex items-center gap-1 rounded-full border px-2 py-[1px] text-[11px] font-medium', p.cls, className)}>
      <p.Icon size={11} strokeWidth={2} />
      {p.label}
    </span>
  );
}

export function ProvenanceSelect({ value, onChange }: { value: Provenance; onChange: (v: Provenance) => void }) {
  return (
    <div className="inline-flex rounded-full border border-line p-0.5 text-[12px]">
      {(['verified', 'inferred'] as const).map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={clsx('rounded-full px-2.5 py-0.5', value === p ? (p === 'verified' ? 'bg-verified text-paper' : 'bg-inferred text-paper') : 'text-muted')}
        >
          {PROV[p].label}
        </button>
      ))}
    </div>
  );
}

export function Difficulty({ value }: { value: 1 | 2 | 3 }) {
  const label = ['', 'Beginner', 'Intermediate', 'Advanced'][value];
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-muted" title={`Difficulty: ${label}`}>
      <span className="flex gap-0.5">
        {[1, 2, 3].map((i) => (
          <span key={i} className={clsx('h-1.5 w-3 rounded-full', i <= value ? 'bg-ink' : 'bg-line')} />
        ))}
      </span>
      {label}
    </span>
  );
}

export function FavoriteButton({ active, onClick, className }: { active: boolean; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? 'Remove from favorites' : 'Add to favorites'}
      title={active ? 'Favorite' : 'Mark as favorite'}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className={clsx('icon-btn', active && 'text-accent hover:text-accent', className)}
    >
      <Heart size={16} fill={active ? 'currentColor' : 'none'} />
    </button>
  );
}

// ───────────────────────────── Overlays

function useEscape(onClose: () => void, active = true) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, active]);
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEscape(onClose, open);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 pt-[8vh] backdrop-blur-[2px]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        onMouseDown={(e) => e.stopPropagation()}
        className={clsx('fade-in w-full rounded-2xl border border-line bg-panel shadow-2xl', wide ? 'max-w-3xl' : 'max-w-lg')}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-[22px]">{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Popover({
  trigger,
  children,
  align = 'right',
  width = 260,
}: {
  trigger: (props: { onClick: () => void; 'aria-expanded': boolean }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'left' | 'right';
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEscape(() => setOpen(false), open);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);
  return (
    <div className="relative inline-block" ref={ref}>
      {trigger({ onClick: () => setOpen((o) => !o), 'aria-expanded': open })}
      {open && (
        <div
          className={clsx('fade-in absolute z-40 mt-1.5 rounded-xl border border-line bg-panel p-1.5 shadow-xl', align === 'right' ? 'right-0' : 'left-0')}
          style={{ width }}
          onClick={(e) => e.stopPropagation()}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ children, onClick, danger, active }: { children: ReactNode; onClick: () => void; danger?: boolean; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] hover:bg-ink/[0.05]',
        danger && 'text-accent',
        active && 'font-medium',
      )}
    >
      {children}
    </button>
  );
}

/** Two-step destructive button: first click arms, second confirms. */
export function ConfirmButton({ onConfirm, children, label = 'Click again to confirm', className }: { onConfirm: () => void; children: ReactNode; label?: string; className?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button type="button" className={clsx('btn-danger', className)} onClick={() => (armed ? onConfirm() : setArmed(true))}>
      {armed ? label : children}
    </button>
  );
}

// ───────────────────────────── Toasts

type ToastMsg = { id: number; text: string; tone: 'info' | 'error' };
let push: ((t: ToastMsg) => void) | null = null;
let seq = 0;

export function toast(text: string, tone: 'info' | 'error' = 'info') {
  push?.({ id: ++seq, text, tone });
}

export function Toaster() {
  const [items, setItems] = useState<ToastMsg[]>([]);
  useEffect(() => {
    push = (t) => {
      setItems((xs) => [...xs, t]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== t.id)), 3800);
    };
    return () => {
      push = null;
    };
  }, []);
  return createPortal(
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2" aria-live="polite">
      {items.map((t) => (
        <div
          key={t.id}
          className={clsx('fade-in pointer-events-auto rounded-full px-4 py-2 text-[13px] shadow-lg', t.tone === 'error' ? 'bg-accent text-paper' : 'bg-ink text-paper')}
        >
          {t.text}
        </div>
      ))}
    </div>,
    document.body,
  );
}

export function errorText(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}
